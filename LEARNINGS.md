# LEARNINGS.md — what this session taught (FERC large-load build)

Durable, reusable lessons from building this microsite. Scoped to things that cost real time or
tokens here and will recur. Project-specific retrieval notes also live in the session memory; the
run-by-run numbers are in [`agent-runs.md`](agent-runs.md); per-bug detail is in [`issues.md`](issues.md).

## Retrieval — Cloudflare-gated government documents

- **ferc.gov / cms.ferc.gov sit behind a Cloudflare "Just a moment" JS challenge.** It returns
  **HTTP 403** to *every* automated client: `curl`, WebFetch, the PDF-fetch MCP, and the Wayback
  Save-Page-Now crawler (520). Don't burn attempts cycling user-agents/headers — none pass it.
- **The reliable path is a real browser the user already has.** It holds the Cloudflare clearance
  cookie. Either (a) the user downloads the PDFs and you read them from `~/Downloads`, or (b) you fetch
  same-origin from a logged-in tab. The on-machine PDF-fetch tool still 403s because it doesn't carry
  the browser's cookie.
- **`Control_Chrome` can `open_url`/`list_tabs` but not run JS** until Chrome's
  *View ▸ Developer ▸ Allow JavaScript from Apple Events* is checked — a **security setting only the
  user can toggle** (I can't, and shouldn't). The misleading error is "Google Chrome is not running."
- **`computer-use` `request_access` timed out (300 s, backend unresponsive)** in this environment, and
  the Claude-in-Chrome extension wasn't connected — so neither was a viable fallback. Don't assume
  computer-use is available; probe once, then move on.
