#!/bin/sh
# One command for a deterministic refresh. Each step is a script whose output is committed and checked.
#
#   sh tools/refresh.sh            rebuild every generated file from sources/, then validate and test (offline)
#   sh tools/refresh.sh --check    verify generated files are current without writing (what CI would run)
#   sh tools/refresh.sh --sweep    first read the eLibrary docket sheets since the last capture (stable Chrome,
#                                  set NODE_PATH to a Playwright install), then list accessions not yet in the catalog
#
# New documents still need capture (tools/fetch-filing-originals.mjs), text extraction, a catalog entry and a
# reading in sources/filings/documents/<slug>.json; `node tools/validate-documents.mjs --coverage` lists the gaps.
set -eu
cd "$(dirname "$0")/.."
mode="${1:---build}"
case "$mode" in
  --build|--check|--sweep) ;;
  *) echo "Usage: sh tools/refresh.sh [--build|--check|--sweep]" >&2; exit 2 ;;
esac
if [ "$mode" = "--sweep" ]; then
  out="${TMPDIR:-/tmp}/ferc-sheets"
  since=$(node -e 'console.log(require("./sources/filings/refresh-coverage.json").asOf || "2026-06-18")')
  node tools/sweep-show-cause.mjs "$out" "$since" "$(date +%Y-%m-%d)" \
    EL26-67-000 EL26-68-000 EL26-69-000 EL26-70-000 EL26-71-000 EL26-72-000 \
    EL25-49-000 ER26-3515-000 ER26-3380-000 ER27-25-000 ER26-3650-000 ER26-3552-000 ER27-432-000 ER27-454-000 EL27-11-000
  python3 tools/reconcile-show-cause.py "$out" --output "$out/new-rows.json" --baseline-output "$out/candidate-baseline.json"
  echo "Review $out/new-rows.json before capturing anything."
  mode=--build
fi
sh tools/refresh-reading-room.sh "$mode"
# A pipe would report tail's exit status, so each check writes to a file and fails on its own status.
log="${TMPDIR:-/tmp}/ferc-refresh.$$"
run() { if "$@" >"$log" 2>&1; then tail -2 "$log"; else cat "$log"; rm -f "$log"; echo "✗ failed: $*" >&2; exit 1; fi; }
run node tools/validate-documents.mjs --strict
run node tools/verify-quotes.mjs
run node --test tests/
rm -f "$log"
