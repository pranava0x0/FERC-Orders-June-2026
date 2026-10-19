# UAT log — FERC Large Load Interconnection microsite

Learned-pathways log for the `ferc-uat` skill (`~/.claude/skills/ferc-uat/SKILL.md`). Do not
delete the "Learned pathways log" section below — it's the skill's memory across runs.

_Last run: 2026-10-19_

---

## Learned pathways log

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
