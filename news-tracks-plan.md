# News & parallel-timelines plan: four tracks, a filing tracker, discourse wave 2 (2026-07-28)

## Progress log (append per session)

**Session 2026-07-28b — Phase 0 done, Phase 1 data layer done, paused mid-flight.**

Done and committed:

- **Phase 0** (previous session, commit `ccb67c1`): abeyance-scope hotfix, shipped.
- **Verification pass** (Part 1.6 items 4, 5, plus the ISO-NE rows in 1.1). What resolved:
  - **AD26-7-000 confirmed as primary source.** federalregister.gov HTML bot-blocks automated
    fetch, but its **JSON API and `full_text/text/...txt` endpoints are open** (write this down;
    it is the workaround for every future FR check). Four notices found: 2026-05-18 (Doc.
    2026-09924), 06-10, 07-08, 07-21 (Doc. 2026-14691). The initial notice states verbatim that the
    conference "will convene on Thursday, July 23, 2026, in the Kevin J. McIntyre Commission Meeting
    Room." **July 23 is now primary-source confirmed**; the plan's date-discipline worry is closed.
  - **ISO-NE 6/29 and 7/21 fetched** from ISO Newswire (first-party, open): the 90-day abeyance
    intent, the Nov 16 2026 §205 target, and the 30-day report's substance.
  - **PJM BRA figures confirmed** against PJM's own release: $325/MW-day cap, 138,318 MW, $16.4B,
    **6,831 MW** short (the plan's "~6.8 GW"), 14.7% reserve margin, September backstop procurement.
  - **Utility Dive 7/24 fetched** for the Swett / LaCerte / Mills quotes.
  - **Still unverified, still eLibrary-gated:** queue items 1, 2, 3, 6 (the six 30-day report
    accessions, the Jul 17 advocates filing's procedural type, any rehearing/abeyance requests, the
    EL25-49 Jul 31 effective date). Everything touching them ships as `filed-reported` or
    `none-observed`, never as verified.
- **Phase 1 data layer** in `docs/js/data.js`: six new `SOURCES` records carrying `published`; the
  five-track `tracks` registry (Part 2.2); `track` on all 11 pre-existing timeline events per the
  Part 2.1 mapping; five new verified events (FR notice, ISO-NE abeyance signal, PJM BRA, ISO-NE
  report, conference held); `meta.newsCapture`.
- **`sources/news-evidence.json`** created (Part 3 Feature F) with the captured snippets, and
  `tools/verify-quotes.mjs` given a `newsEvidenceText` corpus.

Tests are **82/82 green** at this commit; the work so far is purely additive.

**Session 2026-07-28b (continued) — Phases 1 to 4 complete.**

- **Phase 1**: tracks registry, `track` on every event, Timeline Feature A (cards, chips, pills,
  `#timeline/track/<id>`), Overview "where things stand" strip. Commit `c2536cb`.
- **Phase 2**: filing matrix storing **observations only**, with `upcoming` / `none-observed` derived
  from the clock at render time so the grid cannot go stale into a false "nothing was filed";
  Aug 17 collision callout; two-evidence-base board foot; masthead second clause; `REFRESH.md`;
  `tools/check-staleness.mjs`. Commit `52554d1`.
- **Phase 3**: Discourse wave lanes with per-wave capture stamps, three wave-2 themes with track
  pills, evidence plumbed through both capture files, `llms.txt` "Parallel proceedings" and
  "Observed filings" sections. Commit `f1e58be`.
- **Phase 4**: KPI cards read their state off the procedural clock, Overview prose acknowledges the
  post-June world, Dockets carries a pointer to the gov track, footer stamps the news sweep.

**Deviations from the plan, and why:**

- **Feature D #4 (wave-1 roster trim) not done.** `D.voices` is never rendered by `app.js`; it feeds
  `llms.txt` and the tests. There is no 37-name list on the page to collapse behind a show-more.
- **Feature B cell popovers** became an at-a-glance chip grid plus a full "what we observed" list
  underneath. Same data, nothing behind a hover, and it survives 375px without a popover layer.
- **Nothing is `filed-verified`.** eLibrary stayed Cloudflare-gated, so no accession was read. Queue
  items 1, 2, 3 and 6 are open and carried into `REFRESH.md`.

**Still outstanding:** the post-Aug-17 refresh (run `REFRESH.md` end to end on the six show-cause
filings and the E-2 compliance filing). That is scheduled work, and the real test of this plan.

**Session 2026-08-03 — first full REFRESH.md run (logged here retroactively; the prior session ended
before writing this entry).** eLibrary's Cloudflare gate crossed for the first time via the Control_Chrome
browser bridge: all six 30-day generation-adequacy reports and all six abeyance motions confirmed
`filed-verified` with accessions. `elibrary0803` source added; `tracks`, `timeline` and
`procedural.filings` updated. Commissioner-tailoring bug found and fixed (see `issues.md` 2026-08-03/04).

**Session 2026-08-09 — second REFRESH.md run, first real division in the record.** Swept eLibrary
(Control_Chrome bridge) for every filing since Aug 3 across all six §206 dockets, EL25-49, AD26-7-000,
and the newly discovered ER26-3380 (PJM's backstop-auction docket). Findings: American Municipal Power
is the first party to oppose an abeyance motion (MISO's, Aug 7); Silver Run Electric filed a third,
separate abeyance motion in PJM's own docket asking for a ruling by Aug 13; the Indicated PJM
Transmission Owners and, jointly, Exelon and FirstEnergy filed rehearing/clarification requests
against both the PJM order and the E-2 order on July 20 (closing REFRESH.md queue item 3 from the
2026-08-03 refresh — confirmed present only in those two dockets, absent from the other five); FERC's
Aug 4 Federal Register notice set concrete AD26-7 dates (comments due Aug 21, ADR forum starts Sep 1);
and PJM's capacity backstop moved from a stated intent to an actual FERC filing (Docket ER26-3380,
filed Jul 31). Two new sources (`frgov0804`, `udbackstop`) plus `elibrary0809`. All 112 tests, the
quote verifier, and the commissioner-tailoring verifier pass. See `REFRESH.md`'s "Gotchas learned the
hard way" for the session's eLibrary-search lessons (multi-docket filings, pagination order, a
boilerplate description field, and "in response to" not implying opposition).

> Status: **Phases 0 to 4 shipped.** The remaining work is the recurring refresh loop, not features.
> Companion to `ux-improvement-plan.md` (2026-07-09) and
> `policy-analysis-spec.md` (2026-07-14); this spec supersedes the backlog's "compliance tracker,"
> "per-docket procedural clock," "published-date discipline," "Discourse freshness filter," and
> "voice roster rebalance" entries by absorbing them. Nothing in Part 1 ships without the
> verification pass in Part 1.6/Part 4 — the research below is a *lead sheet*, not a source of record.

## Part 0 — Trigger, research provenance, and one surprise

**Trigger.** The site froze at the 2026-06-22/24 capture. Since then the §206 clock it displays has
started firing: interventions closed Jul 9, the 30-day generation-adequacy reports and the statutory
rehearing window closed Jul 20, abeyance requests are due Aug 3, and the 60-day show-cause/tariff
filings (plus the E-2 further compliance filing) land ~Aug 17. Today the Overview board shows three
steps as "Passed" and says nothing about what actually happened — the honesty gap is now the first
thing a visitor sees. The owner asked for a news-driven refresh covering: the six FERC orders, the
PJM governance hearing, PJM E-2, and the "SW technical conference," organized as **separate
timelines**, plus anything else relevant to the 30/60-day deadlines.

**Research provenance.** One Sonnet web-search agent (agent-runs.md Run 10: 44 tool calls, 135K
subagent tokens, ~8 min) swept trade press, RTO/ISO channels, law-firm alerts, and the Federal
Register for the window 2026-06-24 → 2026-07-28. Its report distinguishes items it **fetched and
read** from items seen only in **search snippets**; that distinction is carried into every table
below. ferc.gov and eLibrary returned 403 to automated fetch throughout (known Cloudflare posture;
see issues.md 2026-06-22), so all docket-level confirmations route through the manual browser path
in Part 4.

**The surprise: two of the four requested tracks are one event.** The "PJM governance hearing" and
the "SW technical conference" both resolve to FERC's **Commission-led technical conference on PJM
Governance and Stakeholder Reforms, Docket AD26-7-000, held July 23, 2026** — "SW" reads as
shorthand for **Chairman Laura Swett**, whose "grave legitimacy crisis" line dominated the coverage.
The agent tested and ruled out the alternatives: SPP (Southwest Power Pool) held no 2026 technical
conference (only routine tariff orders); NERC's Emerging Large Loads conference was Feb 24–25, 2026
(too early); FERC's Resource Adequacy conference was June 2025 (wrong year); no other AD26-xx
large-load conference surfaced. **Open question for the owner:** if "SW" meant a genuinely distinct
event, name it — the tracks model below makes adding a sixth track a ~30-line data change, nothing
structural. Until then this plan models governance as ONE track and notes the naming convergence in
its track card, which is itself the kind of disambiguation the site should give readers.

**Provisional-data rule (restated from CLAUDE.md).** Everything in Part 1 is an AI web-research
synthesis. Before any item ships: verify against the primary source (eLibrary accession, Federal
Register page, or a fetched article with captured evidence), stamp `verified_at` + a per-row source,
and route quotes through the same evidence-capture + verbatim-test pipeline the Discourse tab
already enforces. Snippet-only items that fail verification get dropped, not hedged.

---

## Part 1 — What the news changed (content spec, per track)

Columns: **Conf.** = agent confidence (`fetched` = article read end-to-end; `snippet` = search-result
text only). **Ships as** = which surface(s) the item lands on (T = timeline event, M = filing-matrix
cell, D = discourse, C = track card status line).

### 1.1 Track `sc6` — the six §206 show-cause dockets (EL26-67…72)

| Date | What happened | Conf. | Verify via | Ships as |
|---|---|---|---|---|
| 2026-06-29 | ISO-NE and its TOs publicly signaled they plan to request a 90-day abeyance (due Aug 3) and, if granted, target a **Nov 16, 2026 §205 filing** instead of the Aug 17 deadline. | fetched (ISO Newswire 6/29) | re-fetch + evidence capture | T, M (`signaled`), C |
| 2026-07-17 | Ratepayer advocates from DE/IL/MD/OH (jointly) + PA OCA (separately) filed in EL26-67 arguing the PJM order is "arbitrary and capricious" for naming the cost-shift risk without fixing network-upgrade cost allocation. Procedural label (rehearing request vs protest/comment) **unconfirmed**. | fetched (Utility Dive 7/21) | eLibrary: filing type + exact filers | T, D |
| 2026-07-20 | ISO-NE filed its 30-day generation-adequacy report: new large loads should bring **incremental new generation**, and capacity for them should **not be procured through the regional capacity market**. | fetched (ISO Newswire 7/21) | eLibrary accession | T, M (`filed-verified` once accession seen) |
| ~2026-07-20 | PJM filed its 30-day report (expedited new-generation initiatives + near-term resource adequacy). Contents thin in press. | snippet | eLibrary accession + read | M, T (only if verified) |
| ~2026-07-20 | MISO / SPP / CAISO / NYISO report status: **nothing found in press either way.** | — | eLibrary sweep, all six dockets | M (`none-observed` until checked) |
| 2026-07-20 | Statutory rehearing window closed; no rehearing request confirmed in press (the 7/17 advocates filing is the only candidate). | — | eLibrary sweep | M, T |
| 2026-08-03 | Abeyance requests due — **in all six dockets**, not NYISO-only (see 1.5). ISO-NE is the announced user of it. | verified locally | order texts (done) + eLibrary after 8/3 | T, M, board fix |
| 2026-08-17 | 60-day show-cause / tariff filings due, all six dockets. Same day as the E-2 further compliance filing (see 1.2) — a two-clock collision worth one explicit callout. | already on site | eLibrary after 8/17 | T, board |

Regional-divergence note for Discourse (D): trade press is now comparing the visible strategies —
ISO-NE's "bring your own generation, keep it out of the capacity market" stance vs PJM's expedited
new-entry initiatives vs SPP's already-accepted HILL/HILLGA/CHILLS mechanisms. That is the orders'
"regional tailoring" thesis playing out on the record, and it earns a consensus-lane line.

### 1.2 Track `e2` — PJM co-location, EL25-49

| Date | What happened | Conf. | Verify via | Ships as |
|---|---|---|---|---|
| 2026-07-31 | Requested **effective date** of the three new services (Interim NITS, Firm/Non-Firm Contract Demand) from PJM's Feb 2026 compliance filing. | snippet | eLibrary (Feb filing's stated date) | T (only if verified) |
| ~2026-08-17 | PJM + PJM TOs further compliance filing due (already on site, from E-2 itself). | order text | eLibrary after 8/17 | T, board |
| as of 07-28 | **No circuit-court petitions found** against the Dec 2025 or Jun 2026 co-location orders. Agent checked and ruled out the D.C. Cir. "MISO TOs v. FERC" (No. 25-1045, 6/5/2026) as an unrelated ROE case. | fetched (Justia) | periodic court-docket check in refresh loop | C ("quiet lane" status line) |

