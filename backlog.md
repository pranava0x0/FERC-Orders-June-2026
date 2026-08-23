# backlog.md

- **Teach `check-staleness.mjs` to catch expired FRAMING, not just expired dates.** (medium) It flags a
  passed `kind: "deadline"` event, but not an event whose date is still in the future while its subject
  has already resolved. Two shipped that way this session: an abeyance event written in the conditional
  ("any abeyance would push the deadline later") months after all six were granted, and a response
  deadline whose derived date the abeyance orders had replaced. A cheap heuristic: flag any event whose
  body contains conditional markers ("would", "if requested", "could", "is expected to") when a later
  event on the same track describes the same subject as done.

- **done (2026-07-14) — spec phase C: record-to-rule crosswalk (`policyMap`) + policy-map landing + reader strip.**
  Shipped the zero-inference crosswalk the spec sequences first. `docs/js/data.js` gains a hand-authored,
  cite-backed `policyMap`: one row per canonical aq:/pr: issue (13) joining what DOE's ANOPR asked, what the
  June 18 orders **did** (status `directed / briefed / resolved / silent` + a verbatim, page-cited order quote
  reused from the verified directive corpus), and where it goes **next** on the §206 clock (vehicle + a
  procedural-step id that flips Passed/Upcoming live + a Section IV `briefingId`). The By-issue reader gains a
  "from record to rule" strip above the stance groups, and its empty landing pane is now the one-screen
  **policy map** grid (issue · count · micro-stance · status chip · next-step date), each row deep-linking into
  the reader; a bare `#comments/issue` restores the landing. Three visibly distinct honesty lanes (verbatim
  order text with PDF/gov cites, curator status/note labeled "curator judgment," provisional micro-stance),
  status chips are text+color with full-sentence `aria-label`, tag-not-CTA on mobile, no em-dashes.
  New `tests/policy-map.test.mjs` (9 tests: every `did.q` verbatim via the shared quote sweep, `next.step`/
  `briefingId` resolve to live surfaces, enums closed, silent rows carry cited SOURCES, every status seeded,
  copy linted); `tools/verify-quotes.mjs` now exports `carries`/`loose`/`loadOrderTexts` so the crosswalk test
  reuses the exact sweep. Also shipped the zero-cost §4.2 cross-links that make the other tabs policy-aware:
  the Overview stance bars and the Reforms category cards carry the status chip inline + deep-link into the
  record; the procedural board's show-cause step shows "10 record issues land here →"; and each Section IV
  briefing question links to "what the record says →" (join = `policyMap.next.briefingId`, preferring the pr:
  reform issue). Then UAT (findability / navigation / clicks) surfaced two gaps, both fixed (`8d78b94`):
  a "The policy map" callout in the Comments overview (the map was two clicks deep with no signpost), and
  a "← Policy map" back link out of the issue reader. 81 tests pass; quote sweep clean; verified in-browser
  (desktop + 375px). **Not yet built (runs on subscription tokens — no separate $ cost — so size to the
  session budget, small resumable chunks, report spend, pause for go-ahead; do NOT frame as paid API):**
  phase B option extraction (fan-out over 19 issues, the token-heavy piece), phase H camp profiles, phase A
  data debts (OCR + re-authors + topic canon), phases D-options/E/F/G.
- **idea (2026-07-14, LOW) — let the "from record to rule" strip collapse.** UAT: the strip is always
  expanded (~260px, ~0.3 viewport) above the stance groups, so a reader who just wants the letters scrolls
  past it every time. It is intentionally the expert's first read, but a remembered collapse toggle (or
  auto-collapse on repeat visits within a session) would cut scroll for browse-heavy use. Low priority.
