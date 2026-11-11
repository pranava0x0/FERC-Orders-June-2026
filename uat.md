# UAT log — FERC Large Load Interconnection microsite

Learned-pathways log for the `ferc-uat` skill (`~/.claude/skills/ferc-uat/SKILL.md`). Do not
delete the "Learned pathways log" section below — it's the skill's memory across runs.

_Last run: 2026-11-11_

---

## Learned pathways log

### Run 2026-11-11 (Nov 5 PJM letters; measured three UX candidates and changed none)

36 panel checks and 51 goal measurements at 375x812, 768x1024 and 1280x800: zero failures, zero console
errors, zero failed requests, no horizontal overflow, no `undefined`/`NaN`. The three new Nov 5 timeline
entries render with their source chips at all three widths, and both new quotes display.

Blocking first-load weight is **168 KB gzip** against the 220 KB budget (index 11, styles 17, core-data 95,
route 1, app 44), 52 KB of headroom. The backlog's "112 KB gzip data.js" is now 95 KB as `core-data.js`.
Deferred and unchanged: comments-data 106 KB, record-data 49 KB, news-data 19 KB.

**Three mobile costs were investigated and all three were left alone, which is the finding.** Prior sessions
already took the cheap wins here, so the remaining costs are deliberate or inherent:

| Candidate | Measured | Verdict |
|---|---|---|
| Filings `.jump-row` is `display:none` below 768px, so phones scroll instead of jumping (goals m, n cost 4.18 and 3.81 on mobile against 3 and 2.1 on tablet) | Showing it costs **294 px, 0.36 screens, across six wrapped button rows**, and pushes MISO LARS from 1.02 to 1.41 screens | Hiding is correct. Ten chips cost more than the scroll they save. |
| Commissioners goal l, 2.02 screens of scroll, the worst on mobile | The lead-in is only 381 px; `.appears` is a 11,709 px chronological list and the Oct 21 video sits several dated items below Nov 5 | Inherent to a dated list, not a defect |
| Discourse goal i, 1.49 screens on mobile against 0.17 on tablet | `.reader-leads` stacks to one column below 600 px: 688 px, 0.85 screens, for three cards | Editorial placement, not a bug. Demoting the lead is a curator's call, not a UAT fix. |

The lesson for the next run: measure the replacement before removing a deliberate `display:none`. Two of the
three candidates above looked like defects from the goal table alone and were not.


### Every tab: clicks and scroll, November 10

Fresh Overview for each journey. The phone (375×812) and tablet (768×1024) used touch; desktop (1280×800) used a mouse. Scroll is the total vertical distance, in screens, needed to bring controls and the final destination into view. App-driven jumps are excluded. No route required a sideways scroll. These are measured paths, not theoretical minimums.

| Tab | Verified destination | Taps or clicks | Phone scroll | Tablet scroll | Desktop scroll |
|---|---|---:|---:|---:|---:|
| Overview | Registry access: original page | 2 | 0.00 | 0.00 | 0.00 |
| Timeline | Latest event in the show-cause track | 3 | 0.00 | 0.00 | 0.00 |
| Reforms | Cost-shifting mandate | 2 | 1.38 | 0.00 | 0.58 |
| Dockets | PJM E-7 order page | 2 | 0.77 | 0.00 | 0.00 |
| Filings | Google’s MISO protest: original cited page | 4 | 1.85 | 0.00 | 0.00 |
| Commissioners | Rosner’s timestamped statement | 2 | 0.77 | 0.00 | 0.00 |
| Comments · Themes | PJM regional comment record | 2 | 1.31 | 0.00 | 0.62 |
| Comments · By issue | An issue and its first verbatim quote | 4 | 1.49 | 0.57 | 0.68 |
| Comments · Types | Expand a respondent roster | 3 | 0.00 | 0.00 | 0.00 |
| Comments · All | Find Constellation and read a quoted position | 4 + 1 text entry | 2.35 | 0.79 | 0.84 |
| Discourse | OPSI’s commission roll calls | 2 | 0.00 | 0.00 | 0.00 |

The E-7 link moved beside the order: phone scroll fell from 3.17 screens to 0.77; tablet and desktop fell from 1.40 and 1.60 to zero. Reaching the Comments policy map alone now takes two taps and zero scroll on every device (previous phone scroll: 1.92 screens). The quote row above goes further, opening a specific position. Search and reading a result remain the longest phone path.

