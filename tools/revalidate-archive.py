#!/usr/bin/env python3
"""Offline source audit. --write regenerates the report; --check compares it to the committed report.
--write-ocr and --check-ocr separately render the four scanned RM26-4 filings (macOS Vision).
None of these actions changes a signed original, historic extraction, quote or summary.
Requires Python 3.9+, PyMuPDF and Node; only OCR regeneration requires Swift/macOS.
"""
from __future__ import annotations

import argparse
from collections import Counter
import gzip
from hashlib import sha256
from html.parser import HTMLParser
import importlib.util
import json
import logging
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import unicodedata
from xml.etree import ElementTree as ET
from zipfile import ZipFile

import fitz

ROOT = Path(__file__).resolve().parents[1]
S = ROOT / "sources"
C = S / "comments"
OUT = S / "filings/archive-validation.json"
SCAN = ("20251121-5140", "20251121-5224", "20251121-5521", "20251205-5005")
ETI = "20251121-5225"
MARK = re.compile(r"^--- PAGE (\d+) ---[ \t]*\r?$", re.M)
log = logging.getLogger("archive")


def read(path: Path) -> object:
    return json.loads(path.read_text(encoding="utf-8"))


def fingerprint(path: Path) -> str:
    return sha256(path.read_bytes()).hexdigest()


def normalized(text: str) -> str:
    return " ".join(text.split())


def relative(path: Path) -> str:
    return str(path.relative_to(ROOT))


def pages(text: str) -> tuple[list[int], list[str]]:
    fields = MARK.split(text)
    return [int(n) for n in fields[1::2]], fields[2::2]


def pdf_comparison(actual: list[str], saved: str) -> dict:
    markers, extracted = pages(saved)
    if not actual or markers != list(range(1, len(actual) + 1)):
        return dict(status="invalid-page-markers", pages=len(actual), markers=markers)
    blank, changed = [], []
    for n, (page, text) in enumerate(zip(actual, extracted), 1):
        if not normalized(page):
            blank.append(n)
        if normalized(page) != normalized(text):
            changed.append(n)
    result = dict(status="different" if changed else "matches", pages=len(actual))
    if len(blank) == len(actual) and not changed:
        result["status"] = "no-text-layer"
    if blank:
        result["emptyTextLayerPages"] = blank
    if changed:
        result["differingPages"] = changed
    return result


def docx_words(path: Path) -> list[str]:
    ns = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
    with ZipFile(path) as source:
        root = ET.fromstring(source.read("word/document.xml"))
    runs = (el.text or "" if el.tag == ns + "t" else " " if el.tag in {ns+"p", ns+"tab", ns+"br"} else ""
            for el in root.iter())
    return words("".join(runs))


def words(text: str) -> list[str]:
    return [w for w in unicodedata.normalize("NFKC", text).split() if w != "•"]


