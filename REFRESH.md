# REFRESH.md — the news refresh loop

How to bring this site current. Written for the `data-refresh` skill and for a human doing it by hand.
The design behind it is `news-tracks-plan.md` Part 4; this file is the runbook.

**The site is static and baked.** There is no runtime fetching, no RSS, no cron. Freshness comes from
running this loop and committing the result. That is deliberate (plan Part 7).

## When to run

Driven by real dates, not a calendar interval:

| Date | What lands |
|---|---|
| ~~2026-09-30 to 2026-10-21~~ | ~~PJM's backstop auction window~~. FERC suspended the procurement to Feb 28, 2027 on Sep 29 (196 FERC ¶ 61,245). In its Nov 9 refiling (ER27-454, pp. 61–63), PJM proposed a March 1, 2027 start and a four-week offer window. |
| ~~2026-10-21~~ | ~~Answers on PJM's abeyance motion~~. Only NOVEC answered. FERC's Oct 23 notice (20261023-3114, read) did not grant abeyance; it moved the EL26-108 briefs to Jan 11 and Jan 26, 2027. |
| ~~2026-10-22~~ | ~~PJM special MC consultation on the backstop refiling~~. Held; ER27-330 cites it. |
| ~~2026-10-28~~ | ~~PJM MC; CAISO Board~~. The MC agenda had **no** large-load item or vote (the Aug 14 order expected an advisory vote). CAISO's Board advanced its Large Loads proposal; CAISO says it files by Nov 16. |
| ~~2026-10-29~~ | ~~PJM's backstop refiling~~. Filed as a NEW docket, **ER27-330-000** (20261029-5227, read; errata ER27-330-001 Oct 30). Seven rehearing/clarification requests of the Sep 29 order sit in **ER26-3380-001**. |
| ~~2026-11-05~~ | ~~PJM special MC~~ on "a suite of section 205 filings". No minutes or materials found as of Nov 9; the backstop spacing would put PJM's filings on or after Nov 12. |
| ~~2026-11-09~~ | PJM filed registry compliance in ER26-3515-002 (20261109-5217); Ohio sought rehearing in -001 (20261109-5209). PJM separately recoded its Oct 29 backstop proposal as a §205 filing in ER27-454-000 (20261109-5216). |
| 2026-11-12 | NEPOOL vote on ISO-NE's large-load filing (search snippet only, not confirmed). |
| 2026-11-30 | ER26-3515-002 and ER27-454-000 comments due 5 pm ET (Nov 10 notice, 20261110-3030). ER27-330 comments and interventions due 5 pm ET (FERC's Nov 2 combined notice, 20261102-3050, read; also covers the -001 errata). Also watch for answers to the ER26-3380-001 rehearing requests and a FERC rehearing notice. |
| 2027-01-11 | EL26-108 backstop paper-hearing initial briefs (reply briefs Jan 26), per FERC's Oct 23 notice. |
| open | PJM governance: the Board has not said what it will file after the Members' Sept 30 vote. Redlines were posted Oct 13 and walked through Oct 16. Watch AD26-7 and PJM's Members Committee postings. |
| **2026-11-16** | **The reset deadline.** Show-cause responses in five of the six §206 dockets, AND PJM's and the PJM TOs' full co-location compliance filing in EL25-49. PJM, CAISO and others have said they will instead make FPA §205 filings by this date, which suspends the obligation to respond. |
| 2026-11-20 | SPP's show-cause response (EL26-68 got 95 days rather than 90). |
| 2026-12-16 | Answers to the show-cause responses (SPP: 2026-12-21). |

**Resolved 2026-10-19:** Oct 16 (governance page-turn held; redlines posted Oct 13). Oct 9 brought the one FERC order of the window, in ER26-3515, which was never on this table because PJM's Aug 13 IRAS filing was never tracked: the lesson is below under gotchas.

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

**Open verification queue** (updated 2026-11-02; resolved items removed rather than left to rot):

**Nov 10 docket sweep.** The six §206 sheets and their -001s, co-location, governance, the backstop and ER26-3515 were checked against eLibrary. The Nov 9–10 PJM applicant search (9 results) found ER27-454, which the ER27-330 sheet did not. Watch both until a withdrawal is docketed. MISO answered the LARS protests Nov 9 (20261109-5205). The PJM applicant search and EL25-49-002 check below are complete. No new commentary or video sweep was published.

0000. **New 2026-11-02** (eLibrary cutoff Oct 29, `SOURCES.elibrary1102`; web, X and first-party back to Oct 19). (a) Not run this sweep: EL25-49-002 and the general eLibrary search by applicant; run both on Nov 10. (b) AD26-8: only PJM's Panel 1 statement was read. NERC's joint comments (20261021-4000), EEI/AEP (-4002) and Dominion (-4001) are unread, and the conference transcript and webcast were not reviewed, so no commissioner remark from Oct 21 is on the site. (c) Leads not shipped: AEP CEO Bill Fehrman's Q3 line on large loads bearing incremental costs (SEC 8-K exhibit; sec.gov refuses automated fetch, open it in Chrome); a White House spokesperson's statement that PJM has not implemented the Statement of Principles (Northeast Times, Oct 23, 403); Dominion's Q3 call (summary site only). (d) The President's Oct 21 post is quoted via Bisnow; the Truth Social post itself was not opened.

000. **New 2026-10-30** (eLibrary sweep, cutoff Oct 20, `SOURCES.elibrary1030`). (b) is RESOLVED 2026-11-02: AD26-8 is FERC's annual reliability conference (Oct 21), Panel 1 on large loads; see 0000(b). (a) Unread, description only: Tesla/Sunrun/Renew Home protest in EL26-108 (20261020-5159); five of seven ER26-3380-001 rehearing requests (AMP Oct 13 20261013-5514, FirstEnergy, Ohio OCC, Constellation, NOVEC); ER27-330 errata (20261030-5172); NCAI's moratorium comments in all six §206 dockets (20261026-4001); the Vistra and Exelon Third Circuit petitions on the co-location orders (20261022-5214, 20261027-0003); MISO's ZGIA deficiency letter (20261009-3000). (b) AD26-8-000, a FERC technical conference on operational challenges of integrating large loads (pre-conference statements Oct 21; PJM Inside Lines covered it): not read, not on the site. (c) CAISO's Board resolution and vote count not read; only APPA's account of CAISO's statement. (d) No commissioner or IMM statement on the refiling or the Oct 23 notice was found. (e) The first page of the "large load" keyword search (Oct 16-30, 593 hits) was read, not every page.

00. **New 2026-10-19; mostly resolved by the 2026-10-20 eLibrary sweep** (authenticated Chrome, `tools/elibrary-sweep.js`, cutoff Oct 8, every row of every sheet read; `SOURCES.elibrary1020`). The Oct 19 sweep ran from a cloud container with no authenticated browser. Status of each follow-up:
    (a) DONE Oct 20 for EL26-67-000 to EL26-72-000, all six -001 sub-dockets (EL26-68/-69/-70/-71/-72-001 read later the same day: 0, 3, 4, 3 and 4 rows, none since Oct 8), EL25-49-000/-002, ER26-1479-002, AD26-7-000, ER26-3380-000, EL26-108-000 and ER26-3515-000. The six §206 sheets are quiet (service-list updates, one out-of-time intervention in EL26-67).
    (b) RESOLVED. PJM's motion for abeyance (served Oct 12, docketed Oct 13, accession 20261013-5141) is read and extracted; NOVEC answered in support Oct 14 (20261014-5184, description only, not read); FERC's Oct 16 notice (20261016-3047) set answers due 5 pm ET Oct 21. No ruling yet.
    (c) LARS docket FOUND: MISO's Oct 2 filing (20261002-5074) is **ER27-25-000**, effective Dec 2, 2026 (docinfo page). RESOLVED Oct 30: the ER26-3552 sheet shows a FERC deficiency letter dated Oct 9 (20261009-3000; description only).
    (d) Open: read CAISO's draft final proposal PDF (posted Sep 24; the notice was read, the proposal was not).
    (e) RESOLVED. The four Sep 21 non-PJM dismissal orders were re-extracted on Oct 20 from their eLibrary DOCX originals (committed in `sources/originals/`) and matched the browser text word for word; see the manifest `provenance` field.
    (f) ER26-3515: no rehearing requests as of Oct 20 (deadline Nov 9). PJM's compliance filing is still due Nov 9.
    The eLibrary WebAPI is NOT a route around the browser: see gotchas.
0. **Carried from 2026-10-08.** (a) No general eLibrary keyword search for §205 large-load filings by *other* applicants has been completed; "none observed" means the six docket sheets only. (b) Constellation's Sep 8 limited protest of PJM's Aug 17 co-location compliance filing (20260908-5326) is unread. (c) RESOLVED 2026-10-19: all five Sep 21 dismissal orders are now in the corpus (there were five, not four; ISO-NE's 20260921-3056 was the one the Oct 8 sweep missed). (d) Press on the governance vote and the postponed backstop window is snippet-only and not shipped. (e) Rep. Pallone's Sep 28 and Voltus's Sep 29 comments in ER26-3380 are unread.

1. CAISO's Aug 12 Large Loads straw proposal: CAISO's own notice (first-party, in `SOURCES.caisostraw`)
   confirms the posting date, the Aug 19 stakeholder meeting and the topic list. Secondary coverage
   (mgrid.org, Aug 18) attributes to the proposal document itself two named services, "FILI" and "FLIP",
   a 50 MW single-site large-load definition, and a decision to drop FERC's 69 kV and customer-type
   tests. None of that is confirmed against the proposal PDF, which was not located on caiso.com this
   sweep. Treat as a lead. Get the PDF from the Large Loads initiative page before quoting any of it.
2. RESOLVED 2026-10-20: EL26-67's Jul 17 ratepayer-advocate filing. Filers from Maryland OPC's own release (`mdopc0717`): OPC joined by the Ohio Consumers' Counsel, the Delaware Division of the Public Advocate and the Illinois Attorney General, with the Pennsylvania OCA filing separately (`udadvocates0721`). Procedural type from FERC's Sept 21 order, which dismissed them as rehearing requests. The filings themselves are still unread.
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

### Refresh the filing reading room

1. Run `node tools/sweep-show-cause.mjs /tmp/ferc-sheets 2026-06-18 YYYY-MM-DD` for the six roots and their -001 subdockets. Append explicit docket numbers to check companion cases. This uses the installed Playwright and stable Chrome; set `NODE_PATH` to the installed modules if necessary. Each dated result records how many rows the portal reported and how many the browser read. A zero that contradicts an earlier count is a failure. Run `python3 tools/reconcile-show-cause.py /tmp/ferc-sheets --output /tmp/new-rows.json --baseline-output /tmp/candidate-baseline.json` and review all accession differences, including late-indexed filings dated before the last capture. Update the baseline and classification ledger only after that review.
2. Download each new *public* accession and its attachments: `node tools/fetch-filing-originals.mjs --out /tmp/ferc-originals 20261109-5216` (one or more accessions). Review the staged inventory, file signatures and SHA-256 hashes. Record the disposition of every public attachment, including duplicates; never substitute a related accession for an inaccessible original. Update `sources/filings/refresh-documents.json`, the attachment manifests and `refresh-coverage.json`. Preserve restricted and unavailable statuses.
3. Add cited section readings and any attributable responses to `sources/filings/`. Store the document, physical page, a verbatim quote and the speaker’s actual action. A vote on a coalition filing does not establish a vote on a later refiling. For video, use `python3 tools/fetch-video-transcripts.py --help`; keep caption source, original posting date, recording date and official hearing text separate.
4. Run `sh tools/refresh-reading-room.sh --build`, inspect the change in the catalog and archive report, then run `sh tools/refresh-reading-room.sh --check`. The latter re-extracts the sources and compares the generated output without changing it. Use `python3 tools/index-filing-text.py --only SLUG --check` for one original, `--tokens SLUG` for token/page/character offsets, or `python3 tools/revalidate-archive.py --comment ACCESSION` for a historical RM26-4 submission. `--check-ocr` also replays the image pages on macOS.
5. Run the test suite and the browser checks below. `node tools/uat-filing-readers.mjs SITE_URL BASELINE_URL /tmp/ferc-reading-uat` tests all three screen sizes, source anchors, the JavaScript-free keyboard path, and compressed bytes for a cold Overview. Serve the previous release separately as BASELINE_URL. To record real taps, clicks, text entries and scroll for every tab and Comments subtab, run `node tools/uat-tab-interactions.mjs SITE_URL /tmp/ferc-tab-interactions` and open `interactions.html` in the output directory. JSON and Markdown copies sit beside it. With the shared writing tools available, run `node tools/check-filing-prose.mjs --print | python3 ../coding-best-practices/tools/slop_writing.py --stdin --profile public-copy --no-review` and `python3 ../coding-best-practices/tools/slop_design.py --no-review docs/css/reading.css docs/reading/compliance-er26-3515-pjm/index.html`. Source quotes and official titles are not editorial copy.

### 4. Check, test, regenerate

`docs/js/data.js` is the source the browser never loads. `core-data.js` and `news-data.js` are built
from it, so **any edit to `data.js` needs `node tools/build-delivery-data.mjs` before the stamper**, or the
site keeps serving the old copy. The `--check` form fails loudly when the two have drifted, and
`tests/page-weight.test.mjs` runs it, so a skipped build fails the suite rather than shipping quietly.

```bash
node tools/check-staleness.mjs
node tools/build-delivery-data.mjs              # data.js -> core-data.js + news-data.js (then stamp)
node tools/build-llms.mjs
node --test tests/*.test.mjs
node tools/verify-quotes.mjs
python3 tools/extract-abeyance-docs.py --check   # committed order text still matches its source (originals in sources/originals/; needs PyMuPDF)
node tools/survey-summaries.mjs --brief          # comment corpus: the should-be-zero set
```

**The browser check, scripted.** `node tools/uat-playwright.mjs` (serve `docs/` on 127.0.0.1:8131 first)
runs the console check below at 375x812, 768x1024 and 1280x800, fails on `undefined`/`NaN`, horizontal overflow,
console errors or failed requests, and prints the reader-depth table (taps + swipes + screens of scroll
to the filing, comment, deadline and video goals). It needs Playwright and a Chromium, which the cloud container has
and a laptop may not; where it cannot run, do the manual version:

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

### 4b. The record tabs: Filings and Commissioners

Both read `docs/js/record-data.js`, baked from three committed sources and loaded on first open of either tab:

- `sources/filings/tenets.json`: proceedings → documents (slugs of `sources/text/abeyance/*.txt`) → tenets, each a
  plain sentence of at most 16 words with verbatim quotes and the PDF page they sit on.
- `sources/videos/manifest.json` + `sources/videos/text/<id>.txt`: commissioner videos and their auto-caption transcripts.
- `sources/videos/chapters.json`: per video, a contents list and timestamped commissioner quotes.

```bash
# new FERC documents: download in Chrome, add DOCS records, extract (step 4 above), then add tenets for them
# new videos: find, add to the manifest, fetch (yt-dlp in a scratch venv; see the script's docstring)
YTDLP=<venv>/bin/yt-dlp python3 tools/fetch-video-transcripts.py --discover "FERC Rosner data center"
YTDLP=<venv>/bin/yt-dlp python3 tools/fetch-video-transcripts.py          # fetches what is missing, 10 s apart, backs off on 429
python3 tools/fetch-video-transcripts.py --check
node tools/verify-record.mjs          # every quote on its cited page / at its cited second; strict, no fuzzy match
node tools/build-record-data.mjs      # bake docs/js/record-data.js (then stamp-assets)
```

Tenets and video contents are written by extraction agents working from a brief (one proceeding or two or three
videos each) and a closed loop: the agent runs `tools/verify-record.mjs` on its own draft until it prints ✓. The
briefs used on 2026-11-09 are in `agent-runs.md`. YouTube rate-limits caption requests (HTTP 429 after about
eight in a row) and some videos need a PO token the android/ios clients do not have; for those, read the
transcript panel in Chrome or try the same event's other upload.

### 5. Log

Append to `issues.md` anything found broken, and to `agent-runs.md` a row for any sweep agent, with its
token usage. Update the progress log at the top of `news-tracks-plan.md`.

## Scheduled sweeps

Six one-time local scheduled tasks run this loop after each dated event (they live in
`~/.claude/scheduled-tasks/ferc-sweep-<date>/` on the maintainer's Mac and need the app open and the logged-in
Chrome for eLibrary and X): **Oct 22** (Oct 21 answers, PJM special MC), **Oct 30** (Oct 28 MC and CAISO board,
Oct 29 backstop refiling), **Nov 10** (ER26-3515 compliance and rehearing deadline), **Nov 17** (the Nov 16
responses and co-location compliance), **Nov 21** (SPP), **Dec 17** (answers). Each run opens a PR and never
merges. The runbook every task follows:


SETUP: `git fetch && git checkout main && git pull --ff-only`, then `git checkout -b sweep-<YYYY-MM-DD>`. Run `node tools/check-staleness.mjs` first. If another sweep branch or PR is open and unmerged, stop and report instead of duplicating it.

COVER ALL SIX SOURCE TYPES, since `meta.newsCapture` in docs/js/data.js:
1. FERC documents (primary): read every docket sheet in the user's logged-in Chrome (Claude in Chrome tools) with tools/elibrary-sweep.js, CUTOFF = the last newsCapture: EL26-67-000..EL26-72-000 and their -001 sub-dockets, EL25-49-000/-002, ER26-1479-002, AD26-7-000, ER26-3380-000 and -001, EL26-108-000, ER27-330-000 (the Oct 29 backstop refiling), ER27-454-000 (Nov 9 recoding), ER26-3515-000/-001/-002, ER27-25-000 (MISO LARS), ER26-3552 (MISO ZGIA), plus any new docket a filing names. Also run the general eLibrary search by applicant (PJM, MISO, SPP, CAISO, ISO New England, NYISO and their TOs) for new §205 large-load filings. Download every order, notice and substantive filing you quote (click the `a.filedownloadlink` for the named file only), copy the originals into sources/originals/ (COMMITTED: the user wants docs and data in the GitHub repo), add a DOCS record in tools/extract-abeyance-docs.py, extract, and confirm `python3 tools/extract-abeyance-docs.py --check` compares every document.
2. Government press releases and statements: ferc.gov news releases and commissioner statements (Cloudflare-gated: use Chrome), the FERC open-meeting agenda/summary, energy.gov (DOE), PJM Inside Lines and newsroom PDFs, MISO/SPP/CAISO/ISO-NE/NYISO newsrooms, state PUCs and governors in the affected states, NARUC/OPSI/OMS, and members of Congress.
3. Web search for news and analysis: build the matrix with `node tools/news-sweep-plan.mjs --json` and give it to ONE Haiku search agent (model haiku) for trade press, law-firm alerts, think tanks and op-eds.
4. Social media: run X searches yourself in Chrome (queries pairing FERC/PJM/large load/data center/co-location/backstop/the docket numbers with the event of the day; plus timelines of known voices in data.js `voices`). Strip `? & = ; %` from collected text and write results into the page body, then read them with get_page_text (the javascript tool's output is capped and filtered).
5. Commentary from named people (experts, advocates, market monitors, former commissioners): a second Haiku agent focused on statements by named people not already in `voices`.
6. Interviews, videos and spoken statements: YouTube, podcasts (Catalyst, Volts, Energy Gang, Shift Key, Power Lines), conference panels, the FERC open meeting video, and hearings. Quote video only from a published transcript; auto-captions go in as SPOKEN and are labelled unverifiable.

VALIDATE: give every agent and X finding to ONE Sonnet agent (model sonnet) that reopens each page, checks the quote verbatim (X through https://publish.twitter.com/oembed?url=...), confirms speaker, role, headline and date, dedupes against data.js SOURCES/voices, and rejects paraphrases. Run `node tools/news-sweep-plan.mjs --check <file>`. Nothing snippet-only ships as fact.

INTEGRATE: give the validated set to ONE Opus agent (model opus) to place it (timeline with `track`, procedural.filings rows as observations only, tracks status lines, Discourse themes/media/voices roster) and to convert passed deadlines per the deadline-conversion rule. Bump `meta.newsCapture` only when the dockets were actually swept, `meta.commentaryCapture` when commentary was added. Every displayed quote needs its evidence entry.

GATES (all must pass): node tools/check-staleness.mjs; node tools/build-delivery-data.mjs; node tools/build-llms.mjs; node tools/build-seo.mjs; node tools/build-docket-pages.mjs; node tools/verify-record.mjs; node tools/build-record-data.mjs; node tools/stamp-assets.mjs; node --test tests/*.test.mjs; node tools/verify-quotes.mjs; python3 tools/extract-abeyance-docs.py --check; then serve docs/ on 127.0.0.1:8131 and run the REFRESH.md console check (or tools/uat-playwright.mjs).

FINISH: update REFRESH.md (queue, When-to-run table, Learned), issues.md and agent-runs.md (agents and token use). Commit in small focused commits with plain messages, and never add Co-Authored-By or "Generated with" lines. Push the branch and open a PR. Do NOT merge; the user reviews. End with a short summary of what changed, what is still open, and the PR link.

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

- **pjm.com answers a wrong URL with HTTP 200 and a 26,183-byte page.** Every bad guess at a committee or
  disclosure path returns that same soft 404, so `curl -o file.pdf` leaves a real file on disk and a
  status-only check records a source that does not exist. Three guessed paths passed a 200 check on
  2026-11-11 (`20261118/agenda.pdf`, `20261105/minutes.pdf`, an invented ACP letter name). Check the byte
  count, or `file` the result: a real PDF reports its page count, the soft 404 does not. This is the site's
  own "a 200 and a real file is not proof" rule, with a specific number attached.
- **Read PJM's Board Communications page every sweep, not just eLibrary and the committee pages.**
  `pjm.com/about-pjm/who-we-are/pjm-board/public-disclosures.aspx` carries the ex parte letters stakeholders
  send the Board and the Board's replies, and it has held large-load material all year. Three sweeps missed
  the Oct 2 CEBA and Data Center Coalition letter; the Nov 5 letters from ITI and from PJM's own chief
  executive sat there unread until 2026-11-11. The files are posted under the date they were POSTED, not the
  date on the letter (the Nov 5 letters both have Nov 6 file names), so take the date from page 1, not the
  filename. The listing page is JavaScript-rendered, so find entries by web search and curl the PDF directly.
- **A Microsoft sensitivity label in a PDF's metadata is not a confidentiality marking on the document.**
  PJM's Nov 5 CEO letter carries `MSIP_Label ... Name(Confidential - PJM Personnel Only)` whose `SetDate` is
  Nov 13 2025, a year before the letter: it is a stale Word template artifact, and PJM published the file on
  its own public disclosures page. A search agent flagged it as possibly non-public. Check the label's set
  date and where the file is published before treating it as a restriction.

- **YouTube's "en" auto-caption track can be a machine TRANSLATION.** When a video lists many `*-orig` tracks, plain
  `en` is translated text ("Novaya England", "the slaughterhouse case" for Trump v. Slaughter), and every quote from
  it is something nobody said. The strict verifier passed all 29 such quotes, because they were verbatim to the
  wrong text; an independent accuracy reviewer caught it. `fetch-video-transcripts.py` now takes `en-orig` and writes
  the track into each header; check the header before extracting from any transcript.
- **A verifier proves the quote is there, not that the tenet is true.** Round 1 found 11 tenets that overstated
  their quotes ("would expect to grant" as "promises", PJM citing reports as PJM's forecast, a supporter's quote
  under an against-tenet). Keep a reader who re-reads each quote in context in every refresh that adds tenets.

- **When a search agent reports a PDF as "unreadable", fetch it yourself before dropping it.** On 2026-11-02 the
  news agent flagged two pjm.com PDFs as snippet-only because WebFetch could not parse them; `curl` plus PyMuPDF
  read both in seconds, and they were the sweep's two best finds (the CEBA and Data Center Coalition letter of
  Oct 2, missed by three sweeps, and PJM's Members Committee legal report recording DOE's §202(c) orders). PJM's
  committee "regulatory report" PDF (`mc/<yyyy>/<yyyymmdd>/<yyyymmdd>-item-05c---pjm-regulatory-report.pdf`) is a
  monthly digest of every FERC and DOE action touching PJM; read it every sweep.
- **The eLibrary docket sheet is backed by an in-page API.** The Angular app POSTs to
  `/eLibraryWebAPI/api/Docket/GetSingleDocketSheet`, which succeeds inside the authenticated tab (it 401s from
  curl). The request body was not captured (XHR hooks installed after load see nothing until a new search runs),
  so the DOM extractor is still the route; capturing that body would let one in-page `fetch` read every docket.
- **X is a thin source for this docket.** The official FERC, PJM, MISO, SPP, CAISO, NYISO and ISO-NE accounts
  posted nothing substantive Oct 19 to Nov 2 beyond PJM's link to its own backstop release. The one elected
  official's statement came from a Top-tab search with `min_faves:100`, not from Latest. The bridge's output
  filter strips `& ? = ; %`, so re-read any quoted post on its own page before shipping (Van Hollen's `&` was
  lost in the search-list extraction).
- **Playwright without an install.** The repo has no dependencies; `NODE_PATH=<another project's
  node_modules/.pnpm/playwright@x/node_modules> node tools/uat-playwright.mjs` uses an existing copy and the
  cached Chromium, so no `npm install` (and no advisory sweep) is needed to run the harness on the laptop.

- **A promised refiling can land in a NEW docket, not the one it amends.** PJM's Oct 29 backstop refiling is ER27-330-000, not ER26-3380; the ER26-3380 sheet showed only FERC's notice, and rehearing requests went to ER26-3380-001. Only the general search by applicant (dates bracketing the promised day) found it. When a party promises "a section 205 filing", run the applicant search, and read the `-001` sheet of the order being challenged on its 30th day.
- **A "notice addressing" a motion is not a ruling on it.** FERC's Oct 23 notice on PJM's abeyance motion moved the brief dates (to Jan 11 and Jan 26, 2027) and granted nothing. Read the notice before writing "granted".
- **Check the published agenda before trusting a calendar a filing or order recites.** The Aug 14 abeyance order recorded an Oct 28 MC advisory vote; the Oct 28 agenda had no such item, and the consultation moved to a Nov 5 special MC. PJM's agenda PDFs are curl-able at `pjm.com/-/media/DotCom/committees-groups/committees/mc/<yyyy>/<yyyymmdd>[-special]/agenda.pdf` (the regular meeting also answers at `<yyyymmdd>-agenda.pdf`).
- **The eLibrary general search keeps its last query.** Re-navigating to `/eLibrary/search` showed the previous results with no form fields; click the "General Search" link first to get a fresh form, then fill it.
- **The Chrome bridge's javascript tool supports top-level `await`** (Oct 30), so the docket sweep can return its result in one call instead of stashing on `window`. Its output is truncated around 2-3K characters: drop `(doc-less)` intervention rows or shorten descriptions on busy sheets.

- **Track every PJM §205 filing the Board directs, not only the ones in the dockets you watch.** PJM's July 27 Board letter directed two filings, the backstop (ER26-3380) and the Interim Resource Adequacy Service package (ER26-3515, filed Aug 13). The site tracked the first and never the second, so FERC's Oct 9 order on it, the only FERC ruling on large-load tariff text since June 18, arrived with no filing event behind it. When a Board decisional letter or a press report names more than one filing, add each to the context lane the day it is filed. PJM's own FERC-filings page is JavaScript-rendered and useless to curl; the orders surface at `pjm.com/pjmfiles/directory/etariff/FercOrders/<n>/<yyyymmdd>-<docket>.pdf` (find `<n>` by web search for the filename) and the filings at `pjm.com/-/media/DotCom/documents/ferc/filings/<yyyy>/<yyyymmdd>-<docket>.pdf`, though not every filing is posted there (the Oct 12 abeyance motion was not, as of Oct 19).
- **The eLibrary WebAPI is not a back door.** The Angular shell loads from this container, and its config (`/eLibrary/assets/config/app-settings.json`) names a backend at `/eLibraryWebAPI/api/`, but `File/Login` returns 401 without a browser session and every data endpoint is behind it. Probed 2026-10-19; do not spend another sweep on it. The docket sheets still need the authenticated Chrome bridge and `tools/elibrary-sweep.js`.
- **A sweep without eLibrary must say so on every surface it touches.** The Oct 19 refresh shipped `signaled` rows in the filing matrix from the respondents' own documents and a window-check event that states the sheets were not read. "Nothing observed" from a sweep that could not observe is a different fact from "nothing filed", and the reader cannot tell them apart unless the copy does.

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
