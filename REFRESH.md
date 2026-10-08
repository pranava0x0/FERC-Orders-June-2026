# REFRESH.md — the news refresh loop

How to bring this site current. Written for the `data-refresh` skill and for a human doing it by hand.
The design behind it is `news-tracks-plan.md` Part 4; this file is the runbook.

**The site is static and baked.** There is no runtime fetching, no RSS, no cron. Freshness comes from
running this loop and committing the result. That is deliberate (plan Part 7).

## When to run

Driven by real dates, not a calendar interval:

| Date | What lands |
|---|---|
| 2026-09-01 | AD26-7 Alternative Dispute Resolution forum commences (Federal Register, confirmed). |
| 2026-09-16 | Third PJM stakeholder engagement session on its §205 proposal (named in the PJM abeyance order). |
| ~~2026-09-30 to 2026-10-21~~ | ~~PJM's backstop auction window~~. FERC suspended the procurement to Feb 28, 2027 on Sep 29 (196 FERC ¶ 61,245). |
| **2026-10-29** | **PJM's window to refile the backstop under §205** and have the paper hearing held in abeyance (30 days from the Sep 29 order). DOE urged the same date. |
| 2026-11-13 | Backstop paper-hearing initial briefs (45 days from Sep 29) unless held in abeyance; responses 20 days later. |
| ~~end of Sept 2026~~ | PJM's Members approved their own governance term sheet Sept 30; the states oppose it. What PJM files at FERC is not yet known. |
| 2026-10-28 | PJM advisory stakeholder vote at the Members Committee; CAISO Board of Governors and WEM Governing Body approval target. Both named in the Aug 14 abeyance orders. |
| **2026-11-16** | **The reset deadline.** Show-cause responses in five of the six §206 dockets, AND PJM's and the PJM TOs' full co-location compliance filing in EL25-49. PJM, CAISO and others have said they will instead make FPA §205 filings by this date, which suspends the obligation to respond. |
| 2026-11-20 | SPP's show-cause response (EL26-68 got 95 days rather than 90). |
| 2026-12-16 | Answers to the show-cause responses (SPP: 2026-12-21). |

**Resolved 2026-10-08:** Sep 1 (AD26-7 mediation began, per PJM's filing), Sep 16 (PJM stakeholder session, not separately confirmed), the Sep 30 to Oct 21 backstop window (suspended), end-of-September governance package (Members' sheet voted Sept 30).

**Resolved 2026-08-23:** every date above 2026-08-21 in the previous version of this table has landed.
All six abeyance motions were granted Aug 14; Silver Run's was granted with PJM's; the Aug 17 §206
deadline passed with the proceedings paused; the Aug 21 AD26-7 comments arrived (roughly 49 filings).

`node tools/check-staleness.mjs` tells you if you are overdue. Run it first; it is the cheapest signal.

## The loop

### 1. Sweep

Web-search per track since `meta.newsCapture` in `docs/js/data.js`. Produce the table format in
plan Part 1, flagging each finding **fetched** (article read end to end) or **snippet** (search result
text only). Snippet-only findings are leads, never publishable facts.

Tracks to sweep: `sc6` (EL26-67 to EL26-72), `e2` (EL25-49), `gov` (AD26-7), `rm264`, `context`.

### 2. Verify

This is the step that decides what ships. Known-good routes:

```bash
# Federal Register: the HTML pages bot-block automated fetch, but the API and full_text are open.
curl -s "https://www.federalregister.gov/api/v1/documents.json?conditions\[term\]=PJM+governance&conditions\[agencies\]\[\]=federal-energy-regulatory-commission&per_page=20&order=newest&fields\[\]=title&fields\[\]=publication_date&fields\[\]=docket_ids&fields\[\]=document_number"
```

Then read the notice body from `https://www.federalregister.gov/documents/full_text/text/YYYY/MM/DD/<doc-number>.txt`.
That is how AD26-7-000 and the July 23 conference date were confirmed.

- **ISO Newswire** (`isonewswire.com`) is open and first-party for ISO-NE.
- **PJM** release PDFs under `pjm.com/-/media/DotCom/about-pjm/newsroom/` are open and first-party.
- **eLibrary and ferc.gov are Cloudflare-gated** and will 403 any automated fetch. Docket confirmation
  is a deliberate manual browser step; see the retrieval notes in `issues.md` (2026-06-22). This is the
  step that flips `filed-reported` into `filed-verified` and stamps `accession` + `verified_at`.
- Trade press behind a paywall: if the only source for a claim is unfetchable, it ships as a labeled
  headline pointer or not at all. Never as a paraphrased fact.

**Open verification queue** (updated 2026-10-08; resolved items removed rather than left to rot):

