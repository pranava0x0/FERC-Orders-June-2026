# issues.md — audit trail

Format: date · area · description · root cause (code/test/data/source) · status.

## Open

- **2026-06-24 · data · one comment body (ETI, `20251121-5225`) will not download.** Of the 270 RM26-4
  comments carrying attachments, 269 bodies were bulk-downloaded via the iframe grinder; ETI Comments
  (Entergy Texas) is the lone holdout across five attempts (main-frame click ×2, iframe retry, dedicated
  60s iframe, URL-intercept). Root cause: **source-side** — the filelist link renders and the click
  fires, but it triggers no `window.open`, no navigation, and no download (the other 269 behave
  identically), so eLibrary appears to serve this one file inline rather than as an attachment. Status:
  **Open (known gap)** — the file is inventoried in `rm26-4-files.json` and re-downloadable; the site
  reads "269 of 270." Not worth further automation for a single document.

- **2026-06-24 · test · `source-accuracy` maps `extract.deadlines` as objects
  (`${deadline.para} ${deadline.action} ${deadline.days}`) but the deadlines are plain strings**, so
  the deadlines contribute `"undefined undefined undefined"` and back no order-claim support. Harmless
  today — no displayed `reg` finding relies solely on a deadline fact (the NYISO 45-day / 90-day
  abeyance lives in the unaudited `unique` headline and in the Timeline), but a future `reg` claim that
  cites only a deadline would fail to find support. Root cause: **test**. Status: Open (low) — logged,
  not fixed mid-task to avoid unmasking unrelated latent matches.

## Fixed

- **2026-06-24 · data · Respondent counts recounted from the OCR'd order captions.** The displayed
  "N named transmission owners" was off for two orders: MISO showed "~31" (an estimate) but the caption
  lists **30**; SPP showed "23" but the caption lists **22**. PJM's page-1 caption is OCR-linearized
  with "Docket No." mid-column, which truncates a naive read at 33 — the full **45** come from the
  statement-cover page (used for the committed roster). Fix: `data.js` + `orders-extract.json` set to the
  exact list lengths, each docket now ships a full `respondentList`, and `tests/data.test.mjs` asserts
  `respondentList.length === stated count` with no duplicates. Root cause: **data** (estimate / OCR
  caption column layout).

- **2026-06-22 · efficiency · Saving the six orders' full text via LLM subagents failed and wasted
  ~974K tokens.** Root cause: **wrong tool** — a `save-order-fulltext` workflow had 6 Opus agents read
  ~100-page PDFs page-by-page (with truncation re-reads); they hit the session token limit and wrote
  nothing (412 tool calls, 0 output). **Fix:** the PDFs have an embedded text layer, so extraction is
  deterministic — re-did it with a ~30-line PyMuPDF (`fitz`) script in ~2 s for 0 tokens, producing
  `sources/text/orders/*.txt` (1.73M chars). A regression test confirms all 53 extracted directive
  quotes appear verbatim in those files. Lesson in `agent-runs.md`: never LLM-transcribe a text-layer
  PDF — use a library; spend tokens only on judgement.

- **2026-06-22 · source retrieval · The six order PDFs (`ferc.gov/media/e-7…e-12`, EL26-67…72)
  were not machine-retrievable.** Root cause: **source-side** — ferc.gov sits behind a Cloudflare
  "Just a moment" JS challenge that returns HTTP 403 to curl, WebFetch, the PDF-fetch tool, and the
  Wayback Save-Page-Now crawler (HTTP 520). **Fix:** the user opened the six PDFs in a real Chrome
  (which passes Cloudflare) and downloaded them; they were OCR'd 2026-06-22, page-1 captions verified
  (195 FERC ¶ 61,211–61,216, 92–119 pp), and a 6-agent extraction folded quoted directives + paragraph
  cites into Tab 2. Structured extract committed at `sources/orders-extract.json`. Note: the AppleScript
  bridge could not run JS because Chrome's "Allow JavaScript from Apple Events" is off by default — a
  security setting only the user can toggle — so manual browser download was the working path.

- **2026-06-22 · build · `design.md` write collided with existing `DESIGN.md`** on the
  case-insensitive macOS filesystem. Root cause: **environment**. Fix: named the project identity
  file `design-notes.md`.