- **The Internet Archive has the FERC *HTML* pages but not the order PDFs.** Pull the raw snapshot with
  the `…id_/` modifier and `gzip.decompress` it yourself (Wayback replays the original gzip bytes
  without a matching `Content-Encoding`, so `curl --compressed` won't auto-decode).

## Extraction — never LLM-transcribe a text-layer PDF

- **The single most expensive mistake here:** a 6-agent workflow read six ~100-page order PDFs
  page-by-page to dump their full text. It burned **~974K tokens / 412 tool calls, hit the session
  limit, and wrote nothing.** A 30-line PyMuPDF script did the identical job in **~2 s for 0 tokens.**
- **Rule:** if a PDF has an embedded text layer (these did — the MCP extracted clean text incl.
  footnotes), extract it **deterministically** (`fitz` / `pdfplumber` / `pdftotext`). Check for those
  libs *first* (`python3 -c "import fitz"`). Spend LLM tokens only on *judgement* (which passages
  matter, what they mean), never on mechanical OCR-dump work a library does for free and more reliably.
- **Agent fan-out economics:** parallel agents shine for *judgement at breadth* (Run 1 — extract the
  directives that matter from 6 orders, 437K tokens, well spent). They are the wrong tool for bulk
  transcription. And a big fan-out can fail *wholesale* on a session token limit — returning nothing —
  so prefer deterministic/local for bulk.

## Provenance for citation-grade / regulatory work

- **Link the fixed snapshot, not the live page.** Live gov pages drift or gate (403); a regulatory
  reader must reach the exact text a claim was checked against. Carry an `archiveUrl` and have source
  chips prefer it; keep the live URL as secondary context.
- **Separate evidence tiers visibly** (primary FERC / primary DOE / secondary analysis) and register
  *every* secondary source with an exact capture date and a scope note ("backs Tab 3 reception only,
  never a primary finding"). Reviewers will (correctly) reject month-level dates and un-listed sources.
- **Verify against an independent oracle, then lock it with a test.** After extracting quotes via an
  agent, the full text from a *deterministic* extractor is the oracle: assert every quote appears
  verbatim there (we got 53/53; the 5 near-misses were curly-vs-straight apostrophes and one dropped
  OCR footnote marker). A regression test that re-checks this each run beats "trust the agent."
- **Caption-verify before trusting content.** For each order, confirm the page-1 caption (reporter
  cite, respondent, docket, "Order Instituting Proceeding Under Section 206," issued date) before using
  any of its text. Six *sequential* reporter cites (61,211→61,216) that also match the docket→RTO map is
  strong evidence against hallucination — internal consistency a fabricator wouldn't reproduce.
- **Commit the machine-readable text, strip trailing whitespace.** Save extracted text so it's reusable
  and diffable; `rstrip` each line so `git diff --check` stays clean and future source diffs are
  reviewable.
- **Never claim "identical across N sources" from a spot-check — verify across all N.** The commissioner
  statements were labeled "identical across all six orders" on the strength of one distinctive sentence
  appearing once per order. A PR-review-driven test that checked *every* written quote against *all six*
  order texts found they're **largely common but not identical** (a few sentences are tailored per region).
  Verify the actual claim you display, then weaken it to what the data supports ("largely common, with
  per-order tailoring") and cite the specific copy you quoted from. The strengthened test now both guards
  fidelity and keeps the claim honest.
- **Auto-caption transcripts are not citation-grade.** `yt-dlp --write-auto-subs` is great for *what was
  said* but mangles proper nouns (it rendered "Swett"→"Sweatt", "LaCerte"→"LaFleur"). Use spoken quotes to
  capture emphasis the written record lacks, but label them "spoken · auto-caption," tint them distinctly,
  and keep them out of the verbatim test — only the written record is verbatim-checkable.
- **A strengthened test is the best way to "address a review."** Two PR-review findings (the "identical"
  overclaim; the briefing § IV page cite being range-checked only) were resolved by making the *test*
  stricter — check all six orders; assert the cited page actually carries the "Briefing Questions" heading.
  The bug surfaces, the fix is forced, and the guard stays.

## Page-deep links into the order PDFs

- **FERC's published order PDFs drop their paragraph numbers from the text layer.** `fitz` recovers the
  body text and inline footnote superscripts, but the marginal paragraph numbers — the "P 77" a cite
  points to — aren't in the text at all, so a paragraph cite *cannot* be resolved to a page by number.
  Anchor instead to **the page where the quoted directive text appears**, located by splitting the
  extract on its `--- PAGE N ---` markers. A test asserts each linked page actually carries the quote,
  via longest-common-substring tolerant of inline footnote breaks (`technologies154 as`).
- **Printed footer page == physical PDF page in the order body**, so `#page=N` lands true. But the
  appendices / commissioner separate statements at the end restart their own numbering (footer "6" on
  physical p.112). Treat a page as "body" only when footer-number == physical-number, and ignore the
  tail when choosing among multiple quote matches. The front-matter summary (¶ 6) restates every
  directive, so for a high-numbered cite prefer the later, substantive occurrence.
- **`#page=N` only works on an inline, same-origin PDF.** ferc.gov is Cloudflare-gated and may force a
  download, which drops the fragment. Committing the six PDFs under `docs/orders/` and serving them with
  the site (the user OK'd shipping the PDFs) makes the links reliable; keep a visible `ferc.gov` link to
  the official source and list it in provenance.

## Layout — tabs above the fold on mobile

- **A standalone KPI band + a tall masthead pushes the tablist below the fold.** Folding the stats into
  a first "Overview" tab and shrinking the masthead brings the tabs up. Make the tablist
  `position: sticky; top: 0` with `overflow-x: auto` so five tabs scroll in one row on a 375px screen
  instead of wrapping, and on a tab switch scroll back to the tablist (`main.offsetTop`) so a short
  panel starts at the top rather than stranded mid-page.

## Frontend build + preview loop (the P0 comment-analysis overhaul)

- **A `ReferenceError` during synchronous init can silently abort the rest of wiring — and the preview
  console may not show it.** `wireComments()` referenced `CM` (a `renderComments` local, not in scope
  there); line 1 of the By-issue block threw, so every listener defined *after* it never attached, while
  everything before it worked. The preview MCP's `preview_console_logs` reported "No console logs." When
  listeners silently don't fire but the markup renders, suspect a swallowed exception: drop a
  `window.__marker` at suspect points, reload, and read it back — don't trust the console to surface an
  uncaught error from page load. Bind shared helpers (`var CM = window.FERC_COMMENTS;`) at the top of
  *every* function that uses them; don't assume a sibling function's local is visible.
- **The preview viewport intermittently collapses to `innerWidth: 0`** (after resize cycles / reloads),
  which reflows the list to ~26px wide, inflates a 273-row section to ~890,000px, and returns blank
  screenshots. It is a preview-environment artifact, not a layout bug. Set an explicit
  `preview_resize({width, height})` before measuring geometry or screenshotting; prefer width-independent
  `preview_eval` / `preview_inspect` for functional checks (they were reliable throughout).
- **Bump `ASSET_VER` (and the `?v=` tokens) before every verify cycle when iterating.** The browser
  caches `js/*.js?v=…`; editing a file after a load *without* bumping the token serves the stale copy, and
  you will chase a "bug" that is just a cached `comments-data.js`/`app.js`. During active dev, advance the
  suffix each reload; settle on one clean value for the commit.
- **`position: sticky` under `body { overflow-x: hidden }`:** the body becomes the scroll container, so
  sticky still pins for the user, but `window.scrollTo` in a test may scroll the wrong element — measure
  with `document.scrollingElement.scrollTop`. A sticky bar's `top` must equal the sticky tablist's rendered
  height (46px here); measure it, don't guess.
- **Honest data beats the literal spec.** The plan asked for a per-RTO procedural *grid* (filed/pending
  per docket). We don't poll eLibrary for who has filed, so per-RTO cells would fabricate certainty — the
  clock is uniform across the six orders, so it shipped as one shared timeline with browser-computed
  status and a "tracks the schedule, not confirmed filings" rail. CLAUDE.md's "don't manufacture
  certainty" overrides a plan when the data to back it isn't there.
- **Precompute the inverted index at build, fetch one file per view.** The By-issue reader needs "every
  letter on issue X"; assembling that from 268 per-letter files client-side is the wrong shape. The build
  emits one `issues/<slug>.json` per issue (controlled vocab in full + top-N recurring topics, the long
  tail logged not silently capped), guarded by a bin-for-bin trace-back test.

## Small things that mattered

- **Don't put a dash range separator between dash-containing identifiers.** `EL26-67-000 – EL26-72-000`
  and `E-7 – E-12` read ambiguously; use **"to"**.
- **macOS filesystem is case-insensitive** — a project `design.md` collides with `DESIGN.md`; name it
  `design-notes.md`.
- **Static data via `<script>` global, not `fetch`.** For a GitHub Pages *project* site, an in-page
  `window.FERC_DATA` object dodges base-path and CORS/`file://` issues entirely; no build step.

## Bulk comment retrieval + analysis (RM26-4 docket — 272 of 273 bodies)

- **eLibrary bulk download hinges on one Chrome setting.** The docket sheet and file lists render past
  Cloudflare in the user's logged-in Chrome, but downloading *every* comment body is blocked by Chrome's
  *multiple automatic downloads* protection. Allow it for the site
  (`chrome://settings/content/automaticDownloads`), then a hidden-iframe grinder
  (`tools/grind-comment-downloads.js`) clicks each file link. Without that permission iframe downloads
  fail silently — the click "succeeds" and finds the link, yet nothing lands in `~/Downloads`.
- **Concurrency is the failure knob, not a hard wall.** Three Angular file-list bootstraps at once starve
  the renderer and ~25–30% miss the link-wait on the first pass. Retry the `window.__g.fail` set at lower
  concurrency + a longer wait; a final 1-worker pass clears the stragglers.
- **Two filename quirks corrupt the audit trail silently.** A `;` in a name is truncated by Chrome at the
  Content-Disposition separator (`"RM26-4; Antora….pdf"` → `RM26-4`, no extension) — heal it from the PDF
  magic bytes. And eLibrary appends a `" *"` availability marker to some link labels, so an *ends-with*
  `.pdf` regex skips them — strip the marker first. Both hid real comments until validation.
- **Validate against the inventory, not a count.** `tools/validate-comments.py` checks every inventoried
  comment has a body on disk, every PDF opens, and every body has real extracted text. It caught three
  defects a raw count (270/271) had masked: a truncated filename plus two empty-inventory filings (a
  `GetFileListFromP8` gap). A clean count is not a clean corpus.
- **Name files by submitter.** `files/<accession>__<org-slug>/` makes a path name who filed it; keep the
  accession the stable key and resolve a dir from it everywhere (the org slug can change, the accession won't).
- **Tag cheaply and deterministically before reaching for an LLM.** Per-comment reform-principle (5) and
  order-region (6) tags are keyword regex over the extracted body — instant, free, fully auditable. Reserve
  the LLM read for depth (the nine flagships); label the keyword layer "prevalence," not a coded position.
- **OCR is the remaining gap.** Four filings are image-only scans (0 text layer); flagged OCR-pending — no
  local OCR tool, so they are surfaced honestly rather than silently counted as extracted.

## Cross-order scoping (the "(NYISO only)" abeyance bug, 2026-07-28)

- **A provision read in full in ONE order must be grepped across the other five before it ships as
  "unique to X."** The abeyance mechanism was read carefully in the NYISO order (P 42) and labeled
  "(NYISO only)"; a 5-second `grep -c abeyance sources/text/orders/*.txt` shows it in all six (7–8
  mentions each). The committed full texts exist precisely for this — any "only this region" or
  "distinct finding" claim gets a cross-order grep first, and the regression test that guards the
  claim should grep the texts too, not just the display string (see the abeyance test in
  `tests/data.test.mjs`). Corollary: external news is a working accuracy probe — ISO-NE announcing
  an abeyance plan is what exposed the mislabel.

## A moved deadline is not a missed one (2026-08-23)

- **A date written into display copy will outlive the fact it describes.** `renderProcedural()` carried
  one hand-written sentence: "August 17 carries both the six show-cause filings and PJM's further
  compliance filing." FERC moved *both* clocks to November, and that sentence kept asserting August 17
  on the Overview tab, directly above a matrix that had already been corrected. Every other date on the
  site is rendered from `data.js` through `fmtISO`; this was the one that wasn't, and it was the one that
  went stale. The fix was not to retype the new date but to **derive the claim**: `collideNote()` reads
  the operative show-cause date and the E-2 track's own next date and renders only while they genuinely
  coincide, so if the two clocks separate the callout disappears instead of lying. Guarded by a test that
  allows exactly one hardcoded date in `app.js` display strings, the orders' own issuance, which cannot
  move.
- **Model a reset deadline as a separate field, not an overwrite.** The instinct on learning that Aug 17
  became Nov 16 is to edit `steps[].date`. The test suite rejected that, correctly: `procedural.steps` is
  the *order's own arithmetic* (issuance + the period the order states), and a test asserts each step sits
  at its quoted interval. Overwriting it would have destroyed the record of what the order actually
  required. The shape that works is `steps[].revised = { date, by, note, src }`, with one helper
  (`stepWhen`) deciding which date governs, used by status, the "next" pick, every derived filing-matrix
  cell, and `check-staleness.mjs`. The UI then shows both: the new date, the old struck through, and why.
- **Without that, the site would have accused six RTOs of missing a deadline FERC itself moved.** The
  filing matrix derives `none-observed` for any (docket, step) with no stored observation once the step's
  date passes. That derivation is the right design and it produces a false accusation the moment the
  deadline moves underneath it. Any derived-from-the-clock status needs to measure against the operative
  date, not the original.
- **Guard a "was X" render on X existing.** `moved = s.revised && s.revised.date` gated a strikethrough of
  `s.date`, so a step reset from a *relative* window (no original fixed date) would render a bare "was ".
  Latent today, one line to prevent: gate the strikethrough on both dates, and the explanation on the
  reset alone.
- **Check what the STATIC pages serve, not what the app renders.** The per-docket SEO pages
  (`tools/build-docket-pages.mjs`) are a second renderer over the same data, and they had no notion of the
  abeyance: a crawler or a search visitor got "respond by Aug 17" with nothing saying the proceeding was
  paused. Adding a field to `data.js` and wiring it into `app.js` is two of the three places it has to go.

## Blast radius is the whole consumer set, not the diff (2026-08-23)

- **Changing what a helper MEANS silently breaks every reader of its output.** `procStatus()` gained a
  reset-aware date, and the two lines that changed were correct. The two that broke were untouched and
  one function away: `setMastheadDeadline` reads `ps.next.s.date`, and `pmStepWhen` returns
  `fmtISO(hit.s.date)`. Both had been right for months; both now paired a status derived from the *new*
  date with the *old* date printed beside it. The masthead announced a date six days in the past as
  "Next deadline" above every tab, and ten policy-map rows read "Aug 17, 2026 · Upcoming". 119 tests,
  the quote sweep and the staleness checker were all green. **After changing a shared derivation, grep
  every consumer of the value it produces** — here, every read of `.s.date` off a `procStatus()` result.
- **An independent reviewer earns its cost on exactly this class.** Self-review caught the one hardcoded
  string I had written; it did not catch either of the two live bugs in code I had not edited, because I
  was reading the diff and the bugs were not in the diff. Give the reviewer the enclosing functions and
  say plainly that untouched lines are in scope.
- **A per-entity exception has to reach every derived surface or it becomes an accusation.** FERC gave
  SPP 95 days rather than 90. The board can only show one date, which is fine, but the filing matrix and
  the staleness checker are per-docket and were still measuring all six against the majority date, so for
  three days in November SPP's cell would have said "the deadline has passed and our checks found
  nothing" while its own card said Nov 20. When data gains a per-entity exception, every surface that
  derives status from the shared value needs the exception too.
- **Check a check by breaking it deliberately, and be suspicious when it passes.** The abeyance quote
  guard read convincingly and was nearly vacuous: it verified against the union of twelve texts with a
  60-char LCS fallback, and six orders issued the same day from one template share far more than 60
  characters. A quote misattributed from MISO to SPP passed both the tool and its test. Two of my own
  regression tests this session also passed on a deliberately reintroduced bug before I tightened them.
  **A test you have not seen fail is a test you have not written.**