0. **New 2026-10-08.** (a) No general eLibrary keyword search for §205 large-load filings by *other* applicants was completed (the form would not submit); "none observed" means the six docket sheets only. (b) Constellation's Sep 8 limited protest of PJM's Aug 17 co-location compliance filing (20260908-5326) was not read; its download did not land. (c) The Sep 21 dismissal orders in NYISO, MISO and CAISO (20260921-3021, -3047, -3019) are known from docket-sheet descriptions only. (d) Press on the governance vote and the postponed backstop window (Utility Dive, Maryland Matters, MyChesCo, Energy Central) is snippet-only and not shipped. (e) Rep. Pallone's Sep 28 and Voltus's Sep 29 comments in ER26-3380 are unread.

1. CAISO's Aug 12 Large Loads straw proposal: CAISO's own notice (first-party, in `SOURCES.caisostraw`)
   confirms the posting date, the Aug 19 stakeholder meeting and the topic list. Secondary coverage
   (mgrid.org, Aug 18) attributes to the proposal document itself two named services, "FILI" and "FLIP",
   a 50 MW single-site large-load definition, and a decision to drop FERC's 69 kV and customer-type
   tests. None of that is confirmed against the proposal PDF, which was not located on caiso.com this
   sweep. Treat as a lead. Get the PDF from the Large Loads initiative page before quoting any of it.
2. EL26-67: the reported Jul 17 ratepayer-advocate filing. Exact procedural type + filers. (Carried.)
3. EL25-49: the Feb 2026 compliance filing's requested Jul 31 effective date. (Carried.)
4. RESOLVED 2026-10-08: the rehearing requests live in the **-001 sub-docket** (EL26-67-001: 20260717-5246, -5258; 20260720-5198, -5218, -5172), disposed of Sep 21 (20260921-3020). See the gotcha below.
5. Northern Virginia Electric Cooperative's Jul 29 motion for clarification of the June 18 E-2 order is
   newly known from Vistra's Aug 18 answer (20260818-5146). Its own accession has not been pulled.
6. Whether any of the six respondents makes its FPA §205 filing before Nov 16, which suspends its
   obligation to respond. PJM said early-to-mid November, the Indicated PJM TOs no later than Nov 16,
   CAISO Nov 16. This is the single most important thing to check on the next sweep.
7. No new statement from Commissioner Lindsay See or Commissioner Judy Chang on these orders, outside
   their June 18 concurrences, could be sourced in the Jul-Aug sweep. Both appear in the window (Chang at
   NARUC's Summer Policy Summit, Jul 19-22) but nothing verbatim was found. A real gap, not a null
   result: try conference video, NARUC materials and FERC open-meeting transcripts next time.
8. No commissioner reaction to the Aug 14 abeyance grant itself was found anywhere, and no dissent or
   separate statement is attached to any of the six orders. The grant was 9 days old at the sweep window's
   close, so this is probably coverage lag rather than silence. Re-check.
9. The three parties that filed unsolicited comments on the 30-day informational reports (NGSA across
   all six dockets Aug 10, Sparkfund Aug 12, the Organization of MISO States Aug 14) have not been read.
   Nobody was invited to comment on those reports; what they argue is not yet known.

Resolved this sweep: all six abeyance motions (granted Aug 14, all six orders downloaded and read);
Silver Run's separate PJM motion (granted, in the same order as PJM's); whether FERC would rule before
Aug 17 (yes, on Aug 14); whether anyone answered AMP's opposition (FERC did, in the order itself);
PJM's E-2 extension request (granted Aug 14, and the promised partial filing landed Aug 17 anyway).

### 3. Update `docs/js/data.js`

- `tracks.<id>.status.line` + `.asOf`, and `.next` if the clock advanced.
- `timeline`: add events chronologically, each with a required `track`.
  **Deadline-conversion rule:** when a dated `kind: "deadline"` event passes, either replace it with a
  dated sourced event describing what was observed, or append an explicit "window closed, nothing
  observed as of <date>" event. A passed deadline may never sit there in the future tense.
- `procedural.filings.rows`: **observations only.** `upcoming` and `none-observed` are derived at render
  time from the clock, so never store them. Status vocabulary and its evidence cost:
  `filed-verified` (needs `accession` + `verified_at`) · `filed-reported` (needs `src`) ·
  `signaled` (needs `src`).
