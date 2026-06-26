# LEARNINGS.md — what this session taught (FERC large-load build)

Durable, reusable lessons from building this microsite. Scoped to things that cost real time or
tokens here and will recur. Project-specific retrieval notes also live in the session memory; the
run-by-run numbers are in [`agent-runs.md`](agent-runs.md); per-bug detail is in [`issues.md`](issues.md).

## Retrieval — Cloudflare-gated government documents

- **ferc.gov / cms.ferc.gov sit behind a Cloudflare "Just a moment" JS challenge.** It returns
  **HTTP 403** to *every* automated client: `curl`, WebFetch, the PDF-fetch MCP, and the Wayback
  Save-Page-Now crawler (520). Don't burn attempts cycling user-agents/headers — none pass it.
- **The reliable path is a real browser the user already has.** It holds the Cloudflare clearance
  cookie. Either (a) the user downloads the PDFs and you read them from `~/Downloads`, or (b) you fetch
  same-origin from a logged-in tab. The on-machine PDF-fetch tool still 403s because it doesn't carry
  the browser's cookie.
- **`Control_Chrome` can `open_url`/`list_tabs` but not run JS** until Chrome's
  *View ▸ Developer ▸ Allow JavaScript from Apple Events* is checked — a **security setting only the
  user can toggle** (I can't, and shouldn't). The misleading error is "Google Chrome is not running."
- **`computer-use` `request_access` timed out (300 s, backend unresponsive)** in this environment, and
  the Claude-in-Chrome extension wasn't connected — so neither was a viable fallback. Don't assume
  computer-use is available; probe once, then move on.
