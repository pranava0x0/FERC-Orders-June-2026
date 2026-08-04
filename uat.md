# UAT log — FERC Large Load Interconnection microsite

Learned-pathways log for the `ferc-uat` skill (`~/.claude/skills/ferc-uat/SKILL.md`). Do not
delete the "Learned pathways log" section below — it's the skill's memory across runs.

_Last run: 2026-08-03_

---

## Learned pathways log

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
