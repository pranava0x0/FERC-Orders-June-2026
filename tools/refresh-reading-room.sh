#!/bin/sh
# Regenerate or verify the public reading room offline. No downloads, no credentials.
set -eu
cd "$(dirname "$0")/.."
case "${1:---check}" in
  --build) regen=''; archive='--write' ;;
  --check) regen='--check'; archive='--check' ;;
  *) echo "Usage: sh tools/refresh-reading-room.sh [--build|--check]" >&2; exit 2 ;;
esac
python3 tools/extract-abeyance-docs.py $regen
python3 tools/index-filing-text.py $regen
node tools/build-filing-readers.mjs $regen
node tools/build-record-data.mjs $regen
node tools/build-delivery-data.mjs $regen
node tools/build-docket-pages.mjs $regen
node tools/build-seo.mjs $regen
node tools/build-llms.mjs $regen
node tools/stamp-assets.mjs $regen
python3 tools/check-reading-links.py
node tools/check-filing-prose.mjs
python3 tools/revalidate-archive.py "$archive"