The Filings check matches Google’s quoted words to the cited original page. The Commissioners check finds Rosner’s timestamp link; it does not test YouTube playback. Rapid issue changes were tested with both a late success and a late failure. Cold Overview used five requests and 171,686 bytes with per-response gzip, down from 187,570 bytes on #29 (8.5%). The 36 panel checks and 51 goal measurements are separate from these 33 click-throughs. Reproduce the HTML, JSON and Markdown views with the tab-interaction command in [REFRESH.md](REFRESH.md).

### Run 2026-11-10 (filing reading room, against PR #29)

At 375×812, 768×1024 and 1280×800, the three Overview questions opened the registry access rule (p. 124), exit liability (p. 36) and the one-site definition (p. 109) in one click each. Their citations opened the original page text on the second click. From Overview, News → state-commission tally took two clicks. The same source route worked with JavaScript disabled and a keyboard. The NYISO rehearing order’s Word reference also opened its qualification about defining large load, with JavaScript disabled at all three widths. All 425 Word-note reference links across 18 originals have a unique target. The existing 36 panel checks and 51 goal measurements passed on all three viewports.

Cold local Chrome, five requests on both versions: 187,570 bytes gzip for PR #29; 171,344 for this refresh (same per-response gzip method). The archive is fetched only through navigation. The News tables load on first opening News. Compact source headings reduced the registry reader from about 165 kB to 62 kB uncompressed while keeping all physical page anchors. Timings on this machine are not estimates of public mobile latency. Reproduce with the two browser commands in REFRESH.md.

### Run 2026-11-10 (PJM registry and backstop)

At 375×812, 768×1024 and 1280×800 the answer to what PJM filed was visible without scrolling or tapping. Each link opened the relevant proceeding with PJM already selected: one tap, no scroll to the first page citation. The Nov 16 deadline remained visible on load. On the phone the first §206 status line required 0.12 screens of scroll. All 36 panel checks and 51 goal measurements passed; no page errors, failed requests or horizontal overflow.

Compared cold Overview visits against PR #28 in the same local Chrome session: 7 requests → 5; about 1.33 MB → 0.66 MB uncompressed (344 kB → 187 kB with gzip level 9, calculated per requested file). The savings are from removing both idle prefetches. Opening a record tab still downloads its data on first use. Keyboard activation, reload at a specific filer, clearing that filter, recovery after a failed shared record request, and the no-JavaScript answer were checked separately. Stable Chrome 157.0.8103.39 had no `--no-sandbox` on either launch path.

### Run 2026-11-09 (headless harness at 375, 768 and 1280; same session as the Filings and Commissioners tabs)

**Context:** First run with a tablet viewport and eight tabs. Playwright borrowed from another project with a
cached headless shell via the new `PW_CHROME` (the borrowed 1.58/1.64 builds wanted browser builds not on disk).

**What was tested:** 36 panel checks and 42 goal measurements (14 goals × 3 viewports), before and after
collapsing the Filings tab and adding the filters.

**What was discovered:**
- Tab bar: 8 tabs needed ~1,160 px; at 1,024 Discourse was off-screen, and the phone grid overflowed 66 px.
  Fixed (issues.md 2026-11-09).
- Filings on a phone: ~100 screens with all proceedings open → 6.5 collapsed. Google's LARS position: 7.2 → 3
  taps with the filer chip. FERC's first Oct 9 holding: 2. Newest spoken quote: 1. One commissioner's quotes: 2.
  A video's contents: 3.6 phone, 2.7 tablet, 2.5 desktop.
- The June 18 statements moved off the Overview: goal d went 1 → 4.6 on a phone until a jump button was added
  on the Commissioners tab.
- 0 console errors, 0 failed requests, no overflow, no `undefined`/`NaN` at any width.

**Paths NOT yet tested (carry over):** keyboard-only through the new filter chips; a deep link to
`#commissioners/<key>` from a cold load on a slow connection (the lazy load path); the day-of-deadline boundary.

### Run 2026-11-02 (headless harness on the laptop, plus a throttled load-time pass; same session as the Nov 2 refresh)

**Context:** First laptop run of `tools/uat-playwright.mjs` (Playwright borrowed via `NODE_PATH`, see REFRESH.md).
Added a throttled load-time measurement (scratch script: mobile viewport, cache disabled, CDP network
emulation, 4x CPU slowdown, median of 3) against the live site and the branch.

**What was tested:** 20 panel checks and 18 goal measurements, before and after each change; cold deep links
to `#comments/c=<accession>` and `#comments/issue`; opening Comments then leaving before its data arrived.

