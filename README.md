# FERC Large Load Show Cause Orders: DOE ANOPR → §206 (June 18, 2026)

A static, dependency-free microsite that traces the regulatory arc from the Department of Energy's
**October 23, 2025 Section 403 directive / ANOPR** (FERC Docket No. **RM26-4-000**) to FERC's
**June 18, 2026 tailored Section 206 show cause orders** (Items **E-7 through E-12**,
Docket Nos. **EL26-67-000 to EL26-72-000**) directed at all six RTOs/ISOs.

Built for an energy-regulatory audience. Six tabs:

1. **Overview**: the six headline figures, an at-a-glance block (authority, dockets, reporter cite,
   commissioners), a short background on the regulatory arc, and a "what each commissioner emphasized"
   block drawn from the five concurring statements.
2. **Timeline**: the chronology (Oct 2025 → Jun 2026) and why FERC chose tailored §206 show cause
   orders over a generic NOPR.
3. **Reforms**: the five reform categories, the transmission-vs-retail jurisdictional boundary, and the
   per-RTO regional distinctions, grounded in the orders' published framing.
4. **Dockets (E-7 to E-12)**: six collapsible per-RTO accordions (the common §206 spine the orders share
   lives in the Reforms tab) — open one for what's unique to that system, the quoted directives
   (page-linked to the committed PDF and ferc.gov), the system-specific Section IV asks, what each
   commissioner said about that order (quote + page cite, both links), a variable-length distinct-findings
   list including each region's existing-tariff mechanics (each finding page-cited to the PDF + ferc.gov),
   and the full named-respondent roster — plus how to file or follow each docket.
5. **Comments (RM26-4)**: the comment-period summary — all 273 ANOPR comments in filing order with
   eLibrary links and a download/read indicator (filterable by org, type, principle, or region), the
   comment rounds (initial / reply / supplemental), a respondent-type breakdown across 19 stakeholder
   categories, the top themes, a per-comment tagging of which of the five reform principles and which of
   the six show-cause-order RTO regions each engages (keyword-detected, shown per row and in aggregate),
   and the nine read-in-full flagship comments with a stance-per-reform-category breakdown. Comment bodies
   are committed under `sources/comments/files/<accession>__<org-slug>/` (the path names the submitter) and
   validated by `tools/validate-comments.py`; the tab's data is generated from the manifest + extracted
   texts by `tools/build-comments-page-data.mjs` into `docs/js/comments-data.js`.
6. **Discourse**: stakeholder reception, named commentary across the political spectrum, and trade-press
   narratives (with a pointer to the Comments tab for the full filing breakdown).

## Run locally

No build step, no dependencies.

```bash
# any static server; e.g.
cd docs && python3 -m http.server 8000
# open http://localhost:8000
```

## Test

```bash
node --test tests/*.test.mjs   # 31 tests across both suites
```

Two suites, no dependencies:

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
- **RM26-4 public comments** (Docket No. RM26-4-000): all 423 docket filings scraped from FERC eLibrary,
  273 classified as comments with a per-accession file/attachment inventory, and the comment bodies
  downloaded and text-extracted under [`sources/comments/files/`](sources/comments/files/). The
  capture pipeline (scrape → grind-download → organize → audit) and the audit-trail layout are
  documented in [`sources/comments/README.md`](sources/comments/README.md); the bulk download runs
  through a real Chrome tab via [`tools/grind-comment-downloads.js`](tools/grind-comment-downloads.js)
  (eLibrary is Cloudflare-gated). **PDF storage policy:** comment PDFs/DOCX are committed to the repo
  but live **outside `docs/`**, so GitHub Pages (which publishes only `/docs`) never serves them — the
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
