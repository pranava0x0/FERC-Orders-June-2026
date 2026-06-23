# backlog.md

- **done (2026-06-22)** — Downloaded all six order PDFs through a real browser, OCR'd them, and folded
  quoted directives + paragraph cites into Tab 2 (195 FERC ¶ 61,211 to 61,216). Extract in
  `sources/orders-extract.json`.
- **done (2026-06-23)** — Page-citation links: each Tab 2 directive cite opens the committed order PDF
  (`docs/orders/`) at the page carrying its quoted text. Five-tab restructure (Overview/Timeline/
  Reforms/Dockets/Discourse) with a sticky tablist. Balanced commentary section in Discourse.
- **high** — Summarize the RM26-4 public comments (staff reviewed 3,500+ pp). Scrape the eLibrary
  docket sheet for RM26-4-000 (browser bridge past Cloudflare), download each comment PDF, extract
  with fitz, then classify and summarize by stakeholder and position per reform category. Surface as
  a "What commenters said" section. Treat LLM summaries as provisional and cite accession numbers.
  Method is written up in `comments-scrape-plan.md`.
- **medium** — Parse the June 18, 2026 open-meeting record: pull each commissioner's statement (Swett,
  Rosner, See, Chang, LaCerte) and the meeting transcript/webcast for items E-7 to E-12, and surface a
  short "what each commissioner said" block. Source is Cloudflare-gated; use the browser bridge.
- **low** — Mine the orders' Section IV "Briefing Questions" for a per-docket "what FERC is asking"
  sub-list; capture the named transmission-owner respondent lists in full.
- **medium** — Add the FERC "Items E-7–E-12: RTO/ISO Show Cause Orders" presentation deck and the
  Quick Reference one-pager once retrievable (both currently Cloudflare-gated / not archived).
- **medium** — Track the 30-day informational reports and 60-day filings as they land in eLibrary;
  add a "compliance tracker" sub-view per docket (filed / pending / abeyance).
- **low** — `og:image` social card (JPG) rendered from the masthead for link previews.
- **low** — Dark theme token set (palette is defined; wire the toggle + JS re-paint).