- New `SOURCES` records need `published` (the outlet's own date) when cited from a track or filing
  surface. Never invent one: use `undated: true` if the source shows none.
- Any new displayed quote goes into `sources/news-evidence.json` with its captured snippet.
- Bump `meta.newsCapture` and `procedural.filings.asOf`.

### 4. Check, test, regenerate

```bash
node tools/check-staleness.mjs
node tools/build-llms.mjs
node --test tests/*.test.mjs
node tools/verify-quotes.mjs
python3 tools/extract-abeyance-docs.py --check   # committed order text still matches its source
node tools/survey-summaries.mjs --brief          # comment corpus: the should-be-zero set
```

**The one check that is not a script.** The repo has no dependencies and no package.json, so there is no
jsdom and the renderers cannot be exercised headlessly. After a refresh, open the preview and run this
in the console; it is thirty seconds and it has caught real breakage:

```js
// every tab renders, and no data hole leaks into the copy
(async () => { const s = ms => new Promise(r => setTimeout(r, ms)); const out = {};
  for (const t of ['overview','timeline','reforms','dockets','comments','news']) {
    location.hash = '#' + t; await s(700); const p = document.querySelector('#panel-' + t);
    const x = p ? p.innerText : '';
    out[t] = { len: x.length, undef: /\bundefined\b/.test(x), nan: /\bNaN\b/.test(x) };
  } console.table(out); })();
```

Every `len` non-zero, every `undef`/`nan` false. Then check `document.documentElement.scrollWidth -
clientWidth === 0` at 375px, and read the console at all levels. Setting `location.hash` synchronously
and reading immediately returns an empty panel: the render is async, hence the wait.

If the sweep pulled new FERC documents, extract them BEFORE quoting from them: add a record to `DOCS`
in `tools/extract-abeyance-docs.py`, run it, and the text lands in `sources/text/abeyance/` where
`verify-quotes.mjs` can prove any quote you display. A quote from a document that is not in the
committed corpus cannot be verified and must not ship.

### Planning the search

`node tools/news-sweep-plan.mjs` builds the query matrix from the data itself (every docket, reporter
citation, commissioner and named voice on the site) crossed with curated topic, event and
elected-official terms, deduped and prioritized. P1 is what changed in the window and who said something
about it; P3 is the broad topical net. Use `--json` to hand the plan to a search agent, and
`--check <findings.json>` to validate what comes back before merging: every finding needs a URL, a
publisher, a published date inside the window, and either a verbatim quote with a named speaker or an
explicit `snippetOnly: true`. Findings from an outlet not already in `SOURCES` are flagged, not rejected.

**One agent, not a fan-out.** The search is a single background agent with the matrix in its prompt.
Two sweeps running now have found that press lags this docket by more than a week, so the search is
garnish: go to eLibrary first, and spend the search budget on statements by named people, which is the
one thing the docket sheet cannot give you.

### 5. Log

Append to `issues.md` anything found broken, and to `agent-runs.md` a row for any sweep agent, with its
token usage. Update the progress log at the top of `news-tracks-plan.md`.

## Search Console

The site is a verified URL-prefix property at
`https://pranava0x0.github.io/FERC-Orders-June-2026/` (Google account: the repo owner's).
`sitemap.xml` is submitted and regenerates from `data.js`, so a refresh that adds pages needs no
resubmission; Google re-reads the same URL.

**Do not delete `docs/google1a32de6a02a9a6e0.html` or the `google-site-verification` meta tag in
`docs/index.html`.** Both are ownership proofs. Google un-verifies a property when the artifact it
verified with disappears, and the failure is silent: reporting just stops.

After a refresh that adds URLs, optionally inspect one new URL in Search Console and hit **Request
indexing** to put it in the priority crawl queue (quota is roughly 10 per day).

## Gotchas learned the hard way

- **Sweep the `-001` sub-dockets, and the companion docket, not just `-000`.** Rehearing and clarification
  requests (and the orders that dispose of them) are docketed under `EL26-67-001`, not the `-000` sheet.
  The Aug 23 sweep of `-000` alone could not find them, which is the real cause of the "confirmed false
  negative" below: the filing was never on the sheet being searched. A Sep 21 order sat in `EL26-67-001`
  while the `-000` sheet showed one trivial filing. Likewise PJM's backstop sits on `ER26-3380-000` with
  a companion `EL26-108`. For each docket also read `-001` and check the docket sheet of any order that
  cites a new one. The general search (`textsearch`, `Affiliation`) needs its submit button located by
  text if `#submit` is null.
- **PJM hosts FERC's own orders and its filings on pjm.com, open to curl.** `pjm.com/pjmfiles/directory/etariff/FercOrders/…`
  and `pjm.com/-/media/DotCom/documents/ferc/{orders,filings}/…` return real PDFs, so a PJM-docket order
  needs no browser download once you know its accession from eLibrary (still take the accession from
  eLibrary: the extractor keys on it). Extraction needs PyMuPDF; there is none on the system python, so
  make a throwaway venv in the scratchpad rather than installing globally. Do not let the extractor
  rewrite `sources/abeyance-manifest.json` when the old source files are gone: it blanks `source_file`
  on every earlier record. Append the new records instead.

- **The browser caches `data.js` hard** on `localhost`. When a change does not appear, load
  `http://127.0.0.1:8131` instead of `localhost:8131`: a different host string is a separate cache entry.
  Verify against `window.FERC_DATA` in the console before debugging the render.
- **Adding a `const` to `data.js` is two edits.** The IIFE's `return {...}` at the bottom is an explicit
  list; a new section that is not added there is silently `undefined` in the app and every test that
  reads it passes vacuously.
- **A provision read in full in one order is not unique to it.** Grep all six texts in
  `sources/text/orders/` before shipping any "only region X" claim. That was the Phase 0 bug.
- **`published` is not `captured`.** The outlet's own date and the date we pulled it are different
  facts, and a test asserts `published <= captured`.
- **A confirmed false negative: a direct docket-sheet keyword search missed a real filing the docket
  sheet's own accession later cited by docket number.** Constellation's Aug 4 answer (accession
  20260804-5163) shows up in both the EL26-67 and EL25-49-000 docket sheets, and its own text captions
  the two rehearing requests it answers as filed in "Docket No. EL26-67-000" and "Docket No. EL25-49-000,
  et al." respectively. A direct `docketsheet?docket_number=EL26-67-000` keyword search for "rehearing"
  and "clarification," run against every row on that sheet, found zero matches for the underlying
  Transmission Owner and Exelon/FirstEnergy requests themselves, even though Constellation's own
  caption says one of them is filed there. We could not resolve why this session (a mismatched
  description string, a different lead-docket assignment despite the caption, or something else); don't
  assume a "nothing found" eLibrary search is proof of absence when a primary document you already hold
  cites, dates and names the thing you searched for. When a search result and a primary source conflict,
  the primary source wins and the search method is what's suspect, not the fact.
- **eLibrary paginates ascending by filed date, oldest first, and reading only the last page LOSES
  ROWS.** For a 100-row page size the newest filings are at the end, so the instinct is to click through
  to the final page and read it. That silently drops rows whenever recent activity is larger than the
  final page holds: with 135 total rows the last page is 35, and if 49 filings arrived on one day, 14 of
  them sit at the tail of page 1. Measured on 2026-08-23: last-page-only gave AD26-7 35 filings since
  Aug 9 where the true number was 67, and EL26-69 2 where it was 4. **Accumulate rows across every page
  into a map keyed by accession, then filter by date.** `Records Found` in the header gives the total and
  `Math.ceil(total / 100)` the page count; click `button[aria-label="Next page"]` and re-read the table
  after each click. The working extractor is committed at [`tools/elibrary-sweep.js`](tools/elibrary-sweep.js); paste it through the Chrome bridge rather than rewriting it.
- **The Chrome bridge does not await promises.** `execute_javascript` returns "JavaScript executed" for
  an async IIFE and throws the result away. Stash it on `window` (`window.__sweep = {...}`) from inside
  the async function and read it back in a second call.
- **Downloading a filing works.** On a filelist page, `document.querySelectorAll('a.filedownloadlink')`
  are Angular click handlers with `href="#"`, not real URLs; calling `.click()` on them downloads to
  `~/Downloads` as `<accession>_<filename>`. Notational orders are DOCX (`textutil -convert txt -stdout`),
  filings are PDF (`fitz`). This is how the six abeyance orders were read in full rather than trusted
  from their one-line descriptions.
- **A filing's docket-sheet description can be generic or reused boilerplate.** American Municipal
  Power's file-list description read "Answer... to abeyance motion under EL26-80-000" (a docket that
  doesn't exist in this matter; the actual docket is EL26-70) — apparently copy-pasted from a template.
  The docket-sheet row itself had the correct docket. Don't trust a filing's own internal description
  field over the docket sheet when they conflict; when a claim matters, open the PDF. Seen again on
  2026-08-23, and worse: the docket-sheet row for accession 20260813-3026 describes it as an erratum
  "re Midcontinent Independent System Operator, Inc. et al. under EL26-72. For order see accession
  number 20260618-3047." The document itself is captioned Docket No. EL26-70-000 and corrects
  195 FERC ¶ 61,212, the MISO order. Both the docket number and the parent-order accession in the
  description are wrong. Here the DESCRIPTION was wrong and the document right, the opposite of the AMP
  case, so the rule is not "trust the row over the filing" but "open the document".
- **"Answer... in Response to" a motion is not the same as opposing it.** Two respondents this sweep
  used identical procedural phrasing ("Answer of X in Response to the Motion...") for opposite
  positions: NESCOE's Aug 7 answer in EL26-72 supports ISO-NE's abeyance motion outright; American
  Municipal Power's Aug 7 answer in EL26-70 asks FERC to deny MISO's. The procedural title never says
  which; only the PDF body does. Download and read the actual filing before characterizing a stance.