**What was discovered:**
- Reader depth, mobile (taps + typed + swipes + screens of scroll): status 0, next deadline 0, filing matrix 1,
  commissioners 1, newest timeline event 2, EL26-67 PDF 1.28, by-issue map 3.96, a comment by org 4.03, newest
  Discourse quote **7.56 → 1.2** (desktop 4.1 → 1). The October lane had grown to 9 themes in append order, so the
  newest quote sat mid-lane; themes now sort newest-first inside each wave by their newest quoted source.
- Load, live site (main) on a mobile profile: LCP 0.30 s unthrottled, 0.88 s fast 4G, 1.88 s slow 4G, but the load
  event at 1.8 s and 6.5 s, held back by `comments-data.js` (114 KB gzip of 278 KB wire, loaded on every visit
  for one tab). It is now a `<link rel="prefetch">` that app.js executes on first open of Comments. Branch,
  uncompressed local server, before → after: load 5.9 → 3.4 s fast 4G, 22.9 → 13.0 s slow 4G; blocking first-load
  weight 287 → 178 KB gzip. `tests/page-weight.test.mjs` guards both the prefetch and a 220 KB gzip budget.
- 6 requests on first load (5 before the idle prefetch), 1,719 DOM nodes on the Overview, 15,279 once Comments
  renders (14,109 in the All-comments list). Zero console errors, zero failed requests, no `undefined`/`NaN`,
  no horizontal overflow at 375 or 1280.

**Paths NOT yet tested (carry over):** keyboard-only tablist navigation; 768px; the day-of-deadline boundary;
Comments opened on a connection slow enough that the prefetch has not finished (the loading line shows, then the
render; exercised only on a fast local server).

### Run 2026-10-19 (headless, `tools/uat-playwright.mjs`; same session as the Oct 8 to Oct 19 refresh)

**Context:** First run of the Playwright harness, built this session because the cloud container has no
preview MCP and no Chrome bridge. It automates REFRESH.md's console check (every tab and Comments sub-tab,
`undefined`/`NaN`, horizontal overflow, console, failed requests) at 375x812 and 1280x800, and measures
reader depth for nine goals as taps + swipes + screens of scroll from a fresh Overview load, choosing the
cheapest of several candidate paths per goal. Serve `docs/` on 127.0.0.1:8131 first; a run takes about
70 seconds and gave identical numbers on repeat.

**What was tested:** 20 panel checks and 18 goal measurements per run, four runs (before, after the
first fixes, after teaching the tool the new paths, after moving the timeline button).

**What was discovered:**
- One real defect, introduced by this refresh: the `pjmto1009` source chip rendered its 56-character
  org name as a `white-space: nowrap` chip, pushing the Overview 45px and the Timeline 64px past a 375px
  screen. Fixed with a `short` label on the source and `max-width: 100%` + ellipsis on every chip.
- Depth, mobile, before → after: newest timeline event 23.3 → 2 (a "Jump to the latest event" button
  above the track cards; each `.tl-item` now carries `id="tl-<iso>"`), filing matrix 7.9 → 1 and
  commissioner statements 5.7 → 1 (an "On this page" jump row of four buttons under the Overview head,
  buttons not hash links because the router owns the hash), latest Discourse quote 7.1 → 3.1 (the
  commentary section first and open), and the sideways swipe to reach Dockets, Comments and Discourse
  is gone (3x2 tab grid at ≤480px; the sticky bar is 92px there, so jump targets get a 104px
  scroll margin). Desktop: 11.0 → 2, 3.7 → 1, 3.0 → 1, 3.8 → 1.8.
- Load: 6 requests, 1,008 KB uncompressed, 100 to 135 ms to `load` on the local server; 1,548 DOM nodes
  on the Overview and 19,970 after every tab has rendered, 14,109 of them the All-comments list.
  `comments-data.js` is 48% of the bytes and loads on every visit (backlog).
- Unchanged and still fine: no `undefined`/`NaN` anywhere, zero console errors, zero failed requests.

**Paths that worked reliably:** `node tools/uat-playwright.mjs` with `python3 -m http.server 8131
--directory docs` running; `--json` for the full result object; `--out` for the two screenshots. The
tool exits 1 on any failure and 2 if the server is unreachable, and fails rather than passes over an
empty set.

