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

- **2026-07-28 · data/accuracy · the Aug 3 abeyance step was scoped "NYISO only," but the mechanism is in
  all six orders.** Surfaced while researching the news refresh: ISO Newswire (2026-06-29) reports ISO-NE
  planning a 90-day abeyance request, which contradicted the site's label. Verified locally against
  `sources/text/orders/*.txt`: "abeyance" appears 7–8 times in **every** order (e.g., E-11 ISO-NE:
  requests due "within 45 days of issuance," "limited to 90 days," granted with "great disfavor," partial
  abeyance contemplated). Was mis-scoped in three places: `procedural.steps` id `abeyance` ("Abeyance
  request (NYISO only)" · cite "E-12 (NYISO) P 42"), the ≈Aug 17 timeline entry ("in the NYISO order, a
  45-day deadline…"), and the "Fall 2026, if requested" timeline entry ("NYISO's order expressly lets
  respondents request abeyance") — with the masthead next-deadline chip displaying the mislabeled step
  (Aug 3 is the soonest upcoming date). Root cause: **data** — the provision was read in full in the NYISO
  order and assumed unique to it; no cross-order grep before shipping the "(NYISO only)" claim. Status:
  **Fixed** (this session, plan Phase 0 of `news-tracks-plan.md`): step relabeled to the all-six scope with
  the FERC "not reflexively / great disfavor" caveat, both timeline entries corrected (`e11` added as a
  source on the Fall entry), llms.txt regenerated (no delta; the procedural block isn't baked into it), and
  a regression test added (`tests/data.test.mjs`) that rejects any single-RTO scoping AND greps all six
  committed order texts for the provision. 82/82 tests pass.

- **2026-07-14 · ux (found in UAT of the crosswalk) · the policy map was the highest-value view but two
  clicks deep with no signpost.** Reaching it meant Comments tab → "By issue" sub-tab (and the default
  Comments sub is "Themes & categories," so the map isn't even first). Neither label advertises a policy
  crosswalk, and the Comments overview didn't link to it. Root cause: **ux** (discoverability). Status:
  **Fixed** (`8d78b94`) — a "The policy map" callout at the top of the Comments overview links straight
  to it (`#comments/issue`).
- **2026-07-14 · ux (found in UAT) · no way back to the policy map from inside an issue read.** Once you
  drilled into an issue, the only routes back to the landing map were the sub-tab or hand-editing the URL;
  the left outline only swaps issues. Root cause: **ux** (a drill-down with no exit). Status: **Fixed**
  (`8d78b94`) — a "← Policy map" link atop the issue reader restores the landing via the existing route.
- **2026-07-14 · js (found in UAT) · the "planning" Section IV deep-link resolved to `aq:expedited`
  instead of `pr:flex`.** Two crosswalk rows carried `briefingId:"planning"`, and the link helper took the
  first. Root cause: **code** (non-unique join key). Status: **Fixed** (`0358ee6`) — dropped the stray
  `briefingId` on `aq:expedited` (its open item is DOE's 60-day question, not a Section IV item) and made
  the helper prefer the `pr:` reform issue.
- **2026-07-10 · js (found in code review) · a permalinked / cross-nav comment could land hidden behind
  an active filter.** `applyCommentsRoute`'s `acc` branch selected the All-comments sub and scrolled to
  `#c-<acc>` but never cleared the token filter. Scenario: filter to `rg:pjm`, open a By-issue reader,
  click a non-PJM filer's org (its link is `#comments/c=<acc>`) — the target row is still `hidden` from
  the PJM filter, so `scrollIntoView` no-ops and the flash lands on an invisible element; the user sees
  the filtered list without their target. Same for opening a shared `#comments/c=<acc>` link mid-session
  with a filter active. Root cause: **code** (missing filter reset on the permalink entry point). Fix:
  `setFilterState("", "")` in the `acc` branch so a permalink always shows its row in the full list.
  Status: **Fixed** (verified: PJM-filtered → open a non-PJM permalink → filter clears, row visible).

- **2026-07-09 · js · the By-issue wiring silently no-op'd: `wireComments()` referenced `CM` out of
  scope.** `CM` (`window.FERC_COMMENTS`) is a local of `renderComments`; the new By-issue block in
  `wireComments` opened with `(CM.issues || []).forEach(…)`, throwing a `ReferenceError` on the first
  line, so every listener defined after it (the issue-outline click handler, `applyCommentsRoute`, the
  pending-route consume) never attached — the outline rendered but nothing responded, and the preview
  console showed no error. Root cause: **code** (assumed a sibling function's local was visible). Fix:
  bind `var CM = window.FERC_COMMENTS;` at the top of `wireComments`. Status: **Fixed** (verified: the
  deep-link, outline click, and org cross-nav all work). Lesson in LEARNINGS.md (silent-abort during init).

- **2026-06-30 · a11y · collapsible-section titles dropped their heading semantics.** Folding the
  Toplines / Jurisdictional / Regional / Discourse `head()` sections into `<details>` accordions rendered
  the title as a styled `<span class="acc-h2">`, so screen-reader heading navigation and the document
  outline lost seven section landmarks. Root cause: **code** (semantic regression in `accSection`). Status:
  **Fixed** (PR #10) — the span now carries `role="heading" aria-level="2"`. Flagged by Codex and the
  inline code review. (A first pass used a real `<h2>`, reverted after a block heading in a flex `<summary>`
  read as 800 px mid-reflow; see the DESIGN.md "don't trust a mid-reflow measurement" note — the 800 px was
  a measurement artifact, the steady-state height is fine, but span+role is the lighter summary anyway.)
- **2026-06-30 · honesty · consensus heatmap could colour an all-neutral cell "contested" (amber).** A cell
  whose audited letters all take a *neutral* stance has net 0, which banded as `mixed`/"contested" — overstating
  friction in a map whose point is consensus-vs-contest (one real cell today: Oil & gas × proximate generation,
  below the displayed top-12). Root cause: **code** (band ignored the all-neutral case). Status: **Fixed**
  (PR #10) — `band()` returns a `neutral` "no position" band when support+oppose+mixed is 0; the legend keys
  it only when present. Found by the inline review.
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

- **2026-07-28 · data layer · A new `data.js` section was silently `undefined` in the app.**
  The `tracks` registry was added as a `const` inside the `window.FERC_DATA` IIFE but not to the
  explicit `return { … }` list at the bottom, so `D.tracks` was `undefined`. Root cause: **code bug**.
  The failure was silent in both directions: the app rendered zero track cards and zero chips with no
  console error (every consumer did `D.tracks || {}`), and the tests passed vacuously because they
  iterated the same empty object. Caught only by counting rendered nodes in the browser.
  **Fix:** added `tracks` to the return list. **Regression guard:** the tracks tests now assert a
  populated registry (`Object.keys(D.tracks).length >= 5`) before iterating, so an empty section fails
  loud instead of passing over nothing. Noted in REFRESH.md gotchas: adding a section to `data.js` is
  two edits, never one.

- **2026-07-28 · tooling · Timeline event bodies were covered by no quote sweep.**
  `tools/verify-quotes.mjs` swept order directives, commissioner statements, Discourse voices/themes
  and some prose, but never `D.timeline[].body`. Root cause: **coverage gap** — timeline bodies had
  historically only quoted order text, so the gap was invisible until the news refresh put named
  speakers (Swett, LaCerte) on the rail, where a fabricated or drifted quote would have shipped
  unchecked. **Fix:** a required sweep over timeline body prose quotes against
  `sources/news-evidence.json` + the committed corpus, plus a test naming the specific spans. Required
  quote count went 193 → 201 on the sweep addition alone.

- **2026-07-28 · local dev · A stale `data.js` in the browser cache read as a code bug.**
  After editing `data.js`, `http://localhost:8131` kept serving the previous file: the page showed new
  timeline events but an empty `tracks`, which looks exactly like a data-shape bug. `fetch()` of the
  same path returned the *correct* file, which is the tell. Root cause: **environment** (browser HTTP
  cache; `python3 -m http.server` sends no no-cache headers). **Fix:** load `http://127.0.0.1:8131`
  instead of `localhost` — a different host string is a separate cache entry. Check
  `window.FERC_DATA` in the console before debugging the renderer.

- **2026-07-28 · deploy · Asset cache tokens were not bumped, so a release could ship as an old app
  against new data.** Found by the Codex review on PR #14 (P1), not by me or by any test.
  `docs/index.html` loaded `styles.css`, `data.js` and `app.js` with the unchanged
  `?v=20260715a` while the PR replaced all three, so a returning visitor keeps the cached files. Worst
  case is not "stale site" but **skew**: an old `app.js` driving a new `data.js`, which renders as a
  data-shape bug that reproduces for users and never locally. Root cause: **process** — the token was
  one hand-typed date shared by every asset, and "remember to bump it" is not a mechanism.
  **Fix:** `tools/stamp-assets.mjs` derives each token from that file's own sha256, so assets bust
  independently and nobody has to remember; a test asserts the committed HTML matches the generated
  output (same contract as `build-llms.mjs`). `app.js`'s `ASSET_VER` (the cache key for lazily fetched
  bin-detail JSON) now reads the deployed token off its own `<script src>` rather than a literal, which
  could not have held app.js's own content hash without being circular.
  **Note the irony:** I hit this exact cache class three times locally and diagnosed it as a browser
  quirk each time instead of asking whether the deployed tokens had the same problem.

- **2026-07-28 · routing · The Timeline URL could disagree with the rail it was showing.**
  Found in self-review of PR #14 and reproduced in a browser. `pendingTimelineTrack` was a deep-link
  handoff cleared only inside `wireTimeline`, which runs on **first render only**; on the
  already-rendered path it stayed set, and `activate()` preferred it over the live `timelineTrack`.
  Repro: open Overview, click Timeline, follow a `#timeline/track/gov` link, pick a different track by
  chip, leave the tab and come back. The hash read `.../gov` while the rail showed `context`, so a
  copied permalink pointed at the wrong track. Root cause: **code bug**, two sources of truth for one
  piece of state. **Fix:** `timelineTrack` is now the only source of truth; the pending value is
  applied before `activate()` and is purely a before-first-render handoff. Same class as the PR #12
  permalink lesson: if the URL is authoritative, nothing else may quietly outvote it.

- **2026-08-03 · provenance · the 2026-06-26 "largely common, with some per-order tailoring" hedge itself
  overstated the tailoring.** That fix corrected an "identical across all six orders" overclaim after a
  spot-check found mismatches — but the spot-check had a false-positive problem (footnote/page-break
  splices in the OCR text register as "different" to a naive substring check). Redone with the project's
  own LCS-tolerant `carries()` matcher, correctly normalized on both sides this time: **4 of 5
  commissioners' statements are fully verbatim across all six orders; the 5th (Chang) has exactly one
  genuine addition**, a CAISO-specific footnote on E-10 (p. 111, on the Order No. 888 NITS framework).
  Root cause: **data** (an under-tested verification produced the wrong *scope* of correction, not just
  a wrong claim). Fix: `commishAside` field on E-10's docket entry (additive — renders alongside the
  normal five-commissioner list via `commishBlock()`, doesn't replace it, unlike the `commish` override
  built for E-2), corrected `sources.written` text per commissioner, and a new permanent regression tool
  `tools/verify-commish-tailoring.mjs` (wired into `tests/data.test.mjs`) so this stays true instead of
  being a one-time manual finding. Status: **Fixed**.

- **2026-08-03 · provenance · site claimed "no circuit-court petition" against the PJM co-location
  predecessor orders; four were filed in April 2026.** The `e2` track's 2026-07-28 status line said "Our
  checks found no circuit-court petition against the December 2025 or June 2026 co-location orders."
  Direct eLibrary verification (docket EL25-49-002) found Petitions for Review on file in both the Third
  Circuit (PJM Industrial Customer Coalition et al.; Exelon; Industrial Energy Consumers of America, No.
  26-1840) and the D.C. Circuit (American Transmission Systems and affiliated PJM transmission owners),
  all filed in late April 2026 — predating the 2026-07-28 sweep that claimed none existed. Root cause:
  **data** (the claim was never actually re-verified against eLibrary; it was carried forward from an
  earlier, unconfirmed read). Fix: `e2` track status corrected, new timeline entry (Jul 28, 2026, "PJM
  separately seeks more time on its co-location compliance filing") cites all four petitions. Status:
  **Fixed**.

- **2026-08-03 · code · `build-seo.mjs`'s Dataset JSON-LD block was inserted once and never updated
  again.** `if (!out.includes(DATASET_MARK)) out = out.replace("</head>", ...)` handled "insert if
  missing" but had no "replace if present" branch, so the block's `dateModified` (and every other baked
  field) silently froze at whatever it was the first time the block was created — every later
  `node tools/build-seo.mjs` run exited 0 having changed nothing about it. Surfaced by the
  `newsCapture` bump in this session's refresh: the sync test expected `2026-08-03`, got the
  first-ever-baked `2026-07-28`. Root cause: **code** (incomplete branch in an idempotent-generator
  pattern). Fix: match and replace the existing `<script type="application/ld+json">…Dataset…</script>`
  block in place (regex captures its leading whitespace too, so a re-run doesn't compound the indent —
  the first fix attempt did exactly that and had to be corrected again before landing). Status: **Fixed**.
