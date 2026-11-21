# Navigation: the questions this site answers, and how far each answer is

The site is organized around the questions a reader brings to it. Each question has one leaf, the element
that answers it. `tools/nav-questions.json` holds the questions and today's shortest route to each answer.
`tools/nav-budget.mjs` walks every route from a fresh home page at phone (375 × 812), tablet (768 × 1024)
and desktop (1280 × 800) size. It counts taps or clicks, typed entries, screens scrolled and sideways
adjustments. That sum is the question's **cost**.

`tools/nav-baseline.json` records the accepted costs. CI (`.github/workflows/ci.yml`) runs
`node tools/nav-budget.mjs URL OUT --check` on every pull request. The run fails if any question costs 0.3 or
more above its baseline, or can no longer be answered. It also fails if any question costs more than **6** at any screen size (`MAX_COST`): no answer should take more than six taps, typed entries and screens combined. The table is in the run summary. A PR that lowers
costs re-records the baseline with `--update` and commits it, so the bar only moves down.

```bash
python3 -m http.server 8131 --bind 127.0.0.1 --directory docs &
node tools/nav-budget.mjs http://127.0.0.1:8131/ /tmp/nav --check
```

## Who asks what

| Reader | Typical questions |
|---|---|
| RTO, utility or developer counsel | What did my market's operator file? When are comments due? Who opposes it? |
| State regulator or consumer advocate | Who pays for upgrades in each market? What did the June order require? |
| Analyst or reporter | Where does each operator stand? What happens next? What did a commissioner say? |
| Anyone checking a claim | Show me the original page behind this quote. |

## Hierarchy

Five levels, each one tap from the level above. Every answer sits at level 1, 2 or 3. Level 4 (the
original page) is one tap from any quote.

```
0  Home (Now)
   ├─ Next deadlines ......................................... answers "what happens next"
   ├─ Market status: one row per operator .................... answers "where does each stand"
   │    └─ 1  Market (PJM, MISO, SPP, CAISO, ISO-NE, NYISO)
   │         ├─ stage: June order → delay → filing → comments → FERC ruling
   │         ├─ what the June order required, by reform
   │         ├─ what the operator proposed, by reform ......... quotes, each → level 4
   │         ├─ who responded: supports / opposes / asks changes / procedural
   │         └─ 2  every document, grouped by stage
   │              └─ 3  Document: reading, contents, quotes
   │                   └─ 4  Original page
   └─ Reform × market grid: five reforms × six markets ...... answers "how does each market handle X"
        └─ 2  Cell: what the order asked, what the operator filed, with quotes

   Reference, one tap from home: Timeline · Commissioners · ANOPR comments · Discourse · Orders
```

## Where the site is today (baseline 2026-11-18)

Seven top-level tabs and about 13,000 words of rendered text. Costs on a phone, worst first:

| Question | Phone | Why it costs that much |
|---|---|---|
| How does each market handle who pays for upgrades? | 10.1 | Reform rows stack six markets of quotes vertically under one collapsed heading |
| Show me the original page behind a quote | 7.5 | The first quote sits six screens down Now |
| What did Constellation say in the ANOPR comments? | 7.2 | Four steps including a search and a disclosure |
| How does PJM answer the order on who pays for upgrades? | 6.3 | Same reform grid, below four other Now sections |
| Find Google's protest of MISO's LARS filing | 5.9 | Search, then open, then scroll to the cited quote |
| Has FERC acted on ATC's large-load filing? | 5.3 | Status line sits under a list, not at the top of the proceeding |

Total: phone 61.6, tablet 41.1, desktop 37.3. The full table is produced by every run.

**2026-11-18, Filings by market:** Filings is browsed by market subtab (PJM, MISO, SPP, CAISO, ISO-NE,
NYISO, Other), with one-line document rows on wide screens. Search matches every typed word and opens a
single match. 16 questions, none above 6; phone 37.3, tablet 30.1, desktop 28.9.

**2026-11-18, after subtabs, the status table and the reform × market matrix:** phone 35.8, tablet 28.7,
desktop 28.0. Comparing who pays across markets fell from 10.1 to 2.5 taps-plus-screens on a phone; the
quote-to-original-page route from 7.5 to 2. Opening a subtab costs one tap, so a few home-page answers
now cost 1 where they cost a short scroll before; the next deadline is answered by the masthead chip on every page.

**2026-11-18, comparison table as bullets:** each cell lists 2 to 4 page-cited points with figures (deposits, thresholds, timelines), and reform rows use the June orders' own Section III headings. The taller first row adds 0.75 of a screen on a phone to the two who-pays questions (1 to 1.75); accepted for the detail. Phone 37.7, tablet 30.4, desktop 29.1.

**2026-11-18, Filings sections and filters:** each proceeding lists its documents in four sections: FERC orders and notices, proposals and reports, responses, and procedural filings. Procedural filings fold only when there are substantive responses above them. The MISO-responses route now ends on an actual response, not MISO's own filing (desktop 3 to 3.73). Theme chips count and show read documents only; keyword matches are opt-in. Phone 38.4, tablet 30.8, desktop 30.0.

**2026-11-18, ANOPR commenter search on the overview:** a "Find a commenter" box on the ANOPR overview hands off to the All comments filter, saving the tap through that subtab (Constellation question 5.93 to 4.93 on a phone, 1.00 lower at every size). Tried and rejected: routing MISO responses through the Now page's filing link, which is cheaper on tablet and desktop but costs more on a phone. Phone 37.5, tablet 29.9, desktop 29.0.

**2026-11-21, positions on replies:** a reply read for this site shows its stance in place of FERC's document
type ("Supports the proposal with changes") and opens to a plain summary and one quote with its page. New
question: who supports or opposes MISO's LARS filing (phone 4.62, tablet 3.87, desktop 4.71).

## Gaps: questions the site cannot answer yet

Each needs data before it needs a route. When one becomes answerable, it gets a question in
`nav-questions.json` and a baseline.

- **Who supports or opposes each operator's filing?** Answered for MISO's LARS filing (every response
  shows its side, read from its text; question `lars-sides`). The Nov 13–19 filings have no substantive
  replies yet; `tools/curation-queue.mjs` lists each one as it arrives, and a test fails until it is read.
- **What stage is each market at?** Status is prose today. It needs a per-market stage record that the
  market page and the home table both read.
- **Comment deadlines for every Nov 16 filing in one place.** They are scattered across proceeding status lines.

## Order of work

Each step lands as its own PR and must not raise any cost.

1. The filing type line becomes a plain role and, where read, a stance ("Asks FERC to delay",
   "Opposes PJM's proposal"). Procedural rows (interventions, service lists) fold into a count.
2. Market pages (level 1), linked from the status table. Cuts the PJM questions to about 1–2.
3. The reform grid becomes a compact 5 × 6 matrix of cells. Cuts the cross-market question from 10 to about 2.
4. Tabs fold to Now, Markets, Reforms, Documents, plus a Reference menu.
