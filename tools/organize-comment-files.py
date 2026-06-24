#!/usr/bin/env python3
"""Move RM26-4 comment downloads from ~/Downloads into sources/comments/files/<accession>/
and extract text: PDF via PyMuPDF (fitz), DOC/DOCX via macOS `textutil`. Idempotent; safe to
re-run. Files are named '<accession>_<original name>' by the eLibrary downloader."""
import re, shutil, subprocess
from pathlib import Path
import fitz  # PyMuPDF

DL = Path.home() / "Downloads"
ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT / "sources" / "comments" / "files"
ACC = re.compile(r"^(20\d{6}-\d{4})_(.+)$")

moved, extracted, skipped = 0, 0, 0
for p in sorted(DL.iterdir()):
    if not p.is_file():
        continue
    if p.suffix.lower() in (".crdownload", ".part", ".tmp"):
        continue  # in-progress download; leave it until Chrome finishes
    m = ACC.match(p.name)
    if not m:
        continue
    acc, rest = m.group(1), m.group(2)
    # strip Chrome's " (1)" dedupe suffix before the extension
    rest = re.sub(r" \(\d+\)(\.[A-Za-z0-9]+)$", r"\1", rest)
    # heal Content-Disposition truncation: a filename containing ";" is cut at the ";", losing its
    # extension (e.g. "RM26-4; Antora ….pdf" arrives as just "RM26-4"). If the bytes are a PDF, restore it.
    if "." not in rest:
        try:
            with open(p, "rb") as fh:
                if fh.read(5) == b"%PDF-":
                    rest += ".pdf"
        except Exception:
            pass
    d = DEST / acc
    d.mkdir(parents=True, exist_ok=True)
    target = d / rest
    if target.exists():
        skipped += 1
    else:
        shutil.move(str(p), str(target))
        moved += 1
    suf = target.suffix.lower()
    if suf == ".pdf":
        txt = target.with_suffix(".txt")
        if not txt.exists():
            try:
                doc = fitz.open(target)
                parts = [f"--- PAGE {i+1} ---\n{pg.get_text()}" for i, pg in enumerate(doc)]
                txt.write_text("\n".join(parts), encoding="utf-8")
                extracted += 1
            except Exception as e:
                print(f"  ! extract failed {acc}/{rest}: {e}")
    elif suf in (".docx", ".doc"):
        txt = target.with_suffix(".txt")
        if not txt.exists():
            try:
                out = subprocess.run(["textutil", "-convert", "txt", "-stdout", str(target)],
                                     capture_output=True, text=True, check=True)
                txt.write_text(out.stdout, encoding="utf-8")
                extracted += 1
            except Exception as e:
                print(f"  ! docx extract failed {acc}/{rest}: {e}")
print(f"moved={moved} extracted={extracted} skipped(existing)={skipped}")
print(f"accessions with files: {len(list(DEST.glob('20*')))}")
