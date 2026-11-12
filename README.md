# FERC Large Load Show Cause Orders: DOE ANOPR → §206 (June 18, 2026)

A static, dependency-free microsite that traces the regulatory arc from the Department of Energy's
**October 23, 2025 Section 403 directive / ANOPR** (FERC Docket No. **RM26-4-000**) to FERC's
**June 18, 2026 tailored Section 206 show cause orders** (Items **E-7 through E-12**,
Docket Nos. **EL26-67-000 to EL26-72-000**) directed at all six RTOs/ISOs.

Built for an energy-regulatory audience. Seven tabs:

1. **Now**: what is coming up, the latest entries, where each operator stands, and a swimlane graphic of the record.
2. **Orders**: what the June 18 orders require, as a reform-by-operator grid of directives linked to their pages, then the
   per-order cards (E-7 to E-12 and E-2). `#reforms` opens this tab at the grid.
3. **Filings**: every reading-room document (167) by proceeding, the six show cause dockets split by operator. Each
   document has its own reading in `sources/filings/documents/<slug>.json`: a summary, what the filer asks, page-cited key
   points quoting only that document, and its link to the June orders (relation plus order-directive anchors from
   `sources/filings/order-anchors.json`). Theme filters (`sources/filings/themes.json`) and a chart of the capacity figures
   the filings cite. Quoted points load per proceeding from `docs/data/filings/<id>.json`.
4. **Discourse**: commentary quotes, named views, press consensus and friction, and filed positions, as one tagged list
   (`sources/discourse/index.json`, built by `tools/build-discourse-index.mjs`) read by theme, date or speaker, each linked
   to its source and to the filings it discusses.
5. **Timeline**: what is ahead, then the record newest first, with a filter per proceeding.
6. **Commissioners**: recorded remarks by speaker and the June concurring statements.
7. **Comments (RM26-4)**: the 273 ANOPR comments, by theme, respondent type and letter (unchanged).

