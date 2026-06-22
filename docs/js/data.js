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
      captured: "2026-06-18 (Internet Archive)",
      note: "Live page is Cloudflare-gated; text captured from the June 18, 2026 Wayback snapshot.",
    },
    fercFS: {
      label: "Fact Sheet — “FERC Takes Action to Supercharge America’s Grid…”",
      org: "FERC",
      tier: "ferc",
      url: "https://www.ferc.gov/news-events/news/fact-sheet-ferc-takes-action-supercharge-americas-grid-efficiency-reliability-and",
      captured: "2026-06-20 (Internet Archive)",
      note: "Enumerates the five categories, the 30/60-day deadlines, the jurisdictional boundary and the regional distinctions verbatim.",
    },
    fercSum: {
      label: "Summaries — June 2026 Commission Meeting",
      org: "FERC, Office of External Affairs",
      tier: "ferc",
      url: "https://www.ferc.gov/news-events/news/summaries-june-2026-commission-meeting",
      captured: "2026-06-18 (Internet Archive)",
      note: "Confirms the item→RTO→docket mapping and the related E-2 / E-6 agenda items.",
    },
    fercRM264: {
      label: "Docket RM26-4-000 landing page — “Interconnection of Large Loads…”",
      org: "FERC",
      tier: "ferc",
      url: "https://www.ferc.gov/rm26-4",
      captured: "2026-06-19 (Internet Archive)",
      note: "DOE Oct. 23, 2025 §403 directive; >20 MW definition; four summarized ANOPR questions; comment period extended (page last updated Jan 13, 2026).",
    },
    // The six order PDFs — linked for reader verification; NOT machine-retrievable (see Methodology).
    e7: { label: "Order E-7 (PJM) — Docket EL26-67-000", org: "FERC", tier: "order", url: "https://www.ferc.gov/media/e-7-el26-67-000", captured: "—", note: "Cloudflare-gated; not retrieved." },
    e8: { label: "Order E-8 (MISO) — Docket EL26-70-000", org: "FERC", tier: "order", url: "https://www.ferc.gov/media/e-8-el26-70-000", captured: "—", note: "Cloudflare-gated; not retrieved." },
    e9: { label: "Order E-9 (SPP) — Docket EL26-68-000", org: "FERC", tier: "order", url: "https://www.ferc.gov/media/e-9-el26-68-000", captured: "—", note: "Cloudflare-gated; not retrieved." },
    e10: { label: "Order E-10 (CAISO) — Docket EL26-71-000", org: "FERC", tier: "order", url: "https://www.ferc.gov/media/e-10-el26-71-000", captured: "—", note: "Cloudflare-gated; not retrieved." },
    e11: { label: "Order E-11 (ISO-NE) — Docket EL26-72-000", org: "FERC", tier: "order", url: "https://www.ferc.gov/media/e11-el26-72-000", captured: "—", note: "Cloudflare-gated; not retrieved." },
    e12: { label: "Order E-12 (NYISO) — Docket EL26-69-000", org: "FERC", tier: "order", url: "https://www.ferc.gov/media/e12-el26-69-000", captured: "—", note: "Cloudflare-gated; not retrieved." },
    akin: { label: "“FERC Issues Landmark Show Cause Orders on Large Load Interconnection”", org: "Akin Gump (Speaking Energy)", tier: "secondary", url: "https://www.akingump.com/en/insights/blogs/speaking-energy/ferc-issues-landmark-show-cause-orders-on-large-load-interconnection", captured: "2026-06", note: "Law-firm client alert." },
    sheppard: { label: "“FERC Orders Six RTOs to Address Specific Reforms… Speed to Power”", org: "Sheppard Mullin", tier: "secondary", url: "https://www.sheppard.com/insights/blogs/ferc-orders-six-rtos-to-address-specific-reforms-to-effectuate-speed-to-power-that-will-facilitate-the-integration-of-large-loads", captured: "2026-06", note: "Law-firm client alert." },
    whitecase: { label: "“PJM proposes to carve out new services for co-located data centers”", org: "White & Case", tier: "secondary", url: "https://www.whitecase.com/insight-alert/pjm-proposes-carve-out-new-services-co-located-data-centers", captured: "2026", note: "Co-location context (PJM EL25-49 line)." },
    natlaw: { label: "“FERC Acts on Large Load Integration — Key Issues Addressed”", org: "National Law Review", tier: "secondary", url: "https://natlawreview.com/article/ferc-acts-large-load-integration-key-issues-addressed", captured: "2026-06", note: "Source of the derived procedural calendar dates." },
    aaf: { label: "“FERC Data Center Orders Accelerate Grid Connection”", org: "American Action Forum", tier: "secondary", url: "https://www.americanactionforum.org/insight/ferc-data-center-orders-accelerate-grid-connection/", captured: "2026-06", note: "Policy analysis; §206-vs-NOPR timeline framing." },
    utilitydive: { label: "Utility Dive — large-load / co-location coverage", org: "Utility Dive", tier: "secondary", url: "https://www.utilitydive.com/news/ferc-doe-data-center-interconnection/823360/", captured: "2026-06", note: "Trade press; cost-recovery-agreement and generator-reaction reporting." },
    rtoinsider: { label: "“FERC Directs RTOs to Fix Large Load Interconnections as Answer to DOE ANOPR”", org: "RTO Insider", tier: "secondary", url: "https://www.rtoinsider.com/134751-ferc-issues-show-cause-orders-iso-rtos-large-load/", captured: "2026-06", note: "Trade press." },
    latitude: { label: "“FERC to grid operators: Connect large loads to transmission faster”", org: "Latitude Media", tier: "secondary", url: "https://www.latitudemedia.com/news/ferc-to-grid-operators-connect-large-loads-to-transmission-faster/", captured: "2026-06", note: "Trade press." },
    tdworld: { label: "“FERC Orders ‘Aggressive Targeted Action’ to Speed Power…”", org: "T&D World", tier: "secondary", url: "https://www.tdworld.com/transmission-reliability/article/55385369/ferc-orders-aggressive-targeted-action-to-speed-power-to-support-data-centers", captured: "2026-06", note: "Trade press." },
    powermag: { label: "“FERC Orders All Six Regional Grid Operators to Justify or Rewrite Large-Load Tariffs”", org: "POWER Magazine", tier: "secondary", url: "https://www.powermag.com/ferc-orders-all-six-regional-grid-operators-to-justify-or-rewrite-large-load-tariffs/", captured: "2026-06", note: "Trade press; 200M Americans / 31+ states framing." },
    rew: { label: "“FERC takes historic action… ‘defend or revise’ large load interconnection tariffs”", org: "Renewable Energy World", tier: "secondary", url: "https://www.renewableenergyworld.com/energy-business/policy-and-regulation/ferc-takes-historic-action-orders-us-grid-operators-to-defend-or-revise-large-load-interconnection-tariffs/", captured: "2026-06", note: "Trade press." },
    substack: { label: "“FERC Kicks off a Transparency Wave on Large Load Interconnection”", org: "Arushi Sharma Frank (Substack)", tier: "secondary", url: "https://arushisharmafrank.substack.com/p/ferc-kicks-off-a-transparency-wave", captured: "2026-06", note: "Independent policy commentary; abeyance/pause mechanics, no-show/stranded-cost framing, coverage-gap observations." },
  };

  const meta = {
    title: "Large Load Interconnection",
    subtitle: "From the DOE §403 ANOPR (Docket RM26-4-000) to FERC’s June 18, 2026 tailored §206 show cause orders",
    items: "Items E-7 – E-12 · Dockets EL26-67-000 – EL26-72-000",
    capture: "2026-06-22",
    authority: "Federal Power Act § 206 · DOE Organization Act § 403",
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
      date: "Dec 2025", iso: "2025-12-15", kind: "milestone",
      title: "Track record builds: PJM co-location order + SPP HILL approval",
      body: "FERC directs PJM to adopt transparent tariff rules for loads co-located with generation (the December 2025 order, addressed further at this meeting’s Item E-2, Docket EL25-49), and approves SPP’s High Impact Large Load (HILL) initiative establishing new study processes for large loads and electrically proximate generation. These become the templates the show cause orders build on.",
      src: ["fercPR", "fercFS", "fercSum"],
    },
    {
      date: "Jun 18, 2026", iso: "2026-06-18", kind: "ferc",
      title: "FERC issues six tailored § 206 show cause orders (E-7 – E-12)",
      body: "At its open meeting, FERC unanimously issues tailored show cause orders under FPA § 206 to all six RTOs/ISOs and their transmission owners — PJM (E-7/EL26-67-000), MISO (E-8/EL26-70-000), SPP (E-9/EL26-68-000), CAISO (E-10/EL26-71-000), ISO-NE (E-11/EL26-72-000), NYISO (E-12/EL26-69-000) — directing each to defend or revise its large-load tariff. Each order tees up the same five reform categories but respects region-specific market design.",
      src: ["fercPR", "fercFS", "fercSum"],
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
      body: "Within 60 days, each grid operator and its TOs must either justify why its current tariff stays just and reasonable absent clear, consistent large-load provisions, or file § 206 tariff changes addressing the five categories. One commentator notes a ~45-day window to request abeyance and a ~90-day cap on RTO/ISO-led pause periods to develop tariff language. (Calendar dates derived from issuance; see analyses.)",
      src: ["fercFS", "fercPR", "natlaw", "substack"],
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

  const dockets = [
    {
      item: "E-7", rto: "PJM", rtoFull: "PJM Interconnection, L.L.C.", docket: "EL26-67-000", url: "e7",
      region: "Mid-Atlantic / 13 states + DC",
      status: "Justify or reform (60d) · report (30d)",
      notes: [
        { t: "Largest footprint and the epicenter of data-center growth (Northern Virginia ‘Data Center Alley’). FERC handles PJM’s co-located loads in a separate proceeding — this morning’s Item E-2 (Docket EL25-49) — so the show cause order works alongside that co-location track.", src: ["fercFS", "fercSum"] },
        { t: "Builds on the December 2025 order directing PJM to adopt transparent tariff rules for loads co-located with generation.", src: ["fercPR", "whitecase"] },
      ],
    },
    {
      item: "E-8", rto: "MISO", rtoFull: "Midcontinent Independent System Operator, Inc.", docket: "EL26-70-000", url: "e8",
      region: "15 states, Midwest + South (Manitoba)",
      status: "Justify or reform (60d) · report (30d)",
      notes: [
        { t: "Same five-category mandate. Resource adequacy is the live MISO theme — Item E-6 at the same meeting accepted (subject to condition) MISO tariff revisions to improve real-time visibility and procurement of demand-side and certain supply-side resources during emergencies, beginning Planning Year 2028/2029.", src: ["fercSum"] },
        { t: "FERC named each RTO’s transmission owners as respondents alongside the RTO; planning roles are split differently across MISO than in the ISOs.", src: ["fercFS"] },
      ],
    },
    {
      item: "E-9", rto: "SPP", rtoFull: "Southwest Power Pool, Inc.", docket: "EL26-68-000", url: "e9",
      region: "Central U.S., 14+ states",
      status: "Furthest along — HILL / HILLGA in place",
      notes: [
        { t: "Singled out as the front-runner: SPP’s High Impact Large Load (HILL) and High Impact Large Load Generation Assessment (HILLGA) are expedited frameworks already built to reliably serve massive new demand and to study electrically proximate generation. FERC’s prior approval of HILL is cited as a template for categories 1 and 5.", src: ["fercFS", "fercPR"] },
        { t: "Implication: SPP’s 60-day response may lean on ‘justify’ — pointing to HILL/HILLGA as already-just-and-reasonable — more than the others.", src: ["fercFS"] },
      ],
    },
    {
      item: "E-10", rto: "CAISO", rtoFull: "California Independent System Operator Corp.", docket: "EL26-71-000", url: "e10",
      region: "California (+ EIM/WEIM footprint)",
      status: "Distinct transmission-service model",
      notes: [
        { t: "Structurally different: CAISO does not offer traditional Order No. 888 transmission service, so the ‘transmission-service application/study’ category has to be mapped onto CAISO’s own access model rather than a standard OATT. The order leaves room for that translation.", src: ["fercFS"] },
        { t: "State overlay is heaviest here — California retains authority over generation siting/permitting and retail rates, the exact line FERC says it does not cross.", src: ["fercFS"] },
      ],
    },
    {
      item: "E-11", rto: "ISO-NE", rtoFull: "ISO New England Inc.", docket: "EL26-72-000", url: "e11",
      region: "Six New England states",
      status: "Justify or reform (60d) · report (30d)",
      notes: [
        { t: "Same five-category mandate, with the TO-vs-RTO planning split especially pronounced in New England (the transmission owners own and plan local transmission). FERC included the New England TOs as respondents.", src: ["fercFS"] },
        { t: "FERC’s summaries list this docket as ‘26-72-000’ (apparent typo for EL26-72-000); the item/RTO/docket mapping is otherwise consistent across the news release and fact sheet.", src: ["fercSum"] },
      ],
    },
    {
      item: "E-12", rto: "NYISO", rtoFull: "New York Independent System Operator, Inc.", docket: "EL26-69-000", url: "e12",
      region: "New York State",
      status: "Justify or reform (60d) · report (30d)",
      notes: [
        { t: "Same five-category mandate. NYISO’s single-state footprint puts it closest to the FERC/state seam — transmission cost-shifting is FERC’s lane, retail cost-shifting and generation siting stay with New York.", src: ["fercFS"] },
        { t: "Each RTO, NYISO included, may define ‘large load’ for itself and set region-specific operational requirements.", src: ["fercFS"] },
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
      { t: "Speed vs. rigor: the ~45-day abeyance window and ~90-day pause cap prevent indefinite stalling but compress stakeholder process; mandatory grid-enhancing-tech evaluation could itself add study time.", src: ["substack"] },
      { t: "Coverage-gap questions: commenters flag that some transmission owners (e.g., Nebraska Public Power District, Great River Energy) appear absent from the published respondent lists — a completeness question to watch.", src: ["substack"] },
    ],
    outlets: [
      "Utility Dive", "RTO Insider", "Latitude Media", "T&D World", "POWER Magazine",
      "Renewable Energy World", "Power Engineering", "Akin Gump", "Sheppard Mullin",
      "White & Case", "National Law Review", "American Action Forum", "#EnergyTwitter",
    ],
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
