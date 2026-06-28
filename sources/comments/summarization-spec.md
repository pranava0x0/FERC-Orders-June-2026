# Comment summarization — spec & schema (PNNL "CommentNEPA" approach)

Quote-centric, bottom-up, auditable. The **quote is the atomic unit**; bins are built on quotes;
each bin is a short **name** + a longer **description** synthesized from the quotes it holds. Every
value traces back to a verbatim span of the filing.

## Subtasks (per comment)

1. **Chunk + bracket** — read the extracted body; separate substantive comment text from boilerplate
   (captions, signature blocks, certificates of service, headers/footers).
2. **Extract substantive quotes** — pull verbatim spans that carry a position, ask, or argument. Each
   gets a one-line `concern` (plain paraphrase). Skip throat-clearing; keep the load-bearing language.
3. **Bin the quotes** — map each quote to one or more bins drawn from the controlled vocabulary below
   (the three lenses), plus *emergent* `topic:` bins for substantive themes the lenses miss.
4. **Name + describe each bin** — a short `name` (3–6 words) and a `description` (1–3 plain sentences)
   synthesized from *that bin's quotes*, with a `stance` and the `quote_ids` it rests on.
5. **Overall summary** — 1–3 sentences on the filing's overall position.

The keyword lenses already on each comment (`build-comments-page-data.mjs`) are the **prior + a
cross-check**: the bins should broadly agree, and divergence is a signal to inspect — never ship the
LLM pass unaudited (PNNL report ~78% precision / ~20% recall on raw extraction; experts select more).

## Controlled vocabulary (bin namespaces)

- `aq:<key>` — DOE ANOPR comment-period questions: `jurisdiction, threshold, jointstudy, deposits,
  hybridrights, protection, expedited, upgradecost`.
- `pr:<key>` — June-order reform principles: `study, cost, colo, flex, proximate`.
- `rg:<key>` — show-cause-order regions: `pjm, miso, spp, caiso, isone, nyiso`.
- `topic:<slug>` — emergent topic the lenses don't capture (e.g. `topic:tariff-transparency`).

Labels + plain descriptions for `aq`/`pr`/`rg` live in `tools/build-comments-page-data.mjs`.

## Output schema — `summaries-v2/<accession>.json`

```json
{
  "accession": "20251121-5440",
  "filer": "Microsoft Corporation",
  "org_type": "data_center",
  "filed": "11/21/2025",
  "source_text": "sources/comments/files/<accession>__<org-slug>/<name>.txt",
  "overall_summary": "Plain 1–3 sentence read of the filing's position.",
  "quotes": [
    { "id": 1, "text": "verbatim span from the body", "concern": "one-line paraphrase",
      "bins": ["aq:upgradecost", "pr:cost", "rg:pjm"], "page": 8 }
  ],
  "bins": [
    { "key": "pr:cost", "name": "Short bin name", "stance": "support|oppose|mixed|neutral",
      "description": "1–3 plain sentences synthesized from this bin's quotes.", "quote_ids": [1] }
  ],
  "lenses": { "aq": ["upgradecost"], "pr": ["cost"], "rg": ["pjm"] },
  "provenance": { "model": "claude", "generated_at": "YYYY-MM-DD", "method": "agentic-subagent",
                  "verified": false }
}
```

## Rules

- **Quotes are verbatim** — copy exactly (a test asserts each `quote.text` appears in the source `.txt`).
- **`page` is stamped, not hand-authored** — run `node tools/stamp-comment-pages.mjs` after writing/editing
  summaries. It locates each quote's start in the page-marked body (`--- PAGE N ---`) and writes the page
  it begins on, or `null` when the body has no markers or the start can't be located with confidence
  (never guess). A test recomputes and asserts every stored `page` matches.
- **`lenses` is the union** of its bins' `aq`/`pr`/`rg` keys — the fast filter for the UI.
- **`stance` is the filer's**, never the curator's; `neutral` when the bin only describes.
- **`verified: false`** until a human audits it — these are provisional (the "AI-synthesized values are
  provisional" rule). Stamp `generated_at`; keep `source_text` so every summary traces to its body.
- Plain language, no AI register, in `name`/`description`/`overall_summary`/`concern`. Quotes excepted.

## Run

A subagent per comment reads the body `.txt` and emits the JSON above; the orchestrator writes it to
`summaries-v2/<accession>.json`, then `build-comment-audit.mjs` + `build-comments-page-data.mjs` regenerate.
The 9 hand-authored flagships use an earlier (compatible) shape and are re-emitted into this schema.
