# UX improvement plan: the comment-analysis flow + persona deep-dives (2026-07-09)

A build-ready plan: (1) a redesign of the **Comments (RM26-4) tab** into a top-notch
comment-summary product for people who *respond to* public comments and people who *mine* them —
including an external benchmark survey of government comment-analysis tools (§1.8) — and
(2) a **persona-by-persona review of the rest of the site** with ranked improvements. Part 3 is
the prioritized roadmap; Part 4 is implementation guidance for the executor; Part 5 is a
**design refresh** that moves the site off the default-AI look toward a public-record identity
of its own.

Everything here was grounded by reading `docs/js/app.js` end-to-end, inspecting the live
`FERC_COMMENTS` data model, and measuring the rendered site (1280×720 viewport, local server):

| Surface | Rendered height | Screens |
|---|---|---|
| Overview tab | 1,887 px | ~2.6 |
| Timeline | 2,576 px | ~3.6 |
| Reforms | 937 px | ~1.3 |
| Dockets (accordions collapsed) | 2,302 px | ~3.2 |
| Comments → Themes & categories | 2,516 px | ~3.5 |
| Comments → Respondent types | 949 px | ~1.3 |
| **Comments → All comments** | **41,474 px** | **~58** |
| Discourse | 1,920 px | ~2.7 |

The one glaring number: the All-comments list renders all 273 rows synchronously (~142 px average
row), and its only controls (search box + tag bar) are **static at the top** — scroll ten rows in
and every control is off-screen. That violates the project's own "minimal scrolling to controls"
goal and the CLAUDE.md DOM budget. Fixing that list's ergonomics is the spine of Part 1.

Data available today (from `window.FERC_COMMENTS` + `docs/data/comments/*.json`):
273 filings, 272 bodies downloaded, 268 audited summaries; per letter: org, filed date, round,
stakeholder bucket (19), plain-language summary, and stance-carrying bins across four namespaces
(`aq:` eight ANOPR questions, `pr:` five reform principles, `rg:` six RTO regions, `topic:`
emergent); per bin (lazy-loaded): description + verbatim quotes + page numbers. Aggregates:
`themes` (keyword prevalence), `principleStances` (support/oppose/mixed/neutral per principle),
`bucketStances` (18 camps × 5 principles with net scores), `anoprQuestions`/`principles`/`regions`
engagement counts.

---

## Part 1 — The comment-analysis flow

### 1.0 Who this is for (jobs to be done)

The two audiences the user named, decomposed into the five questions they actually bring:

1. **"What does the record say on issue X?"** — a reply-comment drafter or RTO compliance author
   needs every argument on one issue, sorted by side, with quotable cites. *Today this takes ~273
   row-opens; there is no issue-first view.*
2. **"What did organization Y say?"** — opposing counsel, an analyst tracking a competitor, a
   journalist. *Today: type the org in the search box — works, but the result is a row you must
   expand, and there's no way to link a colleague to it.*
3. **"Where does each camp stand?"** — a strategist sizing coalitions. *Today: the stance bars +
   heatmap answer this well; they're the strongest part of the tab.*
4. **"What must my response cover?"** — someone answering the comments (RTO staff, FERC-side
   readers) needs the distinct arguments per issue including the long-tail conditions and
   objections, not just the majority view.
5. **"Who should I coordinate with / watch?"** — who filed on my issues, who's on my side, who
   filed replies and supplementals (the still-active parties).

Questions 1, 4, and 5 have **no view today**. That's the gap; the data to answer all three is
already committed.

### 1.1 Sub-tab structure: evaluate and reshape

Current: `Themes & categories` / `Respondent types` / `All comments`.

Assessment:

- **"Themes & categories"** is a misnomer — it's really the dashboard (stats, rounds, stance
  bars, heatmap, engagement counts). Its internal order buries the best content: keyword
  "Top themes" (the weakest, measured-prevalence signal) comes **before** the audited stance map
  (the strongest). DESIGN.md §8.9 says stance map first.
- **"Respondent types"** at 949 px is a thin sub-tab — one bar list + rosters. It doesn't earn a
  top-level slot on its own; it should grow into the "who" view (see 1.5) or fold into the
  dashboard.
- **"All comments"** does too many jobs: browse, search, and deep-read, across 58 screens with no
  persistent controls.
- The three lenses (questions / principles / regions) are used as *chips and counts* but never as
  *navigation* — the "What the comments engage" block shows the counts and then does nothing with
  them.

Proposed structure — four sub-tabs, ordered by the questions above:

| # | Sub-tab | Job | Content |
|---|---|---|---|
| 1 | **Overview** | "Where does everyone stand?" | Stats + rounds, stance bars, heatmap, keyword themes (demoted to last, collapsible) |
| 2 | **By issue** *(new)* | "What does the record say on X?" | Issue outline → per-issue reader (spec in 1.3) |
| 3 | **All comments** | "What did Y say?" + full-record browse | The list, with the control fixes in 1.4 |
| 4 | **Who filed** | "Who's in this record / who to watch?" | Respondent types + key-voices leaderboards (spec in 1.5) |

