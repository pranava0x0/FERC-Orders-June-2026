#!/usr/bin/env python3
"""Extract the August 2026 abeyance / errata / compliance documents to committed text.

Same contract as sources/text/orders/: the PDF or DOCX itself is not committed (gitignored, and
re-derivable from its eLibrary accession), the verbatim extracted text is. Each output carries a
two-line provenance header, then the body, with `--- PAGE N ---` markers when the source has pages.

The documents are pulled from eLibrary by hand, in an authenticated browser (see REFRESH.md and
tools/elibrary-sweep.js), because eLibrary is Cloudflare-gated. They land in ~/Downloads named
"<accession>_<filename>". This script only does the extraction, so it is safe to re-run: it reads
whatever is present and reports what is missing rather than failing.

Usage:
    python3 tools/extract-abeyance-docs.py                # extract everything found
    python3 tools/extract-abeyance-docs.py --check        # verify committed text matches the source
    python3 tools/extract-abeyance-docs.py --in <dir>     # look somewhere other than ~/Downloads

DOCX goes through `textutil` (macOS, no page concept in a notational order). PDF goes through fitz,
which preserves the embedded text layer and gives real page numbers.
"""
from __future__ import annotations

import argparse
import json
import logging
import re
import subprocess
import sys
from pathlib import Path

log = logging.getLogger("extract-abeyance-docs")

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "sources" / "text" / "abeyance"
MANIFEST = ROOT / "sources" / "abeyance-manifest.json"

