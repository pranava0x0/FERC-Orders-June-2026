#!/usr/bin/env python3
"""Add substantive docket filings to the reading room as page text, without committing the originals.

Usage: python3 tools/ingest-record-tier.py SHEETS_DIR CAPTURE_DIR [--dry-run]

SHEETS_DIR holds one tools/sweep-show-cause.mjs checkpoint per docket. CAPTURE_DIR holds one
tools/fetch-filing-originals.mjs directory per accession. For each captured accession this keeps the
filing only if it concerns the large-load record (see relevant()), keeps its substantive files (drops
clean/redline tariff sheets, FERC's generated tariff copy and certificates of service), and writes:

  sources/filings/text/<accession>_<NNN>.txt   page text, "--- PAGE n ---" separated (PDF) or one block (Word)
  sources/filings/record-tier.json             one entry per accession: sheet row, files, sha256 of each original

The original bytes stay out of git (161 MB for 33 Nov 16 filings). Each file's sha256 is recorded so a
reader can confirm a copy fetched from eLibrary is the one the text came from. Re-running merges with the
existing record-tier.json (append-only by accession) and rewrites nothing that is unchanged.
"""
import argparse
import json
import logging
import re
import sys
from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "sources/filings"
TEXT = SRC / "text"
OUT = SRC / "record-tier.json"
ELI = "https://elibrary.ferc.gov/eLibrary/filelist?accession_number="
# Tariff sheets duplicate the transmittal's explanation at hundreds of pages each; the eLibrary copy
# remains the source for them. A file is skipped only when its accession keeps at least one other file.
SKIP = re.compile(r"\b(?:clean|redline[ds]?|marked)\b|FERC GENERATED TARIFF|certificate of service|^Clean Tariff|^Marked Tariff", re.I)
TOPIC = re.compile(r"large[- ]load|show cause|co-locat|EL2[56]-(?:49|6[7-9]|7[0-2])|\bOSC\b", re.I)


def tracked() -> set[str]:
    return set(json.loads((SRC / "sheet-baseline.json").read_text()))


def relevant(row: dict, first_text: str, base: set[str]) -> bool:
    # A tracked docket is relevant by definition. A docket found by sweeping an accession range is not:
    # the Nov 16 range also holds market-rate applications and agreement cancellations.
    if any(d in base for d in row["dockets"]):
        return True
    return bool(TOPIC.search(row["desc"]) or TOPIC.search(first_text[:20000]))


def kind(desc: str) -> str:
    d = desc.lower()
    for k, p in [("order", r"^(order|letter order|delegated letter)"), ("protest", r"protest"), ("rehearing request", r"rehearing|clarification"),
                 ("answer", r"\banswer\b"), ("comments", r"comment"), ("motion", r"motion"), ("notice", r"^\S.{0,60}\bsubmits notice\b|^notice\b"),
                 ("tariff filing", r"tariff filing|compliance"), ("brief", r"brief"), ("testimony", r"statement|testimony|transcript")]:
        if re.search(p, d):
            return k
    return "filing"


def title(desc: str) -> str:
    t = re.sub(r"\s+submits tariff filing per [\d.()a-z]+:?\s*", ": ", desc)
    t = re.sub(r"\s+(?:under|in Docket No\.?)\s+[A-Z]{2}\d{2}-\d+.*$", "", t).strip(" .")
    return t if len(t) <= 160 else t[:157].rsplit(" ", 1)[0] + "…"


def pdf_pages(path: Path) -> list[str]:
    with fitz.open(path) as doc:
        return [p.get_text().strip() for p in doc]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("sheets", type=Path)
    ap.add_argument("capture", type=Path)
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    sys.path.insert(0, str(ROOT / "tools"))
    from importlib import import_module
    docx_text = import_module("index-filing-text").docx_text

    rows: dict[str, dict] = {}
    for f in sorted(a.sheets.glob("*.json")):
        sheet = json.loads(f.read_text())
        if sheet.get("status") != "checked":
            logging.warning("skipping unchecked sheet %s", f.name)
            continue
        for r in sheet["records"]:
            rows.setdefault(r["acc"], {**r, "dockets": []})["dockets"].append(sheet["docket"])
    base = tracked()
    existing = {e["accession"]: e for e in json.loads(OUT.read_text())} if OUT.exists() else {}
    kept = skipped = failed = 0
    for inv in sorted(a.capture.glob("*/inventory.json")):
        cap = json.loads(inv.read_text())
        acc = cap["accession"]
        row = rows.get(acc)
        if not row:
            logging.error("%s: captured but on no checked sheet", acc); failed += 1; continue
        captured = [f for f in cap["files"] if f["status"] == "captured"]
        if not captured:
            logging.error("%s: nothing captured", acc); failed += 1; continue
        texts = {}
        for f in captured:
            p = inv.parent / f["file"]
            texts[f["file"]] = pdf_pages(p) if p.suffix.lower() == ".pdf" else [docx_text(p)]
        main_files = [f for f in captured if not SKIP.search(f["label"])] or captured[:1]
        if not relevant(row, "\n".join(texts[main_files[0]["file"]]), base):
            logging.info("%s: not about large loads (%s)", acc, row["desc"][:80]); skipped += 1; continue
        files = []
        for f in captured:
            entry = {"label": f["label"], "bytes": f["bytes"], "sha256": f["sha256"]}
            if f in main_files:
                name = f"{acc}_{f['file'][:3]}.txt"
                pdf = f["file"].lower().endswith(".pdf")
                body = "".join(f"--- PAGE {i} ---\n{t}\n" for i, t in enumerate(texts[f["file"]], 1)) if pdf else texts[f["file"]][0] + "\n"
                entry.update(text=f"sources/filings/text/{name}", pages=len(texts[f["file"]]) if pdf else None)
                if not a.dry_run:
                    TEXT.mkdir(parents=True, exist_ok=True)
                    out = TEXT / name
                    if not out.exists() or out.read_text() != body:
                        out.write_text(body)
            else:
                entry["skipped"] = "tariff sheet or service list; read it on eLibrary"
            files.append(entry)
        for f in cap["files"]:
            if f["status"] != "captured":
                files.append({"label": f.get("label", ""), "skipped": f["status"]})
        existing[acc] = {"accession": acc, "dockets": sorted(set(row["dockets"])), "filed": row["filed"], "filer": row["org"].strip(),
                         "description": row["desc"], "title": title(row["desc"]), "kind": kind(row["desc"]), "url": ELI + acc, "files": files}
        kept += 1
    if not a.dry_run:
        data = json.dumps(sorted(existing.values(), key=lambda e: e["accession"]), ensure_ascii=False, indent=1) + "\n"
        if not OUT.exists() or OUT.read_text() != data:
            OUT.write_text(data)
    total = sum(1 for _ in a.capture.glob("*/inventory.json"))
    print(f"✓ {kept} kept · − {skipped} not about large loads · ✗ {failed} failed · of {total} captured; {len(existing)} in the record tier")
    if not total:
        print("nothing captured: check CAPTURE_DIR", file=sys.stderr)
        return 1
    return 1 if failed else 0


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    sys.exit(main())
