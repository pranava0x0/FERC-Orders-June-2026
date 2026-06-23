/* FERC Large Load Show Cause Orders — single source of truth.
 * Loaded as a plain script (no fetch / no build step) so it works on GitHub Pages
 * project paths and from file:// without CORS. Rendered by app.js.
 *
 * Provenance tiers per record/source:
 *   'ferc'     — quoted/paraphrased FERC issuance text (press release, fact sheet, summaries, RM26-4)
 *   'doe'      — the DOE §403 letter / ANOPR (primary PDF, OCR-extracted)
 *   'analysis' — our synthesis from cited primary + secondary sources (visibly distinguished in UI)
 */
window.FERC_DATA = (function () {
  const SOURCES = {
    doe403: {
      label: "DOE §403 Letter & enclosed ANOPR",
      org: "U.S. Dept. of Energy (Sec. Chris Wright)",
      tier: "doe",
      url: "https://www.energy.gov/sites/default/files/2025-10/403%20Large%20Loads%20Letter.pdf",
      captured: "2026-06-22",
      note: "16-pp. primary PDF, downloaded from energy.gov and text-extracted.",
    },
    fercPR: {
      label: "News Release — “FERC Launches Aggressive Targeted Action to Speed Large Load Integration”",
      org: "FERC, Office of External Affairs",
      tier: "ferc",
      url: "https://www.ferc.gov/news-events/news/ferc-launches-aggressive-targeted-action-speed-large-load-integration",
      archiveUrl: "http://web.archive.org/web/20260618211730/https://www.ferc.gov/news-events/news/ferc-launches-aggressive-targeted-action-speed-large-load-integration",
      captured: "2026-06-18 (Internet Archive)",
      note: "Live page is Cloudflare-gated; chip opens the fixed June 18, 2026 Wayback snapshot the text was checked against.",
    },
    fercFS: {
      label: "Fact Sheet — “FERC Takes Action to Supercharge America’s Grid…”",
      org: "FERC",
      tier: "ferc",
      url: "https://www.ferc.gov/news-events/news/fact-sheet-ferc-takes-action-supercharge-americas-grid-efficiency-reliability-and",
      archiveUrl: "http://web.archive.org/web/20260620020229/https://www.ferc.gov/news-events/news/fact-sheet-ferc-takes-action-supercharge-americas-grid-efficiency-reliability-and",
      captured: "2026-06-20 (Internet Archive)",
      note: "Enumerates the five categories, the 30/60-day deadlines, the jurisdictional boundary and the regional distinctions verbatim. Chip opens the fixed snapshot.",
    },
    fercSum: {
      label: "Summaries — June 2026 Commission Meeting",
      org: "FERC, Office of External Affairs",
      tier: "ferc",
      url: "https://www.ferc.gov/news-events/news/summaries-june-2026-commission-meeting",
      archiveUrl: "http://web.archive.org/web/20260618204955/https://www.ferc.gov/news-events/news/summaries-june-2026-commission-meeting",
      captured: "2026-06-18 (Internet Archive)",
      note: "Confirms the item→RTO→docket mapping and the related E-2 / E-6 agenda items. Chip opens the fixed snapshot.",
    },
    fercRM264: {
      label: "Docket RM26-4-000 landing page — “Interconnection of Large Loads…”",
      org: "FERC",
      tier: "ferc",
      url: "https://www.ferc.gov/rm26-4",
      archiveUrl: "http://web.archive.org/web/20260619085932/https://www.ferc.gov/rm26-4",
      captured: "2026-06-19 (Internet Archive)",
      note: "DOE Oct. 23, 2025 §403 directive; >20 MW definition; four summarized ANOPR questions; comment period extended (page last updated Jan 13, 2026). Chip opens the fixed snapshot.",
    },
    // The six order PDFs — downloaded via browser (past Cloudflare) and OCR'd; page-1 captions verified.
    e7: { label: "Order E-7 (PJM) — EL26-67-000 · 195 FERC ¶ 61,211", org: "FERC", tier: "order", url: "https://www.ferc.gov/media/e-7-el26-67-000", captured: "2026-06-22", note: "Downloaded & OCR'd — 114 pp; §206 order, issued June 18, 2026; caption verified." },
    e8: { label: "Order E-8 (MISO) — EL26-70-000 · 195 FERC ¶ 61,212", org: "FERC", tier: "order", url: "https://www.ferc.gov/media/e-8-el26-70-000", captured: "2026-06-22", note: "Downloaded & OCR'd — 115 pp; §206 order, issued June 18, 2026; caption verified." },
    e9: { label: "Order E-9 (SPP) — EL26-68-000 · 195 FERC ¶ 61,213", org: "FERC", tier: "order", url: "https://www.ferc.gov/media/e-9-el26-68-000", captured: "2026-06-22", note: "Downloaded & OCR'd — 92 pp; §206 order, issued June 18, 2026; caption verified." },
    e10: { label: "Order E-10 (CAISO) — EL26-71-000 · 195 FERC ¶ 61,214", org: "FERC", tier: "order", url: "https://www.ferc.gov/media/e-10-el26-71-000", captured: "2026-06-22", note: "Downloaded & OCR'd — 118 pp; §206 order, issued June 18, 2026; caption verified." },
    e11: { label: "Order E-11 (ISO-NE) — EL26-72-000 · 195 FERC ¶ 61,215", org: "FERC", tier: "order", url: "https://www.ferc.gov/media/e11-el26-72-000", captured: "2026-06-22", note: "Downloaded & OCR'd — 115 pp; §206 order, issued June 18, 2026; caption verified." },
    e12: { label: "Order E-12 (NYISO) — EL26-69-000 · 195 FERC ¶ 61,216", org: "FERC", tier: "order", url: "https://www.ferc.gov/media/e12-el26-69-000", captured: "2026-06-22", note: "Downloaded & OCR'd — 119 pp; §206 order, issued June 18, 2026; caption verified." },
    akin: { label: "“FERC Issues Landmark Show Cause Orders on Large Load Interconnection”", org: "Akin Gump (Speaking Energy)", tier: "secondary", url: "https://www.akingump.com/en/insights/blogs/speaking-energy/ferc-issues-landmark-show-cause-orders-on-large-load-interconnection", captured: "2026-06-22", note: "Law-firm client alert." },
    sheppard: { label: "“FERC Orders Six RTOs to Address Specific Reforms… Speed to Power”", org: "Sheppard Mullin", tier: "secondary", url: "https://www.sheppard.com/insights/blogs/ferc-orders-six-rtos-to-address-specific-reforms-to-effectuate-speed-to-power-that-will-facilitate-the-integration-of-large-loads", captured: "2026-06-22", note: "Law-firm client alert." },
    whitecase: { label: "“PJM proposes to carve out new services for co-located data centers”", org: "White & Case", tier: "secondary", url: "https://www.whitecase.com/insight-alert/pjm-proposes-carve-out-new-services-co-located-data-centers", captured: "2026-06-22", note: "Co-location context (PJM EL25-49 line)." },
    natlaw: { label: "“FERC Acts on Large Load Integration — Key Issues Addressed”", org: "National Law Review", tier: "secondary", url: "https://natlawreview.com/article/ferc-acts-large-load-integration-key-issues-addressed", captured: "2026-06-22", note: "Source of the derived procedural calendar dates." },
    aaf: { label: "“FERC Data Center Orders Accelerate Grid Connection”", org: "American Action Forum", tier: "secondary", url: "https://www.americanactionforum.org/insight/ferc-data-center-orders-accelerate-grid-connection/", captured: "2026-06-22", note: "Policy analysis; §206-vs-NOPR timeline framing." },
    utilitydive: { label: "Utility Dive — large-load / co-location coverage", org: "Utility Dive", tier: "secondary", url: "https://www.utilitydive.com/news/ferc-doe-data-center-interconnection/823360/", captured: "2026-06-22", note: "Trade press; cost-recovery-agreement and generator-reaction reporting." },
    rtoinsider: { label: "“FERC Directs RTOs to Fix Large Load Interconnections as Answer to DOE ANOPR”", org: "RTO Insider", tier: "secondary", url: "https://www.rtoinsider.com/134751-ferc-issues-show-cause-orders-iso-rtos-large-load/", captured: "2026-06-22", note: "Trade press." },
    latitude: { label: "“FERC to grid operators: Connect large loads to transmission faster”", org: "Latitude Media", tier: "secondary", url: "https://www.latitudemedia.com/news/ferc-to-grid-operators-connect-large-loads-to-transmission-faster/", captured: "2026-06-22", note: "Trade press." },
    tdworld: { label: "“FERC Orders ‘Aggressive Targeted Action’ to Speed Power…”", org: "T&D World", tier: "secondary", url: "https://www.tdworld.com/transmission-reliability/article/55385369/ferc-orders-aggressive-targeted-action-to-speed-power-to-support-data-centers", captured: "2026-06-22", note: "Trade press." },
    powermag: { label: "“FERC Orders All Six Regional Grid Operators to Justify or Rewrite Large-Load Tariffs”", org: "POWER Magazine", tier: "secondary", url: "https://www.powermag.com/ferc-orders-all-six-regional-grid-operators-to-justify-or-rewrite-large-load-tariffs/", captured: "2026-06-22", note: "Trade press; 200M Americans / 31+ states framing." },
    rew: { label: "“FERC takes historic action… ‘defend or revise’ large load interconnection tariffs”", org: "Renewable Energy World", tier: "secondary", url: "https://www.renewableenergyworld.com/energy-business/policy-and-regulation/ferc-takes-historic-action-orders-us-grid-operators-to-defend-or-revise-large-load-interconnection-tariffs/", captured: "2026-06-22", note: "Trade press." },
    substack: { label: "“FERC Kicks off a Transparency Wave on Large Load Interconnection”", org: "Arushi Sharma Frank (Substack)", tier: "secondary", url: "https://arushisharmafrank.substack.com/p/ferc-kicks-off-a-transparency-wave", captured: "2026-06-22", note: "Independent policy commentary; abeyance/pause mechanics, no-show/stranded-cost framing, coverage-gap observations." },
  };

  const meta = {
    title: "Large Load Interconnection",
    subtitle: "From the DOE §403 ANOPR (Docket RM26-4-000) to FERC’s June 18, 2026 tailored §206 show cause orders",
    items: "Items E-7 to E-12 · Dockets EL26-67-000 to EL26-72-000",
    capture: "2026-06-22",
    authority: "Federal Power Act § 206 · DOE Organization Act § 403",
    citeRange: "195 FERC ¶ 61,211 – 61,216",
    commissioners: "Laura V. Swett (Chairman) · David Rosner · Lindsay S. See · Judy W. Chang · David LaCerte",
  };

  const kpis = [
    { value: "6", label: "RTOs / ISOs", sub: "all FERC-jurisdictional grid operators + their TOs" },
    { value: "5", label: "Reform categories", sub: "teed up in each tailored order" },
    { value: "30 days", label: "Informational report", sub: "resource-adequacy plan to serve large loads", deadline: true },
    { value: "60 days", label: "Justify or file", sub: "defend tariffs or propose §206 revisions", deadline: true },
    { value: "> 20 MW", label: "“Large load”", sub: "DOE threshold (per Order No. 2003)" },
    { value: "3,500+", label: "Pages reviewed", sub: "public comments in the RM26-4 docket" },
  ];

  /* ---------------------------------------------------------------- TAB 1 */
  const timeline = [
    {
      date: "Oct 23, 2025", iso: "2025-10-23", kind: "doe",
      title: "DOE issues a § 403 directive + enclosed ANOPR",
      body: "Energy Secretary Chris Wright, invoking § 403 of the DOE Organization Act (42 U.S.C. § 7173) — a rarely used authority letting the Secretary propose rules within FERC’s jurisdiction — directs FERC to initiate rulemaking on the “timely and orderly” interconnection of large loads (data centers, AI, advanced manufacturing) to the interstate transmission system. The letter asserts that load interconnection to transmission falls “squarely within” FERC jurisdiction even though FERC has historically not asserted it, and asks for final action no later than April 30, 2026.",
      src: ["doe403", "fercRM264"],
    },
    {
      date: "Oct 23, 2025", iso: "2025-10-23b", kind: "doe",
      title: "Fourteen ANOPR principles define the reform menu",
      body: "The enclosed ANOPR sets large loads at > 20 MW (mirroring Order No. 2003 large generators) and lays out 14 principles: study loads with proximate generation, standardized study deposits / readiness / withdrawal penalties, hybrid (load+generation) facilities studied by injection/withdrawal rights, expedited study for curtailable loads (could studies finish in 60 days?), 100% network-upgrade cost responsibility with an open question on crediting, SSR/RMR-type review when an existing plant partially suspends to serve a co-located load, and a transition plan for pending requests.",
      src: ["doe403"],
    },
    {
      date: "Late 2025 – Jan 2026", iso: "2026-01-13", kind: "milestone",
      title: "FERC opens RM26-4-000, takes comment, extends the period",
      body: "FERC opens Docket RM26-4-000 in response to the § 403 proposal and seeks comment on DOE’s principles, then issues a notice extending the comment period. Staff ultimately reviews more than 3,500 pages of public comment. (RM26-4 landing page last updated Jan 13, 2026.)",
      src: ["fercRM264", "fercPR"],
    },
    {
      date: "Dec 2025 – Jun 2026", iso: "2025-12-18", kind: "milestone",
      title: "Track record builds: PJM co-location order + SPP HILL/HILLGA",
      body: "The show cause orders build on a live record. FERC’s PJM Co-Location Order (193 FERC ¶ 61,217, Dec. 18, 2025; rehearing 195 FERC ¶ 61,209; compliance accepted Apr. 16, 2026, 195 FERC ¶ 61,030) created three new services — Interim NITS, Firm and Non-Firm Contract Demand — that the §206 orders now extend to the other regions. SPP’s HILL study process, its HILLGA generation assessment (accepted Jan. 14, 2026, 194 FERC ¶ 61,031), and its Conditional HILL Service (accepted June 5, 2026) become the working template for categories 1 and 5.",
      src: ["e7", "e9", "fercPR"],
    },
    {
      date: "Jun 18, 2026", iso: "2026-06-18", kind: "ferc",
      title: "FERC issues six tailored § 206 show cause orders (E-7 to E-12)",
      body: "At its open meeting, FERC unanimously issues six tailored §206 show cause orders — PJM (195 FERC ¶ 61,211), MISO (¶ 61,212), SPP (¶ 61,213), CAISO (¶ 61,214), ISO-NE (¶ 61,215), NYISO (¶ 61,216), 92–119 pages each, Commissioners Swett, Rosner, See, Chang, LaCerte. Each ‘Order Instituting Proceeding Under Section 206’ runs the same spine — III.A transmission service for large loads · III.B cost-shifting risk · III.C co-location & behind-the-meter generation · III.D services for flexible loads · III.E interconnection for electrically proximate / co-located load · III.F informational report · IV briefing questions — applied to each region’s own tariff.",
      src: ["e7", "e8", "e9", "e10", "e11", "e12"],
    },
    {
      date: "≈ Jul 18, 2026", iso: "2026-07-18", kind: "deadline",
      title: "30-day informational report due",
      body: "Within 30 days, each RTO/ISO and its TOs must file a detailed informational report on how it will ensure adequate generation is available to serve existing and new large loads — including any resource-adequacy proposals under consideration in its stakeholder process, a milestone schedule with the estimated FERC-filing date, and any ongoing efforts to speed new capacity. (Calendar date derived from the June 18 issuance; one analysis pegs the business-day-adjusted due date at July 20, 2026.)",
      src: ["fercFS", "fercPR", "natlaw"],
    },
    {
      date: "≈ Aug 17, 2026", iso: "2026-08-17", kind: "deadline",
      title: "60-day justification or tariff filing due",
      body: "Within 60 days, each grid operator and its TOs must either show cause why its current tariff stays just and reasonable absent clear, consistent large-load provisions, or explain the §206 tariff changes that would remedy the concerns (Ordering Para (B)). The orders also set a 21-day intervention deadline (Rule 214), a 30-day window for responses after the operators file, and — in the NYISO order — a 45-day deadline to request abeyance of up to 90 days (NYISO P 42). The refund effective date is the order’s Federal Register publication date.",
      src: ["e7", "e12", "natlaw"],
    },
  ];

  const toplines = [
    {
      h: "Why § 206 show cause orders, not a generic NOPR",
      tier: "analysis",
      body: [
        "A notice-and-comment rulemaking on the ANOPR could run 2–5 years to a final rule and then compliance. FERC instead used the Federal Power Act’s § 206 “show cause” mechanism: it makes a threshold finding that the existing tariffs may be unjust and unreasonable for want of large-load provisions, and shifts the burden onto each RTO/ISO to defend the status quo or file a fix on a 60-day clock.",
        "The move converts DOE’s April 30, 2026 “final action” deadline into concrete, near-term obligations across all six markets at once — speed-to-power by procedure, not just by policy. It also keeps FERC on firmer jurisdictional ground than a one-size rule: § 206 lets the record build market-by-market.",
      ],
      src: ["fercPR", "aaf", "akin"],
    },
    {
      h: "Tailored, not uniform — federalism toward the RTOs",
      tier: "analysis",
      body: [
        "FERC expressly rejected a one-size-fits-all rule, citing differences in each operator’s market design, stakeholder composition, geography, and progress to date. Each order carries the same five-category template but lets each RTO define “large load” and set region-specific operational requirements.",
        "That respect for regional variation is both substantive (SPP’s HILL and CAISO’s non-Order-888 service model genuinely differ) and strategic: tailored orders are harder to attack as arbitrary on rehearing than a single generic rule imposed across six unlike markets.",
      ],
      src: ["fercPR", "fercFS"],
    },
    {
      h: "The consumer-protection spine: cost causation + transparency",
      tier: "analysis",
      body: [
        "Running through all five categories is one worry — that the cost of connecting multi-hundred-MW loads lands on ordinary ratepayers. FERC’s answer is cost causation made visible: pro forma cost-recovery agreements so large loads bear network-upgrade risk, plus transparency into how upgrade costs are identified, allocated, and communicated.",
        "Chairman Laura V. Swett framed it as doing both at once — investor certainty (protect existing deals) and consumer safeguards (guard against cost-shifting). The orders pair the speed mandate with that ratepayer guardrail rather than trading one for the other.",
      ],
      src: ["fercPR", "utilitydive", "substack"],
    },
  ];

  /* ---------------------------------------------------------------- TAB 2 */
  const categories = [
    {
      n: 1, key: "study",
      title: "Application & study processes (incl. alternative transmission technologies)",
      ferc: "Developing efficient transmission-service application and study processes, including consideration of alternative transmission technologies.",
      detail: "Each RTO must show an efficient, non-discriminatory path for a large load to request transmission service and be studied — and must consider grid-enhancing / alternative transmission technologies (e.g., reconductoring, dynamic line ratings, advanced power-flow control) before defaulting to conventional network upgrades. The DOE ANOPR roots this in the Order No. 2003 / 2023 generator-interconnection toolkit: standardized study deposits, readiness requirements, and withdrawal penalties to deter speculative ‘phantom’ load requests and sharpen demand forecasting.",
      doe: ["Limit reforms to interconnections directly to transmission (seven-factor test).", "Standardized study deposits, readiness requirements, withdrawal penalties.", "Same option-to-build afforded to generator interconnection customers."],
      src: ["fercFS", "fercPR", "doe403"],
    },
    {
      n: 2, key: "cost",
      title: "Cost-shifting prevention & transmission-cost transparency",
      ferc: "Preventing cost shifting and requiring transparency into transmission costs.",
      detail: "FERC flags a lack of transparency in how RTOs assign and recover network-upgrade costs, and an absence of pro forma cost-recovery agreements that put the risk and cost of upgrades on the large-load customer. The remedy is cost causation made auditable: identify, allocate, and communicate the cost of serving large loads so they don’t migrate onto other transmission customers’ bills. The DOE principles supply the mechanics — 100% network-upgrade responsibility (with an open question on crediting over a term), transmission service billed on withdrawal rights, and ancillary services on peak demand without netting co-located generation.",
      doe: ["Load/hybrid facilities responsible for 100% of assigned network upgrades; crediting an open question.", "Transmission service charged on withdrawal rights.", "Ancillary services on peak demand, ignoring co-located generation."],
      src: ["fercFS", "utilitydive", "doe403"],
    },
    {
      n: 3, key: "colo",
      title: "Co-location arrangements & behind-the-meter (BTM) generation",
      ferc: "Accommodating co-location agreements and behind-the-meter generation.",
      detail: "The orders direct each RTO to set clear terms for loads that sit at or near their own generation — the data-center-plus-power-plant configuration. FERC handles PJM’s co-located loads in a separate proceeding (Item E-2, EL25-49), but the show cause orders push the other five to address it. The DOE ANOPR frames co-location as ‘hybrid facilities’: study load and generation together to minimize upgrades, allocate injection/withdrawal rights, and require system-protection equipment to enforce them. One commentator reads the orders as reopening BTM configurations that a December PJM ruling had narrowed.",
      doe: ["Study load + generation together to cut network upgrades.", "Hybrid facilities studied by requested injection/withdrawal rights (e.g., 500 MW load + 600 MW gen, 100 MW injection, 0 withdrawal).", "System-protection facilities to prevent unauthorized injections/withdrawals."],
      src: ["fercFS", "whitecase", "substack", "doe403"],
    },
    {
      n: 4, key: "flex",
      title: "New transmission services for flexible large loads",
      ferc: "Providing new transmission services for flexible large loads.",
      detail: "Loads willing to curtail are worth more to the system than firm loads of the same size, because the operator can lean on them in tight conditions. FERC wants new service products that reward flexibility — and DOE asks whether a curtailable load’s interconnection study could be expedited (potentially to 60 days), provided the operator’s ability to curtail/dispatch is firm enough to fold the facility into operations and planning. This is the lever that most directly delivers ‘speed to power.’",
      doe: ["Expedite the study of loads that agree to be curtailable (and dispatchable hybrids).", "Operator curtailment/dispatch control must suffice for operations + planning.", "Open question: can such expedited studies finish in 60 days?"],
      src: ["fercFS", "doe403"],
    },
    {
      n: 5, key: "proximate",
      title: "Studying generation serving electrically proximate / co-located loads",
      ferc: "Developing a process to study generating facilities that serve electrically proximate large loads and co-located loads.",
      detail: "When an existing power plant proposes to partially shut down (or carve out output) to serve a new neighboring load, that can strip capacity the grid was counting on. FERC wants a defined study process for generation serving electrically proximate loads. DOE’s principle 10 is precise: such a partial suspension must clear an SSR/RMR-type reliability study that looks ≥ 3 years ahead at forecast load growth, can proceed only after any needed upgrades are in service, and puts those upgrade costs on the generator. SPP’s High Impact Large Load Generation Assessment (HILLGA) is the working model.",
      doe: ["SSR/RMR-type study for an existing plant’s partial suspension to serve a new co-located load.", "Study must consider system conditions ≥ 3 years out, including forecast load growth.", "Suspension only after reliability upgrades are in service; upgrade cost on the generator."],
      src: ["fercFS", "fercPR", "doe403"],
    },
  ];

  // Per-order content below is quoted/cited directly from the OCR'd order PDFs (caption-verified).
  // `cite` = official FERC reporter cite; `pages` = order length; `dir` = quoted directives (p = paragraph);
  // `reg` = region-specific findings stated in the order.
  const dockets = [
    {
      item: "E-7", rto: "PJM", rtoFull: "PJM Interconnection, L.L.C.", docket: "EL26-67-000", url: "e7",
      region: "Mid-Atlantic / 13 states + DC", cite: "195 FERC ¶ 61,211", pages: 114,
      respondents: "PJM + 45 named transmission owners",
      status: "Co-location rules already in place",
      dir: [
        { t: "Application / study process", q: "the application process, study procedures, and ongoing operational requirements that apply to Eligible Customers seeking transmission service on behalf of large loads", p: "P 6(a)", pg: 7 },
        { t: "Alternative transmission technologies", q: "require the evaluation of alternative transmission technologies in transmission service request studies … to accurately account for advanced transmission technologies", p: "P 70", pg: 70 },
        { t: "Cost-recovery agreement", q: "a pro forma cost recovery agreement between PJM, the relevant transmission owner, and Eligible Customer … to mitigate the risk of cost shifting among transmission customers", p: "P 77", pg: 28 },
        { t: "Cost transparency", q: "publicly post and regularly update data that details … proposed large load additions … the planned Network Upgrades … and cost estimates for those Network Upgrades", p: "P 71", pg: 51 },
        { t: "Service for flexible loads", q: "transmission services that reflect Eligible Customers taking transmission service on behalf of flexible large loads that are willing and able to limit their use of the transmission system", p: "P 85", pg: 56 },
      ],
      reg: [
        "Co-location and behind-the-meter generation were already settled in the separate PJM Co-Location Order (193 FERC ¶ 61,217, Dec. 18, 2025; reh’g 195 FERC ¶ 61,209) — this §206 order builds on that record rather than re-litigating it.",
        "Directs PJM to extend the services created there — Interim NITS, Firm and Non-Firm Contract Demand — to flexible large loads (P 85).",
        "Defines an ‘electrically proximate large load’ as one no more than two substations from the generating facility, and targets co-located loads ≥ 50 MW for new generator-interconnection study (P 62).",
        "Excludes named non-public-utility TOs from the show-cause directive under FPA § 201(f), but PJM must still answer for their Tariff provisions (P 7 n.13).",
      ],
    },
    {
      item: "E-8", rto: "MISO", rtoFull: "Midcontinent Independent System Operator, Inc.", docket: "EL26-70-000", url: "e8",
      region: "15 states, Midwest + South", cite: "195 FERC ¶ 61,212", pages: 115,
      respondents: "MISO + ~31 named transmission owners",
      status: "Early-stage large-load rules",
      dir: [
        { t: "Alternative transmission technologies", q: "require the evaluation of alternative transmission technologies in transmission service request studies, using models that are capable of evaluating the transmission system", p: "P 119", pg: 74 },
        { t: "Cost-recovery agreement", q: "a pro forma cost recovery agreement between MISO, the relevant transmission owner, and Eligible Customer taking transmission service on behalf of the large load to mitigate the risk of cost shifting", p: "P 6(b)", pg: 6 },
        { t: "Minimum cost recovery / security", q: "what an appropriate minimum level of cost recovery and financial security from an Eligible Customer would be under any such agreements", p: "P 119", pg: 74 },
        { t: "Co-location ancillary charges", q: "whether and how Eligible Customers taking one of the new transmission services on behalf of Eligible Loads will be charged for their use of regulation and black start services", p: "P 99", pg: 58 },
        { t: "Services for flexible / co-located loads", q: "transmission services that reflect Eligible Customers taking transmission service on behalf of co-located loads, load with behind the meter generation, and flexible large loads", p: "P 6(d)", pg: 7 },
      ],
      reg: [
        "MISO is developing a zero-injection generator-interconnection-agreement process for co-located generation, but its Tariff has no standard procedures for it and doesn’t specify how MISO studies the reliability impacts (PP 32, 57).",
        "Existing services are limited to NITS and firm/non-firm Point-To-Point; the Tariff lacks the Interim NITS and Contract Demand services found just and reasonable in the PJM Co-Location Order (P 104).",
        "MISO leans on its Expedited Project Review (Attachment FF) for out-of-cycle approval of local projects, with applications rising on data-center growth (PP 21-22).",
        "MISO itself told its Large Load Working Group the Tariff does ‘not provide a consistent or transparent framework to evaluate’ large loads (PP 29-32).",
      ],
    },
    {
      item: "E-9", rto: "SPP", rtoFull: "Southwest Power Pool, Inc.", docket: "EL26-68-000", url: "e9",
      region: "Central U.S., 14+ states", cite: "195 FERC ¶ 61,213", pages: 92,
      respondents: "SPP + 23 named transmission owners",
      status: "Most mature — HILL / HILLGA",
      dir: [
        { t: "Alternative tech + operational terms", q: "require the evaluation of alternative transmission technologies, and memorialize ongoing operational requirements in a transmission service agreement", p: "Ordering (B)(1)(a)", pg: 21 },
        { t: "Evaluate alt tech by default", q: "in all instances, without the need for a request from the Eligible Customer seeking transmission service on behalf of large load", p: "P 46", pg: 52 },
        { t: "Cost-recovery + crediting", q: "establish a mechanism to ensure such payments are appropriately credited toward transmission owners’ transmission revenue requirements", p: "Ordering (B)(1)(b)", pg: 21 },
        { t: "Co-location service", q: "address the rates, terms, and conditions of service that apply to co-location arrangements", p: "Ordering (B)(1)(c)", pg: 21 },
        { t: "New services for flexible loads", q: "transmission services that reflect Eligible Customers taking transmission service on behalf of co-located loads, load with behind the meter generation, and flexible large loads", p: "Ordering (B)(1)(d)", pg: 22 },
      ],
      reg: [
        "The order adopts SPP’s own HILL (High Impact Large Load) definition as its definition of ‘large load,’ and treats ‘flexible’ loads as the HILL subset not co-located with generation and willing to limit withdrawals (PP 4, 6 n.16).",
        "FERC commends SPP’s already-approved HILL study process and HILLGA (High Impact Large Load Generation Assessment, accepted Jan. 14, 2026, 194 FERC ¶ 61,031), which expedites generation serving an electrically proximate HILL (PP 15-18).",
        "SPP’s Conditional HILL Service (accepted June 5, 2026) is an as-available, non-firm, 7-year-max service, curtailable until firm service is available (P 17).",
        "Two gaps found even in SPP’s leading framework: no requirement to evaluate alternative transmission technologies, and no pro forma terms memorializing operational requirements in a transmission service agreement (P 27).",
      ],
    },
    {
      item: "E-10", rto: "CAISO", rtoFull: "California Independent System Operator Corp.", docket: "EL26-71-000", url: "e10",
      region: "California (+ WEIM footprint)", cite: "195 FERC ¶ 61,214", pages: 118,
      respondents: "CAISO + 24 Participating Transmission Owners",
      status: "No Order No. 888 service",
      dir: [
        { t: "Application / study process", q: "the application process, study procedures, and ongoing operational requirements that apply to Eligible Customers seeking transmission service on behalf of large loads", p: "P 5", pg: 25 },
        { t: "Alternative transmission technologies", q: "they lack clear and consistent provisions requiring the evaluation of alternative transmission technologies as potential solutions to accommodate an Eligible Customer’s request", p: "PP 152-153", pg: 39 },
        { t: "Cost-recovery agreement", q: "a pro forma cost recovery agreement between CAISO, the relevant transmission owner, and Eligible Customer … to mitigate the risk of cost shifting among transmission customers", p: "§ III.B.3", pg: 25 },
        { t: "BTMG netting", q: "it allows load with BTMG to net its BTMG against its load for purposes of calculating Regional Access Charges", p: "pp. 60-61", pg: 60 },
        { t: "Service for flexible loads", q: "it does not include transmission services that reflect … flexible large loads that are willing and able to limit their use of the transmission system under certain conditions", p: "§ III.D", pg: 62 },
      ],
      reg: [
        "CAISO is the structural outlier: it ‘does not offer traditional Order No. 888 network and point-to-point transmission services, offers no firm, long-term transmission reservations of capacity, and does not provide a formal application process for transmission service’ (P 19).",
        "It offers only a single ‘daily’ service; all non-historical, non-wheeling energy is treated as ‘new firm use,’ and CAISO curtails on Tariff-defined scheduling priorities (pp. 17-18).",
        "The Participating TOs ‘play the lead role in managing the interconnection of load’; CAISO’s role is accounting for state-projected load in its Transmission Planning Process, which is tied to the CEC demand forecast and CPUC integrated resource plans (p. 18).",
        "Alternative compliance path: CAISO may explain whether, ‘given that CAISO does not offer the transmission services required by Order No. 888,’ its framework already addresses the concerns (p. 60).",
      ],
    },
    {
      item: "E-11", rto: "ISO-NE", rtoFull: "ISO New England Inc.", docket: "EL26-72-000", url: "e11",
      region: "Six New England states", cite: "195 FERC ¶ 61,215", pages: 115,
      respondents: "ISO-NE + 16 Participating Transmission Owners",
      status: "Transmission-constrained grid",
      dir: [
        { t: "Application / study process", q: "the application process, study procedures, and ongoing operational requirements that apply to Eligible Customers seeking transmission service on behalf of large loads", p: "P 5", pg: 25 },
        { t: "Alternative transmission technologies", q: "require the evaluation of alternative transmission technologies in transmission service request studies, using models that are capable of evaluating the transmission system", p: "P 75", pg: 75 },
        { t: "Cost-recovery agreement", q: "a pro forma cost recovery agreement between ISO-NE, the relevant transmission owner, and Eligible Customer … to mitigate the risk of cost shifting", p: "P 6", pg: 6 },
        { t: "BTMG netting", q: "it allows load with BTMG to net its BTMG against its load for purposes of calculating Regional Network Service charges", p: "P 60", pg: 60 },
        { t: "Proximate-generation service", q: "the rates, terms, and conditions of service applicable to interconnection customers serving electrically proximate large load or co-located load", p: "P 7", pg: 7 },
      ],
      reg: [
        "FERC frames the risk as particularly acute in New England, citing significant transmission constraints and a system peak of only ~30,000 MW (P 11 n.31).",
        "ISO-NE allocates Regional Network Service network-upgrade costs to the Eligible Customer the same way as generator-interconnection costs under Schedule 11 (P 20).",
        "Its Tariff lets Network Customers net BTMG via the ‘Monthly Regional Network Load’ definition; the order imports the PJM MW-threshold remedy (P 60).",
        "ISO-NE plans off the CELT load forecast, which does not generally include large proposed loads such as data centers (P 22). The order extends the PJM co-location services (compliance accepted Apr. 16, 2026, 195 FERC ¶ 61,030) here, with regional variation (PP 57-59).",
      ],
    },
    {
      item: "E-12", rto: "NYISO", rtoFull: "New York Independent System Operator, Inc.", docket: "EL26-69-000", url: "e12",
      region: "New York State", cite: "195 FERC ¶ 61,216", pages: 119,
      respondents: "NYISO + 9 named New York transmission owners",
      status: "Largely outside the tariff today",
      dir: [
        { t: "Timely study window", q: "how NYISO and/or the Transmission Owners will timely study (i.e., within 60-90 days of receiving the request) the provision of transmission service … on behalf of large loads", p: "P 44", pg: 31 },
        { t: "Define ‘large load’", q: "it lacks a definition of large load, as a new category of load", p: "P 64", pg: 41 },
        { t: "Alternative transmission technologies", q: "require the evaluation of alternative transmission technologies in transmission service request studies … in all instances", p: "P 68", pg: 79 },
        { t: "Cost transparency", q: "robust, accurate, and systematic provision of data on NYISO’s website in a single location … searchable and allows users to filter the data, regarding the cost for Network Upgrades", p: "P 73", pg: 47 },
        { t: "Proximate-generation service", q: "it lacks a generator interconnection study process and/or generator interconnection service to reflect an interconnection customer’s commitment … to limit the generating facility’s output", p: "P 121", pg: 72 },
      ],
      reg: [
        "NYISO has load-interconnection procedures for projects > 10 MW at 115 kV+ (or ≥ 80 MW below 115 kV), but the order finds them only partially in the Tariff — study details, deposits, and assumptions sit in non-Tariff documents (PP 32, 46, 64).",
        "NYISO already defines ‘BTM:NG Resource’ and ‘Host Load,’ but its model presumes a firm Host Load that does not participate in wholesale markets; the new directives attach to those definitions (PP 36, 96-97).",
        "NYISO is weighing co-location reforms but doesn’t expect to file tariff revisions until 2027 — which FERC cites as why the § 206 proceeding is needed now (PP 36-37).",
        "Unlike SPP, NYISO is not told to adopt HILLGA; but its Tariff may still be unjust and unreasonable without any tailored study process for generation serving electrically proximate or large co-located load (P 123).",
      ],
    },
  ];

  const jurisdiction = [
    {
      h: "Transmission cost-shifting → FERC. Retail cost-shifting → states.",
      body: "The orders ‘act today to guard against cost shifting among transmission customers but leave to the states the responsibility to ensure that there is no cost shifting among retail customers.’ That bifurcation is the deal: FERC takes the wholesale/transmission side, states keep the retail side.",
      src: ["fercFS"],
    },
    {
      h: "No intrusion on state authority over generation or retail rates",
      body: "‘Nothing in today’s orders intrudes either on the authority of states to select, site, and permit generating resources or on the authority of state public utility commissions to set the rates, terms and conditions of retail sales of electricity.’ The DOE letter pre-builds the same defense across four legal theories anchored in New York v. FERC (535 U.S. 1) and Order No. 888 — asserting jurisdiction over interconnection to transmission, not over retail sales or generation siting.",
      src: ["fercFS", "doe403"],
    },
    {
      h: "Existing agreements protected; transition time for pending ones",
      body: "The orders are ‘not intended to disrupt existing agreements that large loads have negotiated, or are in the process of negotiating, for the provision of transmission service,’ and direct RTOs/ISOs to ‘allow a reasonable amount of time to finalize agreements that are nearing completion when any tariff revisions are filed.’ This is the investor-certainty half of Chairman Swett’s ‘protect existing deals’ framing.",
      src: ["fercFS", "fercPR"],
    },
    {
      h: "30-day report contents",
      body: "The resource-adequacy report must include: any proposals under stakeholder consideration to address resource adequacy for new large loads; a detailed milestone schedule (e.g., stakeholder/board votes) with the estimated date of any FERC filing; and any ongoing processes aimed at increasing the pace of adding generating capacity in the region.",
      src: ["fercFS"],
    },
  ];

  const regional = [
    { h: "Different existing study processes", body: "RTOs/ISOs already differ in how they study transmission-service requests for large loads — some are mid-stream on stakeholder efforts addressing large-load proliferation. The orders meet each where it is.", src: ["fercFS"] },
    { h: "SPP — HILL & HILLGA", body: "SPP ‘stands out’ with its High Impact Large Load and High Impact Large Load Generation Assessment processes — expedited frameworks created to reliably serve massive new demand from loads like data centers and to study proximate generation.", src: ["fercFS"] },
    { h: "PJM — co-location on a separate track", body: "FERC addresses co-located loads in PJM in a separate proceeding, advancing it via Item E-2 on the same morning’s agenda (EL25-49).", src: ["fercFS", "fercSum"] },
    { h: "CAISO — no Order No. 888 service", body: "Transmission-service models differ — notably CAISO, which does not offer traditional Order No. 888 transmission service.", src: ["fercFS"] },
    { h: "RTO/TO planning splits", body: "Roles and responsibilities for transmission planning are split differently among RTOs/ISOs and their transmission owners across regions — so FERC named the TOs as respondents too.", src: ["fercFS"] },
    { h: "Each RTO defines ‘large load’", body: "The orders leave room for each RTO/ISO to define large loads and to create region-particular operational requirements, and account for regional differences on cost transparency, study processes, and network upgrades.", src: ["fercFS"] },
  ];

  /* ---------------------------------------------------------------- TAB 3 */
  const reception = [
    {
      group: "Data-center developers & hyperscalers", stance: "mixed",
      body: "Speed-to-power is the prize — expedited study tracks for flexible loads could compress today’s multi-year interconnection waits. The cost is the bill: pro forma cost-recovery agreements push 100% of network-upgrade risk onto the customer and address the ‘no-show’ problem (a developer walks, ratepayers eat the stranded infrastructure). Flexibility/curtailment becomes a bargaining chip for faster access.",
      src: ["substack", "aaf", "utilitydive"],
    },
    {
      group: "Transmission owners", stance: "mixed",
      body: "Named as respondents alongside the RTOs, TOs get clearer cost-allocation rules but assume new documentation burdens and a duty to evaluate grid-enhancing technologies before defaulting to conventional upgrades — a friction point on timelines.",
      src: ["substack", "fercFS"],
    },
    {
      group: "Generators (gas / nuclear)", stance: "positive",
      body: "Read by analysts (Capstone) as a ‘major victory’ for owners of dispatchable PJM generation — Constellation, PSEG, Vistra — because co-location and proximate-generation pathways raise the value of existing plants sited near load.",
      src: ["utilitydive"],
    },
    {
      group: "State utility commissions", stance: "positive",
      body: "The bifurcation hands states wholesale-side transmission-cost visibility to inform retail rate design, while preserving their authority over retail cost allocation and generation siting — easing the residential-rate-spike worry that has dominated state dockets.",
      src: ["fercFS", "substack"],
    },
    {
      group: "FERC (the Commission itself)", stance: "positive",
      body: "Unanimous action. Chairman Laura V. Swett: ‘We are setting the stage for a resilient, reliable, and forward-thinking grid that empowers communities and safeguards consumers… It also is critical that FERC provide certainty for investors by directing the markets to protect existing deals.’ The orders also invite (don’t foreclose) parallel § 205 filings.",
      src: ["fercPR", "fercFS"],
    },
  ];

  const media = {
    consensus: [
      { t: "‘Historic’ / ‘landmark’: the framing is near-universal across trade press and the bar — FERC asserting itself on load interconnection, an area it historically left alone.", src: ["akin", "rew", "powermag"] },
      { t: "Speed via procedure: § 206 show cause beats a multi-year NOPR; commentators read it as DOE’s April 30 deadline operationalized across all six markets at once.", src: ["aaf", "rtoinsider"] },
      { t: "Regional flexibility is a feature, not a hedge — SPP/PJM treated as proactive leaders; others told to catch up without a uniform template.", src: ["powermag", "latitude"] },
    ],
    friction: [
      { t: "Cost allocation is the central fight: how aggressively must large loads pre-fund and backstop upgrades, and over what crediting term? The ANOPR explicitly left crediting open.", src: ["utilitydive", "doe403"] },
      { t: "Co-location / BTM remains contested — one commentator reads the orders as reopening BTM access a December PJM ruling had narrowed; PJM’s separate E-2 track shows the issue isn’t settled.", src: ["substack", "whitecase"] },
      { t: "Speed vs. rigor: the orders set a 45-day window to request abeyance of up to 90 days (NYISO P 42), which prevents indefinite stalling but compresses stakeholder process; the mandatory alternative-transmission-technology evaluation could itself add study time.", src: ["e12", "substack"] },
      { t: "Coverage-gap questions: commenters flag that some transmission owners (e.g., Nebraska Public Power District, Great River Energy) appear absent from the published respondent lists — a completeness question to watch.", src: ["substack"] },
    ],
    // outlet chips render from cited source records (each links to its SOURCES entry) — no uncited names.
    outlets: ["utilitydive", "rtoinsider", "latitude", "tdworld", "powermag", "rew", "akin", "sheppard", "whitecase", "natlaw", "aaf", "substack"],
  };

  /* ------------------------------------------------ file / follow the dockets */
  const participate = {
    intro: "Each proceeding is open on the public record. Interventions, comments, and protests are filed in the relevant docket via FERC Online; anyone can follow filings in eLibrary or eSubscription. Reference the exact docket number on every submission.",
    // per-docket eLibrary docket-sheet links (enter the docket number if a link 404s on a new docket)
    dockets: [
      { item: "E-7", rto: "PJM", docket: "EL26-67-000" },
      { item: "E-8", rto: "MISO", docket: "EL26-70-000" },
      { item: "E-9", rto: "SPP", docket: "EL26-68-000" },
      { item: "E-10", rto: "CAISO", docket: "EL26-71-000" },
      { item: "E-11", rto: "ISO-NE", docket: "EL26-72-000" },
      { item: "E-12", rto: "NYISO", docket: "EL26-69-000" },
      { item: "ANOPR", rto: "DOE §403 rulemaking", docket: "RM26-4-000" },
    ],
    docketSheet: function (n) { return "https://elibrary.ferc.gov/eLibrary/docketsheet?docket_number=" + encodeURIComponent(n); },
    links: [
      { label: "RM26-4 participation hub", url: "https://www.ferc.gov/rm26-4", note: "FERC’s “how to participate” page for the ANOPR docket." },
      { label: "eComment", url: "https://ferconline.ferc.gov/eComment.aspx", note: "Short, text-only comments — no account needed." },
      { label: "eFiling", url: "https://ferconline.ferc.gov/eFiling.aspx", note: "Documents/attachments; interventions, protests, comments. Requires eRegister." },
      { label: "eLibrary docket search", url: "https://elibrary.ferc.gov/eLibrary/search", note: "Read every filing in a docket." },
      { label: "eSubscription", url: "https://ferconline.ferc.gov/eSubscription.aspx", note: "Email alerts when a docket gets a new filing." },
      { label: "Office of Public Participation", url: "https://www.ferc.gov/OPP", note: "Help navigating the process · opp@ferc.gov · 202-502-6595." },
    ],
  };

  return { SOURCES, meta, kpis, timeline, toplines, categories, dockets, jurisdiction, regional, reception, media, participate };
})();