The e2 track card should say plainly why it is separate: a different docket (EL25-49) with its own
compliance clock, whose product (the three services) the six orders *extend* — the site already
explains this in prose; the track model makes it structural.

### 1.3 Track `gov` — PJM governance & stakeholder reform, AD26-7-000

| Date | What happened | Conf. | Verify via | Ships as |
|---|---|---|---|---|
| 2026-05-18 | Federal Register notice announcing the Commission-led technical conference on PJM governance and stakeholder reforms (supplemental notices 6/10, 7/08, 7/21 updating agenda/panelists). Docket **AD26-7-000** — number seen in FR search results, **not yet read on a FERC page**. | snippet (FR) | federalregister.gov pages (fetchable) + FERC docket page via browser | T, C |
| 2026-07-23 | Conference held at FERC HQ. Chairman **Swett**: PJM faces "a grave legitimacy crisis," is at "a global inflection point"; some TOs openly discuss leaving the RTO. Commissioner **LaCerte**: weakened board independence produced "a cultural quagmire." Participants incl. PJM CEO David Mills, Asim Haque, Dave Anders; DOE Deputy Secretary James Danly; NEDC's Peter Lake; Commissioners Rosner and See; Pat Wood III. AEP + PSEG backed major governance change; states sought expanded roles. | fetched ×3 (RTO Insider 7/23, Utility Dive 7/24, PJM Inside Lines 7/24) | re-fetch all three + evidence capture for every quote | T, D, C |
| 2026-07-23 | PJM's Mills floated an "augmented OPSI" body for all member states with expanded petition rights, and previewed a **September 2026 "backstop" capacity auction** (15-year terms per one outlet). | fetched (Inside Lines) + snippet (terms) | re-fetch; label the 15-yr figure by its single source | T, D |
| next | Swett: FERC will issue a post-conference notice seeking written comments (structured question set) and convene a **time-bound dispute-resolution forum in September**; PJM must adopt reforms by **end of September 2026 or FERC imposes them**. | fetched (Utility Dive 7/24) | FERC notice once issued | T, C (this is the track's own clock) |

Date discipline: one secondary source rendered the conference date as "July 18, Thursday" — an
artifact (Jul 18, 2026 is a Saturday). The FR trail + two fetched outlets agree on **July 23**; the
plan treats that as canonical and the refresh workflow re-confirms against the FR page.

Why this track matters to the core story (goes in the track card, one sentence each): the same
commission running the §206 clock has put PJM's decision-making machinery itself on a
September clock, and the answer decides who controls PJM's follow-through filings.

### 1.4 Track `context` — market events that set the stakes (not docket filings)

| Date | What happened | Conf. | Verify via | Ships as |
|---|---|---|---|---|
| 2026-07-14 | PJM's 2028/29 Base Residual Auction cleared at the **$325/MW-day cap**, ~**6.8 GW short** of the reserve-margin target — third consecutive capped auction. Data centers reported as over a third of the $16.4B cost. | snippet (PJM release + Sierra Club + Utility Dive) | PJM's own release PDF (fetchable URL known); figures re-checked there | T, D |
| 2026-07-23 | PJM MRC endorsed emergency procedures for committing **large-load backup generation** with advance notice of system strain — context for how PJM may frame flexible service on Aug 17. | snippet (RTO Insider) | fetch article; else drop | T (only if verified) |
| 2026-07-27 | Axios: off-grid/BTM data-center strategies are slower, costlier, less reliable than hoped — discourse directly on the orders' co-location/BTM category. | snippet (fetch 403'd) | retry fetch via browser; else cite as headline-only in D or drop | D |

