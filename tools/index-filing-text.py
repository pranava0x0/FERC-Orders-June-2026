#!/usr/bin/env python3
"""Index public post-order originals by physical page and lexical token. See sources/filings/reader-spec.md."""
import argparse
from hashlib import sha256
import json
import logging
from pathlib import Path
import re
from xml.etree import ElementTree as ET
from zipfile import ZipFile

import fitz

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs/reading"
SRC = ROOT / "sources/filings"
TOKEN = re.compile(r"[^\W_]+(?:[’'-][^\W_]+)*", re.UNICODE)
HEADING = re.compile(r"^(?:[IVX]{1,6}\.|[A-H]\.)\s+[A-Z][\w‘“].{2,125}$")
LABEL = re.compile(r"^(?:INTRODUCTION|BACKGROUND|DISCUSSION|CONCLUSION|TABLE OF CONTENTS|REQUEST FOR RELIEF|CERTIFICATE OF SERVICE|SUMMARY|EXECUTIVE SUMMARY|Attachment [A-Z](?:\s*[-–:].*)?)$", re.I)
ELI = "https://elibrary.ferc.gov/eLibrary/filelist?accession_number="

def read(path: Path) -> object:
    return json.loads(path.read_text())

def clean(text: str) -> str:
    return " ".join(text.split())

