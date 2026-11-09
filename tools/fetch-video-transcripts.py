#!/usr/bin/env python3
"""Fetch YouTube auto-captions for the commissioner videos listed in sources/videos/manifest.json.

Each video becomes sources/videos/text/<id>.txt: a two-line provenance header, then one line per
caption block of about 30 seconds, each prefixed with its [hh:mm:ss] offset. The offsets are what the
site links to (`&t=<seconds>`), so a reader lands on the moment a quote was said.

Auto-captions are not citation-grade. The site labels every quote drawn from them SPOKEN and links the
video at the timestamp so the reader can hear it. A quote from a video that is not in this corpus cannot
be checked by tools/verify-video-quotes.mjs and must not ship.

yt-dlp is a dev-time tool, never shipped. On the maintainer's Mac it lives in a throwaway venv:
    python3 -m venv <scratch>/venv && <scratch>/venv/bin/pip install yt-dlp==2025.10.14
(2025.10.14 is the last release that installs on the system Python 3.9.) Point YTDLP at it. The default
web client now fails with "The page needs to be reloaded"; the android client still returns captions,
and --ignore-no-formats-error keeps a missing-PO-token format error from aborting before the captions are
written.

Usage:
    YTDLP=<path> python3 tools/fetch-video-transcripts.py            # fetch what is missing
    YTDLP=<path> python3 tools/fetch-video-transcripts.py --force    # refetch everything
    python3 tools/fetch-video-transcripts.py --check                 # every manifest entry has text
    YTDLP=<path> python3 tools/fetch-video-transcripts.py --discover "FERC Swett data center"
        # print candidate videos (id | title | upload date | channel | seconds) for the manifest
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path

log = logging.getLogger("fetch-video-transcripts")

ROOT = Path(__file__).resolve().parent.parent
VIDEO_DIR = ROOT / "sources" / "videos"
MANIFEST = VIDEO_DIR / "manifest.json"
TEXT_DIR = VIDEO_DIR / "text"
BLOCK_MS = 30_000
PAUSE_S = 10      # between videos; YouTube 429s a burst of caption requests
BACKOFF_S = (30, 90, 240)


def ytdlp() -> str:
    exe = os.environ.get("YTDLP", "yt-dlp")
    return exe


def hms(ms: int) -> str:
    s = ms // 1000
    return f"{s // 3600:02d}:{s % 3600 // 60:02d}:{s % 60:02d}"


def json3_to_lines(events: list[dict]) -> list[str]:
    """Collapse caption events into ~30 s blocks. Rolling auto-captions repeat text across events only
    in the srv/vtt forms; json3 segs are disjoint, so a plain concatenation is lossless."""
    lines, start, buf = [], None, []
    for ev in events:
        segs = ev.get("segs")
        if not segs:
            continue
        t = ev.get("tStartMs", 0)
        if start is None:
            start = t
        if t - start >= BLOCK_MS and buf:
            lines.append(f"[{hms(start)}] " + " ".join("".join(buf).split()))
            start, buf = t, []
        buf.append("".join(s.get("utf8", "") for s in segs))
    if buf:
        lines.append(f"[{hms(start)}] " + " ".join("".join(buf).split()))
    return lines


def fetch(video: dict) -> Path:
    vid = video["id"]
    out = TEXT_DIR / f"{vid}.txt"
    with tempfile.TemporaryDirectory() as tmp:
        cmd = [ytdlp(), "--skip-download", "--write-auto-subs", "--sub-langs", "en-orig,en", "--sub-format", "json3",
               "--ignore-no-formats-error", "--extractor-args", "youtube:player_client=android,ios", "-o", f"{tmp}/%(id)s",
               f"https://www.youtube.com/watch?v={vid}"]
        res = subprocess.run(cmd, capture_output=True, text=True)
        # "en" alone can be YouTube's machine TRANSLATION of an auto-caption track (2026-11-09: the Oct 15 open
        # meeting came back as translated text, "Novaya England" and all). "en-orig" is the English speech
        # recognition; take it whenever it exists, and say in the header which track was used.
        orig = list(Path(tmp).glob(f"{vid}*.en-orig.json3"))
        plain = list(Path(tmp).glob(f"{vid}*.en.json3"))
        subs = orig or plain
        if not subs:
            raise RuntimeError(f"{vid}: no captions ({res.stderr.strip().splitlines()[-1:] or 'no stderr'})")
        track = "en-orig" if orig else "en"
        events = json.loads(subs[0].read_text())["events"]
    lines = json3_to_lines(events)
    if not lines:
        raise RuntimeError(f"{vid}: captions file had no text")
    header = (f"{video['title']} ({video['channel']}, {video['date']}). Auto-generated YouTube captions; "
              f"imperfect, verify against the video.\n"
              f"Source: https://www.youtube.com/watch?v={vid}  Captured {video.get('captured_at', '')} via "
              f"yt-dlp --write-auto-subs (android client), track {track}.\n\n")
    out.write_text(header + "\n".join(lines) + "\n")
    return out


def discover(query: str) -> None:
    cmd = [ytdlp(), "--flat-playlist", "--print", "%(id)s | %(title)s | %(upload_date)s | %(channel)s | %(duration)s",
           f"ytsearchdate25:{query}"]
    subprocess.run(cmd, check=False)


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--discover")
    args = ap.parse_args()

    if args.discover:
        discover(args.discover)
        return 0

    videos = json.loads(MANIFEST.read_text())
    if not videos:
        log.error("manifest is empty: nothing to fetch or check")
        return 1
    TEXT_DIR.mkdir(parents=True, exist_ok=True)

    if args.check:
        missing = [v["id"] for v in videos if not (TEXT_DIR / f"{v['id']}.txt").exists()]
        for m in missing:
            log.error("no transcript for %s", m)
        log.info("checked %d video(s): %d with transcripts, %d missing", len(videos), len(videos) - len(missing), len(missing))
        return 1 if missing else 0

    done = skipped = failed = 0
    for v in videos:
        out = TEXT_DIR / f"{v['id']}.txt"
        if out.exists() and not args.force:
            skipped += 1
            continue
        for attempt, wait in enumerate((0,) + BACKOFF_S):
            if wait:
                log.info("429 on %s; backing off %ds", v["id"], wait)
                time.sleep(wait)
            try:
                fetch(v)
                done += 1
                log.info("fetched %s  %s", v["id"], v["title"][:60])
                break
            except Exception as e:  # one video must not stop the rest
                if "429" in str(e) and attempt < len(BACKOFF_S):
                    continue
                failed += 1
                log.error("%s", e)
                break
        time.sleep(PAUSE_S)
    log.info("✓ %d fetched · %d already present · ✗ %d failed", done, skipped, failed)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
