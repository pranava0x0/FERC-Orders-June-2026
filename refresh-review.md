# September 24 refresh and UX review

Local branch: `vibe/refresh-ux-september`, based on published head `67283df`.
No push, merge, or deployment performed.

## What changed

- Checked ten eLibrary docket sheets through September 24. Downloaded and read five September 21
  rehearing/clarification dismissal orders. Added sources, extracted texts, and timeline entries.
- Kept the November 16 response deadline and SPP's November 20 exception. Replaced the expired
  governance milestone; labeled the backstop auction start as proposed, not approved.
- Replaced the 1,145-word accumulated Overview narrative with a 100-word introduction. Removed
  rhetorical labels in regional descriptions and reform explanations. Historical detail remains
  in the timeline and Git history. All 249 structured quotation fields are byte-for-byte unchanged;
  the 268 source summaries and their 3,520 quotes were not rewritten.
- Replaced cream/serif styling with white, deep teal, gold navigation accents, sans-serif headings,
  square edges and ruled lists. Reference: FERC's current homepage, inspected September 24.
  The masthead identifies this as independent research; no agency seal is used.
- Added six first-screen research links; exposed all main tabs on mobile; added a native issue
  selector on mobile/tablet; moved timeline background below the event list; added a latest-event
  jump. Filing evidence now expands separately from the status table.
- Replaced misleading “audited” summary labels and checkmarks with provisional AI labels.
  Fixed a race where a slow issue response could overwrite a newer selection.

## Clicks and scrolling

Measured in a real browser at 375×812, 768×1024 and 1280×800. Baseline is the August 23 published
version, not the older local checkout. Typing is counted separately from clicks. A “screenful” is
one viewport height; physical swipe/wheel distance varies. Scroll estimates below are
`ceil(max(0, headingY - viewportHeight + 44) / viewportHeight)`.

| Task from Overview | Before: mobile / tablet / desktop | After: mobile / tablet / desktop |
|---|---|---|
| Read current status heading | 6 / 2 / 2 vertical screenfuls | 1 / 0 / 0 screenfuls |
| Reach the schedule | 9 / 3 / 4 screenfuls | 1 click, 0 manual vertical scrolls |
| Reach commissioner statements | 17 / 7 / 9 screenfuls | 1 click, 0 manual vertical scrolls |
| Open comment search | 2 tab activations | 1 shortcut activation |
| Open issue map | 2 tab activations | 1 shortcut activation |
| Open filing status table | Long Overview scroll; baseline distance not separately captured | 1 click, 0 manual vertical scrolls |
| Reveal filing citations | Already expanded below table | 1 additional disclosure click |

All six shortcut links finish at y=466 / 321 / 328 pixels, within the first screen at all three
sizes. The mobile filing table needs one 98-pixel horizontal swipe to reveal its right edge;
tablet and desktop need none. Automatic route scrolling is not counted as a manual scroll.

Raw heading positions, in pixels from page top:

| Heading | Mobile before → after | Tablet before → after | Desktop before → after |
|---|---:|---:|---:|
| Current status | 4999 → 1023 | 2476 → 655 | 2278 → 640 |
| Schedule | 7887 → 3072 | 4049 → 1953 | 3851 → 1779 |
| Commissioner statements | 14049 → 5634 | 8012 → 3717 | 7740 → 3490 |

These are heading-access measurements, not time-to-comprehension studies. The selected comment's
length still determines how far a reader scrolls through its arguments and quotes.

## Comment-analysis workflow

The current 268-summary corpus passes the deterministic checks: 3,520 quotes, 2,748 bins,
no orphan quotes, empty bins, broken two-way quote links, duplicate quotes, off-vocabulary
organization types, or absolute source paths. This is structural/source-text validation, not
human verification of stance or coverage.

Implemented:

1. Validate accessions and real calendar dates before dispatch; deduplicate inputs; maximum five
   records per batch. Default date is the run date, not June 25.
2. Align the default extraction model with the local runbook's measured Sonnet recommendation.
3. Treat `written` as successful only with matching accession, validation `ok`, and an audit flag.
4. Require a successful validator result and verdict for flagged audits. Report extraction and
   audit failures separately; skipped audits remain null, not “good.”
5. Limit repair instructions to two attempts. Preserve failed output for inspection.
6. Test failure paths without spending model tokens. No corpus-wide extraction was run.

Remaining improvements, in priority order:

- Reconcile post-June-24 comment intake before expanding the denominator. September arrivals are
  confirmed but not analyzed. Four scans need OCR; one original collection item is served inline.
- Review conditions, exceptions and objections against source bodies. A high-support aggregate
  can hide conditional support; passing a quote matcher cannot resolve that editorial judgment.
- Keep independent post-run disk validation. Worker-reported success remains self-reported; the
  workflow host does not independently read and hash the saved file before returning `complete`.
- The quote checker allows scattered matching spans to tolerate extraction artifacts. That proves
  text overlap, not argument completeness or preserved context. Keep human verification false.

## Verification

- 132 tests pass, including workflow rejection paths, source traceability, and delayed issue responses.
- Build run twice: identical bytes across all 329 generated/site files.
- 222 required website quotes verified; 17 prose quote spans resolved in the corpus.
- All 268 comment summary disclosures opened and closed in-browser: every quote file loaded,
  zero load errors. All 34 issue files loaded; all 32 filter counts matched click results.
- PJM + cost + opposition filters return six matching records. Empty search, keyboard clearing,
  token removal, filter URLs and a comment permalink reload passed.
- Six main sections × three sizes: 18 checks. Seven standalone docket pages × three sizes:
  21 checks. No page-level horizontal overflow.
- Seven docket accordions and 26 nested disclosures opened. Overview, Reforms, News, methodology,
  filing evidence and all 14 filer-roster expanders exercised. Main-tab arrow/End keys passed.
- Timeline counts: 42 total; 22 show-cause, 5 co-location, 5 governance, 4 RM26-4, 6 context.
  Latest-event jump lands on September 23. No console warnings/errors in the tested session.
- Mobile and desktop screenshots inspected. Primary teal/white contrast exceeds 7:1; gold is
  an accent rather than text. Focus rings and routed focus were checked in-browser.

## Limits

- Tested in the Codex browser with resized viewports, not physical devices or Safari/Firefox.
- Every available summary was opened; every external citation was not followed. Five new order
  documents were retrieved and read. The live public site is unchanged until deployment.
- The comment-analysis corpus still ends June 24. The September docket check is separately dated.
- Four spoken quote excerpts are auto-captions and are not verified against committed written text.
- New PJM/governance/backstop filings are described from docket metadata; their substantive
  arguments were not analyzed. Separate new ER compliance dockets were not searched.
- EL25-49 reports 388 records but renders 391 rows, with 315 distinct accessions. All four pages
  were read twice; the discrepancy remains recorded rather than labeled reconciled.
- Governance dispute-resolution outcome remains unverified. Commentary keeps its June 29 date.

Evidence: [refresh inventory](sources/refresh-2026-09-24.json), [UAT log](uat.md),
[refresh runbook](REFRESH.md), and [source texts](sources/text/rehearing/).
