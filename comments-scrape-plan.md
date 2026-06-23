# Plan: scrape and summarize the RM26-4 public comments

FERC staff reviewed more than 3,500 pages of public comment in Docket **RM26-4-000** (the DOE
§403 ANOPR) before issuing the six show cause orders. This is a plan to capture those comments,
summarize them by stakeholder and position, and surface a "What commenters said" section. It is not
built yet; it is the method to follow when it is.

## What we are producing

A committed, attributed corpus of RM26-4 comments plus a structured summary: per filing, who filed,
what they argued, and where they land on each of the five reform categories. Every displayed claim
traces to a FERC accession number.

## Access (the hard part is Cloudflare, again)

- Comments live in **FERC eLibrary** under docket RM26-4-000. There is no official public API or CSV
  export; the 2021 eLibrary UI is a single-page app over undocumented JSON endpoints, and the whole
  site sits behind a Cloudflare challenge that blocks curl, server-side fetch, and the Wayback crawler
  (the same wall the order PDFs hit). An unofficial wrapper exists (`github.com/4very/ferc-elibrary-api`)
  but assumes direct access.
- Use the **browser bridge** that worked for the orders (see the cloudflare-gov-pdf retrieval notes):
  drive a real browser that passes the challenge, capture the docket sheet's filing list, then download
  each filing's PDF by accession number. Pilot the exact endpoints on ~10 filings before a full run.

## Pipeline (modular, idempotent, checkpointed)

0. **Pilot** — confirm the eLibrary docket-sheet listing shape and the per-accession download URL on a
   handful of filings. Validate before scaling.
1. **Enumerate** — build a manifest of filings for RM26-4-000: accession number, filer, organization,
   filed date, document type, page count, security level. Keep `*_raw` copies of filer/org strings.
   Filter to comment/protest/intervention types.
2. **Download** — fetch each PDF to disk, keyed on accession number (idempotent; never re-download).
   Rate-limit >= 1.5-2s/request, informative User-Agent, exponential backoff from 10s on 429.
3. **Extract** — pull text with PyMuPDF (fitz). Never LLM-transcribe a text-layer PDF; OCR only the
   scanned ones (log which). Preserve `--- PAGE N ---` markers as the orders' extraction does.
4. **Normalize** — one record per filing: filer, org, stakeholder category, filed date, page count, a
   precomputed search string. Dedup form-letter campaigns by content hash; keep a count, not 4,000 rows.
5. **Classify and summarize** — cheapest model that holds up (Haiku before Opus). Keyword pre-filter,
   then a structured per-filing call: stance on each reform category (support / oppose / mixed / silent),
   key arguments, requested relief. Cache by content hash; never re-classify identical text. Log cost
   per layer; `--dry-run` and `--fetch-only` work without a key.
6. **Aggregate** — counts by stakeholder type and by position per category, always with a denominator
   (share of filers, not raw counts). Pull 1-2 representative quotes per cluster with accession cites.
7. **Validate and write** — schema-validate (Pydantic `extra="forbid"`), enforce a source-host allowlist
   (raise on any non-`elibrary.ferc.gov` / `ferc.gov` URL), append-only with provenance (accession #,
   filer, filed date, `captured_at`). Count-floor regression test so the corpus never silently shrinks.

## Stakeholder taxonomy

RTOs/ISOs, transmission owners, data-center developers / hyperscalers, generators (gas / nuclear /
renewables), state commissions and consumer advocates, trade associations, environmental and
public-interest groups, individuals. Classify on a stable signal where one exists, not the free-text
org label alone; survey the real distribution before hardcoding an allowlist.

## Honesty

- LLM summaries are provisional, not citation-grade. Audit a sample against the primary filing, stamp
  `verified_at`, and keep facts, the filing's position, and our synthesis in separate labeled lanes.
- Distinguish a genuinely empty result (a filer silent on a category) from an extraction failure (a bug
  to log in `issues.md` and track as a coverage gap). A silent 0 must never read as "covered."
- This corpus backs only a comments section; it never overrides a primary regulatory finding.

## Surfacing

A static "What commenters said" section (baked JSON in `data.js`, same model as the rest of the site),
with the aggregate picture up top and a filterable list below (top-N + show-all, never dumping
thousands of DOM nodes). Link each filing to its eLibrary accession.

## Rough cost

~3,500 pages across an unknown filing count. Excerpt or chunk long omnibus filings; with a Haiku-first,
hash-cached pass the summarization is a few dollars, dominated by the long institutional filings.
Start small, validate the eval loop, then run the rest.