`context` is deliberately a track: these items must be *visibly* not-filings, or the timeline
re-blurs the very distinction this plan exists to draw. Rule: a `context` event never renders a
docket chip and never feeds the filing matrix.

### 1.5 The correction this research forced: abeyance is in ALL SIX orders

ISO-NE announcing an abeyance plan contradicted the site's "Abeyance request (NYISO only)" step.
Local verification today (grep of `sources/text/orders/*.txt`): **"abeyance" appears 7–8 times in
every one of the six order texts** — e.g. E-11 (ISO-NE): requests due "within 45 days of issuance,"
abeyance "limited to 90 days," granted with "great disfavor," partial abeyance contemplated for
§205-bound subsets. The site mis-scopes this in three places plus the most prominent pixel on the
page:

1. `data.js` `procedural.steps` id `abeyance` — label "Abeyance request (NYISO only)", cite "E-12 (NYISO) P 42";
2. the ≈Aug 17 timeline entry ("…in the NYISO order, a 45-day deadline to request abeyance…");
3. the "Fall 2026, if requested" timeline entry ("NYISO's order expressly lets respondents request abeyance…");
4. **the masthead next-deadline chip is currently showing this mislabeled step** (Aug 3 is the soonest upcoming date).

Logged as issues.md 2026-07-28 (Open). Fix is **Phase 0** — it ships alone, before and independent
of everything else in this plan. Scope: relabel the step (all six dockets; note ISO-NE is the
announced user), re-cite with each order's own paragraph (pull the P number per order from the
committed texts, not just E-12), correct both timeline entries, regenerate `llms.txt`, and add the
regression test in Part 5. Root-cause note for LEARNINGS.md: a provision read in full in ONE order
was assumed unique to it; "distinct finding" claims need a cross-order grep before shipping.