Read the [November 10 brief, with physical page citations](sources/filings/nov-10-brief.md).
The [filing reading room](docs/reading/index.html) links the June orders, operator reports,
motions, tariffs, testimony and responses to their original text by physical page. Start with
[what the state commissions said](docs/reading/positions.html#state-commissions), or inspect
[which records have no readable copy](docs/reading/coverage.html). The [source index](docs/reading/catalog.json)
contains stable document IDs, dates, page and token counts, and SHA-256 hashes.

## Run locally

No build step, no dependencies.

```bash
# any static server; e.g.
cd docs && python3 -m http.server 8000
# open http://localhost:8000
```

## Test

```bash
sh tools/refresh.sh            # rebuild every generated file, validate every quote, run the tests (--check: verify only;
                               # --sweep: read the eLibrary docket sheets first, Playwright + stable Chrome)
node tools/validate-documents.mjs --strict  # every per-document reading: quotes on their pages, anchors, coverage
node tools/build-order-anchors.mjs          # order directives -> sources/filings/order-anchors.json (--check)
node tools/build-discourse-index.mjs        # Discourse items tagged by theme and proceeding (--check)
node --test tests/*.test.mjs   # all suites
sh tools/refresh-reading-room.sh --check  # offline source, extraction, reader, asset and citation checks
node tools/verify-quotes.mjs   # whole-site quote audit (one command; --list for every quote)
node tools/uat-playwright.mjs  # headless UAT at 375px, 768px and 1280px: console, overflow, reader depth (serve docs/ on 127.0.0.1:8131 first)
node tools/check-staleness.mjs # advisory: passed deadlines, stale stamps, unobserved filings
node tools/validate-summaries.mjs        # the 268 comment summaries: verbatim quotes, vocab, bin links
node tools/survey-summaries.mjs          # DISCOVERY pass: distributions + smells nothing checks yet
node tools/reconcile-summary-bins.mjs    # repair quote<->bin links (idempotent; --dry-run to preview)
python3 tools/extract-abeyance-docs.py   # abeyance orders/errata/compliance -> committed text (--check)
node tools/news-sweep-plan.mjs           # build the news-sweep query matrix (--json, --check <file>)
node tools/build-seo.mjs       # bake crawlable content + freshness dates + sitemap (--check)
node tools/build-docket-pages.mjs # regenerate the seven per-docket pages (--check to verify)
node tools/stamp-assets.mjs    # content-hash the ?v= asset tokens (--check to verify)
python3 tools/build-og-image.py # regenerate the 1200x630 social card
```

Refreshing the data (new filings, news, docket activity) is its own runbook:
[REFRESH.md](REFRESH.md). It carries the open eLibrary verification queue and the retrieval
workarounds that actually work (notably: federalregister.gov bot-blocks its HTML pages but leaves its
JSON API and `full_text` endpoints open).

Suites, no dependencies:

- `tests/data.test.mjs`: data-layer integrity. All six dockets present and correctly mapped, all five
  reform categories, every source id resolves, count floors, archive URLs present, every displayed
  directive quote appears verbatim in `sources/text/orders/*.txt`, the comment audit trail resolves
  (each flagship's downloaded body + extracted text is committed), and the deployed `docs/` ships only
  the order PDFs (comment PDFs stay in `sources/`, off the Pages site).
- `tests/source-accuracy.test.mjs`: accuracy. Displayed order metadata, directives, region-specific
  claims, and FERC/DOE summary claims are each supported by the extracted source text. Also checks that
  each directive cite links to a PDF page that carries its quote, that every Discourse commentary quote
  matches captured evidence in `sources/voices-evidence.json`, and that `docs/llms.txt` is in sync with
  `data.js` (regenerate with `node tools/build-llms.mjs`).
- `tests/comment-summaries.test.mjs` + `tests/comment-detail.test.mjs`: the auditable v2 comment
  summaries and their generated bin-detail files: every quote verbatim in its source, controlled
  vocabulary, count floors, and each `docs/data/comments/<acc>.json` traces bin-for-bin and
  quote-for-quote back to `sources/comments/summaries-v2/` (a stale rebuild fails loud).
- `tests/quote-coverage.test.mjs` + [`tools/verify-quotes.mjs`](tools/verify-quotes.mjs): the whole-site
  quote sweep. Every structured quote (order directives & findings, commissioner statements, discourse
  voice/theme quotes) must appear verbatim in its committed source, and every embedded prose quote (in
  `unique`, the Overview summary, toplines) must resolve in the corpus. Run the script for a one-shot
  report; spoken auto-caption quotes are flagged as unverifiable (they live on YouTube, off the text).

## Generated pages

Beyond the single-page app, `docs/dockets/<docket>-<rto>/` holds one static page per order (seven:
E-7 to E-12 plus E-2), generated from `data.js` by `tools/build-docket-pages.mjs`. They exist because
the app is one URL: its tabs are hash routes, and a fragment is not a separate URL to a search
engine, so no order could rank for its own docket number. Each page carries that order's quoted
directives, region-specific findings and full respondent roster, so no two share a paragraph. A test
asserts they are in sync, that every title and description is distinct, and that every sitemap URL
resolves to a committed file.

## Deploy (GitHub Pages)

Serve from the **`/docs`** folder on the default branch:
*Settings → Pages → Build and deployment → Source: "Deploy from a branch" → Branch: `main` → `/docs`.*
The site is fully static; no Actions required.

## Provenance & honesty

- **DOE §403 letter** (16 pp.), downloaded and OCR/text-extracted from the primary PDF on energy.gov.
- **FERC press release, fact sheet, meeting summaries, and the RM26-4 docket page**: official FERC
  text, quoted against Internet Archive snapshots dated June 18 to 20, 2026 for stable citation (the live
  FERC pages are posted but sit behind a Cloudflare challenge that blocks automated retrieval).
- **The six order PDFs** (`ferc.gov/media/e-7…e-12`, **195 FERC ¶ 61,211 to 61,216**, 92 to 119 pp each),
  downloaded through a real browser that passes Cloudflare, then OCR'd. Each one's **page-1 caption was
  verified** (FERC cite, respondent RTO, docket, "Order Instituting Proceeding Under Section 206,"
  issued date) before its text was used. The per-order directives in Tab 2 are quoted from these PDFs
  with paragraph cites, and each cite links to the exact page; the structured extract is committed at
  [`sources/orders-extract.json`](sources/orders-extract.json). The six PDFs are committed under
  [`docs/orders/`](docs/orders/) and served by GitHub Pages (so `#page=` opens inline at the cited
  page); they remain re-downloadable from the linked ferc.gov URLs.
- **Item E-2**: the PJM co-location *rehearing* order (**EL25-49-002, 195 FERC ¶ 61,209**, 278 pp), the
  *Order on Rehearing, Clarification, Compliance Filing, and Paper Hearing* on the December 18, 2025 PJM
  Co-Location Order (193 FERC ¶ 61,217), voted the same June 18, 2026 meeting and finalizing the three new
  transmission services the six orders extend:
  was downloaded the same way (browser past Cloudflare, then PyMuPDF text extraction, page-1 caption
  verified, captured 2026-06-30) and committed under `docs/orders/`. Its directives, findings, and
  Commissioner Chang's separate concurrence are quoted verbatim with page cites; the structured extract
  lives alongside the six in [`sources/orders-extract.json`](sources/orders-extract.json).
- **RM26-4 public comments** (Docket No. RM26-4-000): all 423 docket filings scraped from FERC eLibrary,
  273 classified as comments with a per-accession file/attachment inventory, and the comment bodies
  downloaded and text-extracted under [`sources/comments/files/`](sources/comments/files/). The
  capture pipeline (scrape → grind-download → organize → audit) and the audit-trail layout are
  documented in [`sources/comments/README.md`](sources/comments/README.md); the bulk download runs
  through a real Chrome tab via [`tools/grind-comment-downloads.js`](tools/grind-comment-downloads.js)
  (eLibrary is Cloudflare-gated). **PDF storage policy:** comment PDFs/DOCX are committed to the repo
  but live **outside `docs/`**, so GitHub Pages (which publishes only `/docs`) never serves them: the
  site links each comment to its eLibrary filing instead. The six order PDFs under `docs/orders/` are
  the only deployed PDFs (they back the inline citations); a test enforces this split.

Capture date: **2026-06-22** (the secondary commentary in the Discourse tab was gathered **2026-06-23**,
with a **2026-06-24** refresh adding post-issuance analysis and critiques).
Sources and extracted text live in [`sources/`](sources/), including the complete machine-readable text
of all six orders in [`sources/text/orders/`](sources/text/orders/) (1.73M chars; a test asserts every
quoted directive appears verbatim there).

For LLM and agent consumers, [`docs/llms.txt`](docs/llms.txt) (llmstxt.org) is generated from `data.js`
via `node tools/build-llms.mjs` and served at the site root; a test keeps it in sync with the data.

See also: [`design-notes.md`](design-notes.md) (visual identity) · [`LEARNINGS.md`](LEARNINGS.md)
(what this build taught) · [`agent-runs.md`](agent-runs.md) (subagent run stats + evaluation) ·
[`issues.md`](issues.md) (audit trail).
