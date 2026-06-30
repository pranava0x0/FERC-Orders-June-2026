# issues.md — audit trail

Format: date · area · description · root cause (code/test/data/source) · status.

## Open

- **2026-06-30 · ui/data · consensus heatmap shows a "net oppose" legend swatch with zero matching cells.**
  Of 60 visible stakeholder×reform cells, 41 are strong-support, 13 support, 6 contested, **0 net-oppose** —
  but the legend renders a net-oppose key, advertising opposition that isn't there. Two contributing causes:
  the net-banding is lenient, and the AI comment summaries under-select opposition (~80% precision / ~20%
  recall, PNNL caveat), so a true oppose could also be missed. Root cause: **code** (legend not filtered to
  the present-set) compounded by a **data** limitation. Status: **Open** — fix: render legend entries only
  for stances that occur, or state the absence; revisit banding. See DESIGN.md § 7 (net-vs-plurality).

## Fixed

- **2026-06-30 · accuracy · E-2 "minimum charge" finding cited p.277 (inside Chang's concurrence) for a
  majority holding.** The majority's determination ("does not adequately *substantiate*… we decline to
  establish an additional charge") is on pp.207–208; p.277 is Chang's individual statement and uses her
  paraphrase ("support"). Root cause: **source** (wrong page + paraphrase-vs-holding). Status: **Fixed**
  (commit 188ab52) — re-cited to p.207 with the majority wording; both prongs (need + how to calculate)
  noted. Caught by the FERC-attorney persona review.
- **2026-06-30 · ui · E-2 final order rendered §206 show-cause labels.** The co-location card reused the
  six orders' templates — "Directs the respondent to address", "What FERC presses PJM on", and a Section IV
  **briefing block with 5 quotes not present in E-2 at all** — reading a final order as an open clock. Root
  cause: **code** (render not gated on order type). Status: **Fixed** (188ab52) — gated all three on the
  card being a show-cause order; E-2 reads "What this order holds" / "What the order decides" + a `kind`
  line, no briefing. The misattributed briefing quotes passed silently because `verify-quotes.mjs` did not
  sweep `D.briefing`; that sweep was added (regression guard).

- **2026-06-26 · method/data · v2 comment summaries: recall is unmeasured (PNNL CommentNEPA caveat).**
  All 268 text-extracted RM26-4 comments now have auditable quote-centric summaries
  (`summaries-v2/`), verified against the method: the quote is the atomic unit (verbatim-tested),
  quotes are bracketed substantive-vs-boilerplate, binned bottom-up against the controlled vocab +
  emergent topics, each bin named with the filer's stance, plus an overall summary; the audit graph is
  body (`files/`) → versioned prompt (`tools/summarize-comments.workflow.mjs`) → output (`summaries-v2/`
  with a `source_text` pointer + accurate `provenance.model`). **What is NOT measured:** PNNL reports raw
  LLM extraction at ~78% precision / ~20% recall vs. subject-matter experts (the LLM *under-selects*). We
  enforce precision deterministically (verbatim coverage, vocab, lens=union, lint) and audit a flagged
  ~5%, but we have **no SME-selected gold set to measure recall** — a substantive position an extractor
  skipped would pass silently. Root cause: **method limitation** (no human baseline). Status: **Open
  (known limitation)** — every summary is `verified:false` (provisional); a human-verification pass with
  `verified_at` + feedback-aligned few-shot examples is the mitigation (backlog).
- **2026-06-26 · data · 8 large filings (>120 KB) summarized from a front-slice read, not the full body.**
  Worst case **Sierra Club `20260520-5102` (5.9 MB)** — its substantive argument is pp. 1–6 and the bulk
  is ~3,844 form letters in an appendix, so the front-slice read captured the argument well there, but for
  the others (SPP TO Group 350 KB, SELC coalition 261 KB, ECA 205 KB, Eolian 182/148 KB, Constellation
  157 KB) a position buried deep in an exhibit could be missed. Root cause: **read cap** (documented in
  `summarize-comments.workflow.mjs`). Status: **Open** — a page-windowed map-reduce over the whole body is
  the fuller pass (backlog).
- **2026-06-26 · data · extract-model variance across the corpus.** 183 summaries were extracted by
  Sonnet, 84 by Haiku (1 pilot "claude"); `provenance.model` records each accurately. Haiku was switched
  off mid-run because it over-reported writes on larger filings (~10–40% silent re-runs that the
  self-healing worklist recovered). All 268 pass the same deterministic bar, but quality variance between
  Haiku- and Sonnet-extracted summaries is **unmeasured**. Root cause: **process** (model switch).
  Status: **Open (low)** — spot-check or re-extract the 84 Haiku ones on Sonnet if a quality gap shows.

- **2026-06-24 · data · one comment body (ETI, `20251121-5225`) will not download.** Of the 270 RM26-4
  comments carrying attachments, 269 bodies were bulk-downloaded via the iframe grinder; ETI Comments
  (Energy Trading Institute) is the lone holdout across five attempts (main-frame click ×2, iframe retry, dedicated
  60s iframe, URL-intercept). Root cause: **source-side** — the filelist link renders and the click
  fires, but it triggers no `window.open`, no navigation, and no download (the other 269 behave
  identically), so eLibrary appears to serve this one file inline rather than as an attachment. Status:
  **Open (known gap)** — the file is inventoried in `rm26-4-files.json` and re-downloadable; the site
  reads "272 of 273." Not worth further automation for a single document.

- **2026-06-24 · data · four comment PDFs are image-only scans (no text layer).** `20251121-5224`,
  `20251121-5521` (Data Center Coalition), `20251121-5140` (Yurok Nation letter), `20251205-5005` —
  downloaded, but `fitz` extracts ~0 text. Root cause: **source-side** (scanned filings). Status: **Open
  (OCR-pending)** — no OCR tool installed locally; `tools/validate-comments.py` flags them every run.

- **2026-06-24 · data/code · validation recovered 3 bodies + hardened the pipeline. Fixed.** A
  `validate-comments.py` pass found and fixed: (1) Eolian `20260519-5158` and Sierra Club `20260520-5102`
  had empty inventory from the initial `GetFileListFromP8` pull — re-queried and backfilled
  `rm26-4-files.json`, then downloaded both; (2) filenames containing ";" are truncated by Chrome at the
  Content-Disposition separator (`"RM26-4; Antora….pdf"` arrives as `RM26-4`) — `organize` now restores
  `.pdf` from the PDF magic bytes (recovered Antora `20260518-5155`); (3) eLibrary appends a " *"
  availability marker to some link labels, so the grinder's ends-with regex skipped those files — it now
  strips the marker first.

- **2026-06-24 · test · `source-accuracy` maps `extract.deadlines` as objects
  (`${deadline.para} ${deadline.action} ${deadline.days}`) but the deadlines are plain strings**, so
  the deadlines contribute `"undefined undefined undefined"` and back no order-claim support. Harmless
  today — no displayed `reg` finding relies solely on a deadline fact (the NYISO 45-day / 90-day
  abeyance lives in the unaudited `unique` headline and in the Timeline), but a future `reg` claim that
  cites only a deadline would fail to find support. Root cause: **test**. Status: Open (low) — logged,
  not fixed mid-task to avoid unmasking unrelated latent matches.

## Fixed

- **2026-06-26 · provenance · Commissioner statements claimed "identical across all six orders" on a spot-check.**
  The themed per-commissioner summaries cited their quotes as "identical across all six orders," but that
  rested on one distinctive sentence (Swett's opener) appearing once in each order. The 2026-06-26 PR review
  asked to substantiate it; a strengthened test that checks every written quote against **all six** order
  texts found the concurrences are **largely common but NOT identical** — a handful of sentences are tailored
  per region (e.g., Swett's "status quo… not good enough" is absent from SPP/ISO-NE/NYISO; See has 2, Chang 3
  such quotes). Root cause: **data** (unverified "identical across N sources" assumption from a single
  spot-check). Fix: corrected the displayed claim to "largely common across the six orders, with some
  per-order tailoring," cite the PJM canonical copy, and the test now verifies each quote against the cited
  PJM order (and asserts no summary re-introduces the "identical across all six" overclaim). Status: **Fixed**.

- **2026-06-26 · test · `assert.deepEqual` of a vm-context array failed despite equal contents.** The data
  tests load `data.js` in a `node:vm` context; an array read from `D` has that context's `Array.prototype`,
  so `assert.deepStrictEqual(vmArray, [literal])` fails on a cross-realm prototype mismatch even when the
  elements match. Root cause: **test** (cross-realm identity). Fix: compare by content (`.join(",")`) instead
  of deep-equality on the cross-realm array. Status: **Fixed**.

- **2026-06-26 · a11y/UX · Respondent-roster "Show all" toggle dominated the org pills.** The
  `.cm-showmore` button had `min-height: 44px` + bold accent text + a heavy `rule-strong` border, so it
  rendered ~44 px tall next to ~18 px org pills and read as a primary CTA. Root cause: **code** — the
  44 px touch-target was applied unconditionally (it only matters for touch). Fix: chip-scale by default
  (font-weight 600, lighter border, `1px 9px` padding) with a quiet rotating chevron; the 44 px target is
  restored under `@media (pointer: coarse)`. Commit on `claude/comments-tagbar-docs`. Status: **Fixed**.

- **2026-06-26 · prose · New bin-detail foot-note shipped an em-dash + "X, not Y" parallelism.** The
  Comments-tab "Read the audited analysis" foot-note read "…drawn from — the audit trail… Stance is the
  filer's, not ours." — both patterns the `no-ai-isms` rule says to strip from displayed copy. Caught in
  the self-review of PR #4. Root cause: **code** (AI-register slipped into UI copy). Fix: reworded with the
  same meaning, no em-dash, no stark contrast. Regression bar: the existing prose lint; reviewers scan UI
  copy. Status: **Fixed**.

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