### 1.6 Verification queue (blocks shipping; feeds Part 4's first run)

From the agent's follow-ups plus this plan's own needs, in priority order:

1. eLibrary, EL26-67…72: the six 30-day reports (filed? accession + date each; read PJM's + ISO-NE's).
2. eLibrary, EL26-67: the Jul 17 advocates filing — exact procedural type + filer list.
3. eLibrary, all six: any rehearing requests dated ≤ Jul 20; any abeyance requests (re-check after Aug 3).
4. federalregister.gov: the AD26-7-000 notice trail (confirms docket number + conference date; fetchable without Cloudflare).
5. PJM BRA release PDF: re-check the $325/6.8 GW/$16.4B figures before any of them render.
6. EL25-49: the Feb 2026 compliance filing's requested Jul 31 effective date.
7. After Aug 17: the six show-cause filings + the E-2 further compliance filing (next full refresh).

---

## Part 2 — IA: the tracks model (what "separate timelines" means concretely)

### 2.1 The concept

Today `D.timeline` is one undifferentiated array and the Timeline tab renders one rail; E-2 lives
inside the six-order narrative; governance and market context have nowhere to live at all. The fix
is a **track registry**: every timeline event carries a required `track`, the registry carries the
per-track framing (what it is, why it is separate, its own next date), and every surface that shows
an event shows its track. The crosswalk already proved this pattern with `next.vehicle ∈
{compliance-filing, e2-paper-hearing, rm26-4-rule}` — tracks are the same idea promoted from "where
an issue goes next" to "which proceeding an event belongs to."