# One record per document. `slug` names the output file; `match` is the ~/Downloads filename prefix
# (the accession, which is unique). Titles and citations are copied from each document's own first page,
# never from its docket-sheet description: accession 20260813-3026's description names the wrong docket
# AND the wrong parent order (see REFRESH.md).
DOCS = [
    # --- the six abeyance orders, all issued 2026-08-14 --------------------------------------------
    dict(slug="abeyance-el26-67-pjm", accession="20260814-3059", docket="EL26-67-000", rto="PJM",
         cite="196 FERC ¶ 61,129", issued="2026-08-14", kind="letter order",
         title="Letter order granting the PJM, Indicated PJM Transmission Owners and Silver Run Electric abeyance motions"),
    dict(slug="abeyance-el26-68-spp", accession="20260814-3060", docket="EL26-68-000", rto="SPP",
         cite="196 FERC ¶ 61,128", issued="2026-08-14", kind="letter order",
         title="Letter order granting the SPP Joint Movants' abeyance motion for 95 days, to November 20, 2026"),
    dict(slug="abeyance-el26-69-nyiso", accession="20260814-3068", docket="EL26-69-000", rto="NYISO",
         cite="196 FERC ¶ 61,130", issued="2026-08-14", kind="letter order",
         title="Letter order granting the NYISO, New York Transmission Owners and Non-Incumbent Transmission Owners abeyance motions"),
    dict(slug="abeyance-el26-70-miso", accession="20260814-3058", docket="EL26-70-000", rto="MISO",
         cite="196 FERC ¶ 61,133", issued="2026-08-14", kind="letter order",
         title="Letter order granting the MISO and MISO Transmission Owners abeyance motion over American Municipal Power's opposition"),
    dict(slug="abeyance-el26-71-caiso", accession="20260814-3061", docket="EL26-71-000", rto="CAISO",
         cite="196 FERC ¶ 61,131", issued="2026-08-14", kind="order",
         title="Order Granting Rescission and Abeyance Requests (rescinds the order as to the Six Cities and WAPA)"),
    dict(slug="abeyance-el26-72-isone", accession="20260814-3056", docket="EL26-72-000", rto="ISO-NE",
         cite="196 FERC ¶ 61,132", issued="2026-08-14", kind="letter order",
         title="Letter order granting the ISO-NE and PTO Administrative Committee joint abeyance motion"),
    # --- errata to the June 18 orders --------------------------------------------------------------
    dict(slug="errata-el26-67-pjm", accession="20260813-3025", docket="EL26-67-000", rto="PJM",
         cite="196 FERC ¶ 61,122", issued="2026-08-13", kind="errata notice",
         title="Errata correcting the caption and footnote 13 of 195 FERC ¶ 61,211 (Allegheny Electric Cooperative, Wabash Valley Power Association)"),
    dict(slug="errata-el26-70-miso", accession="20260813-3026", docket="EL26-70-000", rto="MISO",
         cite="196 FERC ¶ 61,123", issued="2026-08-13", kind="errata notice",
         title="Errata correcting the caption and footnote 11 of 195 FERC ¶ 61,212 (Wabash Valley Power Association)"),
    # --- the co-location lane ---------------------------------------------------------------------
    dict(slug="eot-el25-49-pjm", accession="20260814-3005", docket="EL25-49-002", rto="PJM",
         cite=None, issued="2026-08-14", kind="notice of extension of time",
         title="Notice of Extension of Time granting PJM and the Indicated PJM Transmission Owners 90 days, to November 16, 2026"),
    dict(slug="compliance-er26-1479-pjm", accession="20260817-5195", docket="ER26-1479-002", rto="PJM",
         cite=None, issued="2026-08-17", kind="compliance filing (transmittal)",
         title="PJM partial compliance filing in response to the June 18, 2026 order on rehearing in EL25-49-002 et al."),
    dict(slug="compliance-er26-3537-pjm-tos", accession="20260817-5175", docket="ER26-3537-000", rto="PJM TOs",
         cite=None, issued="2026-08-17", kind="compliance filing (transmittal)",
         title="PJM Transmission Owners' partial compliance filing implementing the Interim NITS rate"),
    # --- Sept-Oct 2026 refresh: rehearing dismissal, backstop order, PJM governance filing -----------
    dict(slug="order-el26-67-001-pjm-rehearing", accession="20260921-3020", docket="EL26-67-001", rto="PJM",
         cite="196 FERC ¶ 61,214", issued="2026-09-21", kind="order", captured_at="2026-10-08",
         title="Order dismissing requests for rehearing and clarification of the June 18, 2026 PJM show-cause order"),
    dict(slug="order-er26-3380-pjm-backstop", accession="20260929-3099", docket="ER26-3380-000", rto="PJM",
         cite="196 FERC ¶ 61,245", issued="2026-09-29", kind="order", captured_at="2026-10-08",
         title="Order accepting PJM's Reliability Backstop Procurement, suspending it to February 28, 2027, and establishing further procedures"),
    dict(slug="filing-ad26-7-pjm-governance-vote", accession="20261001-5164", docket="AD26-7-000", rto="PJM",
         cite=None, issued="2026-09-30", kind="informational filing", captured_at="2026-10-08",
         title="PJM informational filing on the September 30, 2026 Members Committee vote on governance term sheets"),
    dict(slug="statement-er26-3380-doe", accession="20261007-5181", docket="ER26-3380-000", rto="PJM",
         cite=None, issued="2026-10-07", kind="notice of intervention and statement of position", captured_at="2026-10-08",
         title="U.S. Department of Energy notice of intervention and statement of position supporting the September 29, 2026 backstop order"),
    # --- Oct 2026 refresh: the PJM large-load (IRAS) order, and the four non-PJM Sep 21 dismissals ------
    dict(slug="order-er26-3515-pjm-large-load", accession="20261009-3055", docket="ER26-3515-000", rto="PJM",
         cite="197 FERC ¶ 61,019", issued="2026-10-09", kind="order", captured_at="2026-10-19",
         title="Order accepting PJM's Large Load definition and Large Load Registry and rejecting the Interim Resource Adequacy Service, BYONC and VRR-curve revisions"),
    # The four orders below were extracted in an authenticated eLibrary browser session on 2026-09-24
    # (branch vibe/refresh-ux-september, commit da4e14a, never merged) and are re-homed here as .txt
    # sources. The method was checked: that branch's text of the PJM order (20260921-3020) carries all
    # 73 of its sentences against PJM's own hosted copy of the PDF. These four have no second copy
    # to check against from this environment, which the `provenance` field says plainly.
    dict(slug="order-el26-71-001-caiso-rehearing", accession="20260921-3019", docket="EL26-71-001", rto="CAISO",
         cite="196 FERC ¶ 61,216", issued="2026-09-21", kind="order", captured_at="2026-09-24",
         provenance="extracted in an authenticated eLibrary browser session on 2026-09-24 (git da4e14a); no second copy available to check",
         title="Order dismissing Eolian's request for rehearing and clarification of the June 18, 2026 CAISO show-cause order"),
    dict(slug="order-el26-69-001-nyiso-rehearing", accession="20260921-3021", docket="EL26-69-001", rto="NYISO",
         cite="196 FERC ¶ 61,218", issued="2026-09-21", kind="order", captured_at="2026-09-24",
         provenance="extracted in an authenticated eLibrary browser session on 2026-09-24 (git da4e14a); no second copy available to check",
         title="Order dismissing Eolian's request for rehearing and clarification of the June 18, 2026 NYISO show-cause order"),
    dict(slug="order-el26-70-001-miso-rehearing", accession="20260921-3047", docket="EL26-70-001", rto="MISO",
         cite="196 FERC ¶ 61,217", issued="2026-09-21", kind="order", captured_at="2026-09-24",
         provenance="extracted in an authenticated eLibrary browser session on 2026-09-24 (git da4e14a); no second copy available to check",
         title="Order dismissing Eolian's request for rehearing and clarification of the June 18, 2026 MISO show-cause order"),
    dict(slug="order-el26-72-001-isone-rehearing", accession="20260921-3056", docket="EL26-72-001", rto="ISO-NE",
         cite="196 FERC ¶ 61,215", issued="2026-09-21", kind="order", captured_at="2026-09-24",
         provenance="extracted in an authenticated eLibrary browser session on 2026-09-24 (git da4e14a); no second copy available to check",
         title="Order dismissing Eolian's request for rehearing and clarification of the June 18, 2026 ISO-NE show-cause order"),
    # --- the only substantive show-cause answer ----------------------------------------------------
    dict(slug="answer-el26-71-morongo", accession="20260812-5158", docket="EL26-71-000", rto="CAISO",
         cite=None, issued="2026-08-12", kind="answer to order to show cause",
         title="Answer of Morongo Transmission LLC: no tariff amendment required, a non-load-serving participating transmission owner"),
]