**Paths NOT yet tested (carry over):** keyboard-only navigation through the tablist and the new jump
buttons (they are real buttons with visible focus, but nobody has tabbed through them); a comment-row
permalink round-trip; the 768px viewport; the day-of-deadline boundary.

### Run 2026-08-03 (first run — same session as the news refresh + commissioner-quote +
RTO/ISO-comment feature work it's testing)

**Context:** This run followed, in the same session, a news refresh (12 new eLibrary-verified
filings, 4 new timeline entries), a commissioner-quote provenance fix (the `commishAside`
mechanism, CAISO/Chang), and a new feature (per-RTO public-comment sections on the six
show-cause docket pages + a region-chip row on the Comments overview). Most of the browser
verification below happened organically while building those features, then was repeated
systematically here as the skill's actual first pass.

**What was tested:**
- BF-01 data integrity: `node --test tests/*.test.mjs` (109/109), `verify-quotes.mjs`
  (209 required + 17 prose, all verified), `verify-commish-tailoring.mjs` (25/25),
  `check-staleness.mjs` (nothing flagged) — all green
- BF-02 Overview (desktop + mobile 375px)
- BF-03 Timeline — all 5 track filter cards, newest events render with correct `as of` dates
- Reforms tab
- BF-04 Dockets — all 7 accordions opened at least once; commissioner block verified on E-7
  (5 commissioners, no aside) and E-10 (5 commissioners, Chang carries the CAISO aside
  additively, nobody drops off the list); "public comment record" section verified present
  with correct stance counts + working deep link on E-10 (CAISO), confirmed absent (not an
  empty placeholder) on E-2
- BF-05 all 7 static docket pages, desktop + mobile (CAISO)
- BF-06 Comments — all 4 sub-tabs (overview incl. new region-chip row, by-issue incl. a
  region deep-link landing correctly, respondent types, all-comments)
- The "Discourse" tab (see Patterns noticed — its real hash is `#news`)
- BF-08 console + network: zero errors, zero failed requests, across every tab visited

**What was discovered:**
- No new bugs. Everything built/fixed this session verified working: the CAISO
  `commishAside` renders additively (all 5 commissioners stay, Chang gets the extra block);
  all 6 show-cause docket pages' new comment sections show correct stance counts and a
  working `#comments/issue?id=rg:<key>` deep link; E-2 correctly has no comment section; the
  Comments-overview region-chip row renders with correct counts (64/27/37/7/6/6) and reflows
  to a 3-column grid at 375px.
- One naming surprise, not a bug: the tab labeled **"Discourse"** in the UI routes on hash
  **`#news`**, not `#discourse`. Typing `#discourse` directly silently does nothing (stays on
  whatever tab was already active) rather than 404ing or erroring — there's no fallback
  warning. Cost real time this run (assumed `#discourse` was a no-op bug before checking
  `app.js`'s `TABS` array). Not worth fixing — nobody types tab hashes by hand — but worth
  remembering so it isn't rediscovered from scratch next time.

**Paths that worked reliably:**
- `read_page` returns an empty `Viewport: 0x0` tree immediately after a fresh `navigate` —
  take one throwaway `computer screenshot` first, then `read_page` returns real content.
- Collapsed `<details>` (every docket card, every commissioner block) is invisible to
  `read_page filter: interactive`; `filter: all` finds the closed `<summary>`, but the
  reliable way to actually open one for content inspection is `javascript_tool` (inspection
  only, per its own scope) — e.g. `document.querySelectorAll('details.docket')`, find by
  `.textContent.includes(...)`, then the nested `.querySelector('details.dcom').open = true`.
  Each `.open = true` only affects that one `<details>`, not nested ones — open outer, then
  inner, separately.
- `127.0.0.1:8131`, never `localhost:8131` — confirmed the caching gotcha is still live.

**Paths NOT yet tested (carry over to next run):**
- Keyboard-only navigation through the six-tab tablist and into a docket accordion
- The "All comments" tag-filter AND-stacking and the search box narrowing behavior
- A comment-row permalink (`#comments/c=<accession>`) round-trip
- Tablet viewport (768px) — no tablet-specific breakpoint has been audited on this project yet
- `document.body.scrollHeight` on All-comments (273 rows) as a virtualization/perf signal
- The procedural-clock "Next deadline" banner's day-of-deadline boundary behavior (it showed
  "Aug 3, 2026" as still-next while today's date is itself Aug 3 — plausibly correct
  inclusive-boundary behavior, not confirmed as intentional vs. accidental)
