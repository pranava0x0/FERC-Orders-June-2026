# backlog.md

- **done (2026-06-22)** — Downloaded all six order PDFs through a real browser, OCR'd them, and folded
  quoted directives + paragraph cites into Tab 2 (195 FERC ¶ 61,211 to 61,216). Extract in
  `sources/orders-extract.json`.
- **done (2026-06-23)** — Page-citation links: each Tab 2 directive cite opens the committed order PDF
  (`docs/orders/`) at the page carrying its quoted text. Five-tab restructure (Overview/Timeline/
  Reforms/Dockets/Discourse) with a sticky tablist. Balanced commentary section in Discourse.
- **done (2026-06-23)** — Each directive cite now offers both options on click: a **PDF** link (the
  committed copy, opens inline to the page) and a **gov** link (the official ferc.gov source at the same
  page). Wanted both PDF and URL paths per citation.
- **done (2026-06-24)** — Reworked the Dockets tab to lead with **what's unique to each system**: a
  per-docket `unique` headline plus a variable-length distinct-findings list (4 to 6, intentionally not
  uniform), each finding order-text-supported. Added the **five concurring statements**
  (Swett/Rosner/See/Chang/LaCerte) as a "what each commissioner emphasized" block on Overview, extracted
  verbatim from the OCR'd order text and page-anchored to the PJM copy — so the medium "what each
  commissioner said" item is met from the written statements, no Cloudflare-gated PDF needed. Captured the
  **full named-respondent rosters** (45/30/22/24/16/9) and a compact per-docket Section IV "what FERC
  presses this system on." Refreshed Discourse with post-issuance analysis/critiques (Dajani/Cooley,
  Chatterjee, the live Maryland cost-allocation complaint). 23 tests; new guards for the per-system
  fields, roster counts, and commissioner-quote-verbatim.
- **high** — Summarize the RM26-4 public comments (staff reviewed 3,500+ pp). Scrape the eLibrary
  docket sheet for RM26-4-000 (browser bridge past Cloudflare), download each comment PDF, extract
  with fitz, then classify and summarize by stakeholder and position per reform category. Surface as
  a "What commenters said" section. Treat LLM summaries as provisional and cite accession numbers.
  Method in `summaries-plan.md` (Part A); shared Cloudflare access strategy at the top of that file.
- **partially done / medium** — The **written** "what each commissioner said" block is shipped from the
  five concurring statements appended to the orders (see done 2026-06-24). What remains is the **spoken**
  open-meeting version: Chairman Swett's dais framing and any remarks not in the written statements, from
  FERC's **YouTube** auto-caption transcript (`yt-dlp --write-auto-sub`, ungated), verified against the
  statement PDFs. Method in `summaries-plan.md` (Part B).
- **partially done / low** — Respondent lists are now captured **in full** per docket (done 2026-06-24)
  and a compact per-docket Section IV "what FERC presses this system on" ships. What remains: the deeper
  verbatim enumeration of every Section IV briefing question per order (PJM's were read in full; the other
  five were distilled from the verified directive set, not read end-to-end).
- **medium** — Add the FERC "Items E-7–E-12: RTO/ISO Show Cause Orders" presentation deck and the
  Quick Reference one-pager once retrievable (both currently Cloudflare-gated / not archived).
- **medium** — Track the 30-day informational reports and 60-day filings as they land in eLibrary;
  add a "compliance tracker" sub-view per docket (filed / pending / abeyance).
- **low** — `og:image` social card (JPG) rendered from the masthead for link previews.
- **low** — Dark theme token set (palette is defined; wire the toggle + JS re-paint).

### Critique / analysis leads (from the 2026-06-24 news refresh)

- **medium** — Develop the **non-RTO coverage gap** into an explicit "what's *not* covered" note:
  environmental advocates flag that utilities outside an RTO (Southeast — NC, TN, AL, GA) face only
  voluntary, not mandatory, compliance even amid heavy data-center buildout (pairs with Devin Hartman's
  non-RTO critique already in Discourse).
- **medium** — Vet and possibly surface the **demand-side / hyperscaler** framing (NVIDIA's June 18
  blog) and its **LBNL** claim that a 10% rise in state electricity consumption correlates with ~6¢/kWh
  lower retail prices. AI-industry PR plus a striking empirical claim — audit against the LBNL primary
  and label as contested before any use; do not ship the stat as fact.
- **low** — Add the **DOE statement applauding FERC** (energy.gov) and **E&E/Politico** coverage as
  reaction sources; consider a Bloomberg Law read ("Energy Regulator Staves Off Critique…") on how the
  orders were drafted to pre-empt the jurisdictional challenge.
- **low** — Capture the **state consumer-advocate** stranded-asset / timing-mismatch concern (PA, DE,
  NJ): near-term large-load need vs. the decades-long life of the gas plants and pipelines built to serve it.