Sub-tab selection must be **URL-addressable** (see 1.6) so any view can be shared. Keep the
existing ARIA tablist contract exactly as-is (it's correct).

### 1.2 Overview sub-tab: reorder, prune, sharpen

Keep it one purpose: the lay of the land in ≤2 screens.

1. **Order**: stat row + rounds strip → **"Where commenters land on each reform"** (stance bars)
   → **"Where each stakeholder type stands"** (heatmap) → keyword themes last, inside a collapsed
   `accSection` (it's a prevalence signal, honest but weak; today it eats 456 px above better
   content).
2. **Delete the "What the comments engage" three-column block** (524 px). Its engagement counts
   move to the By-issue outline, where a count is a *link* ("Cost allocation · 232 letters →")
   instead of a dead bar. This is the single biggest scroll cut on the sub-tab and removes the
   redundancy between it, the themes, and the heatmap.
3. **Make every aggregate clickable through to the view that answers it**: a stance-bar segment
   or heatmap cell links into By-issue with the principle (and camp, for cells) pre-selected.
   Today the heatmap cell has a title/aria-label but no affordance; that's a dead end at the
   exact moment of maximum user intent. (Keep the `role="img"` labels; add an `<a>`/button
   wrapper.)
4. **Rounds strip becomes navigation too**: clicking "Reply comments · 61" opens All comments
   filtered to that round.
5. Add one line under the stat row for **coverage honesty**, kept in sync from data: "268 of 273
   audited; 4 image-only scans await OCR; 1 served inline by eLibrary" — this text exists today
   in the lede; make it a compact badge-style line so the numbers stay scannable.

### 1.3 "By issue" sub-tab — the new core view (highest value in this plan)

The issue-outline navigation the backlog already identified as HIGH, specced concretely. It
inverts the per-letter list: pick an issue, read the whole record on it. This is the view a
comment responder actually drafts from.

**Layout** (mobile-first; two panes on ≥900 px, stacked with a jump-back link below):

- **Left rail / top block: the issue outline.** Three groups in the site's canonical lens order —
  eight ANOPR questions, five reform principles, six regions — plus a fourth "Emergent topics"
  group for `topic:` bins that recur across ≥N letters (compute at build; cap the list at ~15 by
  count so the long tail doesn't swamp it). Each entry: name + letter count + a micro stance bar
  (the same support/oppose/mixed/neutral tokens). The outline is the landing state.
- **Right pane: the issue reader**, rendered when an issue is selected:
  1. **Header**: issue name, plain one-line description (author these ~19 descriptions once, in
     `data.js` — e.g. what "Customer-defined net amounts" actually means), letter count,
     stance split bar with denominators.
  2. **Stance-grouped argument list**: the letters' bins for this issue grouped **Support /
     Oppose / Mixed / No position**, within each group sorted by stakeholder bucket. Each row =
     org + bucket chip + the bin's one-line `desc` (already written, per letter) + expandable
     verbatim quotes with page cites + eLibrary link. This reuses the per-letter bin data —
     no new LLM work — but it must be **indexed by issue at build time** (see below).
  3. **"Response coverage" summary** *(second phase, LLM-generated, auditable)*: a short
     synthesized brief per issue — "what supporters argue (N)", "what opponents argue (N)",
     "conditions and qualifications raised" — each claim traceable to the bins beneath it. Built
     with the same quote-centric pipeline as summaries-v2 (chunk → quotes → bins → synthesize),
     committed under `sources/comments/issue-briefs/`, validated by a verbatim-quote test, and
     labeled AI-generated and provisional exactly like the per-letter summaries. Ship the view
     without this first; the grouped bins alone are already the killer feature.
- **Cross-navigation**: every issue chip anywhere on the site (row tags, heatmap cells, stance
  bars, Reforms-tab principles, Section IV briefing questions on Dockets) should deep-link here.

**Data/build work**: extend `tools/build-comments-page-data.mjs` to also emit one
`docs/data/comments/issues/<ns>-<slug>.json` per issue: `{key, name, desc, stances: {...},
letters: [{acc, org, bucket, stance, desc, quotes, pages}]}`. Sizes are modest (the biggest issue
≈ 232 letters × ~2 short quotes ≈ 60–80 KB) — lazy-load per issue exactly like the per-letter
detail files. Add a test that every issue file traces bin-for-bin back to `summaries-v2/` and
that `union(issue files) == union(letter bins)` (no bin silently dropped).

**Why not client-side assembly from the 268 letter files?** 268 fetches to build one issue view
is the wrong shape; one pre-built file per issue is one fetch. Precompute at ingest, per
CLAUDE.md.

### 1.4 All-comments sub-tab: from a 58-screen scroll to a workbench

Keep the list (it's the audit trail and the by-filer answer); fix its ergonomics.

1. **Sticky controls.** Wrap the search box + result count + active-filter tokens in a bar that
   is `position: sticky` under the (already sticky) primary tablist. The tag bar itself stays
   non-sticky (it's 192 px) but collapses to a "Tags ▾" toggle inside the sticky bar once the
   user scrolls. On `pointer: coarse`, the sticky bar keeps ≥44 px targets.
2. **Token filters with AND semantics** (backlog item, requested 2026-06-26). Clicking a tag adds
   a removable token chip to the sticky bar instead of overwriting the search text; tokens AND
   together; free text ANDs with tokens. Add two token types the tags don't cover: **round**
   (initial/reply/supplemental) and **stance** ("supports co-location", meaning: has a `pr:colo`
   bin with stance support — match against per-row bin stances, which are already in
   `comments-data.js`). Keep `data-q` substring matching for free text; tokens match structured
   fields, not the search string, so "PJM + Cost + oppose" stops returning false positives from
   summary prose.
3. **Windowed rendering.** Render the first ~40 rows per round group; an IntersectionObserver
   sentinel appends the rest in chunks. Gate the append on a real scroll-distance check, not
   `isIntersecting` alone (CLAUDE.md's sentinel warning). Filtering runs over the in-memory row
   models (the `allQ` strings + structured tags), then re-renders the window — never toggle
   `hidden` across 273 live rows. Add a node-count regression test.
4. **Row permalinks.** Give each row `id="c-<acc>"` and a chip-scale "link" button that copies
   `…#comments/c=<acc>`; on load, that hash opens the Comments tab, switches to All comments,
   scrolls to the row, and auto-expands its audited analysis. This is how a drafter cites the
   record to a colleague. (One `history.replaceState` router, see 1.6.)
5. **Copy-citation button** on each audited analysis: copies a ready cite —
   `Comments of <Org>, Docket No. RM26-4-000, eLibrary accession <acc> (filed <Month D, YYYY>), p. <n>`
   — the exact string a reply comment needs. Plain text, no tracking, `navigator.clipboard` with
   a visible fallback.
6. **CSV export of the current filtered set** (org, type, round, filed, stances per principle,
   accession, eLibrary URL). Client-side Blob; prefix any cell starting with `= + - @`, tab, or
   CR with `'` (CLAUDE.md formula-injection rule) and add the regression test.
7. **Sort control**: filing order (default) / org A–Z / most positions. Cheap, and org-sort makes
   the by-filer job trivial without search.
8. **Row density**: the row's summary paragraph (`cm-row-desc`) is the eLibrary description —
   often boilerplate ("Comments of X in support of…"). Where an audited summary exists, show its
   first sentence instead (real signal), full description in the expanded view. Trims average row
   height and improves scan quality at zero data cost.

### 1.5 "Who filed" sub-tab: respondent types + key voices (the follow-up view)

Absorbs today's Respondent-types sub-tab and adds the "who to follow up with" job. All from
existing data; **organizations only, never individuals** (filings carry counsel names, but
surfacing people would cross the project's privacy line — and the org is the follow-up unit in
FERC practice anyway).

1. **Keep** the type bars + rosters (they're good; the show-all pattern already matches
   DESIGN.md).
2. **Add "Most engaged filers"**: a leaderboard of orgs by breadth — number of distinct issues
   binned (letters like Terraflux engage all 8 questions), with their stance mix and bucket. The
   broad filers are the ones a responder must address and a coalition-builder calls first.
3. **Add "Active in later rounds"**: orgs that filed reply or supplemental comments (61 + 37
   filings), most recent first with dates. Reply-round filers are *demonstrably still watching
   the docket* — the best follow-up signal in the record. Supplemental filers (through Jun 24,
   2026 — after the orders issued) are the still-live voices.
4. **Add "Where each camp files"**: reuse the existing heatmap row-order (top camps) but as
   links into By-issue/All-comments filtered views rather than a second chart.
5. Every org name anywhere in this sub-tab links to its row(s) in All comments (permalink from
   1.4), so "who → what they said" is one click.
6. Label the leaderboards honestly: engagement breadth is a *triage heuristic* from AI-audited
   bins, not a measure of influence (CLAUDE.md: raw-count rankings are triage, not verdicts).

### 1.6 URL state (cross-cutting for Part 1)

Extend the existing hash routing (`#comments`) with a tiny param grammar:
`#comments/<sub>[?k=v&…]` — e.g. `#comments/issue?id=pr:cost`, `#comments/all?f=rg:pjm,pr:cost&q=stranded`,
`#comments/c=20251104-5015`. One parse/serialize helper, `history.replaceState` on change, applied
on load and `hashchange`. Keep it readable — these URLs get pasted into emails and briefs. Add a
round-trip test (parse(serialize(s)) === s) in the node test suite.

### 1.7 What NOT to build (decided against, so the executor doesn't relitigate)

- **US map of commenters** — page-weight vs. value, already deferred in backlog; region facets
  cover it.
- **"Similar filers" similarity matrix** — heavy for static; the issue view covers the need.
- **A chatbot / NL search** — against the site's static, auditable posture.
- **Full-text search over comment bodies** — a client-side index over ~270 letters is ~MBs of
  payload; the bins + summaries are the curated index. Revisit only if users ask.
- **Form-letter clustering UI** — run the near-duplicate *check* (backlog MEDIUM) as a build-time
  audit first; the record is mostly distinct orgs, so build UI only if clusters actually exist.

### 1.8 External benchmark survey — what other tools and agencies do (web, 2026-07-09)

A second survey pass beyond the 2026-06-30 backlog scan (which covered DocketScope, SmartComment,
Konveio, the CDO Council pilot, ICF/CommentWorks). This one looked at what *government entities
themselves* run, plus the FERC-specific commercial layer. Findings, each with an adopt/skip call:

1. **USDA Forest Service CARA** (Comment Analysis and Response Application) — the longest-running
   federal in-house tool. Its workflow: break each letter into coded excerpts, roll excerpts into
   **"public concern statements,"** and attach an agency response to each concern. Two takeaways:
   our bins ≈ concern statements (independent validation of the summaries-v2 model), and the
   *response* is a first-class object in their data model, not an afterthought. **Adopt** via the
   response-scaffold export below. CARA also runs a public "reading room" per project — our
   All-comments list already is one.
   ([CARA pilot nomination](https://obamawhitehouse.archives.gov/sites/default/files/microsites/ceq/nepa_pilot_project_nomination_-_sid_1217545_jim_smalls_usda_forest_service_-_comment_analysis_and_response_application_cara.pdf) ·
   [CARA public portal](https://cara.fs2c.usda.gov/Public/CommentInput?project=NP-2048))
2. **The comment-response matrix is the canonical responder deliverable.** EPA, DOE-NEPA, FTA,
   and NCPC all publish "Response to Comments" documents built on the same table: comment ID /
   topic / commenter / comment summary / agency response, with similar comments consolidated
   into one summarized comment answered once.
   ([DOE EIS comment-response process](https://www.energy.gov/nepa/articles/eis-comment-response-process-doe-2004) ·
   [NCPC comment matrix example](https://www.ncpc.gov/files/projects/2016/MP20_Comment_Matrix_Jan2017.pdf) ·
   [FTA guidance](https://www.transit.dot.gov/sites/fta.dot.gov/files/docs/regulations-and-guidance/environmental-programs/55996/11-responding-comments.pdf))
   **Adopt — new P1 item:** a **"response scaffold" export** from the By-issue reader: for the
   selected issue (or all issues), emit a markdown/CSV matrix — issue, then per distinct argument:
   the orgs raising it, stance, representative verbatim quote, accession + page cite, and an empty
   Response column. That turns the By-issue view from a reading aid into the first draft of the
   document a responder is actually producing. Cheap: it serializes data the view already has
   (same CSV-injection guard as 1.4.6).
3. **UK i.AI "Consult" + ThemeFinder** — the UK Cabinet Office's AI consultation-analysis tool
   (open-source), which analyzed 50k+ responses to the Independent Water Commission review and
   was evaluated as matching human accuracy. Its architecture mirrors ours (theme generation →
   response classification → **human review dashboard** before anything is final) and its
   published evaluation is the model for our missing step: a documented accuracy check against
   human coders. **Adopt the posture, not the tool:** (a) the `verified_at` stratified human pass
   (1.9.3) gets promoted from housekeeping to the thing that lets us say "human-reviewed" the way
   Consult's eval does; (b) their question-first dashboard validates By-issue as the primary
   view — UK consultations are question-structured exactly like the ANOPR's eight questions.
   ([Consult](https://ai.gov.uk/knowledge-hub/tools/consult/) ·
   [gov.uk evaluation](https://www.gov.uk/government/publications/ai-consultation-analysis-tool-evaluation))
4. **ACUS Recommendation 2021-1** (Managing Mass, Computer-Generated, and Falsely Attributed
   Comments) — federal best practice for mass-comment handling: deduplication technology, and
   **transparency about how comments were processed**. Our record is small and org-distinct, but
   the recommendation strengthens two planned items: the near-duplicate build-time audit (1.10)
   (roadmap item 14) is standard practice, not paranoia; and the Methodology block should gain a
   short "how the comment record was processed" passage (scrape → download → extract → bin →
   validate → audit gate), which it currently only implies.
   ([ACUS project page](https://www.acus.gov/research-projects/managing-mass-computer-generated-and-falsely-attributed-comments))
5. **Mirrulations / regulations.gov researcher ecosystem** — an open project mirroring
   regulations.gov so researchers can `pip install` a CLI, download whole dockets, and get CSVs.
   FERC's eLibrary sits *outside* regulations.gov, so RM26-4 is invisible to that ecosystem.
   **Adopt — P2:** publish our structured record as a documented, machine-readable bundle
   (`docs/data/rm26-4-comments.csv` + the existing per-letter JSON, described in `llms.txt` and
   the README): the only clean structured copy of this docket's comment record anywhere. Cheap —
   it's the 1.4.6 CSV exporter run at build time over the full set.
   ([Civic Tech DC on Mirrulations](https://www.civictechdc.org/events/community/2025/08/06/civic-hackdc-july-recap.html))
6. **Arbo (ex-LawIQ)** — the commercial FERC docket-intelligence layer (structured filings,
   timeline analytics, per-docket alerts; FERC itself is a customer). Confirms the two things
   practitioners pay for are **docket alerts** and **procedural timelines** — i.e., the
   procedural status board (2.1) is the right P0 and the site's freshness gap is its biggest
   competitive weakness vs. the paid layer. A static site can't push alerts, but it can serve a
   feed: **adopt — P2:** a static `feed.xml` (Atom) of docket events (filings landed, deadlines
   passed/upcoming), regenerated by the data-refresh playbook, linked from the status board.
   ([Arbo](https://goarbo.com/))
7. **Skipped after review**: pol.is/deliberation-mapping visualizations (built for open-ended
   civic opinion, wrong shape for a structured docket record); FCC ECFS-style raw-search parity
   (eLibrary already is the search layer; we link into it).

### 1.9 Data-quality prerequisites (sequence before or alongside)

From the existing backlog, now load-bearing for the new views:

1. **OCR the 4 image-only scans** (incl. Data Center Coalition — a heatmap-relevant camp) and
   re-fetch the ETI holdout, so "268 of 273" moves toward complete and the Who-filed leaderboards
   don't silently omit a major voice.
2. **Re-author the 62 Haiku summaries on Sonnet** (backlog MEDIUM) — the By-issue reader puts
   bin descriptions front-and-center; the weakest tier becomes much more visible there.
3. **Stamp `verified_at` via a stratified human spot-check** before labeling anything less
   provisional. The issue briefs (1.3 phase 2) must not ship before their validator tests do.

---

## Part 2 — Persona deep-dives across the rest of the site

Six personas an energy-regulatory microsite like this actually serves. For each: what they come
for, where the site helps or fails them today (grounded in the rendered tabs), and ranked fixes.

### 2.1 RTO/ISO regulatory & compliance staff (the people who must answer FERC — and the comments)

**They come for**: their order's directives, the Section IV briefing questions, deadlines, what
the record says on each question they must brief, and what other RTOs are doing.

**Works today**: the Dockets tab is genuinely strong — per-RTO accordions with page-cited
directives, Section IV questions, distinct findings, rosters; the Reforms tab holds the common
spine.

**Fails today**:
- **No procedural clock.** The record froze at "as of June 22." As of this plan's date
  (**July 9, 2026 — the intervention deadline itself**), the site says nothing about what's due
  when: intervene Jul 9, generation-adequacy report ~Jul 20 (30-day), rehearing ~Jul 18, abeyance
  request by ~Aug 3 (45-day), show-cause/tariff filing ~Aug 17 (60-day), then per-filing comment
  windows. The backlog's HIGH "What happens next status board" is *this* persona's single biggest
  need and it's now time-critical. Build it as: a dated per-RTO grid (rows = six dockets,
  columns = the clock steps), each cell filed/pending/upcoming with the derived date, one
  "next deadline" banner chip on Overview and the masthead. Derived dates labeled as derived
  (business-day-adjusted), statuses updated from eLibrary as filings land (pairs with the
  data-refresh playbook).
- **Section IV questions don't link to the record.** Each briefing question an RTO must answer
  maps to lenses the Comments tab already tags (e.g. the hybrid-rights question ↔ `aq:hybridrights`).
  Add a "what the comment record says →" link per question into the By-issue reader. This is the
  cross-link that turns two good tabs into one workflow.
- The docket accordion `<summary>` tap target (~13 px) is below the 44 px floor (backlog a11y
  item) — fix in passing.

### 2.2 Utility / transmission-owner regulatory attorney

**They come for**: quotable order text with pin cites, the jurisdictional line (transmission vs.
retail), what protections existing contracts got, and what to argue in replies/compliance
comments.

**Works**: page-anchored PDF + gov links per directive are exactly right; the
jurisdiction blocks on Reforms; the E-2 card.

**Fixes**:
1. Reforms-tab principle cards → "what the record says on this →" (By-issue deep link, same
   as 2.1). The five principles are the five `pr:` lenses; the wiring is one href.
2. The copy-citation button (1.4.5) is built for this persona.
3. **A "conditions and qualifications" surface**: attorneys mine the record for the *narrowing
   language* (support-but-only-if). The stance model already carries `mixed` — in the By-issue
   reader, don't bury mixed under support/oppose; give it its own labeled group ("Support with
   conditions / mixed") since that's where the drafting material lives.

### 2.3 Data-center / hyperscaler energy strategy lead

**They come for**: what the orders mean for interconnection timelines, co-location and BTM
rules (E-2), curtailment/flexibility expectations, and what their peers filed.

**Works**: E-2 card, co-location friction items in Discourse, the `data_center` bucket
(29 filings) is filterable.

**Fixes**:
1. **A "co-location & flexibility pathway" jump**: from Overview, one link that lands on
   By-issue `pr:colo` and `pr:flex` — the two issues this persona reads first.
2. The heatmap row "Data centers, hyperscalers & tech" → clickable into their 29 filings
   (1.2.3 covers this).
3. The "who pays" explainer (backlog HIGH) matters here too — this persona is the one being
   asked to pay; the March 2026 ratepayer-protection pledge context belongs in Discourse with
   contested-claim labeling as the backlog already specifies.

### 2.4 IPP / generation developer

**They come for**: hybrid/co-located generation rights, queue implications, proximate-generation
questions, deposits/penalties design (small-developer equity — see Terraflux's letter).

**Fixes**:
1. By-issue covers their questions (`aq:deposits`, `aq:hybridrights`, `pr:proximate`) — ensure
   the issue descriptions (1.3) are written in plain queue-practitioner language.
2. In Who-filed, the `generator_ipp` camp (37 filings) leaderboard shows them their trade
   position at a glance.
3. No new surface needed — this persona is served by Part 1 almost entirely. Note it in the PR
   description so the executor doesn't invent one.

### 2.5 State commission staff / consumer advocate

**They come for**: the federal/state jurisdictional line, retail-rate impact, stranded-asset
risk, and which consumer voices are in the record.

**Fails today**: cost allocation is "the single most-discussed angle" (backlog) but the site has
no consumer-framed entry; the state consumer-advocate concern is a backlog note, not content.

**Fixes** (mostly existing backlog, now sequenced):
1. The **"who pays" explainer** (backlog HIGH) — a Discourse-lane section grounding the
   transmission-vs-retail split in the household-bill frame, every figure audited to a primary
   and labeled estimate/contested per the data rules.
2. In Who-filed, make the consumer/public-interest buckets prominent even though small — an
   empty-ish camp is itself a finding for this persona ("who is *not* in the record").
3. The non-RTO coverage gap note (backlog MEDIUM): consumer advocates in the Southeast need
   the "this doesn't bind non-RTO utilities" caveat stated on the site, not just in Discourse
   sources.

### 2.6 Trade press / policy analyst

**They come for**: what changed, who said what quotable thing, freshness, and numbers they can
cite without re-deriving.

**Works**: Discourse voices with verified quotes; the stat rows; llms.txt for AI-assisted
readers.

**Fixes**:
1. **Discourse source-type + date filter** (backlog MEDIUM) — press vs. law-firm alert vs.
   social, each with visible published dates so fresh reaction separates from background.
2. `og:image` social card (backlog LOW) — this is the persona that shares links.
3. The By-issue reader's stance splits with denominators are the citable numbers; the URL state
   (1.6) makes them linkable from an article.

### 2.7 Cross-cutting UX (all personas)

1. **Sticky sub-tab bar** on Comments (the primary tabs are already sticky; the sub-tabs scroll
   away).
2. **"Back to top" affordance** on any panel > 3 screens (Dockets, All comments), chip-scale,
   bottom-right, `pointer: coarse`-aware.
3. **Mobile pass at 375 px** on every new surface before done (project rule); the heatmap and
   two-pane issue reader need explicit narrow layouts (heatmap already scrolls in-container —
   keep that pattern).
4. **Dark theme** stays backlog-LOW; don't let it ride along in this work.
5. Keep total added JS small and dependency-free; every new view renders from committed data.
   Budget check: comments-data.js is already 483 KB; issue indexes must be lazy per-issue files,
   not up-front payload (1.3), and nothing in this plan grows the initial load materially except
   ~2–4 KB of app.js.

---

## Part 3 — Prioritized roadmap

**P0 — the core product gap (build first, in this order)**

| # | Item | Spec | Effort | Depends on |
|---|---|---|---|---|
| 1 | URL-state router + row permalinks | 1.6, 1.4.4 | S | — |
| 2 | By-issue sub-tab: build-time issue indexes + outline + stance-grouped reader | 1.3 (phase 1, no LLM briefs) | L | 1 |
| 3 | All-comments workbench: sticky controls, token AND-filters, windowed render | 1.4.1–3 | M | 1 |
| 4 | Overview reorder + aggregate click-through + delete engage-block | 1.2 | S | 2 |
| 5 | Procedural status board + next-deadline chip | 2.1 | M | — (data authoring) |

**P1 — the responder toolkit + who-filed**

| # | Item | Spec | Effort | Depends on |
|---|---|---|---|---|
| 6 | Who-filed sub-tab (types + leaderboards + later-round view) | 1.5 | M | 1 |
| 7 | Copy-citation + CSV export (with injection guard + tests) | 1.4.5–6 | S | 3 |
| 8 | Cross-links: Section IV questions & Reforms principles → By-issue | 2.1, 2.2 | S | 2 |
| 9 | Sort control + summary-first row descriptions | 1.4.7–8 | S | 3 |
| 10 | OCR 4 scans + ETI re-fetch; Haiku→Sonnet re-author | 1.9 | M (pipeline) | — |
| 10a | Response-scaffold export (comment-response matrix per issue) | 1.8.2 | S | 2, 7 |

**P2 — synthesis + persona content**

| # | Item | Spec | Effort | Depends on |
|---|---|---|---|---|
| 11 | Per-issue LLM briefs (auditable, provisional-labeled) | 1.3 phase 2 | L (LLM budget) | 2, 10 |
| 12 | "Who pays" explainer (audited figures) | 2.5 | M | — |
| 13 | Discourse source-type/date filter + og:image | 2.6 | S | — |
| 14 | Near-duplicate build-time audit; UI only if clusters found | 1.7, 1.8.4 | S | — |
| 15 | `verified_at` stratified spot-check pass (the "human-reviewed" claim, per the UK Consult eval model) | 1.9, 1.8.3 | M (human) | — |
| 16 | Machine-readable dataset bundle (full-record CSV + llms.txt/README docs) | 1.8.5 | S | 7 |
| 17 | Static Atom feed of docket events, regenerated on data refresh | 1.8.6 | S | 5 |
| 18 | Methodology: "how the comment record was processed" passage | 1.8.4 | S | — |
| 19 | Design refresh (tokens + idioms, own PR, before/after screenshots) | Part 5 | M | after P0 |

Sizing: S ≈ ≤half a session, M ≈ a session, L ≈ multi-session with checkpointed commits. Items
5, 10, 11, 15 touch data/pipeline, the rest are docs/js/app.js + css + tests. Respect the session
budget rule: L items run in committed chunks, never one fan-out.

## Part 4 — Implementation notes for the executor

- **Files**: all rendering lives in `docs/js/app.js` (single IIFE, `esc()` every interpolation);
  aggregates in `docs/js/comments-data.js` are **generated** — change
  `tools/build-comments-page-data.mjs` and regenerate, never hand-edit; per-letter detail and new
  per-issue files under `docs/data/comments/`; styles in `docs/css/styles.css` (tokens at top);
  bump `ASSET_VER` in app.js *and* the `?v=` tokens in index.html together.
- **Tests are the contract** (`node --test tests/*.test.mjs`, currently 56): every new generated
  file needs a trace-back test (bin-for-bin, quote-for-quote); add count floors for new
  aggregates; the windowed list needs a node-budget test; CSV needs the formula-injection test;
  the URL grammar needs a round-trip test. Regenerated data commits **with** its generator in the
  same commit.
- **Design system**: follow DESIGN.md §8.7 (sub-tabs), §8.8 (lens chips), §8.9 (auditable-corpus
  explorer — stance-map-first, net-sentiment banding, no zero-instance legend swatches, lazy
  evidence, ≥44 px coarse-pointer targets). Reuse the existing stance tokens; invent no new
  palette.
- **Copy rules**: no em-dashes, no "X, not Y" parallelism, ranges as "to", no AI-register words
  in any *displayed* string (memory: no-ai-isms-in-prose; DESIGN.md §11.1). Labels state
  denominators; AI-derived views carry the provisional label.
- **Honesty rails**: stances and bins are AI-audited and `verified:false` — every new aggregate
  view repeats the provenance line the heatmap uses; leaderboards are labeled triage heuristics;
  no individuals' names, orgs only; derived deadline dates labeled derived.
- **Verify loop**: `python3 -m http.server` against `docs/`, test at 375 px and desktop, run the
  full suite plus `node tools/verify-quotes.mjs` before any commit; UAT the three flows —
  issue-to-quote, org-to-permalink, filter-to-CSV.

---

## Part 5 — Design refresh: away from the default-AI look

### 5.1 Honest read of the current design

The site already dodges the worst AI tells (no gradients, no purple, no emoji, system fonts,
hairline rules, one shadow in the whole stylesheet). But audited against "would a stranger guess
an AI built this," several tells remain — and the biggest is the overall *ambience*:

1. **The palette is Claude's palette.** Warm ivory paper (`#f4f1ea`), deep navy, muted serif
   headings — that trio is Anthropic's own brand ambience, and it's become the default "tasteful
   AI output" look across thousands of generated sites. Individually defensible, collectively a
   fingerprint.
2. **Pill inflation.** ~19 `border-radius: 999px` rules — source chips, lens tags, stance pills,
   status pills, count bubbles. The fully-rounded chip is the single most recognizable
   LLM-frontend tic.
3. **The KPI stat-card row** (big number, small gray label, white rounded card ×4) is the
   canonical AI-dashboard opener. Ours is honest, but the *form* is stock.
4. **Numbered tabs** ("01 Overview") — a portfolio-template flourish that reads generated, and
   the numbers carry no meaning.
5. **Uniform white cards on beige** for every content type — cards as the only container idiom.

### 5.2 The direction: design from the primary documents, not from a design system

The site's soul is the public record itself. FERC orders, the Federal Register, and eLibrary
docket sheets have a *strong existing visual language* that no AI default resembles: dense
typographic hierarchy, caption blocks, double rules, paragraph marks (¶ / §), reporter cites,
stamped dates, ledger-style tables. Leaning into that gives the site a look that is (a) fresh,
(b) impossible to mistake for a template, and (c) *argues the content's authority* — the design
itself says "this is the record, organized."

Concretely — a bounded token-and-idiom pass, not a rebuild:

1. **Cool the paper.** Move `--bg` off Claude-ivory to a cooler archival off-white (in the
   direction of `#f6f5f1` → test against WCAG on all existing text tokens) and let the navy
   masthead carry all the warmth-contrast. One move, and the ambience stops reading Anthropic.
2. **Kill the pill.** Replace 999px chips with two idioms: **bracketed tags** for lenses/filters
   (square-cornered, hairline border, mono or small-caps label — visually "[PJM] [Cost]", the
   way a reporter cite reads) and **underline-accent text chips** for sources. Keep stance colors
   exactly as-is (they're semantic tokens, not decoration). One CSS pass over existing classes;
   no markup changes.
3. **Caption block instead of KPI cards.** Re-set the Overview stat row and the Comments stat row
   as a ruled ledger strip — figures in a single hairline-ruled row, tabular numerals, labels in
   small caps beneath, double rule above (the way an order's caption page tables its docket
   numbers). Same data, same `cm-stat` markup, different dress.
4. **Section heads as running heads.** Replace card-boxed section heads with the gazette idiom:
   small-caps section label, thin-thick double rule, generous top space. Drop the numbered-tab
   prefix ("01") from the primary tabs; let the tab labels stand, with the active tab marked by
   a heavier underline (the sub-tabs already do this correctly).
5. **One signature element: the cite margin.** On wide screens, page cites and paragraph marks
   (`P 77`, `p. 43`, accession numbers) — already mono-styled — move into a hanging right margin
   on directive/finding rows, like marginalia in a reporter volume. This is the memorable,
   screenshot-able detail nobody else's site has. (Desktop-only; collapses inline on mobile —
   the mobile layout is already correct.)
6. **Typography tune, no new fonts.** Keep the Charter/serif + system-sans + mono stack (project
   rule: system stacks only). Sharpen the scale contrast: display serif slightly larger/tighter
   at the masthead and section heads, body stays as-is; use real small-caps
   (`font-variant-caps: all-small-caps`) for eyebrows/labels instead of tracked uppercase 11px,
   which is currently the third AI tell in the label styling.
7. **Where color may be added** (sparingly): a single "record red" in the Federal Register
   tradition for the deadline hue could replace the current burnt amber — evaluate against the
   existing `--deadline` semantics; do not add a second accent anywhere else.

### 5.3 Guardrails

- **Don't cosplay authority.** As the design gets more gazette-like, the "Not affiliated with
  FERC or DOE" line must get *more* prominent, not less — keep it in the footer and add it to
  the Methodology summary line. No seals, no eagle, nothing that imitates an official mark.
- **Semantics don't move.** Stance/tier/status color tokens keep their meanings and contrast
  ratios; the refresh touches dress (radius, rules, casing, spacing), not the semantic layer.
- **A11y is the floor**: every replacement keeps focus-visible outlines, ≥44px coarse-pointer
  targets, and the sr-only/aria patterns exactly as they are.
- **Ship it as its own PR** — a pure-CSS pass (plus the tab-number removal) with before/after
  screenshots at 375px and desktop, zero data or behavior changes, so review is purely visual.
- **Effort**: M. Sequence after P0 items land (the new views should be born into the new dress,
  but don't block them on it — tokens first, then views).
