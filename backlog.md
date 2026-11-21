# backlog.md

- **`data.js` is now the largest blocking asset (112 KB gzip of 178 KB).** (medium) With `comments-data.js` lazy
  since 2026-11-02, the timeline and Discourse bodies dominate first load. Splitting them out the same way would
  roughly halve blocking weight again, but every tab reads `D.SOURCES`, so it needs a design (a core file plus
  per-tab files), not a move. Measure with the throttled pass in uat.md before and after.
- **Read every docket in one in-page call.** (low) eLibrary's sheet comes from a POST to
  `/eLibraryWebAPI/api/Docket/GetSingleDocketSheet` that works inside the logged-in tab. Capture the request body
  once (hook XHR, then run a new docket search in the SPA) and `tools/elibrary-sweep.js` could fetch all ~20
  sheets in one call instead of ~20 navigations.

- **Automate the `-001` and companion-docket sweep.** (medium) `tools/elibrary-sweep.js` takes one docket per
  paste. The Sep 21 undercount (five orders, not four; issues.md 2026-10-19) happened on a sweep that had the
  `-001` rule but applied it by hand. Give the extractor a list (`EL26-67-000`, `EL26-67-001`, …, `ER26-3380`,
  `EL26-108`, `ER26-3515`) and have it navigate and accumulate across all of them in one run.

- **Watch the Nov 30 comment filings in ER26-3515-002 and ER27-454-000**, any ER26-3515-001 rehearing action and any actual withdrawal in ER27-330. PJM’s registry compliance and Ohio’s Nov 9 rehearing request are now on Filings. These are separate from the Nov 16 show cause deadline.

- **Consolidate the emergent `topic:` vocabulary.** (medium) 673 distinct topic bins across 268 files,
  with obvious near-synonyms: `topic:state-authority` (7) vs `topic:state-jurisdiction` (3),
  `topic:tariff-transparency` (12) vs `topic:transparency` (5) vs `topic:queue-transparency` (4),
  `topic:cost-allocation` (5) vs `topic:cost-causation` (3). The by-issue index only surfaces topics
  appearing in 3+ letters, so the long tail is invisible to readers while still fragmenting the ones
  that are surfaced. Merge the synonym clusters into a controlled list, keep genuinely one-off topics
  as they are, and record the mapping so the merge is auditable.

- **Teach `check-staleness.mjs` to catch expired FRAMING, not just expired dates.** (medium) It flags a
  passed `kind: "deadline"` event, but not an event whose date is still in the future while its subject
  has already resolved. Two shipped that way this session: an abeyance event written in the conditional
  ("any abeyance would push the deadline later") months after all six were granted, and a response
  deadline whose derived date the abeyance orders had replaced. A cheap heuristic: flag any event whose
  body contains conditional markers ("would", "if requested", "could", "is expected to") when a later
  event on the same track describes the same subject as done.

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
- **medium — OCR the 4 image-only scans.** `20251121-5224`, `20251121-5521` (Data Center Coalition),
  `20251121-5140` (Yurok Nation), `20251205-5005` are downloaded but have no text layer (`validate-comments.py`
  flags them). Needs an OCR tool (no `ocrmypdf`/`tesseract` installed locally — install one, or use macOS
  Vision). Once OCR'd, re-run organize/validate; they drop out of the scanned set into the text-analyzed corpus.
- **low — re-fetch the ETI holdout** (`20251121-5225`, Energy Trading Institute): renders + clicks but won't download
  (served inline). Inventoried + re-downloadable; the corpus reads 272/273. See `issues.md`.
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

- **low — `procedural.filings` rows that cover several filers carry one `accession`** (from the 2026-08-04
  PR #17 review; its other three items were fixed 2026-11-21). EL26-67's abeyance step covers both PJM and the
  Indicated PJM Transmission Owners. The prose is honest about it, but it is lossy against one record, one
  origin; consider an `accessions: []` array if this recurs.

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

- **MEDIUM — human verification pass (feedback alignment).** All 268 are `verified:false`. Curate a
  sample, stamp `verified_at`, and feed each curator edit back as a few-shot example (the PNNL loop).
  No recall baseline exists yet (see `issues.md`); a small SME-selected gold set would let us measure it.
- **MEDIUM — fuller pass on the 8 large filings (>120 KB).** Page-windowed map-reduce over the whole
  body instead of the front-slice read, so a position buried in an exhibit isn't missed (`issues.md`).

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

---

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

- **MEDIUM (2026-07-28)** — **`robots.txt` on a Pages project site is at the wrong path.** It is
  served at `/ferc-large-load-proceedings/robots.txt`, but crawlers read `pranava0x0.github.io/robots.txt`
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

- **Medium** · Make `tools/extract-abeyance-docs.py` merge into the existing manifest instead of regenerating it, and add the `-001` sub-dockets to `tools/elibrary-sweep.js` (2026-10-08).

## From the 2026-11-09 refresh (Filings and Commissioners tabs)

- **High:** validate and ship the Nov 2 to Nov 9 news findings (Rosner at DERVOS Nov 5, NERC's computational-load
  standards Oct 26, ICF on the backstop refiling, the Nov 3 midterms) through the Sonnet validation pass.
- **Medium:** add tenets for documents already in the corpus but not on the Filings tab (the DOE §403 letter,
  the CEBA/DCC letter, PJM's Nov 5 MC materials once posted).

## From the 2026-11-15 refresh (interaction depth)

- **Medium:** a document inside a long proceeding still costs 3 clicks and about 2 screens of scroll on desktop (4 on a phone) when reached by browsing: MISO LARS has 14 rows. The find box gets there in 3 with no scroll. Options to measure: a per-proceeding filer index, or sorting the answering document first.
- **Low:** All comments search stays at 4 interactions (tab, sub-tab, tap, type). A global search box in the masthead would make it 2.
- **Low:** verify and ship the three queued items in REFRESH.md (Market Monitor Nov 12 statement, RTO Insider NEPOOL and NYISO pieces, Latitude on CHILLS).

- **Medium (2026-11-18): phone depth for documents found by browsing a long proceeding.** UAT goals m, n and r cost
  7 to 8 on a phone (open a proceeding, scroll its list, open the document). Options: a per-proceeding find box, or
  collapsing a proceeding's older documents behind "N earlier". The Overview links and the find box already reach
  the newest documents in 1 to 3.
- **Low (2026-11-18): tag reform keys on the remaining Nov 16 transmission owner filings** (NYTOs ER27-529, LSPGNY
  ER27-518, the 15 California TOs) once their readings exist, so the crosswalk counts them.
- **Medium (2026-11-21): read the remaining positional filings outside the watched proceedings.** `node tools/curation-queue.mjs`
  counts them: PJM co-location 147 of 148 unread, governance 75, registry 59, backstop 48, MISO IRR 8, ZGIA 5, ATC 5.
  Mostly settled history; work in chunks per proceeding with the same position format.
- **Low (2026-11-21): add a stance to the older positions outside MISO LARS.** Every LARS comment and protest
  now carries a read stance (2026-11-21). Positions in other proceedings written before stances existed still
  get their row's side from tenets.json or the title; where a stance is added, the build stops if tenets.json
  disagrees.
- **Won't fix (2026-11-21): banning "unlock" and "comprehensive" in comment summaries.** About 30 summaries use
  them, nearly all in the commenter's own sense ("a comprehensive final rule", "unlock 76 GW"). The register
  lint in validate-summaries keeps its narrower list.