Five tracks at launch:

| id | Label (UI copy) | Venue | Own clock |
|---|---|---|---|
| `sc6` | The six-market §206 clock | EL26-67…72 | Aug 3 abeyance → Aug 17 filings → +30d responses |
| `e2` | PJM co-location: EL25-49 | EL25-49 | Jul 31 service effective (if verified) → Aug 17 compliance |
| `gov` | PJM governance: AD26-7 | AD26-7-000 | comment notice → Sept forum → end-of-Sept adopt-or-imposed |
| `rm264` | The RM26-4 record | RM26-4-000 | open; no dated step |
| `context` | Market context | none (not a docket) | none |

Existing timeline events map cleanly: the two Oct 2025 DOE entries + comment-round entry → `rm264`;
the Dec-2025-to-Jun-2026 co-location groundwork entry → `e2`; the Jun 18 issuance + all deadline
entries → `sc6`; the "parallel lane" rehearing-risk entry → `sc6`. No event is orphaned, and the
mapping is test-enforced (Part 5).

### 2.2 Data design (`data.js`)

```js
// Track registry. UI copy rules apply: no em-dashes, no "X, not Y" constructions, ranges as "to".
const tracks = {
  sc6: {
    label: "The six-market §206 clock",
    venue: "FERC Dockets EL26-67-000 to EL26-72-000",
    what: "Six show cause orders on one 60-day clock. Each RTO/ISO must defend its tariff or file a fix.",
    whySeparate: "This is the main proceeding the site tracks. The other lanes run beside it, each on its own clock.",
    status: { asOf: "2026-07-28", line: "Reports are in (checking eLibrary per docket); abeyance requests due Aug 3; filings due Aug 17." },
    next: { date: "2026-08-03", label: "Abeyance requests due (all six dockets)" },
    src: ["e7"],  // representative source id(s), existing SOURCES records
  },
  e2:  { /* same shape */ },
  gov: {
    label: "PJM governance: AD26-7",
    venue: "FERC Docket AD26-7-000 (Commission-led technical conference)",
    what: "A July 23 conference on who runs PJM: board independence, the stakeholder process, and the states' role.",
    whySeparate: "Runs outside the §206 clock. Its September deadlines decide who controls PJM's follow-through filings.",
    aka: "Also referred to in shorthand as the Swett technical conference, after the chairman who convened it.",
    /* … */
  },
  rm264: { /* … */ },
  context: { label: "Market context", venue: null, noDocket: true, /* … */ },
};
```

Timeline events change shape minimally:

```js
{ date: "Jul 23, 2026", iso: "2026-07-23", kind: "ferc", track: "gov",
  title: "FERC holds the PJM governance technical conference",
  body: "…", src: ["utilitydivegov", "rtoinsidergov", "insidelinesgov"] }
```

- `track` is **required** on every event; enum-tested against the registry; ≥1 event per track
  (the seed-per-enum rule, so no track card ever points at an empty lane).
- `kind` is unchanged (doe/ferc/deadline/milestone) and stays the node-dot color; `track` is a new
  orthogonal dimension rendered as a pill.
- **Deadline-conversion rule:** when a dated `kind:"deadline"` event passes, the next refresh either
  (a) replaces it with a dated, sourced event describing what was observed, or (b) appends an
  explicit "window closed; nothing observed in our checks as of <date>" event. A passed deadline may
  not silently persist as a future-tense entry. Enforced by the staleness checker (Part 4), not the
  CI suite (a time-dependent CI test would fail with no code change; the checker runs in the refresh
  loop where a human acts on it).

### 2.3 SOURCES gain publication dates (absorbs the backlog item)

Every `SOURCES` record cited by a `tracks`/`timeline`/Discourse surface adds `published:
"YYYY-MM-DD"` (the outlet's own date; null allowed only with `undated: true` per the house rule
against fabricated dates). Discourse additionally partitions by wave (Part 3.D). Test: any source
cited from a wave-2 surface must have `published ≥ 2026-06-18` or an explicit `background: true`.

### 2.4 `llms.txt`

`build-llms.mjs` gains a "Parallel proceedings" section generated from the registry (one block per
track: label, venue, why-separate, next date, newest 3 events) so agent consumers get the same
disambiguation humans do. Sync test already exists; extend its fixture.

---

## Part 3 — Feature specs

### Feature A — Timeline tab: track-aware rail

**Keep one merged chronological rail** (chronology across lanes is the tab's value: the BRA capping
five days before the governance conference IS the story). Add:

1. **"The parallel tracks" intro grid** above the rail: one card per track (label, venue line,
   why-separate sentence, status line with its `asOf`, next-date chip, event count). The gov card
   carries the `aka` line, which resolves the owner's own "is the SW conference a different thing?"
   confusion for every future reader. Cards are buttons: clicking one applies that track's filter.
