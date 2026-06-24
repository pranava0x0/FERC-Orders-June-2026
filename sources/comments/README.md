# RM26-4-000 public comments — capture pipeline & audit trail

Everything under this folder is the saved record of the public comments filed on the DOE §403
ANOPR (FERC Docket **RM26-4-000**), scraped from FERC eLibrary on **2026-06-24**. The website
(`docs/`) renders a summary of it; this is the primary material behind that summary.

## The chain (each step feeds the next)

```
docket sheet (eLibrary, Angular SPA, Cloudflare-gated)
  └─ 1. scrape ───────────────► rm26-4-manifest.raw.json      (all 423 filings, raw)
  └─ 2. classify ─────────────► rm26-4-comments.json           (273 comments + 17 stakeholder buckets + stats)
  └─ 3. inventory (GetFileListFromP8 JSON API) ► rm26-4-files.json  (per-accession file/attachment list, all 273)
  └─ 4. download bodies ──────► files/<accession>/<name>.pdf|docx  (+ <name>.txt extracted)
  └─ 5. summarize (flagships) ► summaries/<accession>.json     (stance per reform category + verbatim quote)
  └─ 6. aggregate ────────────► rm26-4-audit-index.json         (one row per comment: the whole chain)
                                rm26-4-categorization.json      (stances tallied across summaries)
```

`rm26-4-audit-index.json` is the index of record: for every comment it threads accession →
eLibrary URL → inventoried files → downloaded? → summary? → bucket. It distinguishes three states:
**inventoried** (file list pulled, all 273), **downloaded** (body on disk + text-extracted), and
**summarized** (read in full as a flagship).

## How to run it

Prerequisite for steps 1/3/4: a real Chrome tab on `elibrary.ferc.gov` (the host is behind a
Cloudflare/F5 challenge that blocks server-side fetches), driven via the `Control_Chrome` tools.
For step 4, Chrome also needs **Automatic downloads → Allow** for the site (see the grinder header).

| Step | Tool | Notes |
|------|------|-------|
| 1–2 scrape + classify | `tools/analyze-comments.mjs` | page the docket table in-browser → manifest → classify type + bucket |
| 3 inventory | (in-browser `GetFileListFromP8` calls) → `rm26-4-files.json` | open JSON metadata API; covers all 273 |
| 4 download | **`tools/grind-comment-downloads.js`** (browser) → **`tools/organize-comment-files.py`** (shell) | grinder clicks every PDF/DOCX link via hidden iframes; organize moves `~/Downloads/<acc>_*` → `files/<acc>/` and text-extracts with fitz. Both idempotent. |
| 5 summarize | hand-authored `summaries/<accession>.json` | read the extracted `.txt`; one structured summary per flagship |
| 6 aggregate | `tools/build-comment-audit.mjs` | regenerate the audit index + categorization; re-run as bodies/summaries land |

The download step is the slow one: each accession is a navigate-render-click, ~25–30% miss on
the first pass (Angular slow to render under concurrency), so re-run the grinder over
`window.__g.fail` at lower concurrency until the fail set stops shrinking.

## PDF storage policy — committed to the repo, **not** served by GitHub Pages

- Comment bodies (PDF/DOCX) live **here, under `sources/comments/files/`** — committed to GitHub so
  the audit trail is self-contained and the record survives if eLibrary reorganizes.
- They are deliberately **outside `docs/`**, which is the only folder GitHub Pages publishes. So the
  binaries are in the Git repo (clonable) but **never deployed to the public Pages site**, which keeps
  the published payload small. The website links each comment to its **eLibrary filing**, not to a
  local copy — it has no runtime dependency on these files.
- The **only** PDFs under `docs/` are the six §206 order PDFs in `docs/orders/`, which *are* deployed
  because the inline `#page=` citations open them in the browser. That is the "absolutely needed"
  exception; comment PDFs do not qualify. A test (`tests/data.test.mjs`) enforces that no other PDFs
  reach `docs/` and that the site references comments only via eLibrary.
- `.gitignore` blocks `*.pdf`/`*.docx` globally, with explicit allow-list exceptions for
  `docs/orders/`, the DOE letter, and `sources/comments/files/**`.
