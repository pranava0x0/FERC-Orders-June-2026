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
      label: "News Release: “FERC Launches Aggressive Targeted Action to Speed Large Load Integration”",
      org: "FERC, Office of External Affairs",
      tier: "ferc",
      url: "https://www.ferc.gov/news-events/news/ferc-launches-aggressive-targeted-action-speed-large-load-integration",
      archiveUrl: "http://web.archive.org/web/20260618211730/https://www.ferc.gov/news-events/news/ferc-launches-aggressive-targeted-action-speed-large-load-integration",
      captured: "2026-06-18 (Internet Archive)",
      note: "Live page is Cloudflare-gated; chip opens the fixed June 18, 2026 Wayback snapshot the text was checked against.",
    },
    fercFS: {
      label: "Fact Sheet: “FERC Takes Action to Supercharge America’s Grid…”",
      org: "FERC",
      tier: "ferc",
      url: "https://www.ferc.gov/news-events/news/fact-sheet-ferc-takes-action-supercharge-americas-grid-efficiency-reliability-and",
      archiveUrl: "http://web.archive.org/web/20260620020229/https://www.ferc.gov/news-events/news/fact-sheet-ferc-takes-action-supercharge-americas-grid-efficiency-reliability-and",
      captured: "2026-06-20 (Internet Archive)",
      note: "Enumerates the five categories, the 30/60-day deadlines, the jurisdictional boundary and the regional distinctions verbatim. Chip opens the fixed snapshot.",
    },
    fercSum: {
      label: "Summaries: June 2026 Commission Meeting",
      org: "FERC, Office of External Affairs",
      tier: "ferc",
      url: "https://www.ferc.gov/news-events/news/summaries-june-2026-commission-meeting",
      archiveUrl: "http://web.archive.org/web/20260618204955/https://www.ferc.gov/news-events/news/summaries-june-2026-commission-meeting",
      captured: "2026-06-18 (Internet Archive)",
      note: "Confirms the item→RTO→docket mapping and the related E-2 / E-6 agenda items. Chip opens the fixed snapshot.",
    },
    fercRM264: {
      label: "Docket RM26-4-000 landing page: “Interconnection of Large Loads…”",
      org: "FERC",
      tier: "ferc",
      url: "https://www.ferc.gov/rm26-4",
      archiveUrl: "http://web.archive.org/web/20260619085932/https://www.ferc.gov/rm26-4",
      captured: "2026-06-19 (Internet Archive)",
      note: "DOE Oct. 23, 2025 §403 directive; >20 MW definition; four summarized ANOPR questions; comment period extended (page last updated Jan 13, 2026). Chip opens the fixed snapshot.",
    },
    // The six order PDFs — downloaded via browser (past Cloudflare) and OCR'd; page-1 captions verified.
    e7: { label: "Order E-7 (PJM): EL26-67-000 · 195 FERC ¶ 61,211", org: "FERC", tier: "order", url: "https://www.ferc.gov/media/e-7-el26-67-000", captured: "2026-06-22", note: "Downloaded & OCR'd, 114 pp; §206 order, issued June 18, 2026; caption verified." },
    e8: { label: "Order E-8 (MISO): EL26-70-000 · 195 FERC ¶ 61,212", org: "FERC", tier: "order", url: "https://www.ferc.gov/media/e-8-el26-70-000", captured: "2026-06-22", note: "Downloaded & OCR'd, 115 pp; §206 order, issued June 18, 2026; caption verified." },
    e9: { label: "Order E-9 (SPP): EL26-68-000 · 195 FERC ¶ 61,213", org: "FERC", tier: "order", url: "https://www.ferc.gov/media/e-9-el26-68-000", captured: "2026-06-22", note: "Downloaded & OCR'd, 92 pp; §206 order, issued June 18, 2026; caption verified." },
    e10: { label: "Order E-10 (CAISO): EL26-71-000 · 195 FERC ¶ 61,214", org: "FERC", tier: "order", url: "https://www.ferc.gov/media/e-10-el26-71-000", captured: "2026-06-22", note: "Downloaded & OCR'd, 118 pp; §206 order, issued June 18, 2026; caption verified." },
    e11: { label: "Order E-11 (ISO-NE): EL26-72-000 · 195 FERC ¶ 61,215", org: "FERC", tier: "order", url: "https://www.ferc.gov/media/e11-el26-72-000", captured: "2026-06-22", note: "Downloaded & OCR'd, 115 pp; §206 order, issued June 18, 2026; caption verified." },
    e12: { label: "Order E-12 (NYISO): EL26-69-000 · 195 FERC ¶ 61,216", org: "FERC", tier: "order", url: "https://www.ferc.gov/media/e12-el26-69-000", captured: "2026-06-22", note: "Downloaded & OCR'd, 119 pp; §206 order, issued June 18, 2026; caption verified." },
    akin: { label: "“FERC Issues Landmark Show Cause Orders on Large Load Interconnection”", org: "Akin Gump (Speaking Energy)", tier: "secondary", url: "https://www.akingump.com/en/insights/blogs/speaking-energy/ferc-issues-landmark-show-cause-orders-on-large-load-interconnection", captured: "2026-06-22", note: "Law-firm client alert." },
    sheppard: { label: "“FERC Orders Six RTOs to Address Specific Reforms… Speed to Power”", org: "Sheppard Mullin", tier: "secondary", url: "https://www.sheppard.com/insights/blogs/ferc-orders-six-rtos-to-address-specific-reforms-to-effectuate-speed-to-power-that-will-facilitate-the-integration-of-large-loads", captured: "2026-06-22", note: "Law-firm client alert." },
    whitecase: { label: "“PJM proposes to carve out new services for co-located data centers”", org: "White & Case", tier: "secondary", url: "https://www.whitecase.com/insight-alert/pjm-proposes-carve-out-new-services-co-located-data-centers", captured: "2026-06-22", note: "Co-location context (PJM EL25-49 line)." },
    natlaw: { label: "“FERC Acts on Large Load Integration: Key Issues Addressed”", org: "National Law Review", tier: "secondary", url: "https://natlawreview.com/article/ferc-acts-large-load-integration-key-issues-addressed", captured: "2026-06-22", note: "Source of the derived procedural calendar dates." },
    aaf: { label: "“FERC Data Center Orders Accelerate Grid Connection”", org: "American Action Forum", tier: "secondary", url: "https://www.americanactionforum.org/insight/ferc-data-center-orders-accelerate-grid-connection/", captured: "2026-06-22", note: "Policy analysis; §206-vs-NOPR timeline framing." },
    utilitydive: { label: "Utility Dive: large-load / co-location coverage", org: "Utility Dive", tier: "secondary", url: "https://www.utilitydive.com/news/ferc-doe-data-center-interconnection/823360/", captured: "2026-06-22", note: "Trade press; cost-recovery-agreement and generator-reaction reporting." },
    rtoinsider: { label: "“FERC Directs RTOs to Fix Large Load Interconnections as Answer to DOE ANOPR”", org: "RTO Insider", tier: "secondary", url: "https://www.rtoinsider.com/134751-ferc-issues-show-cause-orders-iso-rtos-large-load/", captured: "2026-06-22", note: "Trade press." },
    latitude: { label: "“FERC to grid operators: Connect large loads to transmission faster”", org: "Latitude Media", tier: "secondary", url: "https://www.latitudemedia.com/news/ferc-to-grid-operators-connect-large-loads-to-transmission-faster/", captured: "2026-06-22", note: "Trade press." },
    tdworld: { label: "“FERC Orders ‘Aggressive Targeted Action’ to Speed Power…”", org: "T&D World", tier: "secondary", url: "https://www.tdworld.com/transmission-reliability/article/55385369/ferc-orders-aggressive-targeted-action-to-speed-power-to-support-data-centers", captured: "2026-06-22", note: "Trade press." },
    powermag: { label: "“FERC Orders All Six Regional Grid Operators to Justify or Rewrite Large-Load Tariffs”", org: "POWER Magazine", tier: "secondary", url: "https://www.powermag.com/ferc-orders-all-six-regional-grid-operators-to-justify-or-rewrite-large-load-tariffs/", captured: "2026-06-22", note: "Trade press; 200M Americans / 31+ states framing." },
    rew: { label: "“FERC takes historic action… ‘defend or revise’ large load interconnection tariffs”", org: "Renewable Energy World", tier: "secondary", url: "https://www.renewableenergyworld.com/energy-business/policy-and-regulation/ferc-takes-historic-action-orders-us-grid-operators-to-defend-or-revise-large-load-interconnection-tariffs/", captured: "2026-06-22", note: "Trade press." },
    substack: { label: "“FERC Kicks off a Transparency Wave on Large Load Interconnection”", org: "Arushi Sharma Frank (Substack)", tier: "secondary", url: "https://arushisharmafrank.substack.com/p/ferc-kicks-off-a-transparency-wave", captured: "2026-06-22", note: "Independent policy commentary; abeyance/pause mechanics, no-show/stranded-cost framing, coverage-gap observations." },
    // Named-voice commentary (added 2026-06-23) backing the spectrum section in Tab 3 only.
    norris: { label: "POWER Magazine on the Duke “Rethinking Load Growth” flexible-loads study", org: "POWER Magazine", tier: "secondary", url: "https://www.powermag.com/duke-researchers-grid-flexibility-key-to-accommodate-load-growth/", captured: "2026-06-23", note: "Reports the Tyler Norris et al. (Duke Nicholas Institute) finding that curtailing a small share of a large load’s annual peak frees existing grid capacity; basis for the flexible-load reform." },
    kavulla: { label: "Texas Energy & Power on Travis Kavulla’s “open season” argument", org: "Texas Energy & Power", tier: "secondary", url: "https://www.texasenergyandpower.com/p/price-the-grid-or-keep-rationing", captured: "2026-06-23", note: "Discusses Kavulla’s American Affairs essay arguing for pricing grid access via a gas-pipeline-style ‘open season’ with transferable rights." },
    insideclimate: { label: "“Federal Regulators Tell Grid Operators to Fix Their Rules on Data Centers”", org: "Inside Climate News", tier: "secondary", url: "https://insideclimatenews.org/news/18062026/federal-energy-regulatory-commission-data-center-orders/", captured: "2026-06-23", note: "June 18, 2026 coverage carrying Sierra Club and Southern Environmental Law Center reactions." },
    publiccitizen: { label: "“FERC Must Reconsider Risks Posed by Data Centers to Power Grids”", org: "Public Citizen", tier: "secondary", url: "https://www.citizen.org/news/ferc-must-reconsider-risks-posed-by-data-centers-to-power-grids/", captured: "2026-06-23", note: "Consumer-watchdog stance; pressed for a temporary moratorium on new data-center interconnections pending NERC reliability alerts." },
    // Post-issuance commentary refresh (gathered 2026-06-24).
    heatmap: { label: "“FERC Has a New Plan for Data Centers”", org: "Heatmap News (Matthew Zeitlin)", tier: "secondary", url: "https://heatmap.news/energy/ferc-data-center-plan", captured: "2026-06-24", note: "Analysis; carries former FERC chairman Neil Chatterjee’s ‘a very FERC-y approach’ reaction and PJM price-surge context." },
    duanemorris: { label: "“FERC Acts to Advance Data Center and Large Load Integration in Six RTO Regions”", org: "Duane Morris LLP", tier: "secondary", url: "https://www.duanemorris.com/alerts/ferc_acts_advance_data_center_large_load_integration_six_rto_regions_0626.html", captured: "2026-06-24", note: "Law-firm alert; partner Robert Montejo on flexibility as connection leverage." },
    mdopc: { label: "“Maryland lawmakers back data center transmission cost complaint at FERC”", org: "Utility Dive", tier: "secondary", url: "https://www.utilitydive.com/news/maryland-ratepayer-advocate-ferc-data-center-complaint-transmission/823244/", captured: "2026-06-24", note: "Maryland Office of People’s Counsel complaint on PJM cost allocation; 80 state lawmakers in support; ~$1.6B ratepayer exposure cited." },
  };

  const meta = {
    title: "Large Load Interconnection",
    subtitle: "From the DOE §403 ANOPR (Docket RM26-4-000) to FERC’s June 18, 2026 tailored §206 show cause orders",
    items: "Items E-7 to E-12 · Dockets EL26-67-000 to EL26-72-000",
    capture: "2026-06-22",
    discourseCapture: "2026-06-24",
    authority: "Federal Power Act § 206 · DOE Organization Act § 403",
    citeRange: "195 FERC ¶ 61,211 to 61,216",
    commissioners: "Laura V. Swett (Chairman) · David Rosner · Lindsay S. See · Judy W. Chang · David LaCerte",
    summary: [
      "On October 23, 2025, the Department of Energy used its rarely invoked § 403 authority to direct FERC to open a rulemaking on the interconnection of large loads such as data centers (Docket RM26-4-000).",
      "Rather than run a multi-year rulemaking, FERC answered on June 18, 2026 with six tailored § 206 show cause orders, one to each RTO/ISO, putting all six markets on a 30/60-day clock to defend or revise their large-load tariffs.",
    ],
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
      body: "Energy Secretary Chris Wright, invoking § 403 of the DOE Organization Act (42 U.S.C. § 7173), a rarely used authority that lets the Secretary propose rules within FERC’s jurisdiction, directs FERC to initiate rulemaking on the “timely and orderly” interconnection of large loads (data centers, AI, advanced manufacturing) to the interstate transmission system. The letter asserts that load interconnection to transmission falls “squarely within” FERC jurisdiction even though FERC has historically not asserted it, and asks for final action no later than April 30, 2026.",
      src: ["doe403", "fercRM264"],
    },
    {
      date: "Oct 23, 2025", iso: "2025-10-23b", kind: "doe",
      title: "Fourteen ANOPR principles define the reform menu",
      body: "The enclosed ANOPR sets large loads at > 20 MW (mirroring Order No. 2003 large generators) and lays out 14 principles: study loads with proximate generation, standardized study deposits / readiness / withdrawal penalties, hybrid (load+generation) facilities studied by injection/withdrawal rights, expedited study for curtailable loads (could studies finish in 60 days?), 100% network-upgrade cost responsibility with an open question on crediting, SSR/RMR-type review when an existing plant partially suspends to serve a co-located load, and a transition plan for pending requests.",
      src: ["doe403"],
    },
    {
      date: "Late 2025 to Jan 2026", iso: "2026-01-13", kind: "milestone",
      title: "FERC opens RM26-4-000, takes comment, extends the period",
      body: "FERC opens Docket RM26-4-000 in response to the § 403 proposal and seeks comment on DOE’s principles, then issues a notice extending the comment period. Staff ultimately reviews more than 3,500 pages of public comment. (RM26-4 landing page last updated Jan 13, 2026.)",
      src: ["fercRM264", "fercPR"],
    },
    {
      date: "Dec 2025 to Jun 2026", iso: "2025-12-18", kind: "milestone",
      title: "Track record builds: PJM co-location order + SPP HILL/HILLGA",
      body: "The show cause orders build on a live record. FERC’s PJM Co-Location Order (193 FERC ¶ 61,217, Dec. 18, 2025; rehearing 195 FERC ¶ 61,209; compliance accepted Apr. 16, 2026, 195 FERC ¶ 61,030) created three new services (Interim NITS, Firm and Non-Firm Contract Demand) that the §206 orders now extend to the other regions. SPP’s HILL study process, its HILLGA generation assessment (accepted Jan. 14, 2026, 194 FERC ¶ 61,031), and its Conditional HILL Service (accepted June 5, 2026) become the working template for categories 1 and 5.",
      src: ["e7", "e9", "fercPR"],
    },
    {
      date: "Jun 18, 2026", iso: "2026-06-18", kind: "ferc",
      title: "FERC issues six tailored § 206 show cause orders (E-7 to E-12)",
      body: "At its open meeting, FERC unanimously issues six tailored §206 show cause orders: PJM (195 FERC ¶ 61,211), MISO (¶ 61,212), SPP (¶ 61,213), CAISO (¶ 61,214), ISO-NE (¶ 61,215), NYISO (¶ 61,216), 92 to 119 pages each, Commissioners Swett, Rosner, See, Chang, LaCerte. Each ‘Order Instituting Proceeding Under Section 206’ runs the same spine, applied to each region’s own tariff: III.A transmission service for large loads · III.B cost-shifting risk · III.C co-location & behind-the-meter generation · III.D services for flexible loads · III.E interconnection for electrically proximate / co-located load · III.F informational report · IV briefing questions.",
      src: ["e7", "e8", "e9", "e10", "e11", "e12"],
    },
    {
      date: "≈ Jul 18, 2026", iso: "2026-07-18", kind: "deadline",
      title: "30-day informational report due",
      body: "Within 30 days, each RTO/ISO and its TOs must file a detailed informational report on how it will ensure adequate generation is available to serve existing and new large loads, including any resource-adequacy proposals under consideration in its stakeholder process, a milestone schedule with the estimated FERC-filing date, and any ongoing efforts to speed new capacity. (Calendar date derived from the June 18 issuance; one analysis pegs the business-day-adjusted due date at July 20, 2026.)",
      src: ["fercFS", "fercPR", "natlaw"],
    },
    {
      date: "≈ Aug 17, 2026", iso: "2026-08-17", kind: "deadline",
      title: "60-day justification or tariff filing due",
      body: "Within 60 days, each grid operator and its TOs must either show cause why its current tariff stays just and reasonable absent clear, consistent large-load provisions, or explain the §206 tariff changes that would remedy the concerns (Ordering Para (B)). The orders also set a 21-day intervention deadline (Rule 214), a 30-day window for responses after the operators file, and, in the NYISO order, a 45-day deadline to request abeyance of up to 90 days (NYISO P 42). The refund effective date is the order’s Federal Register publication date.",
      src: ["e7", "e12", "natlaw"],
    },
  ];

  const toplines = [
    {
      h: "Why § 206 show cause orders, not a generic NOPR",
      tier: "analysis",
      body: [
        "A notice-and-comment rulemaking on the ANOPR could run 2 to 5 years to a final rule and then compliance. FERC instead used the Federal Power Act’s § 206 “show cause” mechanism: it makes a threshold finding that the existing tariffs may be unjust and unreasonable for want of large-load provisions, and shifts the burden onto each RTO/ISO to defend the status quo or file a fix on a 60-day clock.",
        "The move converts DOE’s April 30, 2026 “final action” deadline into concrete, near-term obligations across all six markets at once: speed-to-power by procedure, not just by policy. It also keeps FERC on firmer jurisdictional ground than a one-size rule, because § 206 lets the record build market-by-market.",
      ],
      src: ["fercPR", "aaf", "akin"],
    },
    {
      h: "Tailored to each RTO rather than a uniform rule",
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
        "Running through all five categories is one worry: that the cost of connecting multi-hundred-MW loads lands on ordinary ratepayers. FERC’s answer is cost causation made visible: pro forma cost-recovery agreements so large loads bear network-upgrade risk, plus transparency into how upgrade costs are identified, allocated, and communicated.",
        "Chairman Laura V. Swett framed it as doing both at once: investor certainty (protect existing deals) and consumer safeguards (guard against cost-shifting). The orders pair the speed mandate with that ratepayer guardrail rather than trading one for the other.",
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
      detail: "Each RTO must show an efficient, non-discriminatory path for a large load to request transmission service and be studied, and must consider grid-enhancing / alternative transmission technologies (e.g., reconductoring, dynamic line ratings, advanced power-flow control) before defaulting to conventional network upgrades. The DOE ANOPR roots this in the Order No. 2003 / 2023 generator-interconnection toolkit: standardized study deposits, readiness requirements, and withdrawal penalties to deter speculative ‘phantom’ load requests and sharpen demand forecasting.",
      doe: ["Limit reforms to interconnections directly to transmission (seven-factor test).", "Standardized study deposits, readiness requirements, withdrawal penalties.", "Same option-to-build afforded to generator interconnection customers."],
      src: ["fercFS", "fercPR", "doe403"],
    },
    {
      n: 2, key: "cost",
      title: "Cost-shifting prevention & transmission-cost transparency",
      ferc: "Preventing cost shifting and requiring transparency into transmission costs.",
      detail: "FERC flags a lack of transparency in how RTOs assign and recover network-upgrade costs, and an absence of pro forma cost-recovery agreements that put the risk and cost of upgrades on the large-load customer. The remedy is cost causation made auditable: identify, allocate, and communicate the cost of serving large loads so they don’t migrate onto other transmission customers’ bills. The DOE principles supply the mechanics: 100% network-upgrade responsibility (with an open question on crediting over a term), transmission service billed on withdrawal rights, and ancillary services on peak demand without netting co-located generation.",
      doe: ["Load/hybrid facilities responsible for 100% of assigned network upgrades; crediting an open question.", "Transmission service charged on withdrawal rights.", "Ancillary services on peak demand, ignoring co-located generation."],
      src: ["fercFS", "utilitydive", "doe403"],
    },
    {
      n: 3, key: "colo",
      title: "Co-location arrangements & behind-the-meter (BTM) generation",
      ferc: "Accommodating co-location agreements and behind-the-meter generation.",
      detail: "The orders direct each RTO to set clear terms for loads that sit at or near their own generation, the data-center-plus-power-plant configuration. FERC handles PJM’s co-located loads in a separate proceeding (Item E-2, EL25-49), but the show cause orders push the other five to address it. The DOE ANOPR frames co-location as ‘hybrid facilities’: study load and generation together to minimize upgrades, allocate injection/withdrawal rights, and require system-protection equipment to enforce them. One commentator reads the orders as reopening BTM configurations that a December PJM ruling had narrowed.",
      doe: ["Study load + generation together to cut network upgrades.", "Hybrid facilities studied by requested injection/withdrawal rights (e.g., 500 MW load + 600 MW gen, 100 MW injection, 0 withdrawal).", "System-protection facilities to prevent unauthorized injections/withdrawals."],
      src: ["fercFS", "whitecase", "substack", "doe403"],
    },
    {
      n: 4, key: "flex",
      title: "New transmission services for flexible large loads",
      ferc: "Providing new transmission services for flexible large loads.",
      detail: "Loads willing to curtail are worth more to the system than firm loads of the same size, because the operator can lean on them in tight conditions. FERC wants new service products that reward flexibility, and DOE asks whether a curtailable load’s interconnection study could be expedited (potentially to 60 days), provided the operator’s ability to curtail/dispatch is firm enough to fold the facility into operations and planning. This is the lever that most directly delivers ‘speed to power.’",
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
      item: "E-7", rto: "PJM", rtoFull: "PJM Interconnection, L.L.C.", docket: "EL26-67-000", url: "e7", pdf: "orders/e-7-pjm-el26-67-000.pdf",
      region: "Mid-Atlantic / 13 states + DC", cite: "195 FERC ¶ 61,211", pages: 114,
      respondents: "PJM + 45 named transmission owners",
      commishPages: { swett: 87, rosner: 93, see: 99, chang: 104, lacerte: 113 },
      status: "Co-location rules already in place",
      unique: "The only market that has already cleared the co-location question. PJM’s co-located-load rules were settled in a separate proceeding (the Dec. 2025 Co-Location Order), so this §206 builds on that record instead of reopening it — and PJM’s new services become the template the other five orders are told to copy.",
      asks: [
        "Protecting existing deals: a reasonable implementation period, and time to finalize agreements nearing completion when the new tariff provisions are filed (Section IV).",
        "Whether the new flexible-load services would change regional and local transmission planning, given uncertainty in the type, location, and quantity of such loads (Section IV).",
        "Whether a generating facility serving an electrically proximate or co-located load could join PJM’s energy, ancillary-services, and capacity markets, and how it would be accredited (Section IV).",
      ],
      dir: [
        { t: "Application / study process", q: "the application process, study procedures, and ongoing operational requirements that apply to Eligible Customers seeking transmission service on behalf of large loads", p: "P 6(a)", pg: 7 },
        { t: "Alternative transmission technologies", q: "require the evaluation of alternative transmission technologies in transmission service request studies … to accurately account for advanced transmission technologies", p: "P 70", pg: 70 },
        { t: "Cost-recovery agreement", q: "a pro forma cost recovery agreement between PJM, the relevant transmission owner, and Eligible Customer … to mitigate the risk of cost shifting among transmission customers", p: "P 77", pg: 28 },
        { t: "Cost transparency", q: "publicly post and regularly update data that details … proposed large load additions … the planned Network Upgrades … and cost estimates for those Network Upgrades", p: "P 71", pg: 51 },
        { t: "Service for flexible loads", q: "transmission services that reflect Eligible Customers taking transmission service on behalf of flexible large loads that are willing and able to limit their use of the transmission system", p: "P 85", pg: 56 },
      ],
      reg: [
        { t: "Co-location and behind-the-meter generation were already settled in the separate PJM Co-Location Order (193 FERC ¶ 61,217, Dec. 18, 2025; reh’g 195 FERC ¶ 61,209); this §206 order builds on that record rather than re-litigating it." },
        { t: "Directs PJM to extend the services created there — Interim NITS, Firm and Non-Firm Contract Demand — to flexible large loads.", p: "P 85", pg: 56, a: "willing and able to limit their use of the transmission system" },
        { t: "The only order to fix a distance test: an ‘electrically proximate large load’ is one no more than two substations from the generating facility.", p: "P 62", pg: 62, a: "no more than two substations" },
        { t: "Targets large co-located loads of 50 MW or greater for new generator-interconnection study procedures, tied to the Co-Location Order’s definition.", p: "P 62", pg: 62, a: "50 MW or greater" },
        { t: "Excludes named non-public-utility TOs (e.g., AMP Transmission, Cleveland Public Power, East Kentucky Power Cooperative) from the show-cause directive under FPA § 201(f), but PJM must still answer for their Tariff provisions.", p: "P 7 n.13", pg: 7, a: "AMP Transmission" },
        { t: "Today PJM studies every new request in one first-ready, first-served, three-phase clustered ‘New Services Queue’ (Part VIII of the Tariff), with no study provisions specific to large loads.", p: "pp. 21", pg: 21, a: "first-ready, first-served clustered cycle" },
        { t: "Under the existing cost rule, an Eligible Customer already pays 100% of the minimum Network Upgrades its request triggers that would not have been in the Regional Transmission Expansion Plan, net of benefits and not less than zero.", p: "pp. 22", pg: 22, a: "100% of the costs of the minimum amount of Network Upgrades" },
      ],
      respondentList: ["AEP Appalachian Transmission Company, Inc.", "AEP Indiana Michigan Transmission Company, Inc.", "AEP Kentucky Transmission Company, Inc.", "AEP Ohio Transmission Company, Inc.", "AEP West Virginia Transmission Company, Inc.", "Allegheny Electric Cooperative, Inc.", "American Transmission Systems, Incorporated", "Appalachian Power Company", "Atlantic City Electric Company", "Baltimore Gas and Electric Company", "Commonwealth Edison Company", "Commonwealth Edison Company of Indiana, Inc.", "Dayton Power and Light Company", "Delmarva Power & Light Company", "Duke Energy Kentucky, Inc.", "Duke Energy Ohio, Inc.", "Duquesne Light Company", "Essential Power Rock Springs, LLC", "Hudson Transmission Partners, LLC", "Indiana Michigan Power Company", "Jersey Central Power & Light Company", "Kentucky Power Company", "Keystone Appalachian Transmission Company", "Kingsport Power Company", "Linden VFT, LLC", "Mid-Atlantic Interstate Transmission, LLC", "Monongahela Power Company", "Neptune Regional Transmission System, LLC", "NextEra Energy Transmission MidAtlantic Indiana, Inc.", "Ohio Power Company", "Ohio Valley Electric Corporation", "Old Dominion Electric Cooperative", "PECO Energy Company", "PPL Electric Utilities Corporation", "The Potomac Edison Company", "Potomac Electric Power Company", "Public Service Electric and Gas Company", "Rockland Electric Company", "Silver Run Electric, LLC", "Trans-Allegheny Interstate Line Company", "Transource West Virginia, LLC", "UGI Utilities, Inc.", "Virginia Electric and Power Company", "Wabash Valley Power Association, Inc.", "Wheeling Power Company"],
    },
    {
      item: "E-8", rto: "MISO", rtoFull: "Midcontinent Independent System Operator, Inc.", docket: "EL26-70-000", url: "e8", pdf: "orders/e-8-miso-el26-70-000.pdf",
      region: "15 states, Midwest + South", cite: "195 FERC ¶ 61,212", pages: 115,
      respondents: "MISO + 30 named transmission owners",
      commishPages: { swett: 91, rosner: 96, see: 102, chang: 106, lacerte: 114 },
      status: "Early-stage large-load rules",
      unique: "The fast-growing middle of the pack. MISO runs a Large Load Working Group and an Expedited Project Review path, and even told its own stakeholders the Tariff lacks a ‘consistent or transparent framework’ for large loads — but it has no co-location procedures in the Tariff yet and only the basic Order No. 888 services, so FERC imports the PJM and SPP templates ‘with regional variation.’",
      asks: [
        "Whether and how Eligible Customers taking the new services would be charged for regulation and black-start service (P 99).",
        "An appropriate minimum level of cost recovery and financial security under any cost-recovery agreement (P 119).",
      ],
      dir: [
        { t: "Alternative transmission technologies", q: "require the evaluation of alternative transmission technologies in transmission service request studies, using models that are capable of evaluating the transmission system", p: "P 119", pg: 74 },
        { t: "Cost-recovery agreement", q: "a pro forma cost recovery agreement between MISO, the relevant transmission owner, and Eligible Customer taking transmission service on behalf of the large load to mitigate the risk of cost shifting", p: "P 6(b)", pg: 6 },
        { t: "Minimum cost recovery / security", q: "what an appropriate minimum level of cost recovery and financial security from an Eligible Customer would be under any such agreements", p: "P 119", pg: 74 },
        { t: "Co-location ancillary charges", q: "whether and how Eligible Customers taking one of the new transmission services on behalf of Eligible Loads will be charged for their use of regulation and black start services", p: "P 99", pg: 58 },
        { t: "Services for flexible / co-located loads", q: "transmission services that reflect Eligible Customers taking transmission service on behalf of co-located loads, load with behind the meter generation, and flexible large loads", p: "P 6(d)", pg: 7 },
      ],
      reg: [
        { t: "MISO is developing a zero-injection generator-interconnection-agreement process for co-located generation, but its Tariff has no standard procedures for it and doesn’t specify how MISO studies the reliability impacts.", p: "PP 32, 57", pg: 57, a: "zero-injection" },
        { t: "Existing services are limited to NITS and firm/non-firm Point-To-Point; the Tariff lacks the Interim NITS and Contract Demand services found just and reasonable in the PJM Co-Location Order.", p: "P 104", pg: 61, a: "firm and non-firm Point-To-Point Transmission Service" },
        { t: "MISO leans on its Expedited Project Review (Attachment FF) for out-of-cycle approval of local projects, with applications rising on data-center growth.", p: "PP 21-22", pg: 21, a: "Expedited Project Review" },
        { t: "MISO itself told its Large Load Working Group the Tariff does ‘not provide a consistent or transparent framework to evaluate’ large loads.", p: "PP 29-32", pg: 24, a: "consistent or transparent framework" },
        { t: "MISO’s Tariff doesn’t distinguish by load size and studies new load (Module B) separately from generator interconnection — and service is requested at the load’s maximum demand, regardless of any willingness to be curtailed.", p: "pp. 19-20", pg: 20, a: "regardless of the load's operational capabilities or willingness to be curtailed" },
        { t: "Network Upgrades for new load enter the MISO Transmission Expansion Plan (MTEP) and roll into the transmission owner’s base zonal rates (Attachments N and O), shared among that TO’s wholesale customers by usage.", p: "pp. 20-21", pg: 20, a: "rolled into the relevant transmission owner's base zonal rates" },
      ],
      respondentList: ["AEP Indiana Michigan Transmission Company, Inc.", "ALLETE, Inc.", "Ameren Illinois Company", "Ameren Transmission Company of Illinois", "American Transmission Company, LLC", "Cleco Power LLC", "Duke Energy Indiana, LLC", "Entergy Arkansas, LLC", "Entergy Louisiana, LLC", "Entergy Mississippi, LLC", "Entergy New Orleans, LLC", "Entergy Texas, Inc.", "GridLiance Heartland LLC", "Indianapolis Power & Light Company", "International Transmission Company", "ITC Midwest LLC", "Michigan Electric Transmission Company, LLC", "MidAmerican Energy Company", "Montana-Dakota Utilities Company", "Northern Indiana Public Service Company LLC", "Northern States Power Company, a Minnesota Corporation", "Northern States Power Company, a Wisconsin Corporation", "Northwestern Wisconsin Electric Company", "Otter Tail Power Company", "Pioneer Transmission, LLC", "Republic Transmission, LLC", "Southern Indiana Gas & Electric Company", "Union Electric Company", "Wabash Valley Power Association, Inc.", "Wolverine Power Supply Cooperative, Inc."],
    },
    {
      item: "E-9", rto: "SPP", rtoFull: "Southwest Power Pool, Inc.", docket: "EL26-68-000", url: "e9", pdf: "orders/e-9-spp-el26-68-000.pdf",
      region: "Central U.S., 14+ states", cite: "195 FERC ¶ 61,213", pages: 92,
      respondents: "SPP + 22 named transmission owners",
      commishPages: { swett: 68, rosner: 73, see: 78, chang: 83, lacerte: 92 },
      status: "Most mature: HILL / HILLGA",
      unique: "The acknowledged leader. FERC adopts SPP’s own ‘High Impact Large Load’ (HILL) definition as the order’s definition of large load and commends its HILLGA and Conditional HILL services — so SPP’s is the shortest order (92 pp), finds only two gaps to close, and its frameworks become the model the other regions are told to follow.",
      asks: [
        "A mechanism to credit large-load cost-recovery payments toward transmission owners’ revenue requirements (Ordering (B)(1)(b)).",
        "Evaluating alternative transmission technologies in all instances without a customer request — and, if conventional upgrades are chosen instead, justifying why (P 46).",
      ],
      dir: [
        { t: "Alternative tech + operational terms", q: "require the evaluation of alternative transmission technologies, and memorialize ongoing operational requirements in a transmission service agreement", p: "Ordering (B)(1)(a)", pg: 21 },
        { t: "Evaluate alt tech by default", q: "in all instances, without the need for a request from the Eligible Customer seeking transmission service on behalf of large load", p: "P 46", pg: 52 },
        { t: "Cost-recovery + crediting", q: "establish a mechanism to ensure such payments are appropriately credited toward transmission owners’ transmission revenue requirements", p: "Ordering (B)(1)(b)", pg: 21 },
        { t: "Co-location service", q: "address the rates, terms, and conditions of service that apply to co-location arrangements", p: "Ordering (B)(1)(c)", pg: 21 },
        { t: "New services for flexible loads", q: "transmission services that reflect Eligible Customers taking transmission service on behalf of co-located loads, load with behind the meter generation, and flexible large loads", p: "Ordering (B)(1)(d)", pg: 22 },
      ],
      reg: [
        { t: "The order adopts SPP’s own HILL (High Impact Large Load) definition as its definition of ‘large load,’ and treats ‘flexible’ loads as the HILL subset not co-located with generation and willing to limit withdrawals.", p: "PP 4, 6 n.16", pg: 6, a: "not co-located with generation" },
        { t: "FERC commends SPP’s already-approved HILL study process and HILLGA (High Impact Large Load Generation Assessment, accepted Jan. 14, 2026, 194 FERC ¶ 61,031), which expedites generation serving an electrically proximate HILL.", p: "PP 15-18", pg: 18, a: "High Impact Large Load Generation Assessment" },
        { t: "SPP’s Conditional HILL Service (CHILLS, accepted June 5, 2026) is an as-available, non-firm, 7-year-max service, curtailable until firm service is available.", p: "P 17", pg: 19, a: "Conditional High Impact Large Load Service" },
        { t: "FERC points SPP to its under-development Price Adaptive Load Service (PALS) — a non-firm option for price-sensitive flexible loads — and its Highway/Byway (Attachment J) cost-allocation process as the existing baseline.", p: "PP 19-21", pg: 20, a: "Price Adaptive Load Service" },
        { t: "Even in this leading framework FERC finds only two gaps: no requirement to evaluate alternative transmission technologies, and no pro forma terms memorializing operational requirements in a transmission service agreement.", p: "P 27", pg: 21, a: "memorialize ongoing operational requirements in a transmission service agreement" },
        { t: "SPP’s baseline study is Attachment Z1 (Aggregate Transmission Service Study) plus Attachments AQ (Delivery Point Assessment) and AX (Provisional Load Process); the HILL process layers enhanced study on top of these.", p: "pp. 17-19", pg: 17, a: "Aggregate Transmission Service Study" },
        { t: "Its Highway/Byway cost allocation (Attachment J) splits Network-Upgrade costs by voltage: 300 kV and above region-wide (postage stamp), 100 to 300 kV one-third regional / two-thirds subregional, and 100 kV and below fully local.", p: "pp. 17", pg: 17, a: "for facilities at 300 kV or above" },
      ],
      respondentList: ["AEP Oklahoma Transmission Company, Inc.", "AEP Southwestern Transmission Company, Inc.", "Deseret Generation & Transmission Co-operative, Inc.", "Empire District Electric Company", "Evergy Kansas Central, Inc.", "Evergy Kansas South, Inc.", "Evergy Metro, Inc.", "Evergy Missouri West, Inc.", "GridLiance High Plains LLC", "ITC Great Plains, LLC", "Mountrail-Williams Electric Cooperative", "NextEra Energy Transmission Southwest, LLC", "NorthWestern Energy Public Service Corporation", "Oklahoma Gas and Electric Company", "Prairie Wind Transmission, LLC", "Public Service Company of Oklahoma", "Southwestern Electric Power Company", "Southwestern Public Service Company", "Transource Missouri, LLC", "Transource Oklahoma, LLC", "Tri-State Generation and Transmission Association, Inc.", "Upper Missouri G. & T. Electric Cooperative, Inc."],
    },
    {
      item: "E-10", rto: "CAISO", rtoFull: "California Independent System Operator Corp.", docket: "EL26-71-000", url: "e10", pdf: "orders/e-10-caiso-el26-71-000.pdf",
      region: "California (+ WEIM footprint)", cite: "195 FERC ¶ 61,214", pages: 118,
      respondents: "CAISO + 24 Participating Transmission Owners",
      commishPages: { swett: 93, rosner: 98, see: 104, chang: 109, lacerte: 117 },
      status: "No Order No. 888 service",
      unique: "The structural outlier. CAISO doesn’t offer traditional Order No. 888 transmission service at all — no firm long-term reservations, no formal application process, just a single ‘daily’ service — and its Participating TOs, not CAISO, lead load interconnection. FERC even gives it an escape hatch no other order offers: explain whether its non-888 framework already meets the concerns.",
      asks: [
        "Whether, given that CAISO does not offer Order No. 888 service, its existing framework already addresses the concerns — or what equivalent options it would create (p. 60).",
        "How load-addition study procedures and operational requirements would work when its Participating TOs, not CAISO, lead load interconnection.",
      ],
      dir: [
        { t: "Application / study process", q: "the application process, study procedures, and ongoing operational requirements that apply to Eligible Customers seeking transmission service on behalf of large loads", p: "P 5", pg: 25 },
        { t: "Alternative transmission technologies", q: "they lack clear and consistent provisions requiring the evaluation of alternative transmission technologies as potential solutions to accommodate an Eligible Customer’s request", p: "PP 152-153", pg: 39 },
        { t: "Cost-recovery agreement", q: "a pro forma cost recovery agreement between CAISO, the relevant transmission owner, and Eligible Customer … to mitigate the risk of cost shifting among transmission customers", p: "§ III.B.3", pg: 25 },
        { t: "BTMG netting", q: "it allows load with BTMG to net its BTMG against its load for purposes of calculating Regional Access Charges", p: "pp. 60-61", pg: 60 },
        { t: "Service for flexible loads", q: "it does not include transmission services that reflect … flexible large loads that are willing and able to limit their use of the transmission system under certain conditions", p: "§ III.D", pg: 62 },
      ],
      reg: [
        { t: "CAISO is the structural outlier: it ‘does not offer traditional Order No. 888 network and point-to-point transmission services, offers no firm, long-term transmission reservations of capacity, and does not provide a formal application process for transmission service.’", p: "P 19", pg: 17, a: "does not offer traditional Order No. 888" },
        { t: "It offers only a single ‘daily’ service; all non-historical, non-wheeling energy is treated as ‘new firm use,’ and CAISO curtails on Tariff-defined scheduling priorities.", p: "pp. 17-18", pg: 18, a: "new firm use" },
        { t: "The Participating TOs ‘play the lead role in managing the interconnection of load’; CAISO’s own role is accounting for state-projected load in its Transmission Planning Process.", p: "p. 18", pg: 18, a: "play the lead role in managing the interconnection of load" },
        { t: "That planning process is tightly bound to California state processes — the CEC’s statewide demand forecast and the CPUC’s integrated resource plans.", p: "p. 18", pg: 18, a: "integrated resource plans" },
        { t: "Alternative compliance path no other order offers: CAISO may explain whether, ‘given that CAISO does not offer the transmission services required by Order No. 888,’ its framework already addresses the concerns.", p: "p. 60", pg: 60, a: "does not offer the transmission services required by Order No. 888" },
        { t: "Scheduling Coordinators submit bids or self-schedules for all Eligible Customers; CAISO dispatches the market with all available capacity and curtails on Tariff-defined scheduling priorities when capacity runs short.", p: "pp. 18", pg: 18, a: "Scheduling Coordinators represent" },
        { t: "Participating TOs recover upgrade costs through the Transmission Access Charge: a Local Access Charge for the local component, plus a region-wide Regional Access Charge — a ‘postage stamp’ rate divided by gross load and assessed to all market participants (the high-voltage facilities sit in the regional component, low-voltage in the local).", p: "pp. 19-20", pg: 20, a: "Regional Access Charge" },
      ],
      respondentList: ["Citizen S-Line Transmission LLC", "Citizens Sunrise Transmission LLC", "Citizens Sycamore-Penasquitos Transmission LLC", "City of Anaheim, California", "City of Azusa, California", "City of Banning, California", "City of Colton, California", "City of Pasadena, California", "City of Riverside, California", "DCR Transmission, L.L.C.", "DesertLink, LLC", "GridLiance West LLC", "Horizon West Transmission, LLC", "LS Power Grid California, LLC", "Morongo Transmission LLC", "Pacific Gas and Electric Company", "San Diego Gas & Electric Company", "Southern California Edison Company", "Startrans IO, L.L.C.", "SunZia Transmission, LLC", "Trans Bay Cable LLC", "Valley Electric Association, Inc.", "Viridon Path 15, LLC", "Western Area Power Administration"],
    },
    {
      item: "E-11", rto: "ISO-NE", rtoFull: "ISO New England Inc.", docket: "EL26-72-000", url: "e11", pdf: "orders/e-11-isone-el26-72-000.pdf",
      region: "Six New England states", cite: "195 FERC ¶ 61,215", pages: 115,
      respondents: "ISO-NE + 16 Participating Transmission Owners",
      commishPages: { swett: 92, rosner: 97, see: 102, chang: 107, lacerte: 115 },
      status: "Transmission-constrained grid",
      unique: "The most transmission-constrained. With a system peak of only ~30,000 MW and significant existing constraints, FERC calls the cost-shifting and reliability risks ‘particularly acute’ here — and its planning runs off a CELT forecast that doesn’t even include large proposed data-center loads.",
      asks: [
        "How it would study and serve large loads on a system peaking at only ~30,000 MW with significant transmission constraints (P 11 n.31).",
        "Applying a PJM-style MW threshold to the ‘Monthly Regional Network Load’ behind-the-meter-netting definition (P 60).",
      ],
      dir: [
        { t: "Application / study process", q: "the application process, study procedures, and ongoing operational requirements that apply to Eligible Customers seeking transmission service on behalf of large loads", p: "P 5", pg: 25 },
        { t: "Alternative transmission technologies", q: "require the evaluation of alternative transmission technologies in transmission service request studies, using models that are capable of evaluating the transmission system", p: "P 75", pg: 75 },
        { t: "Cost-recovery agreement", q: "a pro forma cost recovery agreement between ISO-NE, the relevant transmission owner, and Eligible Customer … to mitigate the risk of cost shifting", p: "P 6", pg: 6 },
        { t: "BTMG netting", q: "it allows load with BTMG to net its BTMG against its load for purposes of calculating Regional Network Service charges", p: "P 60", pg: 60 },
        { t: "Proximate-generation service", q: "the rates, terms, and conditions of service applicable to interconnection customers serving electrically proximate large load or co-located load", p: "P 7", pg: 7 },
      ],
      reg: [
        { t: "FERC frames the risk as particularly acute in New England, citing significant transmission constraints and a system peak of only ~30,000 MW.", p: "P 11 n.31", pg: 11, a: "30,000 MW" },
        { t: "ISO-NE allocates Regional Network Service network-upgrade costs to the Eligible Customer the same way as generator-interconnection costs under Schedule 11.", p: "P 20", pg: 20, a: "Schedule 11" },
        { t: "Its Tariff lets Network Customers net BTMG via the ‘Monthly Regional Network Load’ definition; the order imports the PJM MW-threshold remedy.", p: "P 60", pg: 60, a: "Monthly Regional Network Load" },
        { t: "ISO-NE plans off the CELT load forecast, which does not generally include large proposed loads such as data centers. The order extends the PJM co-location services (compliance accepted Apr. 16, 2026, 195 FERC ¶ 61,030) here, with regional variation (PP 57-59).", p: "P 22", pg: 22, a: "CELT load forecast" },
        { t: "ISO-NE routes a large-load request through the same Cluster Study it uses for generator interconnection and Elective Transmission Upgrades, with study and commercial-readiness deposits under Schedule 22 (requests over 20 MW) or Schedule 23 (20 MW or less).", p: "pp. 19", pg: 19, a: "Schedule 22" },
        { t: "Its backbone is Regional Network Service over Pool Transmission Facilities (rated 69 kV and above), alongside Local Network Service and firm or non-firm Local Point-to-Point Service.", p: "pp. 18", pg: 18, a: "69 kV" },
      ],
      respondentList: ["Central Maine Power Company", "The Connecticut Light and Power Company", "Fitchburg Gas and Electric Light Company", "Green Mountain Power Corporation", "Maine Electric Power Company", "The Narragansett Electric Company", "New England Power Company", "New Hampshire Transmission, LLC", "NSTAR Electric Company", "Public Service Company of New Hampshire", "The United Illuminating Company", "Unitil Energy Systems, Inc.", "Vermont Electric Cooperative, Inc.", "Vermont Electric Power Company, Inc.", "Vermont Transco LLC", "Versant Power"],
    },
    {
      item: "E-12", rto: "NYISO", rtoFull: "New York Independent System Operator, Inc.", docket: "EL26-69-000", url: "e12", pdf: "orders/e-12-nyiso-el26-69-000.pdf",
      region: "New York State", cite: "195 FERC ¶ 61,216", pages: 119,
      respondents: "NYISO + 9 named New York transmission owners",
      commishPages: { swett: 96, rosner: 100, see: 106, chang: 111, lacerte: 118 },
      status: "Largely outside the tariff today",
      unique: "The least-codified. NYISO’s large-load handling lives largely outside its tariff — study deposits and assumptions sit in non-tariff documents, it has no tariff definition of ‘large load,’ and it doesn’t expect to file co-location reforms until 2027, which FERC cites as exactly why a §206 proceeding is needed now. It is also the only order with a 45-day window to seek up to a 90-day abeyance.",
      asks: [
        "How NYISO and its TOs will timely study transmission service — within 60–90 days of a request (P 44).",
        "Why a pro forma cost-recovery agreement is not necessary to ensure just and reasonable rates, or else propose one (P 89).",
        "A definition of ‘large load’ as a new category, with readiness requirements to deter speculative requests (P 64).",
      ],
      dir: [
        { t: "Timely study window", q: "how NYISO and/or the Transmission Owners will timely study (i.e., within 60-90 days of receiving the request) the provision of transmission service … on behalf of large loads", p: "P 44", pg: 31 },
        { t: "Define ‘large load’", q: "it lacks a definition of large load, as a new category of load", p: "P 64", pg: 41 },
        { t: "Alternative transmission technologies", q: "require the evaluation of alternative transmission technologies in transmission service request studies … in all instances", p: "P 68", pg: 79 },
        { t: "Cost transparency", q: "robust, accurate, and systematic provision of data on NYISO’s website in a single location … searchable and allows users to filter the data, regarding the cost for Network Upgrades", p: "P 73", pg: 47 },
        { t: "Proximate-generation service", q: "it lacks a generator interconnection study process and/or generator interconnection service to reflect an interconnection customer’s commitment … to limit the generating facility’s output", p: "P 121", pg: 72 },
      ],
      reg: [
        { t: "NYISO has load-interconnection procedures for projects > 10 MW at 115 kV+ (or ≥ 80 MW below 115 kV), but the order finds them only partially in the Tariff: study details, deposits, and assumptions sit in non-Tariff documents.", p: "PP 32, 46, 64", pg: 41, a: "115 kV" },
        { t: "It has no tariff definition of ‘large load’ as a category; the order asks it to set one, plus readiness requirements to deter speculative requests.", p: "P 64", pg: 41, a: "lacks a definition of large load" },
        { t: "NYISO already defines ‘BTM:NG Resource’ and ‘Host Load,’ but its model presumes a firm Host Load that does not participate in wholesale markets; the new directives attach to those definitions.", p: "PP 36, 96-97", pg: 58, a: "BTM:NG Resource" },
        { t: "NYISO is weighing co-location reforms but doesn’t expect to file tariff revisions until 2027, which FERC cites as why the § 206 proceeding is needed now.", p: "PP 36-37", pg: 28, a: "2027" },
        { t: "Unlike SPP, NYISO is not told to adopt HILLGA, though its Tariff may still be unjust and unreasonable without a tailored study process for proximate / co-located generation.", p: "P 123", pg: 79, a: "serving electrically proximate large load or large co-located load" },
      ],
      respondentList: ["Central Hudson Gas & Electric Corporation", "Consolidated Edison Company of New York, Inc.", "LS Power Grid New York Corporation I", "New York State Electric & Gas Corporation", "New York Transco LLC", "NextEra Energy Transmission New York, Inc.", "Niagara Mohawk Power Corp.", "Orange and Rockland Utilities, Inc.", "Rochester Gas and Electric Corporation"],
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
      body: "‘Nothing in today’s orders intrudes either on the authority of states to select, site, and permit generating resources or on the authority of state public utility commissions to set the rates, terms and conditions of retail sales of electricity.’ The DOE letter pre-builds the same defense across four legal theories anchored in New York v. FERC (535 U.S. 1) and Order No. 888, asserting jurisdiction over interconnection to transmission, not over retail sales or generation siting.",
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
    { h: "Different existing study processes", body: "RTOs/ISOs already differ in how they study transmission-service requests for large loads; some are mid-stream on stakeholder efforts addressing large-load proliferation. The orders meet each where it is.", src: ["fercFS"] },
    { h: "SPP: HILL & HILLGA", body: "SPP ‘stands out’ with its High Impact Large Load and High Impact Large Load Generation Assessment processes, expedited frameworks created to reliably serve massive new demand from loads like data centers and to study proximate generation.", src: ["fercFS"] },
    { h: "PJM: co-location on a separate track", body: "FERC addresses co-located loads in PJM in a separate proceeding, advancing it via Item E-2 on the same morning’s agenda (EL25-49).", src: ["fercFS", "fercSum"] },
    { h: "CAISO: no Order No. 888 service", body: "Transmission-service models differ, most notably CAISO, which does not offer traditional Order No. 888 transmission service.", src: ["fercFS"] },
    { h: "RTO/TO planning splits", body: "Roles and responsibilities for transmission planning are split differently among RTOs/ISOs and their transmission owners across regions, so FERC named the TOs as respondents too.", src: ["fercFS"] },
    { h: "Each RTO defines ‘large load’", body: "The orders leave room for each RTO/ISO to define large loads and to create region-particular operational requirements, and account for regional differences on cost transparency, study processes, and network upgrades.", src: ["fercFS"] },
  ];

  /* ---------------------------------------------------------------- TAB 3 */
  const reception = [
    {
      group: "Data-center developers & hyperscalers", stance: "mixed",
      body: "Speed-to-power is the prize. Expedited study tracks for flexible loads could compress today’s multi-year interconnection waits. The cost is the bill: pro forma cost-recovery agreements push 100% of network-upgrade risk onto the customer and address the ‘no-show’ problem (a developer walks, ratepayers eat the stranded infrastructure). Flexibility/curtailment becomes a bargaining chip for faster access.",
      src: ["substack", "aaf", "utilitydive"],
    },
    {
      group: "Transmission owners", stance: "mixed",
      body: "Named as respondents alongside the RTOs, TOs get clearer cost-allocation rules but assume new documentation burdens and a duty to evaluate grid-enhancing technologies before defaulting to conventional upgrades, a friction point on timelines.",
      src: ["substack", "fercFS"],
    },
    {
      group: "Generators (gas / nuclear)", stance: "positive",
      body: "Read by analysts (Capstone) as a ‘major victory’ for owners of dispatchable PJM generation such as Constellation, PSEG, and Vistra, because co-location and proximate-generation pathways raise the value of existing plants sited near load.",
      src: ["utilitydive"],
    },
    {
      group: "State utility commissions", stance: "positive",
      body: "The bifurcation hands states wholesale-side transmission-cost visibility to inform retail rate design, while preserving their authority over retail cost allocation and generation siting, easing the residential-rate-spike worry that has dominated state dockets.",
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
      { t: "‘Historic’ / ‘landmark’: the framing is near-universal across trade press and the bar, with FERC asserting itself on load interconnection in an area it historically left alone.", src: ["akin", "rew", "powermag"] },
      { t: "Speed via procedure: § 206 show cause beats a multi-year NOPR; commentators read it as DOE’s April 30 deadline operationalized across all six markets at once.", src: ["aaf", "rtoinsider"] },
      { t: "Regional flexibility reads as a deliberate design choice: SPP and PJM are treated as proactive leaders, others told to catch up without a uniform template.", src: ["powermag", "latitude"] },
      { t: "Flexibility is becoming the price of speed: practitioners read curtailable / flexible service as the most valuable near-term lever to connect faster, turning a load’s willingness to limit usage into bargaining power.", src: ["duanemorris", "norris"] },
    ],
    friction: [
      { t: "Cost allocation is the central fight: how aggressively must large loads pre-fund and backstop upgrades, and over what crediting term? The ANOPR explicitly left crediting open.", src: ["utilitydive", "doe403"] },
      { t: "Co-location / BTM remains contested: one commentator reads the orders as reopening BTM access a December PJM ruling had narrowed, and PJM’s separate E-2 track shows the issue isn’t settled.", src: ["substack", "whitecase"] },
      { t: "Speed vs. rigor: the orders set a 45-day window to request abeyance of up to 90 days (NYISO P 42), which prevents indefinite stalling but compresses stakeholder process; the mandatory alternative-transmission-technology evaluation could itself add study time.", src: ["e12", "substack"] },
      { t: "Coverage-gap questions: commenters flag that some transmission owners (e.g., Nebraska Public Power District, Great River Energy) appear absent from the published respondent lists, a completeness question to watch.", src: ["substack"] },
      { t: "The cost-allocation fight is already concrete and pending: Maryland’s ratepayer advocate, backed by 80 state lawmakers (June 17, 2026), says PJM’s tariff lets data-center transmission costs ‘leak’ across zones — ‘an unjust subsidy for that data center load’ — and pegs Maryland’s exposure near $1.6 billion over a decade (FERC comment window extended to July 27, 2026).", src: ["mdopc", "utilitydive"] },
      { t: "Fragmentation risk: six regional answers on six different timelines give multi-region developers clarity within a market but a patchwork across them, and fresh diligence for near-term deals.", src: ["utilitydive", "duanemorris"] },
    ],
    // outlet chips render from cited source records (each links to its SOURCES entry) — no uncited names.
    outlets: ["utilitydive", "rtoinsider", "latitude", "tdworld", "powermag", "rew", "akin", "sheppard", "whitecase", "natlaw", "aaf", "substack", "heatmap", "duanemorris"],
  };

  // Named commentary spanning the political spectrum (Tab 3). Each is the source's own
  // position, attributed and linked; lean is the commentator's general orientation on energy policy.
  const voices = [
    {
      name: "Tyler Norris", affil: "Duke Nicholas Institute", lean: "nonpartisan",
      take: "The research case behind the flexible-load category: curtailing roughly 0.25% to 1% of a large load’s annual peak lets the existing grid absorb tens of gigawatts of new demand, so a curtailable data center can connect years sooner than a firm-load study would allow.",
      src: ["norris"],
    },
    {
      name: "Travis Kavulla", affil: "American Affairs · NRG", lean: "right",
      take: "Wants grid access priced, not rationed: borrow the natural-gas ‘open season’ so large loads bid for transferable interconnection rights instead of queuing first-come, first-served. Reads the orders’ cost-causation push as a step toward that, but short of market pricing.",
      src: ["kavulla"],
    },
    {
      name: "Devin Hartman", affil: "R Street Institute", lean: "right",
      take: "Supportive of the design: calls the action ‘far more substantively ambitious than the ANOPR,’ with region-specific §206 pathways more effective than a uniform rule. Faults it mainly for leaving out non-RTO areas, which he says have the worst interconnection practices.",
      src: ["utilitydive"],
    },
    {
      name: "Sierra Club", affil: "environmental advocacy", lean: "left",
      take: "Cautiously positive: the announcement is ‘responsive to Sierra Club’s requests on several fronts, including protecting consumers from costs incurred by large loads,’ with the full orders still to be reviewed.",
      src: ["insideclimate"],
    },
    {
      name: "Southern Environmental Law Center", affil: "Nick Guidi, senior attorney", lean: "left",
      take: "Unconvinced by the cost guardrail: ‘There’s no real quarantining of the cost caused by data centers to those data centers,’ so it gets ‘spread throughout the whole customer base.’ Wanted more federal standardization than the orders deliver.",
      src: ["insideclimate"],
    },
    {
      name: "Public Citizen", affil: "consumer watchdog", lean: "left",
      take: "The most skeptical: pressed FERC for a temporary moratorium on new data-center interconnections until NERC reliability alerts are resolved, and warns against weakening state authority over data centers.",
      src: ["publiccitizen"],
    },
    {
      name: "Mona Dajani", affil: "Cooley LLP", lean: "nonpartisan",
      take: "Reads the six-order route as the end of any national template: ‘The era of one national standard for data center interconnection is over before it began.’ What replaces it, she says, is ‘six regional answers to the same question, decided on six different timelines’ — clarity within each region, fragmentation across them.",
      src: ["utilitydive"],
    },
    {
      name: "Neil Chatterjee", affil: "former FERC chairman", lean: "right",
      take: "Calls it ‘a very FERC-y approach’ — approving of the choice to push region-specific reform through §206 show cause orders rather than one national rule, which he reads as both faster to deliver and harder to challenge.",
      src: ["heatmap"],
    },
  ];

  /* ------------------------------------------------ TAB 3: RM26-4 comment corpus */
  // Scraped from FERC's eLibrary docket sheet (past Cloudflare) on 2026-06-24; full manifest +
  // categorization saved at sources/comments/. Stats are mechanical; bucket positions are a provisional
  // read of each camp pending review of the filing PDFs. Bucket counts sum to `total`.
  const comments = {
    docket: "RM26-4-000",
    url: "https://elibrary.ferc.gov/eLibrary/docketsheet?docket_number=RM26-4-000",
    captured: "2026-06-24",
    filings: 423, total: 273, orgs: 201, interventions: 128, individuals: 15,
    peak: "Nov 21, 2025", peakN: 183, lastFiled: "2026",
    docsInventoried: 273, filesTotal: 281, attachments: 7, downloaded: 272, summarized: 9,
    note: "All 423 docket filings scraped from FERC eLibrary on 2026-06-24, with a document/attachment inventory for all 273 comments. 272 of the 273 comment bodies are downloaded and text-extracted (PDFs via fitz, DOCX via textutil; 4 image-only scans await OCR, 1 filing would not download); the 9 flagships below are read in full. Stakeholder buckets are keyword-derived and the per-camp notes are a provisional read. Audit trail and a validation tool live under sources/comments/.",
    buckets: [
      { label: "Transmission owners & utilities", n: 42, egs: ["Duke", "PG&E", "Eversource", "PSEG", "AEP", "Exelon"], note: "The largest camp; they back clearer large-load rules but want cost-recovery certainty and to keep load-interconnection authority with the transmission owners." },
      { label: "Generators, IPPs & developers", n: 37, egs: ["NRG", "Vistra", "LS Power", "AES", "Fervo", "Oklo"], note: "Favor co-location and proximate-generation pathways that lift the value of dispatchable and new generation (the ‘bring your own generation’ case)." },
      { label: "Data centers, hyperscalers & tech", n: 29, egs: ["Google", "Data Center Coalition", "Digital Energy Council", "Equinix", "Oracle"], note: "Push speed to power and flexible-load service, willing to curtail in exchange for faster, non-discriminatory interconnection." },
      { label: "State commissions", n: 27, egs: ["Maryland PSC", "Georgia PSC", "NY PSC", "NARUC", "OMS / OPSI / NESCOE"], note: "Guard state authority over retail rates and siting, and want the transparency to keep data-center costs off other retail customers." },
      { label: "Trade associations & power groups", n: 25, egs: ["WIRES", "APPA", "Large Public Power Council", "EEI", "co-ops"], note: "Mixed: transmission builders such as WIRES back the push, while public power and cooperatives want firm cost protections for their members." },
      { label: "Clean energy & storage", n: 16, egs: ["ACP", "SEIA", "Advanced Energy United", "Fluence"], note: "Support flexible-load service and grid-enhancing technologies, and want non-discriminatory access for storage and flexible resources." },
      { label: "Individuals", n: 15, egs: ["members of the public"], note: "Affordability and demand-reduction concerns from individual filers." },
      { label: "Consumer advocates", n: 14, egs: ["PA OCA", "Ohio Consumers’ Counsel", "Maryland OPC", "DE Public Advocate"], note: "Center residential ratepayers and press for strong cost causation so data-center load pays its own way." },
      { label: "Environmental & public interest", n: 13, egs: ["Sierra Club", "Public Citizen", "Center for Biological Diversity", "ELPC"], note: "Cost protection plus reliability; some, such as Public Citizen, press hardest toward pauses pending reliability review." },
      { label: "Industrial & large customers", n: 9, egs: ["IECA", "PJM Industrial Customer Coalition", "Steel Manufacturers", "U.S. Chamber"], note: "Want existing industrial load shielded from cost-shifting as data centers connect, with cost causation on the new load." },
      { label: "Think tanks & research", n: 9, egs: ["R Street", "Institute for Progress", "Cato", "ClearPath"], note: "Market-oriented: price grid access, reward flexibility, and avoid a single national rule across six unlike markets." },
      { label: "RTOs / ISOs", n: 7, egs: ["PJM", "MISO", "SPP", "CAISO", "ISO-NE", "NYISO"], note: "Describe their own existing processes and, for PJM and SPP, reforms already filed; they caution against a uniform rule that overrides regional design." },
      { label: "Demand response & flexible load", n: 7, egs: ["Voltus", "CPower", "Enchanted Rock", "Enel"], note: "Flexibility is the lever: expedited, curtailable service for loads that agree to limit withdrawals." },
      { label: "Elected officials", n: 6, egs: ["Sen. Markey et al.", "Senate Energy Cmte.", "Govs. Shapiro & Youngkin"], note: "Bipartisan ratepayer-protection pressure that households should not bear data-center-driven costs." },
      { label: "Reliability & market monitors", n: 4, egs: ["NERC", "PJM IMM", "SPP MMU"], note: "Large-load registration and reliability standards (NERC); cost-allocation and market-power oversight (the market monitors)." },
      { label: "Oil, gas & fuels", n: 3, egs: ["American Public Gas Assn.", "Chevron", "API"], note: "Fold natural-gas considerations and gas-fired co-location into the reforms." },
      { label: "Other / uncategorized", n: 10, egs: ["CTC Global", "Antora Energy", "State Water Project"], note: "A long tail the keyword pass did not slot: vendors, a state water project, and miscellaneous filers." },
    ],
    // Flagship comments downloaded and read in full; stance per reform category, with the audit chain
    // (eLibrary filing → downloaded file → sources/comments/summaries/<accession>.json).
    flagships: [
      { acc: "20251113-4000", filer: "U.S. Senator Edward J. Markey et al.", bucketLabel: "Elected officials", summary: "A senators’ letter urging FERC to act so households are not forced to bear data-center-driven costs, citing record PJM capacity prices and tens of billions in rate increases.", quote: "We write to urge the Federal Energy Regulatory Commission (FERC) to take immediate action to ensure that U.S. households are not forced to bear the costs of the growing nationwide demand for energy by data centers.", stances: { study: "silent", cost: "strong support", colo: "silent", flex: "silent", proximate: "silent" }, file: "2026-00005 Sen. Markey+ (incoming).pdf", elibrary: "https://elibrary.ferc.gov/eLibrary/filelist?accession_Number=20251113-4000" },
      { acc: "20251119-5170", filer: "NRG Energy, Inc.", bucketLabel: "Generators / IPPs / developers", summary: "Supports the ANOPR’s principles but proposes five discrete changes; most notably pricing interconnection capacity through gas-pipeline-style ‘open seasons’ rather than first-come queues.", quote: "NRG proposes that the final rule ... provide for the use of open seasons to expedite large load interconnections and to efficiently allocate interconnection capacity to such interconnections.", stances: { study: "support", cost: "strong support", colo: "support", flex: "support", proximate: "support" }, file: "Comments of NRG Energy ... signed Travis Kavulla.docx", elibrary: "https://elibrary.ferc.gov/eLibrary/filelist?accession_Number=20251119-5170" },
      { acc: "20251121-5212", filer: "Maryland Public Service Commission", bucketLabel: "State commissions", summary: "Treats large-load interconnection as critically important amid unprecedented growth, baseload retirements, and slow new generation; backs reform while preserving state authority over retail rates and siting and protecting Maryland ratepayers.", quote: "this large load expansion unequivocally places significant new demand on the electric grid in Maryland, in the broader PJM region, and beyond—presenting unique hurdles for demand forecasting and system planning.", stances: { study: "support", cost: "support", colo: "support", flex: "support", proximate: "support" }, file: "RM26-4 Large Load ANOPR - MDPSC Comments.pdf", elibrary: "https://elibrary.ferc.gov/eLibrary/filelist?accession_Number=20251121-5212" },
      { acc: "20251121-5227", filer: "Industrial Customer Organizations (IECA, AF&PA, PJM ICC, Coalition of MISO Transmission Customers)", bucketLabel: "Industrial & large customers", summary: "A coalition of large industrial customers presses hardest on cost causation: large loads must bear the network-upgrade costs they trigger so existing industrial and other customers are not saddled with data-center-driven costs.", quote: null, stances: { study: "support", cost: "strong support", colo: "support", flex: "mixed", proximate: "support" }, file: "Industrial Joint Comments RM26-4.pdf", elibrary: "https://elibrary.ferc.gov/eLibrary/filelist?accession_Number=20251121-5227" },
      { acc: "20251121-5242", filer: "PA Office of Consumer Advocate & DE Division of the Public Advocate", bucketLabel: "Consumer advocates", summary: "Speaking for utility consumers, the joint advocates back the reform but center residential ratepayers: data-center load should pay its own way through strong cost causation and transparency so households are not subsidizing it.", quote: null, stances: { study: "support", cost: "strong support", colo: "support", flex: "support", proximate: "mixed" }, file: "Joint Consumer Advocates (PA, DE) Comments.pdf", elibrary: "https://elibrary.ferc.gov/eLibrary/filelist?accession_Number=20251121-5242" },
      { acc: "20251121-5301", filer: "Edison Electric Institute", bucketLabel: "Trade associations & power groups", summary: "The investor-owned utilities’ association supports standardizing large-load interconnection while keeping reliability and affordability central and recognizing utilities’ front-line role in integrating large loads.", quote: "EEI member companies serve nearly 250 million Americans and operate in all fifty states and the District of Columbia. EEI members own and operate our nation’s most critical infrastructure.", stances: { study: "support", cost: "support", colo: "support", flex: "support", proximate: "support" }, file: "EEI Comments on DOE Large Load ANOPR.pdf", elibrary: "https://elibrary.ferc.gov/eLibrary/filelist?accession_Number=20251121-5301" },
      { acc: "20251121-5506", filer: "American Clean Power Association", bucketLabel: "Clean energy & storage", summary: "The clean-energy and storage trade group backs timely, reliable, cost-effective large-load interconnection paired with the supply-side resources to serve it, and urges record development (including jurisdictional determinations) before any rule.", quote: "Ensuring the timely, reliable, and cost-effective interconnection of large loads – along with the supply-side resources that will provide power to them – is an issue of utmost importance.", stances: { study: "support", cost: "support", colo: "support", flex: "strong support", proximate: "support" }, file: "ACP Large load comments FINAL.pdf", elibrary: "https://elibrary.ferc.gov/eLibrary/filelist?accession_Number=20251121-5506" },
      { acc: "20251121-5511", filer: "PJM Interconnection, L.L.C.", bucketLabel: "RTOs / ISOs", summary: "Supports a nationwide ‘level playing field’ for large-load interconnection based on physical principles, but urges FERC to respect the outcomes of PJM’s own ongoing, expedited stakeholder processes rather than override regional design.", quote: "By creating a level playing field across the country, FERC and the Department of Energy can promote large load infrastructure decisions that are made based on physical principles as opposed to uneven regulatory frameworks.", stances: { study: "support", cost: "support", colo: "mixed", flex: "support", proximate: "support" }, file: "20251121-rm26-4-000.pdf", elibrary: "https://elibrary.ferc.gov/eLibrary/filelist?accession_Number=20251121-5511" },
      { acc: "20251121-5539", filer: "Google LLC", bucketLabel: "Data centers, hyperscalers & tech", summary: "Frames timely large-load interconnection as central to the AI race and national security, and urges FERC to prioritize the reforms it can implement fastest: the ones that maximize existing infrastructure and reward flexibility to minimize grid strain.", quote: "Google urges the Commission to promptly and pragmatically prioritize the reforms that can be implemented most quickly and that will incentivize digital and energy infrastructure development in a manner that maximizes use of the existing infrastructure and minimizes strain on the grid.", stances: { study: "support", cost: "support", colo: "support", flex: "strong support", proximate: "support" }, file: "Comments of Google LLC.pdf", elibrary: "https://elibrary.ferc.gov/eLibrary/filelist?accession_Number=20251121-5539" },
    ],
  };

  /* ---------------------------------------------------------------- OVERVIEW */
  // The five concurring statements are attached to every order and read essentially the same across the
  // six, so the emphasis (gist) lives here once; each docket cites the quote's page in its OWN order via
  // docket.commishPages. `quote` is verbatim in all six orders (a test enforces this).
  const commissioners = [
    {
      key: "swett", name: "Laura V. Swett", role: "Chairman", short: "Why §206, not a rulemaking",
      quote: "FERC is no longer the sleepy, responsive agency of the past",
      gist: "Defends the procedure: six tailored show cause orders instead of one rule, because §206 is faster and more ‘legally durable.’ Points to rulemakings like Order Nos. 2023 and 2222 still not fully implemented years on, and notes the six markets cover nearly two-thirds of FERC-jurisdictional load.",
    },
    {
      key: "rosner", name: "David Rosner", role: "Commissioner", short: "Four pillars",
      quote: "Bring Your Own New Generation",
      gist: "Frames the orders as four pillars — protecting consumers, safeguarding reliability, enhancing transparency, fostering innovation. Stresses Cost Recovery Agreements so a data center that never shows up can’t shift costs onto residential customers, grid-enhancing technologies, and ‘Bring Your Own New Generation’ modeled on SPP’s HILLGA.",
    },
    {
      key: "see", name: "Lindsay S. See", role: "Commissioner", short: "Federalism + affordability",
      quote: "affordability must be at the forefront as we protect consumers",
      gist: "Two themes: large-load interconnection is a shared federal-State responsibility, so the orders should support state efforts rather than override them; and affordability must stay central. Pushes alternative transmission technologies to hold down network-upgrade costs and asks states what cost data they actually need.",
    },
    {
      key: "chang", name: "Judy W. Chang", role: "Commissioner", short: "Records & cost causation",
      quote: "The FPA is fundamentally a customer protection statute",
      gist: "Focuses on building records that survive review under §206’s ex parte limits, calling the FPA ‘fundamentally a customer protection statute.’ Warns that cost-recovery agreements ‘untethered from any assessment of the actual cost’ of serving a load may not protect other customers, and notes the orders deliberately don’t assert the ANOPR’s broadest jurisdictional theory.",
    },
    {
      key: "lacerte", name: "David LaCerte", role: "Commissioner", short: "Jurisdictional hardball",
      quote: "I am prepared to play jurisdictional hardball, if needed",
      gist: "The sharpest tone. Invites region-specific §205 proposals and offers operators the ‘first pen,’ but says he is ‘prepared to play jurisdictional hardball’ — if they don’t file real fixes, FERC will ‘dictat[e] the solutions for you.’ Ties the orders to state Ratepayer Protection Pledges.",
    },
  ];

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
      { label: "eComment", url: "https://ferconline.ferc.gov/eComment.aspx", note: "Short, text-only comments; no account needed." },
      { label: "eFiling", url: "https://ferconline.ferc.gov/eFiling.aspx", note: "Documents/attachments; interventions, protests, comments. Requires eRegister." },
      { label: "eLibrary docket search", url: "https://elibrary.ferc.gov/eLibrary/search", note: "Read every filing in a docket." },
      { label: "eSubscription", url: "https://ferconline.ferc.gov/eSubscription.aspx", note: "Email alerts when a docket gets a new filing." },
      { label: "Office of Public Participation", url: "https://www.ferc.gov/OPP", note: "Help navigating the process · opp@ferc.gov · 202-502-6595." },
    ],
  };

  return { SOURCES, meta, kpis, timeline, toplines, categories, dockets, jurisdiction, regional, reception, media, voices, comments, commissioners, participate };
})();