2. **Track filter chips** (All · per-track, with counts) in a row above the rail; single-select;
   `aria-pressed`; filtered state announced via the existing live-region pattern; chip row wraps at
   375px. Filtering hides non-matching `.tl-item`s (display, not DOM rebuild — the array is ~25
   events, no perf concern).
3. **Track pill on every event**, next to the existing kindpill: `<span class="trackpill sc6">§206</span>`
   (short labels: §206 / EL25-49 / AD26-7 / RM26-4 / context). Pill click = filter to that track.
   Distinguish visually from kindpill: kindpill stays color-coded text, trackpill gets a hairline
   border + muted fill so the rail doesn't turn into confetti. Every pill carries a `title` with the
   full track label.
4. **URL state:** `#timeline` stays the tab hash; a track filter appends in the same style the
   comments router already uses (`#timeline/track/gov`). Deep-linked filters must not hide the intro
   grid (the permalink-must-not-land-hidden lesson from PR #12 applies).
5. **New events** from Part 1 tables (verified ones only), interleaved chronologically.

**Rejected alternative — true swimlanes** (parallel columns per track): unreadable at 375px, wasteful
at 25 events across 5 lanes of very different densities, and it destroys cross-lane chronology,
which is the point of the tab. The filter-chip + pill design gives separation-on-demand instead.

Tab subtitle updates to name the parallel structure (current copy is single-arc). Draft, following
the UI copy rules: "One chronology, five lanes: the §206 clock, the EL25-49 co-location docket, the
AD26-7 governance fight, the RM26-4 record, and the market context around them."

### Feature B — Procedural board v2: the per-RTO filing matrix

The board currently tracks the *schedule*; this adds the *observations*. New `data.js` block:

```js
procedural.filings = {
  asOf: "2026-07-28",   // stamped per refresh run
  note: "Observed filings only. A blank cell means our checks found nothing, and that is not proof nothing was filed.",
  rows: [
    { docket: "EL26-67", rto: "PJM",    step: "report", status: "filed-reported",
      date: "2026-07-20", gist: "Expedited new-generation initiatives; near-term resource adequacy.",
      src: ["…"], accession: null, verified_at: null },
    { docket: "EL26-72", rto: "ISO-NE", step: "report", status: "filed-verified",
      date: "2026-07-20", gist: "New large loads bring incremental generation; no capacity-market procurement for them.",
      src: ["isonews0721"], accession: "<from eLibrary>", verified_at: "<date>" },
    { docket: "EL26-72", rto: "ISO-NE", step: "abeyance", status: "signaled",
      date: "2026-06-29", gist: "Plans a 90-day abeyance request; targets a Nov 16 §205 filing.", src: ["isonews0629"] },
    /* … */
  ],
};
```

- **Status vocabulary** (closed enum, tested): `filed-verified` (accession seen on eLibrary) ·
  `filed-reported` (credible press/RTO channel only) · `signaled` (entity announced intent) ·
  `none-observed` (deadline passed, checks found nothing) · `upcoming` (deadline not yet reached) ·
  `na` (step doesn't apply). `filed-verified` **requires** `accession` + `verified_at`;
  `filed-reported` requires `src`; enforced by test. This is the "a 200 is not proof" rule as a
  schema: press-reported and eLibrary-verified render at different visual weights.
- **Render:** a 6-row (RTO) × step matrix under the existing clock, cells showing a status chip;
  cell click opens a popover/details with date, gist, source chips, accession link. Mobile: the
  matrix becomes per-RTO stacked rows (docket heading + step chips), same data. Legend states the
  `none-observed` semantics verbatim from `note`.
- **Board foot + masthead chip update:** the foot's "status reflects today's date, not confirmed
  eLibrary filings" sentence is now only true for the *clock half*; rewrite to describe both halves
  and their different evidence bases. The masthead chip gains a second clause when observations
  exist for the most recent passed step, e.g. "Next: Aug 17 · show-cause filings — reports: 2 of 6
  confirmed." Counts derive from the matrix, never hand-written.
- **The Aug 17 collision callout:** one strip line on the board (and mirrored on the e2 track card):
  the sc6 60-day filings and the E-2 further compliance filing land the same day. Two clocks, one
  date, different dockets — exactly the confusion the tracks model exists to prevent.

### Feature C — Where the governance track lives (and doesn't)

- **No new top-level tab.** Six tabs is already the ceiling; governance is a lane, not a section.
- Lives in: the Timeline (events + track card), the Overview "where things stand" strip (Feature E),
  and Discourse wave 2 (Feature D: the conference IS the discourse event of July).
- **Not** in the Dockets tab accordions (those are the six §206 orders + E-2, all with committed
  PDFs and page-cited quotes; AD26-7 has no committed primary document yet). One cross-link line in
  the Dockets intro pointing at the gov track card is enough. If FERC's post-conference notice
  (with its question set) becomes a committed, quotable primary source later, revisit — that would
  be the moment governance earns a Dockets-grade card, not before.
- Quote handling: the Swett/LaCerte/Mills quotes ship only after re-fetching the three articles and
  capturing evidence per the existing `voices-evidence.json` pattern (a `gov-evidence` section or a
  parallel file keyed the same way), so `verify-quotes.mjs` covers them like every other quote.

### Feature D — Discourse wave 2

The tab currently presents one frozen reaction wave. Restructure into **two dated waves** without
losing wave 1:

1. **Wave lanes.** "Reaction to the June 18 orders (captured Jun 22 to 29)" and "The filings and the
   governance fight (captured <refresh date>)". Each `voiceThemes`/`media` item gets `wave: 1|2`;
   wave 2 renders first (freshest on top); the existing capture-date sentence generalizes to
   per-wave capture stamps. This, plus `published` on sources (2.3), absorbs the backlog's
   "published-date discipline" and "freshness filter" items — the lane split IS the freshness
   filter, with source dates visible on chips.
2. **Per-track tags on wave-2 items** (`track: "gov" | "sc6" | …`), rendered as the same trackpill
   as Feature A. The gov lane keeps governance discourse from contaminating the §206 story — the
   exact separation the owner asked for, applied to commentary.
3. **New wave-2 content** (each item verified per Part 0's rule before shipping):
   - Themes (from the agent's six, post-verification): PJM's "legitimacy crisis" as the new dominant
     frame (Swett/LaCerte quotes); cost-shift becomes a live legal fight (the Jul 17 advocates
     filing's "arbitrary and capricious" line); capacity-auction stress pinned on data centers +
     the September backstop-auction response; speed-to-power reliability skepticism incl. off-grid
     doubts (Axios, if fetchable); governance-reform camps (board independence vs advisory-only
     stakeholders vs expanded state role); regional divergence as the tailoring thesis playing out.
   - Voices: Mills (augmented-OPSI proposal), the joint state advocates, Sierra Club (BRA), plus
     updates to existing voices where they spoke again. Swett/LaCerte quotes render in the gov
     context, NOT as new "voices" cards (they're the regulator, not commentary — same reason the
     reception list filters out the FERC group today).
4. **Roster trim (absorbs the backlog item):** wave 1's voice list stays but collapses to the
   strongest ~20 with the existing show-more accordion pattern; no deletions (append-only data,
   display-level cap, per the cap-by-content rule).

### Feature E — Overview refresh

1. **"Where things stand" strip** directly under the headline stats: one line per track (label +
   status line + next-date chip), generated from the registry — five lines, no new prose to
   maintain. Carries the strip-level `asOf`.
2. The Overview background prose gains one sentence acknowledging the post-June world (reports in,
   governance clock running) so the page no longer reads as frozen on June 18.
3. `meta` gains `newsCapture: "2026-07-28"` (dated per refresh) alongside the existing
   `capture`/`discourseCapture`; the footer "as of" line shows it.
4. KPI row: the "30 days / 60 days" cards get past/upcoming state styling from the same
   status computation the board uses (they currently read as forever-pending).

### Feature F — Provenance plumbing

- New evidence file(s) under `sources/` for wave-2 article captures (mirroring
  `voices-evidence.json`: `captured_at`, snippet per quote), so every new displayed quote is
  covered by the existing verbatim sweep.
- Filing-matrix rows that are `filed-verified` carry eLibrary accession numbers; the matrix is the
  one surface allowed to link eLibrary directly (the comments tab already does).
- No machine-local paths, no fabricated dates (`undated: true` where an outlet shows none), archive
  URLs where Cloudflare permits (federalregister.gov pages archive cleanly; ferc.gov generally
  doesn't — note `archived_via` where used).

---

## Part 4 — The refresh workflow (REFRESH.md bootstrap)

This plan's cadence is driven by real dates: **Aug 3** (abeyance), **Aug 17** (the double filing
day), **mid-Sept** (governance forum + backstop auction), **end of Sept** (governance
adopt-or-imposed). The project has no `REFRESH.md`; Phase 2 writes it so the `data-refresh` skill
can run this repeatably. Contents:

1. **Sweep** (agent or inline): web search per track since last `newsCapture`; output the Part 1
   table format with fetched/snippet flags.
2. **Verify** (browser-assisted, per the Cloudflare playbook in memory/issues.md): eLibrary per
   docket for filings (docket search → accession + date + document type), FR pages for notices,
   article re-fetch + evidence capture for quotes. This is the step that flips `filed-reported` →
   `filed-verified` and stamps `verified_at`.
3. **Update**: `tracks` status lines + `next`, timeline events (deadline-conversion rule),
   `procedural.filings`, Discourse wave items, `meta.newsCapture`; regenerate `llms.txt`.
4. **Check**: `node tools/check-staleness.mjs` (new, ~40 lines): flags past-dated `kind:"deadline"`
   events not yet converted, track `next.date`s in the past, and `asOf` stamps older than N days.
   Advisory output for the refresh operator; not part of `node --test` (see 2.2 rationale).
5. **Test + quote sweep**: full suite + `verify-quotes.mjs`.
6. **Log**: agent-runs.md row (if a sweep agent ran), issues.md for anything found broken.

---

## Part 5 — Tests (the contract)

Extend the existing suites; all deterministic, no network:

1. **Track integrity** (`data.test.mjs`): every timeline event has `track` ∈ registry keys; every
   registry track has ≥1 event (seed-per-enum); every track with `next.date` has a parseable ISO
   date; `context` events carry no docket reference and no filing-matrix rows.
2. **Filing matrix** (`data.test.mjs`): `status` ∈ closed vocab; `filed-verified` ⇒ `accession` +
   `verified_at` present; `filed-reported`/`signaled` ⇒ non-empty `src` resolving to SOURCES;
   `docket` ∈ the six; `step` ∈ `procedural.steps` ids; no duplicate (docket, step) pairs;
   `filings.asOf` present and ISO-valid.
3. **Abeyance regression** (Phase 0): the abeyance step's label/desc must not scope to a single RTO
   (string test: "NYISO only" absent), and — the real check — for each of the six order texts,
   `abeyance` appears (guards against the correction being reverted or a future re-narrowing);
   the step's per-order cites each resolve to a page within that order's page count.
4. **Source dates** (`source-accuracy.test.mjs`): every source cited by a wave-2 Discourse item or a
   track/filing surface has `published` (or `undated: true`); wave-2 citations dated ≥ 2026-06-18
   unless `background: true`; `published` never later than `captured`.
5. **Quote coverage**: new gov/wave-2 quotes appear verbatim in their captured evidence
   (`verify-quotes.mjs` extended to the new evidence file); the Swett "grave legitimacy crisis",
   LaCerte "cultural quagmire", and advocates "arbitrary and capricious" strings each covered.
6. **Count floors**: timeline event count never drops below the pre-refresh floor (append-only);
   Discourse wave-1 item count unchanged after wave-2 lands (trim is display-level only).
7. **llms.txt sync**: regenerated output includes one block per track (fixture updated).
8. **UI copy lint**: the existing style linter covers the new registry strings (no em-dashes, no
   "X, not Y" constructions — the fields are data.js strings, so the sweep just adds the new paths).

---

## Part 6 — Phases & sizing

| Phase | Scope | Size | Notes |
|---|---|---|---|
| **0** | Abeyance-scope hotfix: step relabel + per-order cites, two timeline entries, llms.txt regen, regression test, issues.md → Fixed | **S** (½ session) | Ships alone, first — it corrects the masthead chip currently displaying the error. No news dependencies. |
| **1** | Tracks registry + `track` on events + Timeline Feature A + Overview strip (E1–E3) + `published` field infra + the already-fetched sc6/e2/gov events that survive re-verification | **M** (1 session) | The user-visible "separate timelines" payoff. Browser needed only for article re-fetch + evidence capture. |
| **2** | Filing matrix (Feature B) + eLibrary verification sweep (queue 1.6 items 1–6) + REFRESH.md + check-staleness.mjs | **M** (1 session, browser-assisted) | eLibrary is Cloudflare-gated: plan for the manual-browser path; matrix ships honestly even if some cells stay `none-observed`. |
| **3** | Discourse wave 2 (Feature D) + gov quote evidence captures + roster trim | **M/L** (1 to 1.5 sessions) | Highest verification load (every quote through the evidence pipeline). |
| **4** | Polish: timeline URL state, KPI state styling (E4), Dockets cross-link line, og/social copy touch-ups | **S** (½ session) | |
| — | **Post-Aug-17 refresh** (run Part 4 end-to-end on the six filings + E-2 compliance filing) | M | Scheduled work, not a feature; the plan's real test. |

Sequencing: 0 → 1 → 2 → 3 → 4. Phases 1 and 2 could swap if an eLibrary session is available first;
nothing in 1 depends on 2's data (the matrix simply starts fuller).

## Part 7 — What NOT to build (decided against)

- **No live/auto-refresh, RSS, or client-side fetching of news.** The site stays static, baked, and
  capture-stamped; freshness comes from the Part 4 loop, not runtime code.
- **No automated eLibrary scraping in CI or cron.** Cloudflare posture makes it flaky-by-design;
  verification stays a deliberate browser-assisted step (the existing grind-downloads path exists
  for bulk needs).
- **No new top-level tabs** for governance, the conference, or "news." Tracks are a dimension on
  existing surfaces.
- **No swimlane/multi-column timeline** (rejected in Feature A).
- **No speculative future events** beyond deadlines stated in an order or a published notice — no
  "expected September auction" event until PJM publishes terms (it lives as a `context` status line
  citing coverage until then).
- **No separate "SW conference" track** absent evidence it is a distinct event (Part 0); revisit
  only on owner correction.
- **No merging of the governance clock into `procedural`.** The §206 board stays six-docket-pure;
  gov deadlines live on the gov track card and timeline. One board per clock.
- **No paywalled-source dependence:** if a claim's only source is unfetchable (Axios 403 persists,
  Law360 etc.), it ships as a labeled headline pointer or not at all — never as a paraphrased fact.