class VisibleHTML(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.chunks: list[str] = []
        self.hidden = False

    def handle_starttag(self, tag: str, attrs: list) -> None:
        if tag in {"script", "style"}:
            self.hidden = True

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style"}:
            self.hidden = False

    def handle_data(self, data: str) -> None:
        if not self.hidden:
            self.chunks.append(data)


def match_name(name: str) -> str:
    # Documented browser download transforms; never fall back to "first PDF in the accession".
    p = Path(name)
    stem = re.sub(r" \(\d+\)$", "", p.stem.split(";")[0])
    return normalized(stem).casefold() + p.suffix.casefold()


def compare(path: Path, text: Path, header: bool = False) -> dict:
    result = {"file": relative(path), "text": relative(text)}
    if path.is_file():
        result["sha256"] = fingerprint(path)
    if text.is_file():
        result["textSha256"] = fingerprint(text)
    if not path.is_file() or not text.is_file():
        return dict(result, status="missing-original" if not path.is_file() else "missing-text")
    body = text.read_text(encoding="utf-8")
    ext = path.suffix.lower()
    if ext == ".pdf":
        with fitz.open(path) as doc:
            result.update(pdf_comparison([p.get_text() for p in doc], body))
    elif ext == ".docx":
        if header:
            # Two provenance lines and blank line(s) precede the extracted Word document.
            body = body.partition("\n\n")[2]
        src = docx_words(path)
        result.update(status="matches" if src and src == words(body) else "different", words=len(src))
    elif ext == ".html":
        payload = path.read_bytes()
        if payload.startswith(b"\x1f\x8b"):
            payload = gzip.decompress(payload)
        parser = VisibleHTML()
        parser.feed(payload.decode("utf-8"))
        parser.close()
        html = normalized(" ".join(parser.chunks))
        result["status"] = "matches" if html and html == normalized(body) else "different"
    else:
        result["status"] = "unsupported"
    return result


def scan_pdf(acc: str) -> Path:
    found = [p for p in (C / "files").glob(acc + "*/*") if p.suffix.lower() == ".pdf"]
    if len(found) != 1:
        raise ValueError(f"{acc}: expected one scanned original; found {len(found)}")
    return found[0]


def sidecar(acc: str) -> Path:
    return C / "ocr" / (acc + ".txt")


def ocr_header(acc: str, path: Path) -> str:
    return (f"Machine OCR, unreviewed | RM26-4 | {acc}\n"
            f"Source: {relative(path)}\nSHA-256: {fingerprint(path)}\n"
            "Apple Vision revision 3, English, accurate; grayscale at 144 dpi. Check quotations against the scanned page.\n\n")


def run_ocr(write: bool) -> int:
    with tempfile.TemporaryDirectory() as temp:
        scratch = Path(temp)
        recognizer = scratch / "recognize"
        subprocess.run(["swiftc", str(S / "videos/hearings/recognize.swift"), "-o", str(recognizer)], check=True)
        for acc in SCAN:
            source = scan_pdf(acc)
            images = []
            with fitz.open(source) as doc:
                for n, page in enumerate(doc, 1):
                    image = scratch / f"{acc}-{n}.png"
                    page.get_pixmap(matrix=fitz.Matrix(2, 2), colorspace=fitz.csGRAY).save(image)
                    images.append(image)
            subprocess.run([str(recognizer), *map(str, images)], check=True)
            body = ocr_header(acc, source)
            for n, image in enumerate(images, 1):
                transcription = Path(str(image)+".txt").read_text().strip()
                body += f"--- PAGE {n} ---\n{transcription}\n\n"
            if not any(ch.isalpha() for ch in pages(body)[1][0]):
                raise ValueError(f"{acc}: first page yielded no substantive transcription")
            dest = sidecar(acc)
            if write:
                dest.parent.mkdir(exist_ok=True)
                dest.write_text(body, encoding="utf-8")
            elif not dest.exists() or dest.read_text() != body:
                raise ValueError(f"{acc}: OCR sidecar differs; check the original before replacing it")
            log.info("%s: %s OCR pages", acc, len(images))
    if not write:
        # The GPO hearing extractor also pins Vision revision and physical pages.
        subprocess.run([sys.executable,str(S/"videos/hearings/extract.py"),"--check"],check=True)
    return 0


def comment_archive(only: str | None = None) -> list[dict]:
    inventory = read(C / "rm26-4-files.json")["files"]
    corpus = {c["acc"] for c in read(C / "rm26-4-comments.json")["comments"]}
    if not inventory or set(inventory) != corpus:
        raise ValueError("The comment docket and file inventory disagree")
    if only is not None and only not in corpus:
        raise ValueError(f"{only}: not a known RM26-4 comment accession")
    rows, seen = [], set()
    for acc, files in sorted(inventory.items()):
        if only and acc != only:
            continue
        candidates = sorted(p for p in (C/"files").glob(acc+"*/*") if p.is_file())
        names = set()
        if not files:
            rows.append(dict(accession=acc, status="inventory-empty"))
        for item in files:
            label = item["name"]
            exact = [p for p in candidates if p.name == label]
            found = exact or [p for p in candidates if match_name(p.name) == match_name(label)]
            row = dict(accession=acc, listed=label)
            if len(found) != 1:
                row["status"] = "ambiguous-filename" if found else "missing-original"
                if acc == ETI and not found:
                    row.update(status="unavailable-from-ferc",
                               reason="eLibrary: erroneously filed; Availability_Mode N. Separate public ETI comments: 20251121-5350.",
                               url="https://elibrary.ferc.gov/eLibrary/filelist?accession_Number=20251121-5225")
            else:
                p, = found
                if p in names:
                    raise ValueError(f"{acc}: inventory entries resolve to the same original: {label}")
                names.add(p)
                seen.add(p)
                if p.suffix.lower() == ".txt":
                    row.update(file=relative(p), sha256=fingerprint(p), status="original-text" if p.read_text().strip() else "empty-original-text")
                else:
                    t = p.with_suffix(".txt")
                    row.update(compare(p, t))
                    seen.add(t)
                    if acc in SCAN and row["status"] in {"matches","no-text-layer"}:
                        o = sidecar(acc)
                        row["status"] = "scan-without-ocr"
                        if o.exists():
                            text = o.read_text()
                            numbers, parts = pages(text)
                            valid = (numbers == list(range(1, row["pages"]+1)) and text.startswith(ocr_header(acc, p))
                                     and sum(len(normalized(part)) for part in parts) >= 200)
                            row.update(status="scan-with-ocr-sidecar" if valid else "invalid-ocr-sidecar",
                                       ocr=relative(o), ocrSha256=fingerprint(o),
                                       ocrEmptyPages=[i for i, part in enumerate(parts,1) if not part.strip()])
            rows.append(row)
    remaining = (C/"files").glob(only+"*/*") if only else (C/"files").rglob("*")
    for p in sorted(remaining):
        if not p.is_file() or p in seen or p.name == ".DS_Store":
            continue
        aliases = [f for f in seen if f.parent == p.parent and f.is_file() and f.suffix == ".txt"
                   and p.read_bytes() == f.read_bytes()]
        row = dict(file=relative(p), accession=p.parent.name.split("__")[0], sha256=fingerprint(p))
        rows.append(dict(row, status="duplicate-text", sameAs=relative(sorted(aliases)[0])) if aliases
                    else dict(row, status="uninventoried-file"))
    return rows


def summary_archive(only: str | None = None) -> dict:
    # Reuse the exact project vocabulary, coverage and page-location algorithms, not a weaker reimplementation.
    js = """
import {readFileSync,readdirSync} from 'node:fs';
import {validate} from './tools/validate-summaries.mjs';
import {buildPageIndex,pageForQuote} from './tools/stamp-comment-pages.mjs';
const folder='sources/comments/summaries-v2/';
const results=readdirSync(folder).filter(f=>f.endsWith('.json')&&(!process.argv[1]||f===process.argv[1]+'.json')).sort().map(f=>{
  const s=JSON.parse(readFileSync(folder+f)),r=validate(f),idx=buildPageIndex(readFileSync(s.source_text,'utf8'));
  const pageErrors=s.quotes.filter(q=>pageForQuote(q.text,idx)!==q.page).map(q=>q.id);
  return {accession:s.accession,quotes:s.quotes.length,paged:s.quotes.filter(q=>q.page!=null).length,
    ...(r.errs.length?{errors:r.errs}:{}),...(r.lowQuotes.length?{lowCoverage:r.lowQuotes}:{}),
    ...(pageErrors.length?{pageErrors}:{}),status:r.errs.length||r.lowQuotes.length||pageErrors.length?'review':'matches-project-checks'};
});process.stdout.write(JSON.stringify(results));
"""
    result = subprocess.run(["node","--input-type=module","-e",js,*([only] if only else [])],cwd=ROOT,capture_output=True,text=True,check=True)
    current = json.loads(result.stdout)
    if not current and not only:
        raise ValueError("No current summaries")
    legacy = []
    for f in sorted((C/"summaries").glob(only+".json" if only else "*.json")):
        rec = read(f)
        # V1 predates V2: no vocabulary or bin lint contract. Check quotes only on their cited pages.
        sources = [p for p in (C/"files").glob(rec["accession"]+"*/*") if p.suffix.lower()==".txt"]
        texts = [p.read_text() for p in sources]
        legacy_quotes = []
        for q in rec["quotes"]:
            pg = q.get("page")
            cited = [part for txt in texts for n,part in zip(*pages(txt)) if n == pg]
            raw = normalized(q["text"])
            if pg is None and raw and any(not pages(t)[0] and raw in normalized(t) for t in texts):
                status = "exact-in-unpaginated-source"
            elif not cited:
                status = "no-paginated-source"
            elif any(raw in normalized(p) for p in cited):
                status = "exact-on-page"
            else:
                status = "not-exact-on-cited-page"
            legacy_quotes.append(dict(page=pg,status=status))
        legacy.append(dict(accession=rec["accession"],status="legacy-no-v2-lint",quotes=legacy_quotes))
    all_acc = {r["acc"] for r in read(C/"rm26-4-comments.json")["comments"]}
    if only:
        all_acc &= {only}
    return dict(current=current, missingCurrent=sorted(all_acc-{r["accession"] for r in current}), legacy=legacy)


def original_archive() -> dict:
    result = {}
    orders = []
    for row in read(S/"orders-extract.json")["orders"]:
        options = list((ROOT/"docs/orders").glob(row["item"].lower()+"-*.pdf"))
        if len(options) != 1:
            raise ValueError(f"{row['item']}: expected one published order, found {len(options)}")
        p, = options
        orders.append(dict(item=row["item"],**compare(p,S/"text/orders"/(p.stem+".txt"))))
    if not orders:
        raise ValueError("No order inventory")
    result["juneOrders"] = orders
    result["postOrderFilings"] = [dict(accession=r["accession"],slug=r["slug"],
                                      **compare(S/"originals"/r["source_file"],ROOT/r["text"],True))
                                  for r in read(S/"abeyance-manifest.json")["documents"]]
    manifest = read(S/"manifest.json")["sources"]
    result["archivedHTML"] = [dict(id=r["id"],**compare(S/"archived"/(Path(r["text"]).stem+".html"),ROOT/r["text"]))
                               for r in manifest if "archive_url" in r and "text" in r]
    doe = compare(S/"pdf/doe-403-large-loads-letter.pdf",S/"text/doe-403-full.txt")
    if doe["status"] == "different":
        doe.update(status="historic-ocr-differs", note="The original PDF has an embedded text layer. The historic OCR is retained verbatim; its line breaks, spacing and some characters differ.")
        with fitz.open(ROOT/doe["file"]) as pdf:
            _, saved = pages((ROOT/doe["text"]).read_text())
            doe["identicalIgnoringAllWhitespace"] = [i for i,(pg,t) in enumerate(zip(pdf,saved),1)
                                                     if "".join(pg.get_text().split())=="".join(t.split())]
    result["doeLetter"] = doe
    index = S/"text/doe-403-key-extract.txt"
    result["doeEditorialIndex"] = dict(file=relative(index), sha256=fingerprint(index),status="paraphrased-index")
    statements = []
    pjm = normalized((S/"text/orders/e-7-pjm-el26-67-000.txt").read_text())
    for p in sorted((S/"commissioners").glob("*-statement.txt")):
        body = normalized(p.read_text().partition("\n\n")[2])
        statements.append(dict(file=relative(p),sha256=fingerprint(p),
                               status="matches-pjm-order" if body and body in pjm else "different"))
    result["commissionerStatements"] = statements
    return result


def videos_archive() -> list[dict]:
    """Raw caption cues were preserved only for some videos. Never infer authenticity from a timestamp."""
    rows = []
    code = importlib.util.spec_from_file_location("archive_captions", ROOT/"tools/fetch-video-transcripts.py")
    mod = importlib.util.module_from_spec(code)
    code.loader.exec_module(mod)
    for video in read(S/"videos/manifest.json"):
        vid = video["id"]
        p = S/"videos/text"/(vid+".txt")
        track = "en" if video.get("captionSource") == "publisher" else "en-orig"
        raw = S/"videos/cues"/f"{vid}.{track}.json3"
        if video.get("transcriptSlug"):
            base = S/"videos/hearings"/video["transcriptSlug"]
            original, transcript = base.with_suffix(".pdf"), base.with_suffix(".txt")
            row = dict(video=vid, **compare(original, transcript))
            if row["status"] == "different":
                # The hearing extractor augments only short embedded pages that actually have images.
                with fitz.open(original) as pdf:
                    eligible = [i for i,pg in enumerate(pdf,1) if len(pg.get_text().strip())<120 and pg.get_images()]
                if set(row["differingPages"]) <= set(eligible):
                    row.update(status="printed-hearing-with-ocr", ocrPages=row.pop("differingPages"),
                               verification="python3 sources/videos/hearings/extract.py --check")
            rows.append(row)
            continue
        row = dict(video=vid,text=relative(p))
        if not p.is_file():
            row["status"] = "missing-text"
        elif raw.is_file():
            expected = mod.render(video,raw,track,track=="en")
            row.update(status="matches" if expected == p.read_text() else "different",file=relative(raw),
                       sha256=fingerprint(raw),textSha256=fingerprint(p))
        else:
            row.update(status="transcript-only",textSha256=fingerprint(p))
        rows.append(row)
    june = S/"commissioners/open-meeting-transcript.txt"
    rows.append(dict(video="r7y-iDn-rkU",text=relative(june),textSha256=fingerprint(june),status="transcript-only"))
    return rows


def audit() -> dict:
    report = original_archive()
    report["commentFiles"] = comment_archive()
    report["summaries"] = summary_archive()
    report["captionTranscripts"] = videos_archive()
    # Files with independent, dedicated validators. Record success, not OS paths or log timestamps.
    commands = [
        [sys.executable,"tools/validate-comments.py"],[sys.executable,"tools/extract-abeyance-docs.py","--check"],
        [sys.executable,"tools/fetch-video-transcripts.py","--check"],[sys.executable,"tools/index-filing-text.py","--check"],
        ["node","tools/verify-quotes.mjs"],["node","tools/verify-record.mjs"],["node","tools/verify-commish-tailoring.mjs"]
    ]
    checks = []
    for cmd in commands:
        r = subprocess.run(cmd,cwd=ROOT,text=True,capture_output=True)
        checks.append(dict(command=" ".join(["python3" if cmd[0]==sys.executable else cmd[0],*cmd[1:]]),exit=r.returncode))
        if r.returncode:
            log.error("%s failed: %s",cmd[1],(r.stderr or r.stdout)[-700:])
    report["checks"] = checks
    report["scope"] = {
        "originals":"June orders, abeyance-manifest submissions, RM26-4 inventoried files, DOE letter and FERC HTML snapshots. Supplemental tariff exhibits, stakeholder documents and the Senate hearing use the filing reader's separate all-original index.",
        "match":"PDF: every physical page, markers in order, case and punctuation preserved, whitespace folded. DOCX: document XML word sequence, NFKC and layout bullets normalized; no page numbers. HTML: visible text nodes, script/style excluded.",
        "ocr":"Machine OCR is an unreviewed search aid. Historical blank or incomplete source text layers remain intact. --check-ocr independently rerenders four comment filings and the GPO hearing on macOS.",
        "summaries":"Current summaries: the project validator's quoted-run coverage and original bin/style contract, plus independent recomputation of every cited start page. These checks do not certify paraphrases or stances. Legacy summaries: strict quote-on-cited-page check only.",
        "localOnly":"The untracked ferc-one-pager.pdf browser print and local copies of six June PDFs are not authoritative originals. The archived HTML files and seven published order PDFs are checked instead.",
        "captions":"Stored cue files are re-rendered when present. For transcript-only rows, the saved text is fingerprinted, not independently verified against audio."
    }
    report["counts"] = {
        "juneOrders":len(report["juneOrders"]), "junePdfPages":sum(r.get("pages",0) for r in report["juneOrders"]),
        "postOrderFilings":len(report["postOrderFilings"]), "archivedHTML":len(report["archivedHTML"]),
        "commentAccessions":len({r["accession"] for r in report["commentFiles"]}),
        "commentAttachmentsListed":sum("listed" in r for r in report["commentFiles"]),
        "commentFileStatus":dict(sorted(Counter(r["status"] for r in report["commentFiles"]).items())),
        "commentPdfPages":sum(r.get("pages",0) for r in report["commentFiles"]),
        "commentOcrPages":sum(r.get("pages",0) for r in report["commentFiles"] if r.get("ocr")),
        "currentSummaries":len(report["summaries"]["current"]),
        "currentSummaryQuotes":sum(r["quotes"] for r in report["summaries"]["current"]),
        "legacySummaryQuotes":sum(len(r["quotes"]) for r in report["summaries"]["legacy"]),
    }
    return {"counts":report.pop("counts"),**report}


def problems(report: dict) -> int:
    # Known source-side limits are explicit row statuses; they are not successes.
    failed = {"different","no-text-layer","missing-original","missing-text","invalid-page-markers","unsupported","review",
              "not-exact-on-cited-page","no-paginated-source","invalid-ocr-sidecar","scan-without-ocr","ambiguous-filename","uninventoried-file","empty-original-text","inventory-empty"}
    def count(item: object) -> int:
        if isinstance(item, list):
            return sum(count(i) for i in item)
        if isinstance(item, dict):
            return int(item.get("status") in failed) + sum(count(v) for v in item.values())
        return 0
    return count(report) + sum(r["exit"] != 0 for r in report["checks"])


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    group = ap.add_mutually_exclusive_group(required=True)
    for opt in ("write","check","write-ocr","check-ocr"):
        group.add_argument("--"+opt,action="store_true")
    group.add_argument("--comment",metavar="ACCESSION",help="Recheck one RM26-4 accession against the archived file inventory, texts, summaries and report")
    args = ap.parse_args()
    logging.basicConfig(level=logging.INFO,format="%(message)s")
    if args.comment:
        if not re.fullmatch(r"\d{8}-\d{4}",args.comment):
            ap.error("expected an accession such as 20251121-5521")
        expected = read(OUT)
        rows, summaries = comment_archive(args.comment), summary_archive(args.comment)
        filtered = {k:[v for v in vs if (v if isinstance(v,str) else v["accession"]) == args.comment]
                    for k,vs in expected["summaries"].items()}
        sys.stdout.write(json.dumps(dict(files=rows,summaries=summaries),indent=2,ensure_ascii=False)+"\n")
        has_error = problems(dict(commentFiles=rows,summaries=summaries,checks=[]))
        return int(bool(has_error or rows != [r for r in expected["commentFiles"] if r["accession"]==args.comment] or summaries != filtered))
    if args.write_ocr or args.check_ocr:
        return run_ocr(args.write_ocr)
    report = audit()
    encoded = json.dumps(report,indent=2,ensure_ascii=False)+"\n"
    n = problems(report)
    log.info("Compared %d June orders, %d post-order filings, %d RM26-4 file/alias rows and %d current summaries; %d unexpected failures.",
             len(report["juneOrders"]),len(report["postOrderFilings"]),len(report["commentFiles"]),len(report["summaries"]["current"]),n)
    if args.write:
        OUT.write_text(encoded,encoding="utf-8")
    elif not OUT.is_file() or OUT.read_text() != encoded:
        log.error("Archive report differs. Inspect the inputs; regenerate with --write and review the diff.")
        return 1
    return int(n > 0)


if __name__ == "__main__":
    sys.exit(main())
