# FERC Large Load Show Cause Orders — DOE ANOPR → §206 (June 18, 2026)

A static, dependency-free microsite that traces the regulatory arc from the Department of Energy's
**October 23, 2025 Section 403 directive / ANOPR** (FERC Docket No. **RM26-4-000**) to FERC's
**June 18, 2026 tailored Section 206 show cause orders** (Items **E-7 through E-12**,
Docket Nos. **EL26-67-000 – EL26-72-000**) directed at all six RTOs/ISOs.

Built for an energy-regulatory audience. Three tabs:

1. **Timeline & Toplines** — the chronology (Oct 2025 → Jun 2026) and why FERC chose tailored §206
   show cause orders over a generic NOPR.
2. **The Dockets (E-7–E-12)** — the five reform categories, per-RTO distinctions, and the
   transmission-vs-retail jurisdictional boundary, grounded in the orders' published framing.
3. **News & Discourse** — stakeholder reception and trade-press / policy narratives.

## Run locally

No build step, no dependencies.

```bash
# any static server; e.g.
cd docs && python3 -m http.server 8000
# open http://localhost:8000
```

## Test

```bash
node tests/data.test.mjs
```

Validates the data layer: all six dockets present and correctly mapped, all five reform categories,
every record carries ≥1 source, and append-only count floors hold.

## Deploy (GitHub Pages)

Serve from the **`/docs`** folder on the default branch:
*Settings → Pages → Build and deployment → Source: "Deploy from a branch" → Branch: `main` → `/docs`.*
The site is fully static; no Actions required.

## Provenance & honesty

- **DOE §403 letter** (16 pp.) — downloaded and OCR/text-extracted from the primary PDF on energy.gov.
- **FERC press release, fact sheet, meeting summaries, and the RM26-4 docket page** — official FERC
  text, captured from Internet Archive snapshots dated June 18–20, 2026 (the live FERC pages sit
  behind a Cloudflare challenge that blocks automated retrieval).
- **The six individual order PDFs** (`ferc.gov/media/e-7…e-12`) are **not** machine-retrievable
  (same Cloudflare gate, and not yet in the Wayback Machine). Per-order specifics are therefore drawn
  from FERC's own cross-order materials (press release + fact sheet, which enumerate the regional
  distinctions verbatim), the DOE ANOPR principles, and named legal/industry analyses — **not** from
  the order text itself. Every such item is tagged `Analysis` and links to the underlying order PDF
  so a reader can verify against the primary source.

Capture date: **2026-06-22**. Sources and extracted text live in [`sources/`](sources/).

See [`design-notes.md`](design-notes.md) for the visual identity and [`issues.md`](issues.md) for the
audit trail.