def find_source(in_dir: Path, accession: str) -> Path | None:
    hits = sorted(in_dir.glob(f"{accession}_*"))
    return hits[0] if hits else None


def extract_docx(path: Path) -> str:
    """macOS textutil; a notational order has no page structure to preserve."""
    out = subprocess.run(["textutil", "-convert", "txt", "-stdout", str(path)],
                         capture_output=True, text=True, check=True)
    return out.stdout


def extract_pdf(path: Path) -> tuple[str, int, str]:
    """Page by page, with the same `--- PAGE N ---` markers sources/text/orders/ uses so the existing
    quote-page tooling (tools/stamp-comment-pages.mjs) can locate a quote's page. PyMuPDF when it is
    installed; otherwise poppler's pdftotext (-layout), whose form feeds mark the page breaks. The two
    lay out whitespace differently, so a re-extraction with the other tool reads as DRIFT: the tool used
    is recorded in the header and the manifest for that reason."""
    try:
        import fitz  # PyMuPDF
    except ImportError:
        fitz = None
    if fitz is not None:
        doc = fitz.open(path)
        parts = []
        for i in range(doc.page_count):
            parts.append(f"--- PAGE {i + 1} ---")
            parts.append(doc[i].get_text())
        return "\n".join(parts), doc.page_count, "PyMuPDF (fitz)"
    out = subprocess.run(["pdftotext", "-layout", str(path), "-"], capture_output=True, text=True, check=True)
    pages = [pg for pg in out.stdout.split("\f") if pg.strip()]
    if not pages:
        raise RuntimeError(f"pdftotext produced no text for {path.name}")
    parts = []
    for i, pg in enumerate(pages):
        parts.append(f"--- PAGE {i + 1} ---")
        parts.append(pg)
    return "\n".join(parts), len(pages), "pdftotext (poppler)"


def extract_prepared(path: Path) -> str:
    """A .txt source is text already extracted elsewhere (another session's authenticated browser run,
    checked in on a branch), re-homed here so the quote sweep can see it. The record's `provenance`
    field must say where it came from; this function only reads it."""
    return path.read_text(encoding="utf-8")


def normalize(text: str) -> str:
    """Collapse the runs of blank lines and trailing spaces the converters leave behind. The words,
    their order and their line breaks are untouched: quotes are verified verbatim against this text."""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip() + "\n"


