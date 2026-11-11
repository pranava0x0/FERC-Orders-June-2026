#!/usr/bin/env python3
"""Compare fresh FERC sheet snapshots with the accession ledger. Read only; exit 1 for review."""
from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
log = logging.getLogger("reconcile-show-cause")

def disposition(row: dict) -> str:
    """Keep all new rows visible; bodies and policy relevance need review by a reader."""
    label = row["desc"].lower()
    return "documentless" if "doc-less" in label or "document-less" in label else "review original"

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("snapshots", type=Path, help="Directory from tools/sweep-show-cause.mjs")
    parser.add_argument("--output", type=Path, help="Write the detailed JSON report")
    parser.add_argument("--baseline-output", type=Path, help="Write a candidate updated full accession list for manual review")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    ledger = json.loads((ROOT / "sources/filings/refresh-coverage.json").read_text())
    docs = {d["docket"]: d for d in ledger["dockets"]}
    baseline = json.loads((ROOT / "sources/filings/sheet-baseline.json").read_text())
    results = []
    files = sorted(args.snapshots.glob("*.json"))
    if not files:
        log.error("No sheet snapshots found in %s", args.snapshots)
        return 2
    for file in files:
        fresh = json.loads(file.read_text())
        docket = fresh["docket"]
        reference = docs.get(docket)
        if reference is None or fresh.get("status") != "checked" or fresh.get("total") != fresh.get("rowsSeen"):
            results.append({"docket": docket, "status": "incomplete", "reason": fresh.get("error", "No verified sheet or known baseline")})
            continue
        listed = {r["acc"]: r for r in fresh["records"]}
        known = baseline.get(docket)
        if known is None:
            results.append({"docket": docket, "status": "incomplete", "reason": "No accession baseline"})
            continue
        # Compare accession identity, not filing date: FERC often indexes yesterday's
        # filings today. Keep administrative rows in this baseline for the same reason.
        missing = [a for a,date in sorted(known.items()) if fresh["since"] <= date <= fresh["through"] and a not in listed]
        new = [{**r, "disposition": disposition(r)} for a,r in sorted(listed.items()) if a not in known]
        results.append({"docket": docket, "status": "review" if missing or new else "matched", "missing": missing, "new": new})
        baseline[docket] = {**{a:date for a,date in known.items() if a not in missing}, **{a:r["filed"] for a,r in listed.items()}}
    if args.baseline_output:
        if any(r["status"] == "incomplete" for r in results):
            log.error("Incomplete sheet; refused to write a candidate baseline")
            return 2
        args.baseline_output.write_text(json.dumps(baseline,sort_keys=True,indent=2)+"\n")
    if args.output:
        args.output.write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n")
    for row in results:
        log.info("%s: %s", row["docket"], row["status"])
    return int(any(row["status"] != "matched" for row in results))

if __name__ == "__main__":
    raise SystemExit(main())
