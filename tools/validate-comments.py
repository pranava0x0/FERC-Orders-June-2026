#!/usr/bin/env python3
"""Validate the RM26-4 comment corpus end-to-end: every inventoried comment has its body
on disk, every PDF opens with pages, and every body has substantive extracted text. Flags
missing, corrupt, and scanned (image-only -> empty text layer) files. Exits non-zero on an
*unexpected* problem (anything beyond the known ETI gap + genuinely file-less filings).
Run: python3 tools/validate-comments.py"""
import json, re, sys
from pathlib import Path
import fitz  # PyMuPDF

ROOT = Path(__file__).resolve().parent.parent
C = ROOT / "sources" / "comments"
FILES = C / "files"
comments = json.loads((C / "rm26-4-comments.json").read_text())["comments"]
inv = json.loads((C / "rm26-4-files.json").read_text())["files"]

def dir_for(acc):
    """Body dir for an accession — named "<accession>__<org-slug>" (older runs used a bare accession)."""
    if FILES.exists():
        for d in FILES.iterdir():
            if d.is_dir() and (d.name == acc or d.name.startswith(acc + "__")):
                return d
    return FILES / acc

TEXT_MIN = 200          # chars of real text below which we suspect a scanned/empty extraction
KNOWN_MISSING = {"20251121-5225"}  # ETI: renders but won't download (issues.md)

def extraction_chars(d: Path) -> int:
    """Total real text across the dir's .txt files (page markers stripped)."""
    total = 0
    for t in d.glob("*.txt"):
        s = re.sub(r"--- PAGE \d+ ---", "", t.read_text(encoding="utf-8", errors="replace"))
        total += len(s.strip())
    return total

ok, scanned, corrupt, missing, fileless = [], [], [], [], []
for c in comments:
    acc = c["acc"]
    if not inv.get(acc):
        fileless.append(acc); continue
    d = dir_for(acc)
    pdfs = list(d.glob("*.pdf")) if d.exists() else []
    docx = (list(d.glob("*.docx")) + list(d.glob("*.doc"))) if d.exists() else []
    txts = list(d.glob("*.txt")) if d.exists() else []
    standalone_txt = [t for t in txts if not any(t.stem == b.stem for b in pdfs + docx)]
    if not (pdfs or docx or standalone_txt):
        missing.append(acc); continue
    bad = False
    for p in pdfs:
        try:
            doc = fitz.open(p)
            if doc.page_count < 1:
                bad = True
            doc.close()
        except Exception:
            bad = True
    if bad:
        corrupt.append(acc); continue
    (ok if extraction_chars(d) >= TEXT_MIN else scanned).append(acc)

with_files = len(comments) - len(fileless)
print(f"RM26-4 comment corpus validation")
print(f"  total comments:          {len(comments)}")
print(f"  comments with files:     {with_files}")
print(f"  OK (body + real text):   {len(ok)}")
print(f"  scanned (needs OCR):     {len(scanned)}  {scanned}")
print(f"  corrupt PDFs:            {len(corrupt)}  {corrupt}")
print(f"  missing body:            {len(missing)}  {missing}")
print(f"  file-less (no attach):   {len(fileless)}  {fileless}")
print(f"  => downloaded {len(ok) + len(scanned) + len(corrupt)} / {with_files} bodies")

unexpected_missing = set(missing) - KNOWN_MISSING
problems = []
if unexpected_missing:
    problems.append(f"{len(unexpected_missing)} unexpectedly missing: {sorted(unexpected_missing)}")
if corrupt:
    problems.append(f"{len(corrupt)} corrupt: {corrupt}")
if problems:
    print("\nFAIL: " + " | ".join(problems))
    sys.exit(1)
print("\nPASS: all comments-with-files are downloaded; PDFs open; text extracted "
      f"(scanned/OCR-pending: {len(scanned)}; known gap: {sorted(set(missing) & KNOWN_MISSING)}).")