def build(rec: dict, src: Path) -> tuple[str, dict]:
    pages = None
    suffix = src.suffix.lower()
    if suffix == ".pdf":
        body, pages, tool = extract_pdf(src)
    elif suffix == ".txt":
        if not rec.get("provenance"):
            raise ValueError(f"{rec['slug']}: a .txt source needs a `provenance` field saying where the text came from")
        body = extract_prepared(src)
        tool = f"no local extraction: {rec['provenance']}"
    else:
        body = extract_docx(src)
        tool = "textutil"
    body = normalize(body)

    cite = f" — {rec['cite']}" if rec.get("cite") else ""
    pg = f" — {pages} pp" if pages else ""
    header = (
        f"FERC {rec['kind']} — {rec['rto']} — Docket {rec['docket']} — accession {rec['accession']}"
        f"{cite} — {rec['title']} — Issued {rec['issued']}{pg}\n"
        + (f"Extracted locally with {tool} from the document downloaded from its eLibrary accession. "
           if not tool.startswith("no local extraction") else f"Text {tool}. ")
        + "Verbatim; source text layer preserved.\n\n\n"
    )
    meta = dict(rec, source_file=src.name, pages=pages, chars=len(body), tool=tool,
                text=str((OUT_DIR / f"{rec['slug']}.txt").relative_to(ROOT)))
    return header + body, meta


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="in_dir", default=str(Path.home() / "Downloads"))
    ap.add_argument("--check", action="store_true",
                    help="verify committed text matches what the sources produce; write nothing")
    ap.add_argument("-v", "--verbose", action="store_true", help="debug-level logging")
    args = ap.parse_args()
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO,
                        format="%(levelname)s %(message)s")

    in_dir = Path(args.in_dir).expanduser()
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    wrote, same, missing, drifted = [], [], [], []
    compared = []   # only documents with a source file present, i.e. actually verified
    metas = []
    for rec in DOCS:
        dest = OUT_DIR / f"{rec['slug']}.txt"
        src = find_source(in_dir, rec["accession"])
        if src is None:
            # Not an error: the download directory is transient, the committed text is the artifact.
            (missing if not dest.exists() else same).append(rec["accession"])
            if dest.exists():
                metas.append(dict(rec, source_file=None, pages=None,
                                  chars=len(dest.read_text(encoding="utf-8")),
                                  text=str(dest.relative_to(ROOT))))
            continue
        text, meta = build(rec, src)
        metas.append(meta)
        compared.append(rec["accession"])
        if dest.exists() and dest.read_text(encoding="utf-8") == text:
            same.append(rec["accession"])
        elif args.check:
            drifted.append(rec["accession"])
        else:
            dest.write_text(text, encoding="utf-8")
            wrote.append(rec["accession"])

    if not args.check and metas:
        # Merge, never regenerate. The download directory is transient, so a run after it was cleaned
        # used to rewrite every earlier record with source_file=None and a recomputed `chars`,
        # destroying the provenance of documents it had not touched (issues.md 2026-10-08). A record
        # is replaced only when its source was present and re-extracted this run; otherwise the
        # committed record stands. New accessions are appended in DOCS order.
        existing = json.loads(MANIFEST.read_text(encoding="utf-8")) if MANIFEST.exists() else {}
        by_acc = {d["accession"]: d for d in existing.get("documents", [])}
        for m in metas:
            if m.get("source_file") is None and m["accession"] in by_acc:
                continue  # nothing re-extracted: keep the record that knows its source
            by_acc[m["accession"]] = m
        order = [rec["accession"] for rec in DOCS]
        documents = [by_acc[a] for a in order if a in by_acc] + [d for a, d in by_acc.items() if a not in order]
        MANIFEST.write_text(json.dumps({
            "captured_at": existing.get("captured_at", "2026-08-23"),
            "note": existing.get("note", "FERC documents quoted on the site, extracted to sources/text/abeyance/. "
                                          "Titles and citations come from each document's own first page."),
            "documents": documents,
        }, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    log.info("%s: %d written, %d unchanged, %d drifted, %d missing source and no committed text",
             "checked" if args.check else "extracted", len(wrote), len(same), len(drifted), len(missing))
    for a in drifted:
        log.error("DRIFT %s: committed text differs from the source document", a)
    for a in missing:
        log.error("MISSING %s: no file in %s and nothing committed", a, in_dir)

    # --check exists to prove the committed text still matches its source. When the transient download
    # directory has been cleaned, every document takes the "no source" branch and is counted as
    # unchanged, so the command reported "12 unchanged" and exited 0 having compared nothing at all.
    # That is the failure mode CLAUDE.md names directly: a check that passes over an empty set is
    # indistinguishable from one that passed. Verifying nothing is now an error, not a pass.
    if args.check and not compared:
        log.error("--check verified 0 of %d document(s): no source files found in %s. "
                  "Re-download them from eLibrary (see tools/elibrary-sweep.js) before trusting this.",
                  len(DOCS), in_dir)
        return 2
    if args.check:
        log.info("--check compared %d of %d document(s) against their sources.", len(compared), len(DOCS))
    return 1 if (drifted or missing) else 0


if __name__ == "__main__":
    raise SystemExit(main())