- **The Internet Archive has the FERC *HTML* pages but not the order PDFs.** Pull the raw snapshot with
  the `…id_/` modifier and `gzip.decompress` it yourself (Wayback replays the original gzip bytes
  without a matching `Content-Encoding`, so `curl --compressed` won't auto-decode).

## Extraction — never LLM-transcribe a text-layer PDF

- **The single most expensive mistake here:** a 6-agent workflow read six ~100-page order PDFs
  page-by-page to dump their full text. It burned **~974K tokens / 412 tool calls, hit the session
  limit, and wrote nothing.** A 30-line PyMuPDF script did the identical job in **~2 s for 0 tokens.**
- **Rule:** if a PDF has an embedded text layer (these did — the MCP extracted clean text incl.
  footnotes), extract it **deterministically** (`fitz` / `pdfplumber` / `pdftotext`). Check for those
  libs *first* (`python3 -c "import fitz"`). Spend LLM tokens only on *judgement* (which passages
  matter, what they mean), never on mechanical OCR-dump work a library does for free and more reliably.
- **Agent fan-out economics:** parallel agents shine for *judgement at breadth* (Run 1 — extract the
  directives that matter from 6 orders, 437K tokens, well spent). They are the wrong tool for bulk
  transcription. And a big fan-out can fail *wholesale* on a session token limit — returning nothing —
  so prefer deterministic/local for bulk.

## Provenance for citation-grade / regulatory work

- **Link the fixed snapshot, not the live page.** Live gov pages drift or gate (403); a regulatory
  reader must reach the exact text a claim was checked against. Carry an `archiveUrl` and have source
  chips prefer it; keep the live URL as secondary context.
- **Separate evidence tiers visibly** (primary FERC / primary DOE / secondary analysis) and register
  *every* secondary source with an exact capture date and a scope note ("backs Tab 3 reception only,
  never a primary finding"). Reviewers will (correctly) reject month-level dates and un-listed sources.
- **Verify against an independent oracle, then lock it with a test.** After extracting quotes via an
  agent, the full text from a *deterministic* extractor is the oracle: assert every quote appears
  verbatim there (we got 53/53; the 5 near-misses were curly-vs-straight apostrophes and one dropped
  OCR footnote marker). A regression test that re-checks this each run beats "trust the agent."
- **Caption-verify before trusting content.** For each order, confirm the page-1 caption (reporter
  cite, respondent, docket, "Order Instituting Proceeding Under Section 206," issued date) before using
  any of its text. Six *sequential* reporter cites (61,211→61,216) that also match the docket→RTO map is
  strong evidence against hallucination — internal consistency a fabricator wouldn't reproduce.
- **Commit the machine-readable text, strip trailing whitespace.** Save extracted text so it's reusable
  and diffable; `rstrip` each line so `git diff --check` stays clean and future source diffs are
  reviewable.
- **Never claim "identical across N sources" from a spot-check — verify across all N.** The commissioner
  statements were labeled "identical across all six orders" on the strength of one distinctive sentence
  appearing once per order. A PR-review-driven test that checked *every* written quote against *all six*
  order texts found they're **largely common but not identical** (a few sentences are tailored per region).
  Verify the actual claim you display, then weaken it to what the data supports ("largely common, with
  per-order tailoring") and cite the specific copy you quoted from. The strengthened test now both guards
  fidelity and keeps the claim honest.
- **Auto-caption transcripts are not citation-grade.** `yt-dlp --write-auto-subs` is great for *what was
  said* but mangles proper nouns (it rendered "Swett"→"Sweatt", "LaCerte"→"LaFleur"). Use spoken quotes to
  capture emphasis the written record lacks, but label them "spoken · auto-caption," tint them distinctly,
  and keep them out of the verbatim test — only the written record is verbatim-checkable.
- **A strengthened test is the best way to "address a review."** Two PR-review findings (the "identical"
  overclaim; the briefing § IV page cite being range-checked only) were resolved by making the *test*
  stricter — check all six orders; assert the cited page actually carries the "Briefing Questions" heading.
  The bug surfaces, the fix is forced, and the guard stays.

## Page-deep links into the order PDFs

- **FERC's published order PDFs drop their paragraph numbers from the text layer.** `fitz` recovers the
  body text and inline footnote superscripts, but the marginal paragraph numbers — the "P 77" a cite
  points to — aren't in the text at all, so a paragraph cite *cannot* be resolved to a page by number.
  Anchor instead to **the page where the quoted directive text appears**, located by splitting the
  extract on its `--- PAGE N ---` markers. A test asserts each linked page actually carries the quote,
  via longest-common-substring tolerant of inline footnote breaks (`technologies154 as`).
- **Printed footer page == physical PDF page in the order body**, so `#page=N` lands true. But the
  appendices / commissioner separate statements at the end restart their own numbering (footer "6" on
  physical p.112). Treat a page as "body" only when footer-number == physical-number, and ignore the
  tail when choosing among multiple quote matches. The front-matter summary (¶ 6) restates every
  directive, so for a high-numbered cite prefer the later, substantive occurrence.
- **`#page=N` only works on an inline, same-origin PDF.** ferc.gov is Cloudflare-gated and may force a
  download, which drops the fragment. Committing the six PDFs under `docs/orders/` and serving them with
  the site (the user OK'd shipping the PDFs) makes the links reliable; keep a visible `ferc.gov` link to
  the official source and list it in provenance.

## Layout — tabs above the fold on mobile

- **A standalone KPI band + a tall masthead pushes the tablist below the fold.** Folding the stats into
  a first "Overview" tab and shrinking the masthead brings the tabs up. Make the tablist
  `position: sticky; top: 0` with `overflow-x: auto` so five tabs scroll in one row on a 375px screen
  instead of wrapping, and on a tab switch scroll back to the tablist (`main.offsetTop`) so a short
  panel starts at the top rather than stranded mid-page.

## Small things that mattered

- **Don't put a dash range separator between dash-containing identifiers.** `EL26-67-000 – EL26-72-000`
  and `E-7 – E-12` read ambiguously; use **"to"**.
- **macOS filesystem is case-insensitive** — a project `design.md` collides with `DESIGN.md`; name it
  `design-notes.md`.
- **Static data via `<script>` global, not `fetch`.** For a GitHub Pages *project* site, an in-page
  `window.FERC_DATA` object dodges base-path and CORS/`file://` issues entirely; no build step.

## Bulk comment retrieval + analysis (RM26-4 docket — 272 of 273 bodies)

- **eLibrary bulk download hinges on one Chrome setting.** The docket sheet and file lists render past
  Cloudflare in the user's logged-in Chrome, but downloading *every* comment body is blocked by Chrome's
  *multiple automatic downloads* protection. Allow it for the site
  (`chrome://settings/content/automaticDownloads`), then a hidden-iframe grinder
  (`tools/grind-comment-downloads.js`) clicks each file link. Without that permission iframe downloads
  fail silently — the click "succeeds" and finds the link, yet nothing lands in `~/Downloads`.
- **Concurrency is the failure knob, not a hard wall.** Three Angular file-list bootstraps at once starve
  the renderer and ~25–30% miss the link-wait on the first pass. Retry the `window.__g.fail` set at lower
  concurrency + a longer wait; a final 1-worker pass clears the stragglers.
- **Two filename quirks corrupt the audit trail silently.** A `;` in a name is truncated by Chrome at the
  Content-Disposition separator (`"RM26-4; Antora….pdf"` → `RM26-4`, no extension) — heal it from the PDF
  magic bytes. And eLibrary appends a `" *"` availability marker to some link labels, so an *ends-with*
  `.pdf` regex skips them — strip the marker first. Both hid real comments until validation.
- **Validate against the inventory, not a count.** `tools/validate-comments.py` checks every inventoried
  comment has a body on disk, every PDF opens, and every body has real extracted text. It caught three
  defects a raw count (270/271) had masked: a truncated filename plus two empty-inventory filings (a
  `GetFileListFromP8` gap). A clean count is not a clean corpus.
- **Name files by submitter.** `files/<accession>__<org-slug>/` makes a path name who filed it; keep the
  accession the stable key and resolve a dir from it everywhere (the org slug can change, the accession won't).
- **Tag cheaply and deterministically before reaching for an LLM.** Per-comment reform-principle (5) and
  order-region (6) tags are keyword regex over the extracted body — instant, free, fully auditable. Reserve
  the LLM read for depth (the nine flagships); label the keyword layer "prevalence," not a coded position.
- **OCR is the remaining gap.** Four filings are image-only scans (0 text layer); flagged OCR-pending — no
  local OCR tool, so they are surfaced honestly rather than silently counted as extracted.
