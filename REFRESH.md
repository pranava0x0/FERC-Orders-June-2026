# REFRESH.md — the news refresh loop

How to bring this site current. Written for the `data-refresh` skill and for a human doing it by hand.
The design behind it is `news-tracks-plan.md` Part 4; this file is the runbook.

**The site is static and baked.** There is no runtime fetching, no RSS, no cron. Freshness comes from
running this loop and committing the result. That is deliberate (plan Part 7).

## When to run

Driven by real dates, not a calendar interval:

| Date | What lands |
|---|---|
| 2026-08-03 | Abeyance requests due, all six dockets. ISO-NE has announced it will use it. |
| 2026-08-17 | **Two clocks, one date.** The six show-cause / tariff filings, and PJM's further compliance filing in EL25-49. |
| ~2026-09-16 | Response windows open, 30 days after each filing lands. |
| mid-Sept 2026 | The AD26-7 dispute-resolution forum, and PJM's proposed backstop capacity auction. |
| end of Sept 2026 | PJM's governance reform package is due, or FERC imposes its own. |

`node tools/check-staleness.mjs` tells you if you are overdue. Run it first; it is the cheapest signal.

## The loop

### 1. Sweep

Web-search per track since `meta.newsCapture` in `docs/js/data.js`. Produce the table format in
plan Part 1, flagging each finding **fetched** (article read end to end) or **snippet** (search result
text only). Snippet-only findings are leads, never publishable facts.

Tracks to sweep: `sc6` (EL26-67 to EL26-72), `e2` (EL25-49), `gov` (AD26-7), `rm264`, `context`.

### 2. Verify

This is the step that decides what ships. Known-good routes:

```bash
# Federal Register: the HTML pages bot-block automated fetch, but the API and full_text are open.
curl -s "https://www.federalregister.gov/api/v1/documents.json?conditions\[term\]=PJM+governance&conditions\[agencies\]\[\]=federal-energy-regulatory-commission&per_page=20&order=newest&fields\[\]=title&fields\[\]=publication_date&fields\[\]=docket_ids&fields\[\]=document_number"
```

Then read the notice body from `https://www.federalregister.gov/documents/full_text/text/YYYY/MM/DD/<doc-number>.txt`.
That is how AD26-7-000 and the July 23 conference date were confirmed.

- **ISO Newswire** (`isonewswire.com`) is open and first-party for ISO-NE.
- **PJM** release PDFs under `pjm.com/-/media/DotCom/about-pjm/newsroom/` are open and first-party.
- **eLibrary and ferc.gov are Cloudflare-gated** and will 403 any automated fetch. Docket confirmation
  is a deliberate manual browser step; see the retrieval notes in `issues.md` (2026-06-22). This is the
  step that flips `filed-reported` into `filed-verified` and stamps `accession` + `verified_at`.
- Trade press behind a paywall: if the only source for a claim is unfetchable, it ships as a labeled
  headline pointer or not at all. Never as a paraphrased fact.

**Open verification queue** (carried from the 2026-07-28 refresh, plan 1.6):

1. eLibrary, all six dockets: the 30-day reports. Accession + date each. Only ISO-NE's is observed.
2. eLibrary, EL26-67: the reported Jul 17 ratepayer-advocate filing. Exact procedural type + filers.
3. eLibrary, all six: any rehearing requests dated on or before Jul 20; abeyance requests after Aug 3.
4. EL25-49: the Feb 2026 compliance filing's requested Jul 31 effective date.

### 3. Update `docs/js/data.js`

- `tracks.<id>.status.line` + `.asOf`, and `.next` if the clock advanced.
- `timeline`: add events chronologically, each with a required `track`.
  **Deadline-conversion rule:** when a dated `kind: "deadline"` event passes, either replace it with a
  dated sourced event describing what was observed, or append an explicit "window closed, nothing
  observed as of <date>" event. A passed deadline may never sit there in the future tense.
- `procedural.filings.rows`: **observations only.** `upcoming` and `none-observed` are derived at render
  time from the clock, so never store them. Status vocabulary and its evidence cost:
  `filed-verified` (needs `accession` + `verified_at`) · `filed-reported` (needs `src`) ·
  `signaled` (needs `src`).
- New `SOURCES` records need `published` (the outlet's own date) when cited from a track or filing
  surface. Never invent one: use `undated: true` if the source shows none.
- Any new displayed quote goes into `sources/news-evidence.json` with its captured snippet.
- Bump `meta.newsCapture` and `procedural.filings.asOf`.

### 4. Check, test, regenerate

```bash
node tools/check-staleness.mjs
node tools/build-llms.mjs
node --test tests/*.test.mjs
node tools/verify-quotes.mjs
```

### 5. Log

Append to `issues.md` anything found broken, and to `agent-runs.md` a row for any sweep agent, with its
token usage. Update the progress log at the top of `news-tracks-plan.md`.

## Search Console

The site is a verified URL-prefix property at
`https://pranava0x0.github.io/FERC-Orders-June-2026/` (Google account: the repo owner's).
`sitemap.xml` is submitted and regenerates from `data.js`, so a refresh that adds pages needs no
resubmission; Google re-reads the same URL.

**Do not delete `docs/google1a32de6a02a9a6e0.html` or the `google-site-verification` meta tag in
`docs/index.html`.** Both are ownership proofs. Google un-verifies a property when the artifact it
verified with disappears, and the failure is silent: reporting just stops.

After a refresh that adds URLs, optionally inspect one new URL in Search Console and hit **Request
indexing** to put it in the priority crawl queue (quota is roughly 10 per day).

## Gotchas learned the hard way

- **The browser caches `data.js` hard** on `localhost`. When a change does not appear, load
  `http://127.0.0.1:8131` instead of `localhost:8131`: a different host string is a separate cache entry.
  Verify against `window.FERC_DATA` in the console before debugging the render.
- **Adding a `const` to `data.js` is two edits.** The IIFE's `return {...}` at the bottom is an explicit
  list; a new section that is not added there is silently `undefined` in the app and every test that
  reads it passes vacuously.
- **A provision read in full in one order is not unique to it.** Grep all six texts in
  `sources/text/orders/` before shipping any "only region X" claim. That was the Phase 0 bug.
- **`published` is not `captured`.** The outlet's own date and the date we pulled it are different
  facts, and a test asserts `published <= captured`.