def inventory() -> list[dict]:
    manifest = read(ROOT / "sources/abeyance-manifest.json")["documents"]
    filings = read(SRC / "tenets.json")["groups"]
    groups = {d["slug"]:(g["title"],d["filer"]) for g in filings for d in g["docs"]}
    rows = []
    for d in manifest:
        group, who = groups.get(d["slug"], (d.get("rto", "") + " filings" if d.get("rto") else d["docket"] + " filings", d.get("filer","")))
        rows.append(dict(slug=d["slug"],title=d["title"],issued=d["issued"],accession=d["accession"],docket=d["docket"],group=group,
                         filer=who,kind=d["kind"],file="sources/originals/"+d["source_file"],url=d.get("source_url") or ELI+d["accession"]))
    for d in read(ROOT / "sources/orders-extract.json")["orders"]:
        path, = (ROOT/"docs/orders").glob(d["item"].lower()+"-*.pdf")
        rows.append(dict(slug=path.stem,title=d["rto"]+(" co-location rehearing order" if d["item"]=="E-2" else " show cause order"),
                         issued="2026-06-18", docket=d["docket"],filer="FERC",group="June 18 orders",kind="order",
                         file=str(path.relative_to(ROOT)), url="https://www.ferc.gov/media/"+(d["item"].replace("-","") if d["item"] in ("E-11","E-12") else d["item"]).lower()+"-"+d["docket"].lower()))
    for d in read(SRC/"other-originals.json"):
        rows.append(dict(**d, file="sources/originals/"+d["filename"],kind="stakeholder document"))
    parents = {d["slug"]:d for d in rows}
    for f in [SRC/"attachments.json", SRC/"regional-attachments.json"]:
        if not f.exists():
            continue
        for a in read(f):
            par=parents[a["parent"]]
            rows.append(dict(par,slug=a.get("slug",Path(a["filename"]).stem),title=a["label"],parent=a["parent"],
                             **({"text_file":a["text_file"]} if a.get("text_file") else {}),kind="attachment",url=a["url"],file="sources/originals/"+a["filename"]))
    f=ROOT/"sources/videos/hearings/manifest.json"
    if f.exists():
        for d in read(f):
            rows.append(dict(**d, file=str((f.parent/d["filename"]).relative_to(ROOT)),kind="hearing transcript",group="Congressional testimony"))
    mixed=read(SRC/"image-inserts.json")
    for r in rows:
        if r["slug"] in mixed: r["text_file"]=mixed[r["slug"]]
    if not set(mixed)<=set(r["slug"] for r in rows): raise ValueError("Orphan OCR insert sidecar")
    if len(rows)!=len({r["slug"] for r in rows}):
        raise ValueError("Duplicate reader slug")
    if any(not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*",r["slug"]) for r in rows):
        raise ValueError("Unsafe reader slug")
    return sorted(rows,key=lambda r:r["slug"])

def docx_text(path: Path) -> str:
    with ZipFile(path) as z:
        doc=ET.fromstring(z.read("word/document.xml"))
    return "\n".join("".join(e.text or "" for e in p.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t")) for p in doc.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p"))

def source_pages(rec: dict) -> tuple[list[str],list[tuple[int,str]]]:
    path=ROOT/rec["file"]
    if path.suffix.lower()==".docx":
        return [docx_text(path)],[]
    with fitz.open(path) as pdf:
        pages=[p.get_text().strip() for p in pdf]
        marks=[(n,clean(t)) for _,t,n in pdf.get_toc() if 1<=n<=len(pages) and clean(t)]
    # Reviewed transcripts may supplement the PDF text layer with page-separated OCR.
    if rec.get("text_file"):
        textpath=path.parent / rec["text_file"]
        chunks=re.split(r"^--- PAGE (\d+) ---\s*$",textpath.read_text(),flags=re.M)
        extracted={int(chunks[i]):chunks[i+1].strip() for i in range(1,len(chunks),2)}
        if set(extracted)!=set(range(1,len(pages)+1)): raise ValueError(f"{textpath}: incomplete page coverage")
        pages=list(extracted[i] for i in range(1,len(pages)+1))
    return pages,marks

def sections(pages: list[str], bookmarks: list[tuple[int,str]], paginated: bool) -> list[dict]:
    # A boundary needs a source heading, not an inferred policy conclusion. Inspect positions
    # inside the page as well: two opposing holdings can share the same physical page.
    starts, source = {}, "printed heading"
    bmap={}
    for pg,title in bookmarks: bmap.setdefault(pg,[]).append(title)
    for pg,text in enumerate(pages,1):
        for title in bmap.get(pg,[]):
            key=r"\s+".join(map(re.escape,title.split()))
            m=re.search(key,text,re.I)
            if m: starts[(pg,m.start())]=(title,"PDF bookmark")
        for m in re.finditer(r"[^\n]+",text):
            line=clean(m[0])
            if re.fullmatch(r"(?:[IVX]{1,6}|[A-H])\.",line):
                rest=text[m.end():].lstrip().splitlines()
                if rest: line+=" "+clean(rest[0])
            if (HEADING.fullmatch(line) or LABEL.fullmatch(line)) and not re.search(r"\.{2,}|\s\d+$",line):
                starts.setdefault((pg,m.start()),(line,source))
    if not starts:
        for pg in range(1,len(pages)+1,4):
            end=min(pg+3,len(pages))
            starts[(pg,0)]=(f"Pages {pg} to {end}" if end>pg else ("Document text" if not paginated else f"Page {pg}"),"page range" if paginated else "document text")
    if (1,0) not in starts: starts[(1,0)]=("Opening text", "opening text")
    # Resolve whitespace-indented headings that coincide with a PDF bookmark.
    ordered=[]
    for (pg,off),(title,method) in sorted(starts.items()):
        if ordered and ordered[-1]["p"]==pg and not pages[pg-1][ordered[-1]["at"]:off].strip():
            if method=="PDF bookmark" or ordered[-1]["method"]!="PDF bookmark": ordered.pop()
            else: continue
        ordered.append(dict(p=pg,at=off,title=title,method=method))
    return ordered

def generate(rec: dict) -> tuple[dict,dict]:
    path=ROOT/rec["file"]
    pages,marks=source_pages(rec)
    if not pages: raise ValueError(f"{path}: no pages")
    ns=[len(TOKEN.findall(p)) for p in pages]
    starts=[]; total=0
    for count in ns:
        starts.append(total);total+=count
    paginated=path.suffix.lower()==".pdf"
    row=dict(rec,sha256=sha256(path.read_bytes()).hexdigest(),pages=len(pages) if paginated else None,
             tokens=total,emptyPages=[i+1 for i,n in enumerate(ns) if not n])
    parts=sections(pages,marks,paginated)
    for i,s in enumerate(parts):
        n=parts[i+1] if i+1<len(parts) else {"p":len(pages),"at":len(pages[-1])}
        s["endPage"],s["endAt"]=n["p"],n["at"]
        s["startToken"]=starts[s["p"]-1]+len(TOKEN.findall(pages[s["p"]-1][:s["at"]]))
    for i,s in enumerate(parts): s["endToken"]=parts[i+1]["startToken"] if i+1<len(parts) else total
    return row,dict(document=row,pages=[dict(page=i+1,startToken=starts[i],endToken=starts[i]+ns[i],text=p) for i,p in enumerate(pages)],sections=parts)

def emit(path: Path,obj: object,check: bool) -> None:
    data=(json.dumps(obj,ensure_ascii=False,separators=(",",":"))+"\n").encode()
    if path.exists() and path.read_bytes()==data: return
    if check: raise ValueError(f"stale or missing: {path.relative_to(ROOT)}")
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_bytes(data)

def main() -> None:
    arg=argparse.ArgumentParser(description=__doc__)
    arg.add_argument("--check",action="store_true");arg.add_argument("--tokens",metavar="DOCUMENT");arg.add_argument("--only",metavar="DOCUMENT")
    args=arg.parse_args(); rows=inventory()
    selected=args.tokens or args.only
    if selected:
        rows=[r for r in rows if r["slug"]==selected]
        if not rows: arg.error("unknown document slug")
    manifest=[]
    for rec in rows:
        row,data=generate(rec);manifest.append(row)
        if args.tokens:
            for p in data["pages"]:
                for i,m in enumerate(TOKEN.finditer(p["text"]),p["startToken"]):
                    import sys
                    sys.stdout.write(json.dumps([i,p["page"],m.start(),m.end(),m[0]],ensure_ascii=False)+"\n")
            return
        emit(OUT/row["slug"]/"source.json",data,args.check)
    if not selected:
        unmatched={p.name for p in (ROOT/"sources/originals").iterdir() if p.suffix.lower() in (".pdf",".docx")}-{Path(r["file"]).name for r in manifest}
        if unmatched: raise ValueError("unindexed originals: "+", ".join(sorted(unmatched)))
        orphan={p.parent.name for p in OUT.glob("*/source.json")}-{r["slug"] for r in manifest}
        if orphan: raise ValueError(f"orphan reader outputs: {sorted(orphan)}")
        emit(OUT/"catalog.json",manifest,args.check)
    logging.warning("%d originals; %d lexical tokens; %d pages with no extractable words",len(rows),sum(r["tokens"] for r in manifest),sum(len(r["emptyPages"]) for r in manifest))

if __name__=="__main__": main()
