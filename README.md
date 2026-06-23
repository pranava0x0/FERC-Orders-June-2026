# FERC Large Load Show Cause Orders: DOE ANOPR → §206 (June 18, 2026)

A static, dependency-free microsite that traces the regulatory arc from the Department of Energy's
**October 23, 2025 Section 403 directive / ANOPR** (FERC Docket No. **RM26-4-000**) to FERC's
**June 18, 2026 tailored Section 206 show cause orders** (Items **E-7 through E-12**,
Docket Nos. **EL26-67-000 to EL26-72-000**) directed at all six RTOs/ISOs.

Built for an energy-regulatory audience. Five tabs:

1. **Overview**: the six headline figures, an at-a-glance block (authority, dockets, reporter cite,
   commissioners), and a short background on the regulatory arc.
2. **Timeline**: the chronology (Oct 2025 → Jun 2026) and why FERC chose tailored §206 show cause
   orders over a generic NOPR.
3. **Reforms**: the five reform categories, the transmission-vs-retail jurisdictional boundary, and the
   per-RTO regional distinctions, grounded in the orders' published framing.
4. **Dockets (E-7 to E-12)**: the six per-RTO order cards, with each quoted directive linked to the
   exact page of the committed order PDF, plus how to file or follow each docket.
5. **Discourse**: stakeholder reception, named commentary across the political spectrum, and
   trade-press narratives.

## Run locally

No build step, no dependencies.

```bash
# any static server; e.g.
cd docs && python3 -m http.server 8000
# open http://localhost:8000
```

## Test

```bash
node --test tests/*.test.mjs   # 19 tests across both suites
```

Two suites, no dependencies:

- `tests/data.test.mjs`: data-layer integrity. All six dockets present and correctly mapped, all five
  reform categories, every source id resolves, count floors, archive URLs present, and every displayed
  directive quote appears verbatim in `sources/text/orders/*.txt`.
- `tests/source-accuracy.test.mjs`: accuracy. Displayed order metadata, directives, region-specific
  claims, and FERC/DOE summary claims are each supported by the extracted source text.

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
  with paragraph cites; the structured extract is committed at
  [`sources/orders-extract.json`](sources/orders-extract.json). The PDFs themselves live in
  `sources/pdf/orders/` (gitignored, large binaries; re-downloadable from the linked URLs).

Capture date: **2026-06-22**. Sources and extracted text live in [`sources/`](sources/), including the
complete machine-readable text of all six orders in [`sources/text/orders/`](sources/text/orders/)
(1.73M chars; a test asserts every quoted directive appears verbatim there).

See also: [`design-notes.md`](design-notes.md) (visual identity) · [`LEARNINGS.md`](LEARNINGS.md)
(what this build taught) · [`agent-runs.md`](agent-runs.md) (subagent run stats + evaluation) ·
[`issues.md`](issues.md) (audit trail).
