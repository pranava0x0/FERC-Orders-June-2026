# Policy-analysis spec: from stances to policy options (2026-07-14)

An evaluation of the comment-summary analysis as it stands after the P0 flow overhaul (PR #12), and
a build-ready spec for the layer it is missing: **policy intelligence for SMEs and regulatory
experts** — what concrete policies the record puts on the table, who backs each, what the June 18
orders actually did with them, and where each can still be implemented (the Aug 17 compliance
filings, the Section IV briefs, the E-2 paper hearing, the still-open RM26-4 rulemaking).

Relationship to [ux-improvement-plan.md](ux-improvement-plan.md): **complements, does not
supersede.** That plan fixed the *flow* (issue-first reading, workbench filters, permalinks,
procedural clock — P0 #1–5, shipped). This spec addresses the *analysis ceiling* the flow work
exposed, and it upgrades two of that plan's open items rather than duplicating them: P1 #10a
(response-scaffold export) and P2 #11 (per-issue LLM briefs) are redefined here in policy-option
terms. P1 #10 (OCR + Haiku re-author) becomes a gating prerequisite.

Everything below is grounded in a measured pass over the committed data (2026-07-14): all 268
`sources/comments/summaries-v2/*.json`, the 34 generated issue files under
`docs/data/comments/issues/`, the reader/outline code in `docs/js/app.js`, and the order extracts
in `sources/orders-extract.json` + `docs/js/data.js` (`briefing`, `procedural`).

---

## Part 1 — Evaluation: what the summary analysis is today

### 1.1 What is genuinely strong (keep, and build on)

1. **The audit architecture is the best thing in the project.** Quote-centric, bottom-up
   (PNNL CommentNEPA), every value traceable: 268 of 273 letters audited, **3,517 verbatim quotes**
   (avg 13.1/letter), **2,748 bins** (avg 10.3/letter), each bin resting on named quote ids, each
   quote verbatim-tested against its committed source text, 92% of quotes page-stamped by tool
   (never guessed). No government or commercial benchmark surveyed in ux-plan §1.8 (CARA, UK
   Consult, SmartComment) publishes this level of per-claim traceability.
2. **The controlled vocabulary held.** The three lenses (8 ANOPR questions, 5 reform principles,
   6 regions) bin cleanly; letter counts per issue are large enough to be meaningful
   (pr:cost 231 letters, pr:study 229, aq:jurisdiction 161).
3. **The shipped views answer "who / where / how many."** Stance map → heatmap → By-issue reader
   → All-comments workbench is a coherent descending path; aggregates click through; URLs are
   shareable. The five jobs-to-be-done in ux-plan §1.0 are served.
4. **Honesty rails are real**: provisional labels, denominators, coverage badges, derived-date
   labels, stance = the filer's not the curator's.

### 1.2 Where the analysis stops short for an SME (the gap this spec fills)

The current analytical unit is *topic × stance*. For a regulatory expert, that ceiling shows up
in five measured ways:

1. **Stance has almost no discriminating power on this record.** Bin stances run 1,892 support /
   423 oppose / 184 mixed / 249 neutral — **69% support**. On pr:cost, 187 of 231 letters
   "support." But what they support differs materially: incremental cost responsibility,
   protective charges, minimum-take commitments, postage-stamp socialization with credits,
   contract-term floors are *different policies* that all bin as "support · pr:cost." The
   analysis stops exactly where an expert's thinking starts — the variance inside the consensus
   is the record's actual content.
2. **~1,200 concrete policy asks are already extracted but invisible.** 34% of quote `concern`
   lines carry an ask verb (should / must / urge / propose / recommend / request). Example
   already in the corpus: Terraflux proposes "near-located means within three busbar substations"
   and customer-defined netting amounts — concrete, novel design proposals that render today as
   two more "support" rows. The original plan (summaries-plan.md step 5) listed **requested
   relief** as a field; the v2 schema dropped it, and nothing downstream recovers it.
3. **The emergent-topic long tail is fragmented into noise.** 673 distinct `topic:` slugs exist;
   the By-issue outline ships the top 15 by recurrence; the #1 topic (cooperative-federalism)
   appears in only 15 letters. Near-duplicate slugs (`topic:cost-allocation` vs
   `topic:ratepayer-protection` vs `topic:transparency` vs `topic:tariff-transparency`) split
   what an expert would read as one policy conversation. 658 topics are invisible — and the long
   tail is precisely where novel policy ideas live (option-to-build, NERC registration thresholds,
   load-forecasting accountability).
4. **The record is never connected to the decision space.** The site already holds all four
   pieces an expert must join: (a) what DOE proposed (the ANOPR's principles → `aq:` lens),
   (b) what commenters said (bins), (c) what FERC did on June 18 (per-order directives with page
   cites in `orders-extract.json` / data.js, the five `pr:` principles, the E-2 services), and
   (d) what is procedurally open (five Section IV briefing questions in `data.js#briefing`, the
   §206 clock with the Aug 17 show-cause deadline). They live in four different tabs with no
   crosswalk. "Which record positions did the orders adopt, which did they pose as questions,
   which did they ignore — and what is still contestable in the compliance round?" requires
   reading all four surfaces and doing the mapping by hand. **This is the single highest-value
   unbuilt view for the named audience**, and (unlike most syntheses) most of it is authorable
   from committed, cite-checked data with zero new LLM inference.
5. **The By-issue reader is a reading aid, not an analysis.** Selecting pr:cost renders 231
   letter cards in four stance groups — better than 58 screens of All-comments, but still a wall:
   no distinct-argument consolidation, no proposal grouping, conditions ("support **only if**…")
   buried inside `mixed`/`support` descriptions. The reader's landing state is a hint sentence,
   spending the best screen in the tab on nothing.

### 1.3 Data-quality debts that gate any new synthesis

| Debt | Measured | Why it gates |
|---|---|---|
| Haiku-tier summaries | 62 of 268 (23%) on `claude-haiku-4-5` | Option extraction consumes bin descs + concerns; the weakest tier becomes load-bearing input |
| Nothing human-verified | `verified: false` on all 268 | A synthesized options layer inherits and amplifies unaudited inputs; the "human-reviewed" claim (ux-plan P2 #15) rises in priority |
| Un-stamped quote pages | 284 quotes (8%) `page: null` (mostly DOCX-extracted bodies with no page markers) | Option cards cite quotes; a null page weakens the cite (still linkable to the eLibrary filing, so acceptable — but note the cause in the UI foot) |
| Missing letters | 4 image-only scans + 1 eLibrary-inline (268/273) | Data Center Coalition is one of the four — a heatmap-relevant camp absent from options backers |
| One unlabeled provenance | 1 summary with `model: "claude"` | Trivial; normalize when touched |

---

## Part 2 — The concept: a policy layer over the existing quotes

Three new first-class objects, each auditable in the same quote-centric way:

1. **Policy option** — a distinct, concrete course of action proposed in the record on an issue
   ("tier study deposits by MW so entry cost scales", "define near-located as ≤3 busbars",
   "credit network-upgrade payments against future transmission rates"). Extracted by clustering
   the *existing* quotes/concerns per issue — no letter is re-read. Each option carries: plain
   name + description, kind (`proposal | condition | objection`), implementation **vehicle**
   (`compliance-filing | rm26-4-rule | e2-paper-hearing | state | nerc`), backers (org + bucket +
   quote ids), and skeptics where quotes oppose it.
2. **Crosswalk row ("from record to rule")** — per canonical issue: what DOE's ANOPR proposed,
   the record's stance split (exists), the top options (from #1), **what the June 18 orders did**
   (status + verbatim order quote + page cite), and **where it goes next** (which procedural
   step / Section IV question / E-2 hearing it lands in). Hand-authored curator judgment, one
   row per issue, every claim cite-backed. Status enum:
   `directed` (orders direct tariff reform on it) · `briefed` (posed as a Section IV question —
   asked, not decided) · `resolved` (fixed in E-2) · `silent` (orders do not address; lives in
   RM26-4, still open).
3. **Open-question status** — the forward link: each crosswalk row names the concrete vehicle and
   date ("show-cause/tariff filing, Aug 17, 2026" from `data.js#procedural`), so "what could be
   implemented as a result" is a dated, procedural answer, never a prediction.

External grounding: this is exactly the shape the canonical government deliverable takes. In the
comment-response-matrix tradition (EPA/DOE-NEPA/FTA; CARA's concern→response model, ux-plan
§1.8.1–2), the consolidated *concern statement* is our policy option, and the *agency response*
column is our crosswalk's "what the orders did" — with the advantage that FERC's response already
exists in the committed, page-cited order text.

**Audience jobs this unlocks** (extending ux-plan §1.0's five):

6. *"What are the distinct design choices on issue X, and who backs each?"* — an RTO drafter
   choosing what to put in the Aug 17 filing; a stakeholder deciding what to endorse in the
   30-day response window.
7. *"What did FERC already signal, and what is genuinely open?"* — an analyst separating decided
   ground (E-2 services), directed-but-undesigned ground (the five principles), asked-questions
   ground (Section IV), and untouched ground (e.g. issues the orders are silent on).
8. *"Which minority proposals survived into the orders, and which majority asks were ignored?"* —
   the expert's calibration question; answerable only by the crosswalk.

## Part 3 — Data design

### 3.1 Policy-option extraction (pipeline)

**Input** (all committed): per canonical issue, every quote binned to it across the 268 summaries
— `{acc, org, bucket, stance, concern, quote, page}`. Measured sizes: pr:cost 959 quotes / 231
letters (largest), pr:study 860/229, aq:jurisdiction 618/161, … 5,244 canonical-binned quote
instances total. The largest issue fits one context comfortably (~115K tokens with prompt);
**one clustering call per issue**, 19 canonical calls + ~10–15 normalized-topic calls.

**Method** (per issue, one subagent call, self-critique folded in per the audit-cost-sink rule):

1. Cluster the quotes into distinct options; write `name` (3–6 words), `desc` (1–3 plain
   sentences), `kind`, `vehicle`.
2. Assign every backing quote id to exactly the options it supports; a quote may back multiple
   options; an option must rest on ≥1 verbatim quote per backer org.
3. Separate `condition` options (support-only-if narrowing language — the drafting material,
   per ux-plan §2.2.3) from `proposal` (affirmative design) and `objection` (argued harms).
4. Mark `singular: true` where only one org backs it (kept, labeled — the long tail is signal;
   Terraflux's busbar definition must not be dropped for being alone).
5. Leftover quotes that fit no option go to an explicit `unclustered` list with count — an empty
   or huge remainder is an audit flag, never silently absorbed.

**Output** — committed, one file per issue: `sources/comments/policy-options/<ns>-<slug>.json`

```json
{
  "issue": "pr:cost",
  "generated_at": "YYYY-MM-DD",
  "provenance": { "model": "...", "method": "per-issue-clustering", "verified": false },
  "options": [
    { "slug": "protective-minimum-take", "kind": "proposal",
      "name": "Minimum-take / protective charges", 
      "desc": "Large loads commit to a minimum level of cost recovery ... so upgrade costs cannot strand on other customers.",
      "vehicle": "compliance-filing",
      "singular": false,
      "backers": [{ "acc": "20251121-5523", "org": "Advanced Energy United", "bucket": "clean_energy", "quote_ids": [4, 7] }],
      "skeptics": [{ "acc": "...", "org": "...", "bucket": "...", "quote_ids": [2] }] },
    ...
  ],
  "unclustered": { "count": 12, "quote_refs": [{ "acc": "...", "id": 3 }] }
}
```

`quote_ids` refer into the letter's `summaries-v2/<acc>.json` — the option layer stores **no quote
text of its own**, so verbatimness stays enforced at the single source of truth and the layers
cannot drift.

**Deterministic validators** (extend `tools/validate-summaries.mjs` or a sibling
`validate-options.mjs`) — every check that can be code, is code, before any LLM audit:

- every `quote_ids` entry resolves in that letter's summary, and that quote is binned to this issue;
- every backer/skeptic `acc` appears in the issue's letter set (`docs/data/comments/issues/`);
- `union(option quote refs) + unclustered == all quotes binned to the issue` (nothing dropped);
- vocabulary: `kind`/`vehicle` enums closed; slugs unique per issue;
- style/boilerplate linter over `name`/`desc` (the existing AI-register linter — reuse it);
- count floors per issue once shipped (append-only protection).

**Selective LLM audit** only on deterministically flagged issues (unclustered > 15%, an option
with backers whose stances on the parent issue are all `oppose` while `kind: "proposal"`,
zero conditions found on an issue whose `mixed` count > 20 — divergence smells), per the measured
~43%-savings gating rule. Budget: ~630K input + prompts ≈ **~$3–5 on Sonnet, run in per-issue
chunks, resumable** (each issue file lands independently; the run stops cleanly at any budget
line — respect the session-budget rule, report spend per chunk).

### 3.2 Topic normalization (prerequisite for topic-level options)

One committed mapping file, `sources/comments/topic-canon.json`:
`{ canonical: [{ slug, name, desc, members: ["topic:cost-allocation", "topic:ratepayer-protection", ...] }] }`.
Build it in two passes: deterministic first (slug token overlap / stemming clusters the obvious
near-duplicates among 673 slugs), then one LLM pass over the residue proposing merges a human
reviews once (it is a ~30-minute read of slug lists, not letters). `build-comments-page-data.mjs`
then aggregates topic bins through the canon: the outline's "Emergent topics" group swaps its
raw top-15 for the canonical set (target ~20–30 with real counts), long tail still logged. Keep
raw slugs in the summaries **unchanged** (`*_raw` rule: cleaning is lossy; the canon maps, never
rewrites). A test asserts every member slug exists in some summary and no member is claimed by
two canonicals.

### 3.3 The record-to-rule crosswalk (hand-authored, cite-backed)

A `policyMap` const in `docs/js/data.js`, following the `briefing` pattern (curator-authored,
verbatim-verified fields):

```js
policyMap: [
  { issue: "aq:protection",                 // one row per canonical policy issue (13 aq+pr; selected topics later)
    anopr: "100% network-upgrade cost responsibility with an open question on crediting",  // what DOE proposed (from the ANOPR text already excerpted in data.js)
    status: "briefed",                       // directed | briefed | resolved | silent
    did: { q: "without the inclusion of cost shifting protections", order: "E-7", pg: 69 }, // verbatim order quote + page, verified by the quote sweep
    next: { vehicle: "compliance-filing", step: "showcause", briefingId: "costshift" },     // joins procedural.steps + briefing.questions by id
    note: "The orders adopt the cost-causation frame and pose the protection design as a Section IV question each RTO must brief." },
  ...
]
```

Authoring rules: `status`, `did`, `note` are the curator's judgment lane — labeled as such in the
UI, every `did.q` verified verbatim against `sources/text/orders/*.txt` by the existing
quote-coverage machinery, `next.step` must exist in `procedural.steps`, `next.briefingId` in
`briefing.questions`. Rows only for issues the curator has actually read the order text on; an
un-authored issue renders "not yet mapped," never a guessed status (absence of judgment is
meaningful). The `rg:` lens gets no rows (regions are venues, not policies).

This is roughly 13 rows × 15 minutes of curator work against already-extracted order text — the
cheapest high-value artifact in this spec, and the only piece with **zero** LLM inference.

### 3.4 Build outputs

`tools/build-comments-page-data.mjs` (extended) merges options into the existing per-issue files
— `docs/data/comments/issues/<ns>-<slug>.json` gains an `options` array (quote text resolved at
build so the reader keeps one fetch per issue; sizes stay ~modest, pr:cost grows ~40–60 KB).
The outline index gains per-issue `optionCount`. The crosswalk ships in `data.js` (it is small
and load-bearing for two tabs). `docs/llms.txt` gains the options + crosswalk (regenerate via
`build-llms.mjs`) — for the named audience, agent consumers are real users.

## Part 4 — UX design

### 4.1 By-issue reader upgrade (the core surface)

Top-to-bottom order when an issue is selected — the expert's read order:

1. **Header** (exists): name, desc, letter count, stance split bar.
2. **"From record to rule" strip** *(new, from policyMap)*: one compact ruled row — ANOPR ask →
   status chip (`Directed / Posed as a question / Resolved in E-2 / Not addressed`) → the verbatim
   order line with PDF + gov page links (reuse the directive-cite idiom) → "Next: <vehicle> ·
   <date>" chip joined live to the procedural clock (so it flips to Passed automatically).
   Curator-judgment label on the strip foot.
3. **"What's on the table" option cards** *(new, from §3.1)*: one card per option — name, kind
   badge (proposal / condition / objection), one-line desc, backer mini-bar by bucket (the
   heatmap's camp colors), `N orgs` count with `singular` flagged as "one filer proposes",
   expandable backer list (org → their verbatim quote(s) with page cites → permalink to their
   All-comments row). Sort: backer count desc, conditions grouped after proposals, objections
   last. A "show unclustered (N)" foot keeps the remainder honest.
4. **Stance-grouped letters** (exists, demoted below the options): the full per-letter record,
   unchanged.

The reader's **landing state** (no issue selected) stops being a hint sentence and becomes the
**policy map**: a ruled grid, one row per crosswalk issue — issue name · letters count · micro
stance bar (all exist in the outline index) · status chip · next-vehicle chip. One screen answers
"across the whole record, what is decided, directed, asked, and ignored" — the strategic read an
SME currently assembles by hand. Rows link into the reader. (No fifth sub-tab: the outline is
already the issue list; the landing pane is the natural home and costs no navigation.)

### 4.2 Cross-links that make the existing tabs policy-aware (cheap, high leverage)

- **Dockets tab, Section IV questions** → "what the record says →" deep link into By-issue with
  the mapped issue selected (ux-plan P1 #8, now with a concrete join key: `policyMap.next.briefingId`).
- **Reforms tab principle cards** → same link (`pr:` keys are the join).
- **Procedural status board** rows gain "issues landing at this step (N)" chips out of policyMap
  — the clock becomes a policy calendar, not just a date list.
- **Overview stance map** rows gain the status chip inline (one glyph + label), so "187 support"
  reads next to "posed as a question, briefs due with the Aug 17 filing."

### 4.3 Exports (upgrades ux-plan P1 #10a, absorbs it)

The response-scaffold export emits the **policy-option matrix** per issue (or all issues):
markdown + CSV — issue · option · kind · backers (orgs, buckets, N) · representative verbatim
quote · accession + page cite · order status from policyMap · empty Response column. This is the
comment-response matrix a responder actually files, pre-filled with everything the record and the
orders already settle. Same formula-injection guard + test as the planned CSV work.

### 4.4 URL, a11y, design system

- Grammar (extends `comments-route.js`): `#comments/issue?id=pr:cost&opt=protective-minimum-take`
  (selected option card scrolled + expanded); `#comments/issue` with no id = the policy-map
  landing (already the default). Round-trip test extends the existing one.
- Status chips are text + color, never color alone; option cards keep ≥44px coarse-pointer
  targets on the expand affordance; the policy-map grid scrolls in-container on mobile like the
  heatmap; `aria-label` carries the full status sentence on every chip (lossy-glyph rule).
- Design tokens: reuse stance colors and the bracketed-tag idiom (a status chip is a tag, not a
  pill — this lands well with the Part-5 design refresh direction, but does not depend on it).
- Copy rules apply to every new displayed string: no em-dashes, no "X, not Y", ranges as "to",
  denominators stated, provisional labels on all AI-derived content, curator-judgment label on
  crosswalk fields (no-ai-isms memory; DESIGN.md §11.1).

### 4.5 Honesty rails specific to this layer

- **Three lanes, visibly distinct**: verbatim record (quotes, order text — cited), AI-derived
  aggregation (bins, options — "AI-audited, provisional" label, `verified: false` until the
  human pass), curator judgment (crosswalk status/note — "curator's read, cite-checked" label).
  Never let a status chip render without its lane label reachable.
- **No forecasting.** The layer says what is procedurally open and who asked for what — never
  "FERC is likely to." The vehicle+date chip is the only forward-looking element, and it is a
  quoted deadline.
- **Backer counts are engagement, not weight** — repeat the triage-heuristic caveat on option
  cards (a 40-org option is not "winning"; FERC weighs arguments, not votes — and the crosswalk
  itself will show minority asks that prevailed).
- Options and crosswalk ship `generated_at` / authored dates; the compliance-round views must
  survive the record going stale (the site's capture date is explicit everywhere already).

## Part 5 — Tests (the contract)

1. `tests/policy-options.test.mjs`: every option quote ref resolves + is binned to its issue;
   union(refs)+unclustered == issue quote set; enums closed; slugs unique; backers ⊆ issue
   letters; style-linter clean; count floors once shipped; generated issue files trace
   option-for-option back to `sources/comments/policy-options/` (stale rebuild fails loud).
2. `tests/policy-map.test.mjs`: every `did.q` verbatim in `sources/text/orders/*.txt` (reuse the
   quote-sweep helper); every `next.step` in `procedural.steps`; every `briefingId` in
   `briefing.questions`; status enum closed; every `pg` cite lands on a page carrying its quote
   (the existing directive-cite test pattern).
3. Topic canon: member slugs exist, no slug claimed twice, canonical counts ≥ members' max.
4. Route round-trip extended for `opt=`; node-budget check on the policy-map landing grid
   (13 rows — trivial, but the floor guards growth).
5. Seed rule: ≥1 example per `kind` and per `status` in shipped data, so no legend slot renders
   empty (enum-seed rule).

## Part 6 — Phases, sizing, sequencing

| Phase | What | Effort | Gates / depends |
|---|---|---|---|
| A | Data debts: OCR 4 scans + ETI re-fetch, 62 Haiku→Sonnet re-authors, topic canon (§3.2), normalize the 1 `model:"claude"` | M (pipeline) | = ux-plan P1 #10, promoted: **gates B** |
| B | Option extraction over 19 canonical issues + validators + committed files (§3.1) | L (LLM ~$3–5, per-issue chunks, resumable) | A |
| C | Crosswalk `policyMap` authored + tests (§3.3) | M (curator, no LLM) | — (parallel to B) |
| D | UI: reader strip + option cards + policy-map landing + cross-links + URL (§4.1–4.2, 4.4) | L | B, C |
| E | Option-matrix export (§4.3) | S | B, C (absorbs ux-plan P1 #10a) |
| F | Topic-level options for the canonical top topics | M | A, B learnings |
| G | `verified_at` stratified human pass now covering options (ux-plan P2 #15, scope grown) | M (human) | B |

Ship order: **C first** (cheapest, zero-inference, immediately useful as the policy-map landing
with status chips even before options exist), then A → B → D, then E/F/G. Each phase is its own
PR with the repo's committed-chunk discipline; B runs under the `/summarize-comments`-style
budget pattern (explicit pause points, spend reported per chunk).

Supersessions to record in backlog when work starts: ux-plan **P2 #11 (per-issue LLM briefs) is
replaced** by options (same budget, strictly more structure — a prose brief can still be
synthesized *from* options later if wanted); **P1 #10a is absorbed** into phase E.

## Part 7 — What NOT to build (decided against)

- **Outcome prediction / likelihood scoring** of options — manufactured certainty; the site shows
  the record and the mechanism, never a black-box verdict.
- **Option "winner" ranking or recommendation** — same rule; sort by backer count with the triage
  caveat, nothing more.
- **Cross-issue option dedup into one global proposal registry** — options are issue-scoped by
  design; a global registry invites false merges across contexts. Revisit only if phase F shows
  heavy cross-issue duplication.
- **Re-reading the 268 letters for extraction** — the quotes are the audited substrate; if the
  quotes prove too thin for an issue (unclustered too high), that is a summaries-v2 gap to fix at
  the source, not a reason to bypass the audit graph.
- **A "model FERC's next order" narrative page** — the crosswalk + clock already say what is
  open; anything more is speculation the posture forbids.