- **planned 2026-07-14 (HIGH) — policy-options layer + record-to-rule crosswalk: see [policy-analysis-spec.md](policy-analysis-spec.md).**
  The next comment-analysis increment, aimed at SMEs and regulatory experts: the current analysis stops at
  topic × stance (69% of bins read "support"), while ~1,200 concrete policy asks already sit extracted in the
  summaries-v2 quotes with no surface. The spec: (B) cluster each issue's quotes into auditable **policy
  options** (proposal / condition / objection, backers by camp, implementation vehicle) with deterministic
  validators and a gated audit; (C) a hand-authored, cite-backed **policyMap crosswalk** per issue — what DOE
  proposed, what the record said, what the June 18 orders did (directed / briefed / resolved in E-2 / silent,
  verbatim order quote + page), and where it can still land (Aug 17 show-cause filings, Section IV briefs,
  E-2 paper hearing, RM26-4); (D) the By-issue reader gains a "from record to rule" strip + "what's on the
  table" option cards, and its empty landing pane becomes the one-screen **policy map**; (H) **camp profiles**
  per stakeholder bucket — computed footprint, "in their words, what's at stake" (own-quotes only), and a
  curator industry-context line, plus a camp filter in the reader — so respondent-type impact is a surface,
  not a reader exercise. Also: normalize the 673-slug emergent-topic tail behind a committed canon. Quality
  bar binding throughout (2026-07-14): cite accuracy, auditability, quote-in-context fidelity (extraction
  always carries the letter's own framing), descriptive option names, three visibly distinct lanes. Start
  with phase C (curator-only, zero LLM). Upgrades rather than duplicates the ux-plan roadmap: absorbs P1
  #10a, replaces P2 #11, extends P1 #6; P1 #10 (OCR + Haiku re-author) becomes its gating phase A.
  Sequences and supersedes several open items below (issue-outline navigation, multi-select token filter,
  procedural status board, Discourse freshness filter, comments-tool benchmark ideas) into one prioritized
  P0/P1/P2 roadmap with specs. Work those items from the plan, not from their older entries here.
- **done (2026-07-10) — plan P0 #5: procedural status board + next-deadline chip.** The Overview tab now
  opens with a "What happens next" §206 clock: the six steps from the June 18 issuance (21-day intervene,
  30-day report, statutory rehearing, NYISO 45-day abeyance, 60-day show-cause/tariff, the relative response
  window), each cited to its ordering paragraph, with status (Passed / Next / Upcoming / Pending) computed in
  the browser against today's date. The masthead carries a next-deadline chip. Dates are quoted-period +
  derived calendar (business-day-adjusted, National Law Review), labeled derived, with an honesty foot noting
  status tracks the schedule, not confirmed eLibrary filings. **Not a per-RTO filing matrix:** the clock is
  uniform across the six orders and we don't poll eLibrary for who has filed, so a per-RTO status grid would
  fabricate certainty; that needs the data-refresh playbook and is left as a follow-up. New
  `tests/procedural.test.mjs` (dates valid, chronological, cited, matching the quoted periods); 72 tests pass.
- **done (2026-07-10) — plan P0 #4: Overview reorder + aggregate click-through.** The Comments Overview
  now leads with the audited stance map, then the stakeholder heatmap, with the weaker keyword-themes
  prevalence demoted to a collapsed section at the end; the redundant "What the comments engage" three-column
  block is gone (its counts live in the By-issue outline). Every aggregate is now a way in: each stance-bar
  principle and each heatmap cell deep-links into By-issue for that reform, and each round in the strip opens
  All comments filtered to that round. Added a compact coverage-honesty badge under the stats (derived, in
  sync: "268 of 273 audited · 4 image-only scans await OCR · 1 served inline"). Also wired the URL filter
  grammar (`#comments/summaries?f=…&q=…`) into the token system, so filtered lists are shareable. Verified
  in-browser; 67 tests pass.
- **done (2026-07-09) — plan P0 #3: All-comments workbench (sticky controls + AND-token filters).** The
  search box, a Tags toggle, the result count, and the active-filter tokens now sit in a bar that stays
  stuck under the primary tablist while you scroll the list. Clicking any lens/round/stance chip adds a
  removable AND token that matches structured row fields (not the search string, so "PJM + Cost + Opposes
  Cost" returns the 6 exact rows, no summary-prose false positives); free text ANDs with the tokens. New
  round and stance token types. Verified in-browser (AND correctness, removal, empty state, sticky pin,
  375px). **Windowing (plan §1.4.3) deferred:** at 273 rows (~7k nodes, 140px each) the list is far below
  the DOM-budget threshold that motivates it (the rule targets ~38k rows / 265k nodes); revisit if the
  record grows an order of magnitude. Logged here rather than built speculatively.
- **done (2026-07-09) — plan P0 #2: By-issue reader.** Pick a question, principle, region, or recurring
  topic and read the whole record on it, grouped by stance, with the verbatim quotes behind each. Build tool
  now emits a By-issue index (`docs/data/comments/issues/`): the controlled vocab (19 lenses) in full plus the
  top-15 recurring emergent topics; the long tail is logged, not silently capped. New "By issue" sub-tab with a
  two-pane outline+reader (stacks on mobile), lazy-loading one file per issue, deep-linkable via
  `#comments/issue?id=<key>`, with org names cross-linking to their All-comments row. Trace-back test
  (`tests/comments-issues.test.mjs`) pins the inversion to source both ways; 67 tests pass.
- **done (2026-07-09) — plan P0 #1: Comments URL-state router + row permalinks.** New `docs/js/comments-route.js`
  (a single parse/serialize helper for the `#comments/<sub>[?k=v]` and `#comments/c=<acc>` grammar), wired into
  app.js: sub-tabs are now URL-addressable, every comment row has `id="c-<acc>"` and a copy-link button, and a
  shared `#comments/c=<acc>` link opens the All-comments list, scrolls to the row, and expands its audited
  analysis. Back-compatible with bare `#comments`. Round-trip test added (`tests/comments-route.test.mjs`); 60
  tests pass. Foundation for the By-issue and All-comments-workbench items (plan §1.6, §1.4.4).
- **done (2026-06-22)** — Downloaded all six order PDFs through a real browser, OCR'd them, and folded
  quoted directives + paragraph cites into Tab 2 (195 FERC ¶ 61,211 to 61,216). Extract in
  `sources/orders-extract.json`.
- **done (2026-06-23)** — Page-citation links: each Tab 2 directive cite opens the committed order PDF
  (`docs/orders/`) at the page carrying its quoted text. Five-tab restructure (Overview/Timeline/
  Reforms/Dockets/Discourse) with a sticky tablist. Balanced commentary section in Discourse.
- **done (2026-06-23)** — Each directive cite now offers both options on click: a **PDF** link (the
  committed copy, opens inline to the page) and a **gov** link (the official ferc.gov source at the same
  page). Wanted both PDF and URL paths per citation.
- **done (2026-06-24)** — Reworked the Dockets tab to lead with **what's unique to each system**: a
  per-docket `unique` headline plus a variable-length distinct-findings list (4 to 6, intentionally not
  uniform), each finding order-text-supported. Added the **five concurring statements**
  (Swett/Rosner/See/Chang/LaCerte) as a "what each commissioner emphasized" block on Overview, extracted
  verbatim from the OCR'd order text and page-anchored to the PJM copy — so the medium "what each
  commissioner said" item is met from the written statements, no Cloudflare-gated PDF needed. Captured the
  **full named-respondent rosters** (45/30/22/24/16/9) and a compact per-docket Section IV "what FERC
  presses this system on." Refreshed Discourse with post-issuance analysis/critiques (Dajani/Cooley,
  Chatterjee, the live Maryland cost-allocation complaint). 23 tests; new guards for the per-system
  fields, roster counts, and commissioner-quote-verbatim.
- **done (2026-06-24)** — Made each docket a **collapsible accordion** (first open) to cut scrolling,
  and gave each its own **"What the commissioners said in this order"** subsection: all five
  concurrences with a verbatim pull-quote and a page cite to *that order's* pages, linked to both the
  committed PDF and ferc.gov (Swett p.87 in PJM, p.68 in SPP, …). Then extended the same
  **page-cite treatment to the distinct-findings** — each finding now carries `{ p, pg, a }` and renders
  a clickable PDF + ferc.gov page link, anchored (like the directives) to the page where its text
  appears; findings that cite only another order stay text-only. 24 tests: every commissioner and
  finding cite is asserted to land on a page that actually carries its quote/anchor.
- **done (2026-06-24)** — Sharpened the **general-vs-specific** split. Mined each E-7→E-11 order's
  **Section II (Existing Processes)** for two more order-specific findings apiece — e.g., PJM's
  first-ready/first-served New Services Queue and its
  100%-of-minimum-upgrades rule; MISO studying load at max demand regardless of flexibility and rolling
  upgrades into base zonal rates; SPP's Attachment Z1/AQ/AX baseline and Highway/Byway voltage cost
  split; CAISO's Scheduling Coordinators and the postage-stamp Regional Access Charge; ISO-NE's
  Cluster Study with Schedule 22 (>20 MW) / Schedule 23 and PTF ≥ 69 kV. Each new finding is page-cited
  and verified (the region-support test now also accepts the finding's own cited page). 24 tests.
  (E-12/NYISO left as-is per the request scope.)
- **done (2026-06-24)** — Scraped the **RM26-4-000 docket sheet** from FERC eLibrary past Cloudflare
  (Control_Chrome `execute_javascript` + `get_page_content` now work in the user's Chrome; paged the
  Angular table, downloaded the manifest via a Blob to `~/Downloads`). Saved all **423 filings**
  (`sources/comments/rm26-4-manifest.raw.json`), classified type and stakeholder bucket
  (`tools/analyze-comments.mjs` → `rm26-4-comments.json`), and surfaced a **"What the RM26-4 commenters
  said"** section in Discourse: 273 comments from ~201 orgs, 128 interventions, the Nov 21 2025 deadline
  spike (183 filings), and 19 stakeholder buckets with provisional per-camp positions. A test asserts the
  bucket counts sum to the comment total.
- **done (2026-06-24)** — **Full pull + audit trail.** Cracked the eLibrary `GetFileListFromP8` JSON API
  and pulled the **document/attachment inventory for all 273 comments** (281 files, 7 with sub-documents;
  `sources/comments/rm26-4-files.json`). Downloaded, text-extracted, and wrote **structured summaries**
  for **9 flagship comments** across the major camps (Google, NRG/Kavulla, PJM, IECA industrial coalition,
  Maryland PSC, PA+DE consumer advocates, Sen. Markey, ACP, EEI) — each with stance per reform category +
  a verbatim quote (`sources/comments/summaries/<accession>.json`, bodies under `files/<accession>/`). The
  audit chain (website → file inventory → summary → categorization) is generated by
  `tools/build-comment-audit.mjs` and `analyze-comments.mjs`, enforced by a test, and rendered as flagship
  cards in Discourse.
- **done (2026-06-24, bodies) / medium (summaries)** — The Chrome multiple-download block that walled the
  bulk pull is now lifted by allowing **Automatic downloads** for `elibrary.ferc.gov`, so
  `tools/grind-comment-downloads.js` clicks every PDF/DOCX link via hidden iframes and pulls the comment
  **bodies** for the full 273 (then `organize-comment-files.py` fitz-extracts; pipeline in
  `sources/comments/README.md`). `DownloadP8File` stays WAF/401-walled — the iframe-click path is the one
  that works. What remains is **structured summaries** beyond the 9 flagships (bodies are on disk +
  text-extracted, ready to read), and OCR for the few scanned filings (e.g., Data Center Coalition).
  Re-run `build-comment-audit.mjs` as summaries land; categorization auto-aggregates.
- **done (2026-06-26) — agentic LLM comment analysis (PNNL "CommentNEPA" approach).** Extended per-comment
  analysis from the 9 flagships to all 268 text-extracted bodies, following PNNL/Battelle's *CommentNEPA: Auditable,
  Agentic Workflows with Feedback Alignment for Environmental Review* (NAEP 2025, PNNL-SA-210567). The unit
  of evidence is the **quote**, and binning is **bottom-up on quotes** — not a single chat-shot. Decompose
  each correspondence into auditable subtasks:
  1. **Chunk + bracket** — split the filing into spans and classify each as a substantive comment vs
     boilerplate / non-comment (PNNL's "bracketing"; this is their eval target — ~78% precision, ~20% recall
     vs. SMEs, who select more text — so it must be audited, not trusted).
  2. **Extract substantive quotes + a one-line concern per span** — the quote is the atomic, auditable unit
     (and passes the repo's "quote appears verbatim in source text" test); only the best concerns advance.
  3. **Bin the quotes** — map each quote to one or more bins: the five reform principles + six order regions
     as *pre-specified* bins, plus *emergent* topic bins the model proposes; carry a per-principle stance.
  4. **Name + summarize each bin** — a short bin **name** + a longer **description** synthesized from the
     quotes it holds, with references back to the original correspondence (accession + quote); plus a
     per-filing summary on top.
  Add self-evaluation/critique loops (generate → critique → revise; let competing prompts compete) and store
  the **graph of every LLM input + prompt + output**, so each quote, bin, and summary is inspectable and
  traceable (matches the provenance + "AI-synthesized values are provisional" rules — stamp `verified_at` +
  a per-row source). Human-in-the-loop *feedback alignment*: a curator's edit to a quote/bin/summary becomes
  a few-shot example that tunes the prompts, so the curator audits rather than prompt-engineers. Keep the
  **keyword** principle/region tags as the cheap deterministic prior, the seed for the pre-specified bins,
  and a cross-check on the LLM's binning — never ship the LLM pass unaudited. Cost discipline: keyword
  pre-filter first, cheapest model that holds quality, cache by content hash. Surface each bin's name +
  description with its quote references in the Comments tab.
  - **Done (2026-06-26) — 268/268 summarized, validated, and wired into the Comments tab.** Each comment
    row carries an expandable "audited analysis" (plain summary + each position as a stance-colored chip),
    and the Comments → Overview sub-tab leads with a "Where commenters land" stance map (support / oppose /
    mixed / no-position per reform principle). `tests/comment-summaries.test.mjs` enforces the fidelity bar
    (verbatim quotes, vocab, lens=union, count floor, one-example-per-enum). **Follow-ups (new):**
    - **medium — human verification pass (feedback alignment).** All 268 are `verified:false`. Curate a
      sample, stamp `verified_at`, and feed each curator edit back as a few-shot example (the PNNL loop).
      No recall baseline exists yet (see `issues.md`); a small SME-selected gold set would let us measure it.
    - **medium — fuller pass on the 8 large filings (>120 KB).** Page-windowed map-reduce over the whole
      body instead of the front-slice read, so a position buried in an exhibit isn't missed (`issues.md`).
    - **done (2026-06-26) — lazy-loaded per-letter bin detail + exposed quotes.** Each audited letter's
      description + verbatim quotes are emitted to `docs/data/comments/<acc>.json` (one ~10 KB file,
      ~3.1 MB total) and fetched only when a row's "Read the audited analysis" opens; the up-front
      `comments-data.js` stays ~104 KB gzip. Rendered grouped by lens (questions / principles / regions /
      other), `aria-busy` + `role=status` on the async load. `tests/comment-detail.test.mjs` traces every
      detail file bin-for-bin and quote-for-quote back to `summaries-v2/`. Closes the audit loop on the web.
    - **low — Haiku-vs-Sonnet quality spot-check.** 84 summaries are Haiku-extracted; re-extract a sample
      on Sonnet and diff to confirm no quality gap (`issues.md`).
  - **In progress (2026-06-25) — 45 of 268 done, ~224 remaining.** Quote-centric v2 summaries
    (`summaries-v2/<acc>.json`, schema in `sources/comments/summarization-spec.md`) by
    `tools/summarize-comments.workflow.mjs`: **extract (Haiku) + self-critique → independent audit only
    on `tools/flag-summary.mjs`-flagged items (Sonnet)**, self-validated against
    `tools/validate-summaries.mjs` (verbatim coverage, vocab, lens=union, AI-register/boilerplate lint).
    Work-list `tools/build-comment-worklist.mjs` → `.worklist.json` (gitignored); `--next N` yields the
    next chunk; "done" = passes full validation, so a killed worker's partial file re-queues (self-heals).
    **Run it in small budget-sized chunks across 5-hr windows** (`node tools/build-comment-worklist.mjs
    --next 10` → pass as `args.accs`); the full remaining run is ~13M tokens, several windows. **Biggest
    open token lever: batch several short comments per agent** to amortize the ~25–30K per-agent floor
    (see `agent-runs.md` Runs 8–9). **Caps applied — go back and do the fuller versions:**
    1. **Big-body read cap.** For the **8 filings > 120 KB** the extract agent reads only the first
       ~2000 lines + greps for the argument/recommendation sections, so quotes can miss material buried
       in later pages or exhibits. Worst case **Sierra Club `20260520-5102` (5.9 MB)** — read only a small
       front slice. Others (chars): `20260406-5178` SPP TO Group (350k), `20251121-5396` SELC et al.
       (261k), `20260615-5164` Electricity Customer Alliance (205k), `20260519-5158` Eolian (182k),
       `20251205-5306` Constellation (157k), `20251121-5541` Eolian (148k), `20251205-5289` Eolian (121k).
       Fuller pass: chunk the whole body (page-windowed map-reduce over quotes), not a front slice.
    2. **Model cap.** Extraction ran on **Sonnet**, not Opus, for cost. The deterministic validator
       backstops quote fidelity, but stance/binning nuance on the hardest filings may improve on Opus —
       re-run a sample on Opus and diff before deciding whether it's worth the full re-run.
    3. **Quote-count guidance** ("typically 4 to 15; do not pad") soft-bounds very rich filings; a
       maximal pass would lift the ceiling for the large coalition/RTO comments.
    4. **Corpus cap.** Only the **268 text-extracted bodies** are summarized. The other **5 are not
       summarizable: 4 image-only scans** (`20251121-5224`, `20251121-5521`, `20251121-5140`,
       `20251205-5005` — no text layer, OCR-pending) **plus 1 inline-only filing** (ETI,
       `20251121-5225` — eLibrary serves it inline, no downloadable body). See the OCR + ETI items below.
       `.worklist.json`'s `MIN_CHARS=400` is the cutoff for "has usable text".
- **done (2026-06-26) — Comments tab restructure + filter discoverability.** Removed the dated
  "Start here: one filing per camp" flagship block (the 9 orgs remain as normal rows; curated
  `D.comments.flagships` data + its audit tests kept). Renamed the sub-tabs to read as clear buckets:
  **Themes & categories · Respondent types · All comments**, with "All comments" leading into the list.
  Added a collapsible **"filter by tag"** bar on All comments — the full lens vocabulary (8 questions /
  5 principles / 6 regions) with per-tag match counts; clicking a tag drives the existing search box, and
  the search index now also covers position names. Pruned the dead `.cm-flag*`/`.cm-stance` CSS. Two small
  fixes folded in: the new bin-detail foot-note shipped an em-dash + "X, not Y" (caught in review, reworded),
  and the respondent-roster "Show all" toggle was 44 px tall and CTA-loud — now chip-scale with a chevron,
  44 px target restored only on coarse pointers.
- **medium — OCR the 4 image-only scans.** `20251121-5224`, `20251121-5521` (Data Center Coalition),
  `20251121-5140` (Yurok Nation), `20251205-5005` are downloaded but have no text layer (`validate-comments.py`
  flags them). Needs an OCR tool (no `ocrmypdf`/`tesseract` installed locally — install one, or use macOS
  Vision). Once OCR'd, re-run organize/validate; they drop out of the scanned set into the text-analyzed corpus.
- **low — re-fetch the ETI holdout** (`20251121-5225`, Energy Trading Institute): renders + clicks but won't download
  (served inline). Inventoried + re-downloadable; the corpus reads 272/273. See `issues.md`.
- **done (2026-06-26) — per-commissioner themed summaries (themes + quotes, no tags).** All five
  commissioners (Swett, Rosner, See, Chang, LaCerte) summarized the auditable way: an overall read plus
  5 themes each, every theme backed by verbatim quotes, no tag/stance vocabulary. Written quotes are
  verbatim from the OCR'd order text (cited to the PJM copy; the concurrences are largely common across the
  six orders but vary in places — caught by the all-six verbatim check during the 2026-06-26 PR review) and
  guarded by a `data.test.mjs` verbatim check; spoken quotes come from the June 18 open-meeting auto-caption
  transcript (pulled with `uvx yt-dlp --write-auto-subs` from the user's YouTube link) and are labeled
  "spoken" (Rosner ×2, See ×1, Swett ×1; Chang and LaCerte deferred to their written statements at the
  dais, so written-only). Sources committed under `sources/commissioners/` (5 statements + transcript).
  Rendered as an expandable themed read on each Overview commissioner card (embedded in `data.js`, not
  lazy-loaded — only 5 small items). On PR #6.
- **done (2026-06-26, Section IV) / medium remaining (the clock) — enriched the Dockets tab.** Added each
  order's **Section IV Briefing Questions** as a numbered, page-cited, collapsible list on the docket card:
  the five templated questions (protecting existing arrangements; flexible-service planning impact;
  cost-shift protections; alternative transmission technologies; generator interconnection for proximate /
  co-located load), each with a plain-language label + the verbatim excerpt; SPP shows four (it already has
  HILLGA, so its order omits the proximate-generation question). Stored once as `data.js` `briefing`
  (questions + per-docket § IV page + SPP omission) and DRY-rendered per docket; `data.test.mjs` verifies
  every shown question is verbatim in that order's text and the § IV page is in range. **Still open:** the
  **procedural clock** (the (A)-(F) ordering paragraphs — 30-day report, 60-day show-cause, 21-day
  intervene, 30-day responses + derived dates) as a per-docket timeline, and deeper Section III sub-findings.
- **requested 2026-06-26 / medium — explore a multi-select / token search on the All-comments filter.** Today
  the search box holds one substring and the tag bar replaces it on click. Explore letting several tags stack
  as removable tokens (AND/OR) so you can compose "PJM + Cost + opposes". Design question: token chips in the
  input vs. a multi-select facet model; AND vs OR semantics; how it interacts with free-text. Spec before build.
- **medium — add published-date discipline to Discourse sources.** Discourse now aims to show reaction to the
  June 18 orders, not pre-order background. Add a `published_at` (or `source_date`) field to every `SOURCES`
  record used by `D.reception`, `D.media`, and `D.voices`, then add a test that rejects any Discourse source
  dated before 2026-06-18 unless it is explicitly marked as background and rendered in a separate context lane.
- **medium — give Discourse a source-type/freshness filter.** The tab now mixes trade press, law-firm alerts,
  social posts, public reaction, operator voices, and long-form context in one surface. Split or filter by
  post-order source type (press/law, social, industry, advocacy, public reaction), with visible source dates so
  readers can tell fresh reaction from slower background analysis.
- **low — rebalance the Discourse voice roster.** The post-order scan made the voice section broad enough that
  some cards feel more like context than live reaction. Trim to the strongest 20 to 25 voices, or add a
  "show more" pattern per group so the first screen carries the clearest post-order arguments.
- **partially done / low** — Respondent lists are now captured **in full** per docket (done 2026-06-24)
  and a compact per-docket Section IV "what FERC presses this system on" ships. What remains: the deeper
  verbatim enumeration of every Section IV briefing question per order (PJM's were read in full; the other
  five were distilled from the verified directive set, not read end-to-end).
- **medium** — Add the FERC "Items E-7–E-12: RTO/ISO Show Cause Orders" presentation deck and the
  Quick Reference one-pager once retrievable (both currently Cloudflare-gated / not archived).
- **medium** — Track the 30-day informational reports and 60-day filings as they land in eLibrary;
  add a "compliance tracker" sub-view per docket (filed / pending / abeyance).
- **low** — `og:image` social card (JPG) rendered from the masthead for link previews.
- **low** — Dark theme token set (palette is defined; wire the toggle + JS re-paint).
- **low — a11y: the docket accordion summary (`details.dreg > summary`) has a ~13 px tap target** (no
  padding/min-height) — below the 44 px guideline. Pre-existing (commit `735f776`), surfaced by the
  2026-06-26 review. Fix: add `padding: 11px 0; min-height: 44px; display: flex; align-items: center;`.

- **low — the "Discourse" tab's hash id is `news`, not `discourse`.** Surfaced by the 2026-08-03 first
  `ferc-uat` run: `app.js`'s `TABS` array names the sixth tab `news` even though its visible label and
  every doc reference to it say "Discourse." Typing `#discourse` by hand silently no-ops (stays on
  whatever tab was already active) instead of erroring, which cost real debugging time this run. Not
  user-facing (nobody hand-types tab hashes), so low priority — but a one-line rename of the `TABS` entry
  (plus its route-parsing branch) would remove the trap for the next person who reads the code before the
  UI. Logged in `uat.md`'s "Patterns noticed."

- **low — minor cleanup items from the 2026-08-04 PR #17 review, not worth blocking the merge for.**
  (1) `tools/verify-commish-tailoring.mjs`'s `statementSpans(item)` is called inside the per-commissioner
  loop — 25 re-reads/re-parses of ~200KB order text files instead of 6 (once per order). Hoist it above
  the commissioner loop. (2) `tools/build-docket-pages.mjs`'s `pickRepresentative(letters, n = 4)` never
  has `n` passed by any caller and isn't exported, so it can't be unit-tested directly — export it or
  drop the unused parameter. (3) A `docs/data/comments/issues/rg-<key>.json` with an empty `letters: []`
  would still render a heading and an empty list; guard on `region.letters.length` alongside the
  `existsSync` check in `loadRegionComments`. (4) Several `procedural.filings` rows describe multiple
  filers in the `gist` (e.g. EL26-67's abeyance step covers both PJM and the Indicated PJM Transmission
  Owners) while carrying one `accession` — the prose is honest about it, but it's lossy against the
  one-record-one-origin convention; consider an `accessions: []` array if this recurs.

### Critique / analysis leads (from the 2026-06-24 news refresh)

- **medium** — Develop the **non-RTO coverage gap** into an explicit "what's *not* covered" note:
  environmental advocates flag that utilities outside an RTO (Southeast — NC, TN, AL, GA) face only
  voluntary, not mandatory, compliance even amid heavy data-center buildout (pairs with Devin Hartman's
  non-RTO critique already in Discourse).
- **medium** — Vet and possibly surface the **demand-side / hyperscaler** framing (NVIDIA's June 18
  blog) and its **LBNL** claim that a 10% rise in state electricity consumption correlates with ~6¢/kWh
  lower retail prices. AI-industry PR plus a striking empirical claim — audit against the LBNL primary
  and label as contested before any use; do not ship the stat as fact.
- **low** — ~~Add the **DOE statement applauding FERC** (energy.gov)~~ **done (2026-06-28)** — added the
  June 18 DOE applause statement as the `doeApplaud` source and a **Secretary Chris Wright** voice (the
  directing agency declaring victory; adds the executive-branch / right-leaning perspective). Still open:
  **E&E/Politico** coverage as reaction sources. ~~Bloomberg Law read ("Energy Regulator Staves Off Critique…") on how the orders
  were drafted to pre-empt the jurisdictional challenge~~ **done (2026-06-27)** — added as the
  `bloomberglaw` source, a Jennifer Danis voice (litigation-durability), and a "Built to survive appeal"
  consensus line in Discourse.
- **low** — Capture the **state consumer-advocate** stranded-asset / timing-mismatch concern (PA, DE,
  NJ): near-term large-load need vs. the decades-long life of the gas plants and pipelines built to serve it.

### Improvement leads (from the 2026-06-27 discourse scan: X, trade press, consumer/academic voices)

Each idea is tied to what the FERC/energy discourse is actually doing right now, not a guess. The scan ran
across trade/law press, X (Ari Peskoe, Travis Kavulla, Sec. Wright, Ramez Naam, Art Berman, @FERC),
analyst pieces (Bloomberg Law) and consumer coverage (Consumer Reports). Reddit/Bluesky returned little
indexable thread-level signal; the lay concern they carry ("who pays on my bill?", "is this federal
overreach?") is folded into ideas 2 and 5.

- **high — a live "What happens next" procedural status board.** Every practitioner thread and law-firm
  alert ends on the same calendar, and the site is still a frozen "as of June 18" snapshot. Build a dated,
  per-RTO tracker of the post-order clock: **intervene by Jul 9**, **generation-adequacy report Jul 20**
  (30-day), **rehearing ~Jul 18** (30-day), **abeyance request by Aug 3** (45-day, FERC says it will
  heavily scrutinize and cap at 90 days), **show-cause / tariff filing by Aug 17** (60-day), then a 30-day
  public-comment window after each filing. Surface "next deadline" prominently and a per-RTO status
  (report filed? abeyance requested? tariff filing landed?). This unifies and supersedes the older
  "procedural clock" (per-docket A–F timeline) and "compliance tracker" leads above into one prioritized
  deliverable. Dates corroborated across Day Pitney, McGuireWoods, Husch Blackwell, V&E. Note SPP is
  furthest along (its HILL / HILLGA expedited process is the template others are told to adapt).

- **high — a "who pays" cost-shift explainer that lands the bill stakes.** Cost allocation is the single
  most-discussed angle, but the public frame is the household bill, not the tariff. Ground the existing
  transmission-vs-retail bifurcation in the concrete story the discourse runs on: the March 2026 tech
  "ratepayer protection pledge" (Microsoft, Anthropic and others to build/buy and pay for their own
  infrastructure), reported residential spikes (a Virginia ~$281 bill, Jan 2026), 30+ states with 300+
  data-center bills, demand ~80→150 GW by 2028, and Ari Peskoe's argument that FERC's 1994 transmission-
  pricing policy lets utilities socialize data-center upgrades. Pairs with the new "affordability backstop
  is split" friction line. Label estimates/contested claims as such; audit each figure to a primary before
  shipping (do not ship the LBNL price-correlation stat or PR figures as fact — see the existing lead).

- **done (2026-06-27) — grounded the PJM co-location companion track.** Verification resolved the
  identity: **Item E-2 = Docket EL25-49**, whose order (193 FERC ¶ 61,217, issued Dec. 18, 2025) found
  PJM's tariff unjust and unreasonable and set co-located-load procedures, interim non-firm /
  contract-demand transmission service, and behind-the-meter netting limits — the "December PJM ruling"
  the site already referenced vaguely. Added it as the `pjmcoloc` source (verified via National Law
  Review) and enriched the co-location/BTM friction item with the docket, the reporter cite, and the
  specifics, keeping the "Item E-2, EL25-49" label consistent with the Reforms-tab detail. Note: a
  *distinct* June-18 PJM order separate from the E-7 show cause order could not be confirmed past
  Cloudflare (the ferc.gov "Directs Nation's Largest Grid Operator" fact sheet is gated and may just be
  the E-7 press release), so nothing was asserted about one.

- **evaluated 2026-06-27 — deferred (would be redundant): a curated "what the experts flag" digest into
  the Comments tab.** On inspection the Discourse tab already carries this: "Commentary across the
  spectrum" *is* a curated, attributed set of expert takes (now incl. Danis, Christiansen), and the
  "Open the Comments tab →" pointer already bridges into the audited corpus. A separate digest mapping
  order-reaction voices to ANOPR-comment themes would duplicate both, and the mapping is loose (the
  order-reaction commentators are mostly not the docket commenters). The one influential voice still
  missing is **Ari Peskoe (Harvard ELI)** — but his point is the cost-causation / outdated-1994-
  transmission-pricing argument, which is the substance of the HIGH "who pays" cost-shift explainer.
  **Plan:** add Peskoe there (verifiable via Utility Dive, "An outdated FERC policy is undermining the
  White House's ratepayer protection pledge"), not as a bolted-on digest. Skipped to avoid a redundant
  feature. **Update (2026-06-28):** added **Ari Peskoe (Harvard ELI)** as a cost-causation voice from
  that op-ed (verbatim quotes backed in voices-evidence.json). The full "who pays" explainer is still the
  HIGH item; the voice is the standalone piece of it that fit cleanly now.

- **done (2026-06-27) — frame the federalism / jurisdiction question explicitly.** Added a **Matthew
  Christiansen (Wilson Sonsini)** voice giving the jurisdiction-defense side (the orders stay within
  FERC's transmission jurisdiction and don't encroach on state authority), verified-quoted from Bloomberg
  Law. With the existing "affordability backstop is split" friction item (the overreach-challenge concern)
  and the DOE §403 timeline note (FERC asserting interconnection jurisdiction it "historically has not
  asserted"), the states-vs-Washington debate is now framed across both lanes by named voices. Kept it in
  the Discourse/commentary lane (not Reforms) to preserve the facts-vs-judgment separation.

- **done (2026-06-27) / partial — round out the outlet set to the audiences now covering it.** Added
  Bloomberg Law, The Hill, ENR, Data Center Knowledge and **IEEE Spectrum** (engineering-technical
  audience) as outlet chips. **Consumer-facing source deferred on purpose:** the strongest consumer piece
  (Consumer Reports, "AI Data Centers: Big Tech's Impact on Electric Bills") is dated 2026-03-20 and
  predates the orders, so it is not honest as a "where it's being covered" chip — it belongs in the HIGH
  "who pays" cost-shift explainer instead. (Tech Times covered the orders from a consumer angle but is a
  thin SEO outlet; left out for quality.)

- **done (2026-06-27) / partial — made "freshness" salient.** Added a masthead line ("Order record as of
  <capture> · discourse updated <discourseCapture>") rendered by app.js from `D.meta` (single source of
  truth; placeholder ships `hidden` and is revealed once filled, so JS-off users still get the footer
  date). The **"next deadline <date>"** half was intentionally deferred — it depends on the HIGH
  procedural status board, which owns the deadline data.

---

## Comments-tab UX ideas — from a scan of public-comment-processing tools (2026-06-30)

Surveyed how dedicated comment-analysis platforms present mass public comment (DocketScope, SmartComment,
Konveio, the federal CDO Council "Comment Analysis" pilot, ICF/CommentWorks, and the academic comment-viz
literature). Patterns worth borrowing for our read-only, static RM26-4 Comments tab, ranked by value/effort
for a zero-dependency site:

- **HIGH — Stance-by-reform aggregate visualization (diverging stacked bar / heatmap).** Every tool leads
  with a "level of support" rollup: support / oppose / mixed per issue, sliceable by stakeholder type. We
  already store per-bin stances on the audited letters; surface an at-a-glance diverging bar per reform
  principle (and an org-type × reform heatmap). Blocked on coverage — only ~9 flagships carry full stances
  today; depends on extending audited stances to more letters (see the model-delta note). Pure SVG, no dep.
- **HIGH — Issue-outline ("by issue") navigation.** DocketScope's core view is a hierarchical issue
  outline: click an issue, see every comment that raised it with its quotes. We have the three lenses
  (ANOPR questions / reform principles / regions) and per-letter bins; add a "browse by issue" mode that
  inverts the current "by comment" list — pick a principle/question/region and read the binned quotes
  across all letters. Reuses existing data; mostly a render mode + index.
- **MEDIUM — Form-letter / near-duplicate clustering with collapse + count.** The single biggest UX win in
  every federal tool: detect mass-campaign/identical submissions and collapse them into one row with an
  "N identical/near-identical" badge so they don't drown the unique substance. Our 273 are mostly distinct
  orgs, but worth a near-duplicate pass (shingled/MinHash on the extracted text) to confirm and to label
  any campaign clusters. Data-layer (build step) + a collapse affordance in the list.
- **MEDIUM — Top-phrases / keyword-frequency chips per lens.** Academic viz tools show a per-cluster phrase
  cloud. Lightweight version: top distinctive terms per reform/region computed from the keyword pass,
  rendered as a small chip row under each theme. Cheap, additive, no new data model.
- **LOW — "Similar filers" links.** Several tools surface "comments most closely related." Useful but heavy
  for a static site (needs a similarity matrix); defer.
- **LOW — Interactive geographic map of comments.** SmartComment maps comments by location. We have the six
  RTO-region tags, but a US map adds real page weight to a deliberately light site; a region-faceted list
  (already have region filtering) covers most of the value. Defer unless region geography becomes a focus.
- **Already have (parity check):** faceted search/filter by org/type/lens/position, drill-down to the
  audit trail (quotes → eLibrary), per-tag match counts, and a quote-centric extraction view. These match
  the table-stakes features of the commercial tools.

Sources: [DocketScope](https://www.docketscope.com/public-comment-software-comment-analysis-tool/) ·
[Federal CDOC Comment Analysis toolset](https://resources.data.gov/resources/cdoc_comment_analysis/) ·
[SmartComment](https://www.smartcomment.com/features/) ·
[Konveio analytics](https://www.konveio.com/features/analytics-reporting) ·
[ICF GenAI comment analysis](https://www.icf.com/clients/technology/regulations-gov-gen-ai-public-comment-analysis).

---

## Comment-summary model tier — normalize + verify (2026-06-30)

State today: 268 audited summaries, all `provenance.verified:false`, split **Sonnet 4.6 ×183 / Haiku 4.5
×62 / Opus 4.8 ×22 (the flagships) / 1 unlabeled**. The flagships were deliberately re-authored on Opus
after starting as Haiku, i.e. Haiku quality was judged insufficient where it mattered most. Established
facts (agent-runs.md Runs 5–9): the full corpus cost **~13M tokens regardless of model** — token COUNT is
set by the per-agent floor (~25–30K) and the verbatim-quote validate→fix loop, not by the model; Haiku
even *loops more* (~25 tool calls/agent), so it's cheaper per token but not fewer tokens, and lower
quality. So model choice moves **$/token and quality, not token count.**

Recommended next steps, in order:

- **MEDIUM — Re-author the 62 Haiku summaries on Sonnet** (or Opus for any high-profile filer) to lift the
  whole corpus to at least the Sonnet floor and retire the weakest tier. Bounded job (~62 × ~50K ≈ 3.1M
  tokens); run in budget-sized, checkpointed chunks (commit per chunk) per the self-healing worklist —
  never a single fan-out (see the Run 8 budget blowup). Stamp `provenance.model` on the rewrite.
- **MEDIUM — Stamp `verified_at` via a sampled human/deterministic pass.** Everything is `verified:false`.
  The next real quality lever is not another model swap but verification: spot-check a stratified sample
  (by org type + by model tier), fix, stamp `verified_at`, and fold each human edit into a few-shot
  example for any future re-runs (the feedback-alignment loop in CLAUDE.md's AI-cost section).
- **LOW — Batch several short filings per agent** before any re-run. This is the only lever that actually
  cuts token COUNT (removes the per-agent floor); pair it with the Haiku→Sonnet rewrite so the rewrite is
  cheaper than the original pass, not just better.
- **Decision: drop Haiku for this task.** No token-count benefit, measurably more validate-fix looping,
  and a quality gap the flagship re-authoring already conceded. Default workhorse = **Sonnet**; reserve
  **Opus** for synthesis/judgment-heavy flagships; keep the deterministic keyword + linter gate in front
  of any LLM audit (that gate, not the model, is where the savings are).

---

- **done (2026-06-30)** — Built the **stance consensus heatmap** (the HIGH idea above): a
  stakeholder-type × five-reform grid in the Comments tab, each cell colored by net stance, `role="img"`
  with a full `aria-label` (color is a lossy visual). Pure SVG/CSS, no new deps. Also **cut scrolling**
  by folding the long flat tabs into collapsible `<details>` sections on Background/Reforms/Discourse
  (first section open). Shipped on `feat/comments-consensus-ux` (PR #10). Known follow-ups from review:
  the legend shows a net-oppose swatch with no matching cells (issues.md), and stance *coverage* is still
  flagship-only until the Haiku→Sonnet re-author lands (see the model-tier note above).

---

- **HIGH (2026-07-28)** — **Add CI: nothing runs the test suite on push.** The repo has no
  `.github/workflows/`, so the 99 tests, the quote sweep, the llms.txt sync check and the new
  asset-token check only run when someone remembers locally. Both bugs found in the PR #14 review were
  invisible to local checking, which is exactly the case CI exists for. A single workflow running
  `node --test tests/*.test.mjs`, `node tools/verify-quotes.mjs`, `node tools/build-llms.mjs --check`
  and `node tools/stamp-assets.mjs --check` would cover it. Pin `uses:` to a full commit SHA with a
  minimal `permissions:` block (CLAUDE.md supply-chain rules).

- **HIGH (2026-07-28)** — **Post-Aug-17 refresh: run REFRESH.md end to end.** Aug 17 carries both the
  six show-cause / tariff filings and PJM's further compliance filing in EL25-49. This is the real
  test of the tracks + filing-matrix design, and the first run where cells should move to
  `filed-verified`. Aug 3 (abeyance requests, ISO-NE has announced it will use it) is the smaller
  rehearsal before it.

- **MEDIUM (2026-07-28)** — **Close the eLibrary verification queue** (REFRESH.md items 1 to 4).
  Needs a manual browser session: the six 30-day report accessions (only ISO-NE is observed, and only
  as press-reported), the reported Jul 17 ratepayer-advocate filing's procedural type and filers, any
  rehearing requests on or before Jul 20, and EL25-49's Feb 2026 compliance filing effective date.
  Until these land, nothing in the filing matrix can reach `filed-verified`.

- **LOW (2026-07-28)** — **Revisit the `none-observed` legend wording.** PJM's 30-day report was
  reported filed in trade press but could not be verified this pass, so its cell derives to
  `none-observed` ("our checks found nothing"). That is honest about our evidence but a reader could
  take the empty cell as "PJM did not file," which is probably false. Raised in the PR #14 self-review
  and deliberately left; the fix, if any, is the wording rather than the data. A third status for
  "reported but unverified by us" is the alternative, at the cost of vocabulary for one row.

- **LOW (2026-07-28)** — **AD26-7 has no committed primary document.** The governance track ships as
  timeline events plus a track card, with a pointer from the Dockets tab, because there is no order
  PDF to page-cite. If FERC issues its post-conference notice with the structured question set, that
  becomes a quotable primary source and the track earns a Dockets-grade card.

- **done (2026-07-28)** — **Per-docket static pages** (was HIGH). Seven pages under
  `docs/dockets/<docket>-<rto>/`, generated by `tools/build-docket-pages.mjs`, 730 to 1,030 unique
  words each, with self-referencing canonicals, `Report` + `BreadcrumbList` JSON-LD, sitemap entries
  and internal links from both the app and the baked summary. Also done: the `Dataset` JSON-LD for
  the comment corpus (was LOW). Remaining from that batch is the `robots.txt` path note below.

- **superseded (2026-07-28)** — **Per-docket static pages: the site is one indexable URL.** The six tabs are
  hash routes, and a fragment is not a separate URL to a search engine, so 3,500 pages of analysed
  record compete for a single result. Generating six real pages (one per order: RTO, docket, cite,
  page-cited directives, region-specific findings, respondent roster, link to the committed PDF) from
  `data.js` would multiply the indexable surface with genuinely unique content, give each order a URL
  worth linking to, and let each rank for its own docket number. Each needs a self-referencing
  canonical, a link back into the app, and the footer disclaimer. Generate them the same way as
  `build-seo.mjs`, with a sync test. This is the largest remaining SEO lever; it is listed rather than
  built because it adds site architecture and deserves a design decision, not a late-session sprint.

- **done (2026-07-28)** — **Google Search Console: property created, verified, sitemap submitted.**
  Property is the URL-prefix `https://pranava0x0.github.io/FERC-Orders-June-2026/`, verified by HTML
  file with the meta tag as a second method. `sitemap.xml` submitted (15 URLs) and the homepage sent to
  the priority crawl queue via URL inspection. Baseline worth remembering: before this, URL inspection
  reported **"URL is not on Google"** and "no referring sitemaps detected" — the site had never been
  indexed at all, which is what the whole SEO pass was fixing.
  Two follow-ups: the sitemap read **"Couldn't fetch"** immediately after submission, which is the
  normal pre-processing state (the file is HTTP 200, `application/xml`, valid, and the root
  `robots.txt` 404s so nothing is blocked) — **re-check the Sitemaps page in a few days** and only
  investigate if it has not flipped to Success. And **never delete `docs/google1a32de6a02a9a6e0.html`
  or the `google-site-verification` meta tag**: removing what Google verified with silently
  un-verifies the property and reporting just stops.

- **MEDIUM (2026-07-28)** — **`robots.txt` on a Pages project site is at the wrong path.** It is
  served at `/FERC-Orders-June-2026/robots.txt`, but crawlers read `pranava0x0.github.io/robots.txt`
  (the user-site root), which this repo does not control. The file documents intent and the `<meta
  name="robots">` tag does the actual work, so nothing is broken; worth knowing that the `Sitemap:`
  line in it is largely decorative. Submitting the sitemap directly in Google Search Console is the
  reliable path.

- **LOW (2026-07-28)** — **Consider `BreadcrumbList` / `Dataset` JSON-LD.** The page ships a `Report`
  entity. If per-docket pages land, each should carry its own `Report` or `Legislation` entity with
  `datePublished` and the FERC cite, and the comment corpus arguably qualifies as a `Dataset` (273
  filings, structured, openly licensed), which is a rich-result type worth testing.

- **MEDIUM (2026-08-09)** — **A "rehearing" column for the filing matrix.** `procedural.steps` already
  has a `rehearing` step (statutory 30-day deadline, Jul 20), but `procedural.filings.steps` only
  tracks `report` / `abeyance` / `showcause`. This sweep found real rehearing requests (PJM's docket
  and the E-2 docket, confirmed via Constellation's Aug 4 answer), which currently live only as
  timeline prose, not as a matrix row with an accession. Adding the column is a small schema change
  but touches the matrix's render logic and its tests; deserves its own pass rather than folding into
  a refresh. The underlying rehearing filings themselves are also still unconfirmed on eLibrary by
  direct accession (see `REFRESH.md`'s gotcha on multi-docket filings not cross-listing); a future
  session should also try to find their own accession numbers before adding the column.

- **LOW (2026-08-09)** — **Should PJM's capacity backstop auction (Docket ER26-3380) get its own
  track?** It started as pure market context (the Jul 14 auction result) but is now a real FERC
  docket with its own filing, intervenors, and a Sept 30 to Oct 21 auction window: more than the
  `context` track's "auction results and market events... none of these are filings" framing was
  built for. Currently described under `context` anyway to avoid a mid-refresh schema change; if it
  keeps generating docket-level developments (protests, a FERC order), promote it to a sixth track
  with its own venue and next-step clock.

- **LOW (2026-08-09)** — **`docs/js/data.js`'s editorial prose has drifted from its own style rule.**
  `design-notes.md`'s Voice section is explicit: no em-dashes in displayed prose, comma/colon/period/
  parentheses instead, "X to Y" not "X, Y" ranges. A grep of the file finds roughly 56 em-dashes in
  track status lines and timeline bodies accumulated across refresh sessions (this session's own new
  text avoids them, following the rule). Not fixed here because touching all 56 would churn many
  unrelated lines in a refresh-scoped diff; worth a dedicated copy-edit pass that greps, rewrites, and
  adds the "grep the rendered tabs for em-dashes, expect zero" check the design doc already prescribes
  as an actual test rather than a manual habit.
