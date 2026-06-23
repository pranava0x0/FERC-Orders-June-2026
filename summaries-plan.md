# Plan: summarizing the RM26-4 comments and the June 18 meeting

Two deferred summary features and the method to build them. **Not executed yet.** Both pull from FERC
sources that sit behind Cloudflare, so the access strategy is shared and comes first.

## Access: Cloudflare gating and alternatives

`ferc.gov` and `elibrary.ferc.gov` return **HTTP 403** to every automated client we tried (curl,
WebFetch, the PDF-fetch MCP, the Wayback Save-Page-Now crawler). Cycling user-agents does not pass it.
See `LEARNINGS.md`. Tier the sources by whether they are gated, and prefer the ungated ones:

1. **Not gated, use first.**
   - **The open-meeting YouTube webcast.** FERC posts its open meetings to its YouTube channel; YouTube
     is not Cloudflare-gated. Pull the auto-caption transcript with `yt-dlp --write-auto-sub
     --skip-download` (or the timed-text endpoint), no API key. This is the primary path for the meeting
     summary; find the June 18, 2026 meeting video on FERC's channel (do not hardcode a guessed video id).
   - **Internet Archive snapshots** of the FERC HTML pages (press release, fact sheet, meeting summaries,
     RM26-4 landing). We already cite these; pull with the `…id_/` modifier and `gzip.decompress` yourself.
2. **Gated, need a real browser that holds the Cloudflare clearance cookie.** The eLibrary comment
   filings and the written commissioner-statement PDFs. Either the user downloads them and we read from
   `~/Downloads`, or we fetch same-origin from a logged-in tab. The on-machine PDF-fetch tool still 403s
   because it carries no cookie. This is the proven path for the order PDFs.
3. **Semi-automated bypass, use with care.** A stealth headless browser (Playwright + a stealth plugin,
   or FlareSolverr as a challenge-solving proxy) can sometimes clear the challenge. It is an arms race
   and can bump rate limits or terms; rate-limit hard, cache everything, and keep the manual path as the
   fallback. Do not build a pipeline that depends on it.
4. **Do not bother.** The unofficial `ferc-elibrary-api` wrapper assumes direct access (still blocked);
   there is no clean bulk comment export; FOIA is overkill for public filings.

Whatever the path: cache every fetched file to disk keyed on its id (accession number, video id),
rate-limit >= 1.5 to 2s per host, back off exponentially from 10s on a 429, and never re-download.

## A. RM26-4 public-comments summary

Goal: a committed, attributed corpus of the RM26-4-000 comments (staff reviewed 3,500+ pages), plus a
structured summary of who filed, what they argued, and where they land on each of the five reforms.

0. **Pilot** the eLibrary docket-sheet listing shape and the per-accession download URL on ~10 filings.
1. **Enumerate** a manifest for RM26-4-000: accession number, filer, organization, filed date, document
   type, page count, security level. Keep `*_raw` filer/org strings. Filter to comment / protest /
   intervention types.
2. **Download** each PDF (browser bridge per the access tiers above), keyed on accession number.
3. **Extract** text with PyMuPDF (fitz). Never LLM-transcribe a text-layer PDF; OCR only the scanned
   ones and log which. Keep the `--- PAGE N ---` markers.
4. **Normalize** to one record per filing; dedup form-letter campaigns by content hash (keep a count,
   not 4,000 rows).
5. **Classify and summarize** with the cheapest model that holds up (Haiku first). Keyword pre-filter,
   then a structured per-filing call: stance per reform category (support / oppose / mixed / silent),
   key arguments, requested relief. Cache by content hash.
6. **Aggregate** by stakeholder type and position per category, always with a denominator (share of
   filers, not raw counts). Pull 1 to 2 representative quotes per cluster with accession cites.
7. **Validate and write** append-only with provenance (accession #, filer, filed date, `captured_at`);
   schema-validate (`extra="forbid"`); source-host allowlist (raise on any non-eLibrary/ferc.gov URL);
   count-floor regression test.

Stakeholder taxonomy: RTOs/ISOs, transmission owners, data-center developers / hyperscalers, generators,
state commissions and consumer advocates, trade associations, environmental and public-interest groups,
individuals. Classify on a stable signal where one exists, not the free-text org label alone.

Surface as a static "What commenters said" section (baked JSON in `data.js`): the aggregate picture up
top, a filterable list below (top-N + show-all, never thousands of DOM nodes), each filing linked to its
eLibrary accession.

## B. June 18, 2026 open-meeting summary

Goal: a compact "what each commissioner said" block for the large-load items (E-7 to E-12, plus the
related E-2 / E-6), one short read per commissioner (Swett, Rosner, See, Chang, LaCerte).

Sources, tiered by the access rules above:
- **The YouTube webcast transcript** is the primary source and is not gated. The commissioners speak to
  the items at the meeting; their spoken remarks are the raw material.
- **The written commissioner statements** (PDFs on ferc.gov) are gated; pull via the browser bridge and
  extract with fitz. These are the citation-grade version of what was said.
- **The meeting-summaries HTML page** (Wayback-archived) confirms the item to docket mapping.
- **Press release and fact sheet** (already archived) carry Chairman Swett's quoted framing.

Pipeline:
1. Pull the auto-transcript (`yt-dlp --write-auto-sub`), with timestamps.
2. Segment by speaker on the chair's recognitions ("Commissioner Rosner", "Chairman Swett", and so on);
   auto-captions do not carry speaker labels, so segment on those verbal cues and the agenda order.
3. Pull each commissioner's remarks on the large-load item; summarize per commissioner (their stance and
   emphasis: speed, ratepayer protection, federalism, reliability).
4. **Verify** key quotes against the written statement PDF or by replaying the video at the timestamp;
   auto-captions mishear names and terms, so a spoken quote is provisional until checked.
5. Cite both the video timestamp and the written statement.

Surface as a "Commissioner statements" block (five commissioners, 1 to 2 sentences each) with a link to
the video at the timestamp and to the statement PDF. Static, baked into `data.js`. A natural home is the
Overview or Timeline tab next to the June 18 issuance.

## Both

- LLM summaries are provisional, not citation-grade. Audit a sample against the primary source, stamp
  `verified_at`, and keep facts, the source's position, and our synthesis in separate labeled lanes.
- Distinguish a genuinely empty result (a filer or commissioner silent on a point) from an extraction
  failure (a bug to log in `issues.md` and track as a coverage gap). A silent 0 must never read as
  "covered."
- Cheapest model that holds up (Haiku first); cache by content hash; log cost per layer; `--dry-run` and
  `--fetch-only` work without a key. Start small, validate the eval loop, then run the rest.
