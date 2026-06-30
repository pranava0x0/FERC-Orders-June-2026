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
    e2: { label: "Order E-2 (PJM co-location): EL25-49-002 · 195 FERC ¶ 61,209", org: "FERC", tier: "order", url: "https://www.ferc.gov/media/e-2-el25-49-002", captured: "2026-06-30", note: "Downloaded & OCR'd, 278 pp; Order on Rehearing, Clarification, Compliance Filing, and Paper Hearing in PJM’s co-location proceeding, issued June 18, 2026 at the same meeting as E-7 to E-12; caption verified. The foundational co-location order the six show cause orders extend." },
    akin: { label: "“FERC Issues Landmark Show Cause Orders on Large Load Interconnection”", org: "Akin Gump (Speaking Energy)", tier: "secondary", url: "https://www.akingump.com/en/insights/blogs/speaking-energy/ferc-issues-landmark-show-cause-orders-on-large-load-interconnection", captured: "2026-06-22", note: "Law-firm client alert." },
    sheppard: { label: "“FERC Orders Six RTOs to Address Specific Reforms… Speed to Power”", org: "Sheppard Mullin", tier: "secondary", url: "https://www.sheppard.com/insights/blogs/ferc-orders-six-rtos-to-address-specific-reforms-to-effectuate-speed-to-power-that-will-facilitate-the-integration-of-large-loads", captured: "2026-06-22", note: "Law-firm client alert." },
    whitecase: { label: "“PJM proposes to carve out new services for co-located data centers”", org: "White & Case", tier: "secondary", url: "https://www.whitecase.com/insight-alert/pjm-proposes-carve-out-new-services-co-located-data-centers", captured: "2026-06-22", note: "Co-location context (PJM EL25-49 line)." },
    pjmcoloc: { label: "“FERC Issues Order Clarifying Data Center and Large Load Interconnection Procedures in PJM”", org: "National Law Review", tier: "secondary", url: "https://natlawreview.com/article/ferc-issues-order-clarifying-data-center-and-large-load-interconnection-procedures", captured: "2026-06-27", note: "FERC’s Dec. 18, 2025 PJM co-location order (EL25-49-000, 193 FERC ¶ 61,217): found PJM’s tariff unjust and unreasonable; set co-located-load procedures, interim non-firm and contract-demand transmission service, and behind-the-meter netting limits for large loads. The ‘December PJM ruling’ the June orders build on." },
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
    kavullali: { label: "Travis Kavulla on data-center power pricing", org: "Travis Kavulla on LinkedIn", tier: "secondary", url: "https://www.linkedin.com/posts/travis-kavulla-a199994_how-will-data-centers-pay-for-power-american-activity-7462986821577400321-Lakz", captured: "2026-06-29", note: "LinkedIn post around Kavulla's American Affairs argument; the comment thread sharpened the point that large-load competition between regulated monopolies can erode consumer surplus if hyperscalers do not internalize incremental infrastructure costs." },
    insideclimate: { label: "“Federal Regulators Tell Grid Operators to Fix Their Rules on Data Centers”", org: "Inside Climate News", tier: "secondary", url: "https://insideclimatenews.org/news/18062026/federal-energy-regulatory-commission-data-center-orders/", captured: "2026-06-23", note: "June 18, 2026 coverage carrying Sierra Club and Southern Environmental Law Center reactions." },
    publiccitizen: { label: "“FERC Must Reconsider Risks Posed by Data Centers to Power Grids”", org: "Public Citizen", tier: "secondary", url: "https://www.citizen.org/news/ferc-must-reconsider-risks-posed-by-data-centers-to-power-grids/", captured: "2026-06-23", note: "Consumer-watchdog stance; pressed for a temporary moratorium on new data-center interconnections pending NERC reliability alerts." },
    // Post-issuance commentary refresh (gathered 2026-06-24).
    heatmap: { label: "“FERC Has a New Plan for Data Centers”", org: "Heatmap News (Matthew Zeitlin)", tier: "secondary", url: "https://heatmap.news/energy/ferc-data-center-plan", captured: "2026-06-24", note: "Analysis; carries former FERC chairman Neil Chatterjee’s ‘a very FERC-y approach’ reaction and PJM price-surge context." },
    duanemorris: { label: "“FERC Acts to Advance Data Center and Large Load Integration in Six RTO Regions”", org: "Duane Morris LLP", tier: "secondary", url: "https://www.duanemorris.com/alerts/ferc_acts_advance_data_center_large_load_integration_six_rto_regions_0626.html", captured: "2026-06-24", note: "Law-firm alert; partner Robert Montejo on flexibility as connection leverage." },
    mdopc: { label: "“Maryland lawmakers back data center transmission cost complaint at FERC”", org: "Utility Dive", tier: "secondary", url: "https://www.utilitydive.com/news/maryland-ratepayer-advocate-ferc-data-center-complaint-transmission/823244/", captured: "2026-06-24", note: "Maryland Office of People’s Counsel complaint on PJM cost allocation; 80 state lawmakers in support; ~$1.6B ratepayer exposure cited." },
    // Coverage refresh (gathered 2026-06-27): the story moved past trade/law press into analyst, mainstream and sector outlets.
    bloomberglaw: { label: "“Energy Regulator Staves Off Critique in New Data Center Orders”", org: "Bloomberg Law", tier: "secondary", url: "https://news.bloomberglaw.com/environment-and-energy/energy-regulator-staves-off-critique-in-new-data-center-orders", captured: "2026-06-27", note: "Analyst read that the per-RTO §206 record is built to resist litigation; quotes Jennifer Danis (Institute for Policy Integrity), Larry Gasteiger (WIRES) and Matthew Christiansen (Wilson Sonsini)." },
    thehill: { label: "“FERC lays out AI data center, grid operator reforms”", org: "The Hill", tier: "secondary", url: "https://thehill.com/policy/energy-environment/5931287-ai-data-centers-grid-operators-ferc/", captured: "2026-06-27", note: "Mainstream political-press coverage; carries the federal-transmission vs. state-retail cost-shifting split." },
    dcknowledge: { label: "“FERC Targets Grid Rules for Data Centers and Large Loads”", org: "Data Center Knowledge", tier: "secondary", url: "https://www.datacenterknowledge.com/build-design/ferc-targets-grid-rules-for-data-centers-and-large-loads", captured: "2026-06-27", note: "The affected industry’s own trade press; developer-side read on speed-to-power." },
    enr: { label: "“FERC Orders Grid Operators to Rework Data Center Power Rules”", org: "Engineering News-Record", tier: "secondary", url: "https://www.enr.com/articles/63195-ferc-orders-grid-operators-to-rework-data-center-power-rules", captured: "2026-06-27", note: "Engineering and construction trade coverage." },
    ieee: { label: "“U.S. Pushes Grid Operators to Connect Data Centers Faster”", org: "IEEE Spectrum", tier: "secondary", url: "https://spectrum.ieee.org/ferc-data-center-policy", captured: "2026-06-27", note: "Engineering and technical-audience coverage of the June 18 orders; speed-to-connect paired with consumer cost protections." },
    peskoe: { label: "“An outdated FERC policy is undermining the White House’s ratepayer protection pledge”", org: "Utility Dive", tier: "secondary", url: "https://www.utilitydive.com/news/ferc-transmission-policy-white-house-ratepayer-protection-peskoe/815438/", captured: "2026-06-28", note: "Op-ed by Ari Peskoe (Harvard Electricity Law Initiative), published 2026-04-15: argues FERC’s 1994 transmission-pricing policy lets utilities socialize data-center upgrade costs, and that FERC should require full cost assignment plus disaggregated-pricing transparency." },
    latitudedocket: { label: "“What’s in FERC’s large load interconnection docket”", org: "Latitude Media", tier: "secondary", url: "https://www.latitudemedia.com/news/whats-in-fercs-large-load-interconnection-docket/", captured: "2026-06-28", note: "Docket-comment analysis (2025-11-25): AI/tech filers agree the current process hampers growth but split on federal preemption; OpenAI proposes a >250 MW ‘national interest’ fast lane, while Google, Meta, Amazon and the Data Center Coalition favor preserving the state role." },
    doeApplaud: { label: "“The Department of Energy Applauds FERC’s Action on Large Load Interconnection Reform”", org: "U.S. Department of Energy", tier: "doe", url: "https://www.energy.gov/articles/department-energy-applauds-fercs-action-large-load-interconnection-reform", captured: "2026-06-28", note: "Official DOE statement, June 18, 2026: the agency that directed FERC (via the §403 ANOPR) endorses the show cause orders as speed-to-power with ratepayer protection; carries a Secretary Wright quote." },
    techcrunch: { label: "“AI data centers just got a government-mandated fast lane to the grid”", org: "TechCrunch", tier: "secondary", url: "https://techcrunch.com/2026/06/18/ai-data-centers-just-got-a-government-mandated-fast-lane-to-the-grid/", captured: "2026-06-29", note: "Tech / startup press framing: FERC gives data centers and other large loads a faster interconnection path, while the power-supply shortage remains the harder bottleneck." },
    apdata: { label: "“Federal regulators order grid operators to speed power to energy-hungry AI data centers”", org: "Associated Press", tier: "secondary", url: "https://apnews.com/article/power-electricity-ai-plants-data-centers-grid-506e3d206871111f15c3c62fc5368be5", captured: "2026-06-29", note: "Mainstream wire coverage: unanimous FERC vote, state retail-rate authority preserved, data centers assigned upgrade costs, and public backlash over power, water, noise and land-use impacts." },
    tomhardware: { label: "“US energy regulator to order grid operators to expedite AI data center applications”", org: "Tom’s Hardware", tier: "secondary", url: "https://www.tomshardware.com/tech-industry/data-centers/us-energy-regulator-to-order-grid-operators-to-expedite-ai-data-center-applications-says-projects-should-bring-their-own-power-or-cut-usage-during-high-demand", captured: "2026-06-29", note: "Hardware / tech-industry read: the fast lane is tied to bring-your-own-power or curtailment, while the article links the order to PJM rate pressure, Maryland cost-allocation backlash, and local opposition to data centers." },
    dcdpowerup: { label: "“Republican senator introduces bill to impose federal rules on data center grid connections”", org: "Data Center Dynamics", tier: "secondary", url: "https://www.datacenterdynamics.com/en/news/republican-senator-introduces-bill-to-impose-federal-rules-on-data-center-grid-connections/", captured: "2026-06-29", note: "Federal-legislation context: Sen. Cynthia Lummis's POWER Up Act would set a 100 MW large-load threshold and direct FERC to issue standardized transmission-level interconnection rules while preserving state/local authority over siting, retail rates and generation." },
    eenewsferc: { label: "“FERC acts to force US markets to protect electricity ratepayers”", org: "E&E News by POLITICO", tier: "secondary", url: "https://www.eenews.net/articles/ferc-acts-to-force-us-markets-to-protect-electricity-ratepayers/", captured: "2026-06-29", note: "E&E / Politico coverage of the June 18 orders; Josh Siegel contributed to the story. Carries Nvidia, EEI, John Miller, Neil Chatterjee and Robert Gramlich reactions around ratepayer protection, speed-to-power and jurisdiction." },
    xschifman: { label: "“FERC Reforms Large Load Interconnection; Security Gaps Remain”", org: "Ben Schifman on X", tier: "secondary", url: "https://x.com/BenSchifman/article/2067679572431138993", captured: "2026-06-29", note: "X article surfaced in the social scan: reads FERC's large-load reform as an interconnection-speed move but flags unresolved grid-security and reliability questions." },
    xnearco: { label: "“The Sixty-Day Clock: FERC”", org: "NeArco Capital on X", tier: "secondary", url: "https://x.com/NearcoCapital/article/2069126584909303911", captured: "2026-06-29", note: "X article surfaced in the social scan: investor / infrastructure framing around the 60-day response clock and the physical scarcity of power for data centers." },
    xhalcyon: { label: "“What’s Happening in Energy June 26”", org: "Halcyon on X", tier: "secondary", url: "https://x.com/Halcyon/article/2070478226141712581", captured: "2026-06-29", note: "X article surfaced in the social scan: curates the FERC large-load action into a broader energy-alert stream, showing the order is now part of the recurring data-center / grid watchlist." },
    jigarferc: { label: "Jigar Shah on FERC's June 18 large-load orders", org: "Jigar Shah on LinkedIn", tier: "secondary", url: "https://www.linkedin.com/posts/jigarshahdc_on-june-18-ferc-didnt-issue-a-sweeping-activity-7475542327546122240-WudI", captured: "2026-06-29", note: "Former DOE Loan Programs Office director Jigar Shah reads the orders as a clever region-by-region move that targets the speed-to-power bottleneck, not the underlying electricity-price problem; he also flags missing public capacity / demand data." },
    benferc: { label: "Ben Inskeep on FERC large-load interconnection", org: "Ben Inskeep on X", tier: "secondary", url: "https://x.com/Ben_Inskeep/status/2068025625860841880", captured: "2026-06-29", note: "X reaction surfaced in the social scan: Citizens Action Coalition's Ben Inskeep rejects the premise that data centers need more help connecting to the grid, while saying he is encouraged to see FERC's large-load interconnection action." },
    bennerc: { label: "“NERC issues Level 3 alert, mandates action to address data center load losses”", org: "Utility Dive", tier: "secondary", url: "https://www.utilitydive.com/news/nerc-issues-rare-level-3-alert-over-data-center-load-losses/819295/", captured: "2026-06-29", note: "Reliability context for Ben Inskeep's data-center stance: warns that data-center-driven grid instability could become severe and calls for standards protecting ratepayers from stability, reliability and resiliency impacts." },
    mohanferc: { label: "Affidavit of Levitt, Mohan, Quint and Tanneeru on behalf of Eolian", org: "Eolian / Brattle / Elevate Energy Consulting", tier: "secondary", url: "https://www.brattle.com/wp-content/uploads/2025/11/2025.11.21-RM26-4-Affidavit-of-Levitt-et-al-for-Eolian-L.P.pdf", captured: "2026-06-29", note: "RM26-4 filing co-authored by Aniruddh Mohan: argues that hybrid large-load / generation facilities can be studied by modeling both generation and load, including dispatchability and load curtailment, so N-0 and N-1 flows stay within limits." },
    mohanx: { label: "Aniruddh Mohan on PJM data-center transmission cost scrutiny", org: "Aniruddh Mohan on X", tier: "secondary", url: "https://x.com/aniruddh_mohan/status/2069973894237184457", captured: "2026-06-29", note: "X post surfaced in the social scan: flags increasing scrutiny over who pays for transmission to connect data centers, including the Maryland ratepayer complaint against PJM and the claim that Maryland ratepayers face more than $2 billion in transmission costs for new data centers." },
    arthurwm: { label: "“Data centers are adding an extra 220 gigawatts of electricity demand in the US”", org: "Wood Mackenzie / Energy Gang", tier: "secondary", url: "https://www.woodmac.com/podcasts/energy-gang/data-centers-are-adding-an-extra-220-gigawatts-of-electricity-demand-in-us/", captured: "2026-06-29", note: "Developer-operations lens: Arthur Haubenstock (Equinix) discusses real data-center electricity needs, the limits of bring-your-own-power / bring-your-own-new-clean-energy ideas, backup generation constraints, local grid impacts and why grids matter." },
    jeffdennis: { label: "“FERC Directs Grid Reform to Support Large Loads and Customer Affordability”", org: "Jeff Dennis / Electricity Customer Alliance", tier: "secondary", url: "https://www.linkedin.com/posts/jeffdennis77_ecaferclargeloadinterconnectionstatementpdf-activity-7473477334738599936-NWa-", captured: "2026-06-29", note: "Electricity Customer Alliance statement from Jeff Dennis: supports FERC's direction to speed large-load interconnection while making new large loads bear the costs incurred to serve them, improving transparency, and working with states." },
    simonmahan: { label: "“Southeast Energy Opportunities Require a Bigger, Better, Faster Grid”", org: "CEBA / Southern Renewable Energy Association", tier: "secondary", url: "https://ceba.org/southeast-energy-opportunities-require-a-bigger-better-faster-grid-business-leaders-call-for-regional-transmission-planning/", captured: "2026-06-29", note: "Simon Mahan (SREA) argues that manufacturers and data centers are bringing jobs to the Southeast, but without modern regional transmission the region risks higher prices, power shortages and lost economic opportunity." },
    briggswhite: { label: "“Demand is Here — Are We Ready to Build?”", org: "Briggs White on LinkedIn", tier: "secondary", url: "https://www.linkedin.com/pulse/demand-hereare-we-ready-build-briggs-white-cixae", captured: "2026-06-29", note: "Briggs White (Keystone Ascent) frames data-center demand as a physical infrastructure and supply-chain buildout: co-location is now assumed, emergency load reduction deserves deeper analysis, and long lead times for gas turbines, transformers and interconnection force regulators to balance affordability and reliability." },
    heathermcgeory: { label: "“American Energy, American AI: Powering a Secure Future”", org: "American Clean Power", tier: "secondary", url: "https://cleanpower.org/blog/american-energy-american-ai-powering-a-secure-future/", captured: "2026-06-29", note: "CoreWeave hyperscaler voice: Heather McGeory says data-center power conversations have moved from megawatts to gigawatts, and frames energy availability as a national-security / AI-infrastructure issue." },
    aysecoskun: { label: "“Transforming Data Centers into Grid-Responsive Powerhouses”", org: "Boston University", tier: "secondary", url: "https://www.bu.edu/eng/2025/07/01/transforming-data-centers-into-grid-responsive-powerhouses/", captured: "2026-06-29", note: "Academic / Emerald AI voice: Ayse Coskun's research makes data-center energy flexibility central to grid stability and sustainability; relevant to FERC's flexible-load study category." },
    varunsivaram: { label: "“The rise of flexible data centers”", org: "Latitude Media", tier: "secondary", url: "https://www.latitudemedia.com/news/catalyst-the-rise-of-flexible-data-centers/", captured: "2026-06-29", note: "Emerald AI voice: Varun Sivaram argues AI data centers can operate as flexible grid assets rather than fixed loads; related search also surfaced his LinkedIn post on visits to the White House, FERC and DOE to showcase AI flexibility." },
    timlatimer: { label: "“Tim Latimer’s vision for Fervo and geothermal energy”", org: "Fast Company", tier: "secondary", url: "https://www.fastcompany.com/91549060/tim-latimer-fervo-energy-world-changing-ideas-2026", captured: "2026-06-29", note: "Firm-power supply voice: Tim Latimer and Fervo are tied to Google data-center clean-power procurement, including the Nevada project and larger Utah geothermal buildout." },
    jeffbladen: { label: "“Can data centers be good grid citizens?”", org: "Volts / Verrus", tier: "secondary", url: "https://www.volts.wtf/p/can-data-centers-be-good-grid-citizens", captured: "2026-06-29", note: "Flexible-data-center operator voice: Jeff Bladen explains how asset-backed flexible data centers can operate as grid assets rather than passive large loads." },
    jamienolan: { label: "Jennifer Granholm on Power Demand and Governors Races", org: "Jamie Nolan / Energy Empire", tier: "secondary", url: "https://www.linkedin.com/posts/jamiemnolan_the-episode-i-have-been-waiting-for-has-finally-activity-7475925914535538691-kMB8", captured: "2026-06-29", note: "Public-narrative voice: Jamie Nolan frames data centers as neither automatic villains nor automatic allies; the political question is whether guardrails make them lower bills rather than raise them." },
    luciatian: { label: "“The AI Energy Nexus”", org: "Google Data Centers podcast", tier: "secondary", url: "https://datacenters.google/podcast/the-ai-energy-nexus/", captured: "2026-06-29", note: "Google clean-energy voice: Lucia Tian frames AI load growth as a race to secure carbon-free power through advanced geothermal, nuclear, storage and grid-optimization partnerships." },
    saraaxelrod: { label: "“Big Tech steps up: companies agree to cover energy costs amid AI data center surge”", org: "Crusoe / LinkedIn", tier: "secondary", url: "https://www.linkedin.com/posts/this-with-krish_big-tech-steps-up-companies-agree-to-cover-activity-7435339817791672320-T8HB", captured: "2026-06-29", note: "Crusoe government-affairs voice: Sara Axelrod frames AI compute as making energy the defining constraint and competitive advantage for data infrastructure, with Crusoe taking an energy-first / BYO-power approach." },
    chaselochmiller: { label: "“US grid overhaul urgently needed to meet AI load: FERC”", org: "Argus Media", tier: "secondary", url: "https://www.argusmedia.com/en/news-and-insights/latest-market-news/2804882-us-grid-overhaul-urgently-needed-to-meet-ai-load-ferc", captured: "2026-06-29", note: "Crusoe CEO voice: Chase Lochmiller says developers are pairing data-center growth with their own behind-the-meter generation and situating facilities near stranded or underutilized supply." },
    cullycavness: { label: "“The data center event that became an energy event”", org: "Latitude Media", tier: "secondary", url: "https://www.latitudemedia.com/news/the-data-center-event-that-became-an-energy-event/", captured: "2026-06-29", note: "Crusoe operator voice: Cully Cavness describes gas as a bridge to grid power at Abilene / Stargate, showing how the data-center buildout is turning into an energy-buildout story." },
    amandapc: { label: "“How Big Tech learned to speak FERC”", org: "E&E News by POLITICO", tier: "secondary", url: "https://www.eenews.net/articles/how-big-tech-learned-to-speak-ferc/", captured: "2026-06-29", note: "Google data-center-energy voice: Amanda Peterson Corio says tech companies need solutions that better utilize the grid, and Utility Dive reports her point that paying other customers to shift load can be faster and cheaper than curtailing data-center chips." },
    charleshua: { label: "“Thousands of Hoover Dams: Utilities request $1.4 trillion in spending through 2030”", org: "Latitude Media / PowerLines", tier: "secondary", url: "https://www.latitudemedia.com/news/thousands-of-hoover-dams-utilities-request-1-4-trillion-in-spending-through-2030/", captured: "2026-06-29", note: "Affordability / utility-regulation voice: Charles Hua argues data centers are an important energy topic but rate increases also reflect the utility business model and a need for regulatory transparency and modernization." },
    chrisgillett: { label: "“Why American data centers can’t plug in”", org: "Works in Progress", tier: "secondary", url: "https://worksinprogress.co/issue/why-american-data-centers-cant-plug-in/", captured: "2026-06-29", note: "Grid-mechanics voice: Chris Gillett argues the United States has electricity to power AI buildout, but the bottleneck is connecting data centers and power plants to the grid; flexible connection rights are part of the fix." },
    shanumathew: { label: "Shanu Mathew on FERC large-load reform and energized gigawatts", org: "Shanu Mathew", tier: "secondary", url: "https://www.shanumathew.com/writing/data-centers-focus-on-energized-gw", captured: "2026-06-29", note: "Capital-markets / infrastructure voice: Mathew tracks energized GW, power constraints and political resistance as the real investment variables; his X thread reads FERC's reform as fixing slow, inconsistent data-center interconnection rules and making full upgrade-cost responsibility central." },
    joshlevi: { label: "Testimony: Josh Levi, President, Data Center Coalition", org: "FERC Reliability Technical Conference", tier: "secondary", url: "https://www.ferc.gov/media/testimoniescomments-josh-levi-president-data-center-coalition", captured: "2026-06-29", note: "Data Center Coalition voice: Levi tells FERC the industry needs faster infrastructure and broader public understanding of data centers' grid role." },
    cymcgeady: { label: "“The Electricity Supply Bottleneck on U.S. AI Dominance”", org: "CSIS / Cy McGeady", tier: "secondary", url: "https://www.csis.org/analysis/electricity-supply-bottleneck-us-ai-dominance", captured: "2026-06-29", note: "Equinix energy-policy voice with CSIS source lineage: Cy McGeady argues electricity supply is a bottleneck for U.S. AI dominance and maps where data-center investment is moving based on generation, permitting and land-use constraints." },
    cymcneill: { label: "Cy McNeill, Senior Director of Federal Affairs", org: "Data Center Coalition", tier: "secondary", url: "https://datacentercoalition.org/cpages/cy-mcneill", captured: "2026-06-29", note: "Data Center Coalition federal-affairs voice: Cy McNeill represents DCC in federal energy, transmission, siting and permitting advocacy; separate from Equinix's Cy McGeady." },
    davidyoung: { label: "Data Center Coalition committee leadership", org: "Data Center Coalition", tier: "secondary", url: "https://datacentercoalition.org/cpages/committee-leadership", captured: "2026-06-29", note: "Data-center federal-policy voice: David Young of Equinix is listed as a Data Center Coalition Federal Policy Leadership Advisory Council co-chair." },
    taggreason: { label: "QTS Co-CEO Tag Greason on data-center capacity delivery", org: "TD Securities", tier: "secondary", url: "https://www.tdsecurities.com/ca/en/tdc-insights-qts-on-data-center-outlook", captured: "2026-06-29", note: "Data-center operator / capital-delivery voice: Tag Greason discusses hyperscale AI demand and bottlenecks for delivering data-center capacity." },
    rimaalaily: { label: "Rima Alaily on We Energies data-center rate", org: "Rima Alaily on LinkedIn", tier: "secondary", url: "https://www.linkedin.com/posts/rima-alaily_we-energies-data-center-rate-activity-7432819257794699264-2ips", captured: "2026-06-29", note: "Microsoft hyperscaler voice: Alaily says Microsoft has committed to pay its own way so its data centers do not increase residents' electricity prices, pointing to Wisconsin's Very Large Customer tariff as the mechanism." },
    brianakobor: { label: "Google's Capacity Commitment Framework for large loads", org: "LinkedIn / Simple Thread", tier: "secondary", url: "https://www.linkedin.com/posts/justinetheredge_yesterday-briana-kobor-shed-light-on-the-activity-7331290739412189186-Hs8W", captured: "2026-06-29", note: "Google hyperscaler voice: Briana Kobor's ESIG presentation described Google's Capacity Commitment Framework, shifting forecasting risk and capacity-planning uncertainty from utilities to large customers through long-term commitments, minimum charges, collateral and transparent modification fees." },
    redditecon: { label: "r/Economics thread: “AI data centers just got a government-mandated fast lane…”", org: "Reddit", tier: "secondary", url: "https://www.reddit.com/r/Economics/comments/1ua07ck/ai_data_centers_just_got_a_governmentmandated/", captured: "2026-06-29", note: "Public social reaction to the TechCrunch / Yahoo framing: FERC gave data centers a faster interconnection path but did not solve the underlying power-supply shortage." },
    reddittech: { label: "r/technology thread: “Federal regulators order grid operators to speed power…”", org: "Reddit", tier: "secondary", url: "https://www.reddit.com/r/technology/comments/1u9ir0r/federal_regulators_order_grid_operators_to_speed/", captured: "2026-06-29", note: "Public tech-community reaction to AP coverage: the order is read through AI demand, local backlash, affordability, and whether fast interconnection shifts costs or risks elsewhere." },
  };

  const meta = {
    title: "Large Load Interconnection",
    subtitle: "From the DOE §403 ANOPR (Docket RM26-4-000) to FERC’s June 18, 2026 tailored §206 show cause orders",
    items: "Items E-7 to E-12 · Dockets EL26-67-000 to EL26-72-000",
    capture: "2026-06-22",
    discourseCapture: "2026-06-29",
    authority: "Federal Power Act § 206 · DOE Organization Act § 403",
    citeRange: "195 FERC ¶ 61,211 to 61,216",
    commissioners: "Laura V. Swett (Chairman) · David Rosner · Lindsay S. See · Judy W. Chang · David LaCerte",
    summary: [
      "On October 23, 2025, the Department of Energy invoked its rarely used § 403 authority to direct FERC to open a rulemaking on connecting large loads (data centers, AI, advanced manufacturing) to the interstate grid (Docket RM26-4-000), and asked for final action by April 30, 2026.",
      "Rather than run a multi-year rulemaking, FERC answered on June 18, 2026 with six tailored § 206 show cause orders, one to each RTO/ISO. Each makes a threshold finding that the region’s tariff may be unjust and unreasonable for lack of clear, consistent large-load rules, then puts the market on a 30/60-day clock to defend the status quo or file a fix across the same five reform categories.",
      "The through-line is cost causation made visible: the large load that triggers a network upgrade should bear its cost and spare ordinary ratepayers, with new transparency into how those costs are identified and allocated. The same morning, FERC finalized the PJM co-location order (Item E-2, EL25-49-002) whose three new transmission services the six orders extend to every other region.",
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
    {
      date: "After each 60-day filing", iso: "2026-09-16", kind: "deadline",
      title: "Responses due 30 days after the RTO/TO filing",
      body: "The 60-day filing is not the end of the process. After each respondent files its show-cause answer or proposed tariff changes, other parties get 30 days to respond. That response window is where large-load customers, generators, states, consumer advocates and existing customers can contest whether the filing actually solves cost allocation, transparency, flexible service and co-location issues.",
      src: ["e7", "natlaw"],
    },
    {
      date: "Fall 2026, if requested", iso: "2026-10-01", kind: "deadline",
      title: "Abeyance requests can slow the clock, but only within a bounded lane",
      body: "NYISO's order expressly lets respondents request abeyance within 45 days, capped at 90 days and subject to FERC scrutiny. Practitioners read that as the safety valve for regions that need stakeholder process time, not an open-ended pause. Any abeyance would push the tariff-answer deadline later for that region while leaving the broader §206 proceeding alive.",
      src: ["e12", "substack", "natlaw"],
    },
    {
      date: "After the response records close", iso: "2026-10-17", kind: "ferc",
      title: "FERC decides whether to accept, modify, or impose a §206 remedy",
      body: "Once the show-cause answers and response comments are in, FERC can accept a sufficient compliance path, direct further tariff changes, set additional hearing or settlement procedures, or impose its own §206 remedy if a region has not shown its tariff is just and reasonable. The practical question after the 60-day filings is therefore not just 'filed or not filed,' but whether the filing gives FERC enough record to approve a durable regional fix.",
      src: ["e7", "bloomberglaw", "fercFS"],
    },
    {
      date: "Parallel lane", iso: "2026-10-18", kind: "milestone",
      title: "Rehearing and court-review risk runs alongside implementation",
      body: "Parties can seek rehearing of FERC action before heading to court. Legal commentators read the six region-specific §206 records as a litigation-defense strategy: narrower records, tailored findings and market-by-market remedies give challengers fewer generic-rule targets. That does not remove legal risk; it shapes where the fight happens.",
      src: ["bloomberglaw", "heatmap"],
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
      unique: "PJM is the control case, the one region that does not start from a blank page. FERC rebuilt PJM’s co-location rules in the parallel EL25-49 proceeding (Item E-2, decided the same morning), so E-7 asks PJM to carry those new services (Interim NITS and Firm/Non-Firm Contract Demand) into a general large-load framework. The catch: every request still runs through one ‘first-ready, first-served’ clustered New Services Queue with no large-load-specific study, even though an Eligible Customer already pays ‘100% of the costs of the minimum amount of Network Upgrades’ its request triggers. So the order presses how to add flexible-load service and protect deals nearing completion without breaking that queue.",
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
      unique: "MISO is the cost-allocation stress test. Its tariff still studies new load at its maximum demand ‘regardless of the load’s operational capabilities or willingness to be curtailed,’ and the resulting network upgrades are ‘rolled into the relevant transmission owner’s base zonal rates,’ spread across that utility’s wholesale customers. MISO itself told its Large Load Working Group the tariff does ‘not provide a consistent or transparent framework’ for large loads. E-8 presses whether flexible service and a pro forma cost-recovery agreement can keep those upgrade costs on the load that caused them.",
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
      unique: "SPP is the benchmark, not the laggard. E-9 adopts SPP’s own ‘High Impact Large Load’ (HILL) definition, commends its ‘High Impact Large Load Generation Assessment’ (HILLGA) and Conditional HILL Service, and leaves the Attachment Z1/AQ/AX study stack and Highway/Byway cost split intact. Even in this leading framework FERC finds only two real gaps: no requirement to evaluate alternative transmission technologies, and no pro forma terms to ‘memorialize ongoing operational requirements in a transmission service agreement.’ The remaining ask is a mechanism to credit large-load payments back through transmission owners’ revenue requirements.",
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
      unique: "CAISO is the translation problem. It ‘does not offer traditional Order No. 888 network and point-to-point transmission services, offers no firm, long-term transmission reservations of capacity,’ and its Participating TOs (not CAISO itself) ‘play the lead role in managing the interconnection of load’ inside California’s state planning and forecasting processes. So E-10 gives CAISO an alternative no other order offers: either build equivalent large-load protections, or explain why its single daily service and Transmission Access Charge (TAC/RAC) framework already solves the same cost and reliability problems.",
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
      unique: "ISO-NE is the small-system, big-load case. FERC flags a system peaking at only ‘30,000 MW’ with significant transmission constraints, and a ‘CELT load forecast’ that generally excludes proposed data centers, so a single large customer can move the regional needle. E-11 turns that into concrete planning questions: how Schedule 22/23 cluster studies, Pool Transmission Facilities at ‘69 kV’ and above, and the Monthly Regional Network Load behind-the-meter-netting rules should change, and whether to import PJM’s MW-threshold remedy for that netting.",
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
      unique: "NYISO is the tariff-gap case. It runs load interconnection for projects over 10 MW at ‘115 kV’ and above largely off-tariff: the study details, deposits, and assumptions sit in non-tariff documents, and its tariff ‘lacks a definition of large load’ as a category. With co-location reforms not expected until ‘2027,’ E-12 converts that off-tariff practice into show-cause issues: a 60-to-90-day study expectation, a new large-load definition with readiness requirements to deter speculation, and the only order’s express path to request a 90-day abeyance.",
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

  // Item E-2 (PJM co-location) — the order the six show cause orders build on, voted the same
  // June 18, 2026 meeting. It is NOT a §206 show cause order to an RTO; it is the order on rehearing,
  // clarification, compliance, and paper hearing in PJM's December 18, 2025 co-location proceeding
  // (193 FERC ¶ 61,217). Kept out of `dockets` (which is the six §206 orders) and rendered as its own
  // distinguished card. Every quote is verbatim in sources/text/orders/e-2-pjm-el25-49-002.txt at `pg`.
  const colocation = {
    item: "E-2", rto: "PJM", rtoFull: "PJM Interconnection, L.L.C.", track: "Co-location",
    docket: "EL25-49-002", url: "e2", pdf: "orders/e-2-pjm-el25-49-002.pdf",
    region: "Mid-Atlantic / 13 states + DC", cite: "195 FERC ¶ 61,209", pages: 278,
    respondents: "PJM + its transmission owners",
    kind: "Order on rehearing, clarification, compliance & paper hearing",
    status: "The co-location order the six build on",
    unique: "E-2 is the co-location order the other six extend. Voted the same morning, it closes out PJM’s December 18, 2025 §206 co-location proceeding (193 FERC ¶ 61,217) by resolving rehearing, clarification, a compliance filing, and a paper hearing at once. It modifies and sets aside the December Order in part, accepts PJM’s compliance filing only in part, and (most consequentially) fixes the just-and-reasonable rates, terms, and conditions for the three new transmission services the §206 orders now push into every other region: Interim NITS, Firm Contract Demand (FCD), and Non-Firm Contract Demand (NFCD). It also rewrites the retail behind-the-meter-generation netting rules with a transition path for existing participants, and rejects PJM’s proposed cap tying required NFCD service to the co-located generator’s dedicated megawatts. Commissioner Chang concurs separately on the still-open ‘minimum charge’ cost-shift question.",
    asks: [
      "Rehearing & clarification: the December Order is modified and set aside in part; the clarification requests are granted in part and denied in part.",
      "Compliance: PJM’s compliance filing is accepted in part and rejected in part, with a further compliance filing due in 60 days.",
      "Paper hearing: the Commission sets the just-and-reasonable rates, terms, and conditions for Interim NITS, FCD, and NFCD service.",
    ],
    dir: [
      { t: "One of three new co-location services", q: "the Eligible Customer taking transmission service on behalf of the Co-Located Load takes one of three transmission services", p: "P 2", pg: 3 },
      { t: "Interim NITS", q: "a new interim, non-firm transmission service available until all Network Upgrades necessary to provide the requested NITS are complete (Interim NITS)", p: "P 2", pg: 3 },
      { t: "Retail BTMG netting rewritten", q: "the Behind the Meter Generation (BTMG) rules in the Tariff to be no longer just and reasonable, and the Commission directed PJM to submit in its compliance filing revisions to its Tariff to revise the retail BTMG netting rules and to implement a transition process for existing BTMG participants", p: "P 4", pg: 3 },
      { t: "Paper hearing sets the rates", q: "we establish as just and reasonable certain rates, terms, and conditions for the new transmission services directed in the December Order", p: "Disposition", pg: 5 },
      { t: "December Order set aside in part", q: "we are modifying the discussion in the December Order and setting aside the order, in part", p: "FPA § 313(a)", pg: 5 },
    ],
    reg: [
      { t: "E-2 resolves rehearing of PJM’s December 18, 2025 §206 co-location order (193 FERC ¶ 61,217), the show cause proceeding the other six orders cite as their template.", p: "p. 2", pg: 2, a: "On December 18, 2025, the Commission issued an order in the show cause proceeding in Docket No. EL25-49-000" },
      { t: "On compliance, PJM must set the specific Tariff terms an Interconnection Customer in PJM seeking to serve Co-Located Load must follow to effectuate a Co-Location Arrangement.", p: "p. 3", pg: 3, a: "Interconnection Customer in PJM seeking to serve Co-Located Load must follow" },
      { t: "The Commission rejected PJM’s proposed NFCD ‘Maximum Facility Output’ limit, which would have tied required service to the megawatts of the co-located generator dedicated to the load.", p: "p. 271", pg: 271, a: "we reject PJM’s proposal" },
      { t: "On the ‘minimum charge’ question, the Commission found the record does not adequately support either the need for an additional charge at this time or how to calculate one.", p: "p. 277", pg: 277, a: "the record does not adequately support either the need for an additional charge at this time" },
    ],
    // Only Commissioner Chang filed a separate statement on E-2 (the others did not write separately here).
    commish: { chang: { pg: 276, quote: "I write separately to address the Commission’s resolution of the “minimum charge” issue raised in my concurrence to the December Order", gist: "Chang is the lone separate writer on E-2. She concurs on the resolution of the ‘minimum charge’ question: the Commission found the record did not yet support an added charge for co-located loads that take little or no transmission service. She says she stands ready to consider §205 filings or §206 complaints, including sua sponte action, if that cost shift actually appears." } },
  };

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
      body: "Speed-to-power is the prize, but the trade is explicit: large customers are increasingly expected to bring credible capacity commitments, minimum charges, collateral, flexible operations or their own power strategy. Microsoft, Google, DCC, Equinix and operator voices all converge on the same point from different angles: the projects that look real are the ones that can show who pays, who curtails and where deliverable power comes from.",
      src: ["amandapc", "joshlevi", "cymcgeady", "arthurwm"],
    },
    {
      group: "Transmission owners", stance: "mixed",
      body: "Named as respondents alongside the RTOs, TOs get clearer cost-allocation rules and a faster §206 lane than a generic rulemaking. The burden is real: they must help build the record, evaluate grid-enhancing technologies before defaulting to conventional upgrades, and answer whether existing tariffs can handle large-load risk without cross-subsidies.",
      src: ["fercFS", "bloomberglaw", "jeffdennis"],
    },
    {
      group: "Generators (gas / nuclear)", stance: "positive",
      body: "Dispatchable and firm-power suppliers benefit from the co-location and proximate-generation frame: a data center that can pair with deliverable generation is easier to study than a naked load request. That helps existing plants near load, but the clean-firm-power lane is also live; geothermal, storage, nuclear and grid-optimization procurement are part of the hyperscaler answer.",
      src: ["utilitydive", "timlatimer", "luciatian", "chaselochmiller"],
    },
    {
      group: "State utility commissions", stance: "positive",
      body: "The bifurcation gives states wholesale-side transmission-cost visibility while preserving retail cost allocation and siting authority. That matters because the household-bill fight is already concrete: Maryland's ratepayer advocate and state lawmakers are challenging how PJM transmission costs tied to data-center load move across zones.",
      src: ["fercFS", "thehill", "mdopc", "bloomberglaw"],
    },
    {
      group: "Consumer and environmental advocates", stance: "mixed",
      body: "The guardrail camp sees progress but not closure. Sierra Club called the announcement responsive on consumer-protection fronts; SELC wanted stronger federal standardization and clearer quarantine of data-center costs; Public Citizen remains more skeptical, tying fast interconnection to unresolved NERC reliability and state-authority concerns.",
      src: ["insideclimate", "publiccitizen", "benferc", "bennerc"],
    },
    {
      group: "Grid-flexibility and demand-response providers", stance: "positive",
      body: "This camp gets a clearer market opening. Flexible-load operators argue that telemetry, controls and dispatchable demand can turn some data centers into grid assets and shorten study timelines. Their caveat is operational proof: the promise only works if the tariff turns flexibility into enforceable performance.",
      src: ["varunsivaram", "jeffbladen"],
    },
    {
      group: "Public power, co-ops and large customers", stance: "mixed",
      body: "Large customers and public-power interests mostly like faster interconnection when the beneficiary pays. Their worry is that vague cost causation turns into ordinary customers funding speculative upgrades, so the post-order debate keeps coming back to transparency, state coordination and bill-design mechanics.",
      src: ["jeffdennis", "mdopc"],
    },
    {
      group: "Non-RTO Southeast and regional planners", stance: "negative",
      body: "The six orders cover organized markets, not the whole country. Southeast voices warn that manufacturers and data centers still need regional transmission planning outside the RTO/ISO frame, and that the regions with weak interconnection practice may be precisely where FERC's show-cause orders do not directly reach.",
      src: ["utilitydive", "simonmahan"],
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
      { t: "Flexibility is becoming the price of speed: practitioners read curtailable / flexible service as the most valuable near-term lever to connect faster, turning a load’s willingness to limit usage into bargaining power.", src: ["duanemorris", "briggswhite", "varunsivaram", "jeffbladen"] },
      { t: "Built to survive appeal: legal analysts read the six tailored § 206 orders as deliberately litigation-resistant. A detailed, region-specific administrative record offers fewer openings to challenge than a single national rule, and it skips the multi-year lag of a rulemaking.", src: ["bloomberglaw", "heatmap", "eenewsferc"] },
      { t: "The public headline has escaped the energy-law lane: TechCrunch, AP, Tom's Hardware and Reddit all translate the orders as a data-center fast lane, even when they disagree on whether the real bottleneck is interconnection paperwork, physical power supply, or household bills.", src: ["techcrunch", "apdata", "tomhardware", "jigarferc", "redditecon", "reddittech"] },
      { t: "X is treating the 60-day response clock as the live market story: energy/security analysts and infrastructure accounts are watching whether the RTO filings answer the real scarcity question, not just whether they satisfy FERC's process.", src: ["xschifman", "xnearco", "xhalcyon"] },
    ],
    friction: [
      { t: "Cost allocation is the central fight: how aggressively must large loads pre-fund and backstop upgrades, and over what crediting term? The ANOPR explicitly left crediting open.", src: ["utilitydive", "doe403"] },
      { t: "Speed vs. rigor: the orders set a 45-day window to request abeyance of up to 90 days (NYISO P 42), which prevents indefinite stalling but compresses stakeholder process; the mandatory alternative-transmission-technology evaluation could itself add study time.", src: ["e12", "substack"] },
      { t: "Coverage-gap questions: commenters flag that some transmission owners (e.g., Nebraska Public Power District, Great River Energy) appear absent from the published respondent lists, a completeness question to watch.", src: ["substack"] },
      { t: "The cost-allocation fight is already concrete and pending: Maryland’s ratepayer advocate, backed by 80 state lawmakers (June 17, 2026), says PJM’s tariff lets data-center transmission costs ‘leak’ across zones — ‘an unjust subsidy for that data center load’ — and pegs Maryland’s exposure near $1.6 billion over a decade (FERC comment window extended to July 27, 2026).", src: ["mdopc", "utilitydive"] },
      { t: "Fragmentation risk: six regional answers on six different timelines give multi-region developers clarity within a market but a patchwork across them, and fresh diligence for near-term deals.", src: ["utilitydive", "duanemorris"] },
      { t: "The affordability backstop is split: FERC guards against cost-shifting among transmission customers but says preventing cost-shifting among retail customers is the states’ job, so the household-bill fight moves to state regulators even as the orders’ federal reach over load interconnection invites a jurisdictional challenge.", src: ["thehill", "bloomberglaw"] },
      { t: "Fast lane vs. power supply: TechCrunch and Reddit frame the order as faster access to the grid, but AP and tech press stress the harder constraint: data-center construction is outrunning new generation, transmission upgrades and local consent.", src: ["techcrunch", "apdata", "tomhardware", "redditecon"] },
      { t: "Reliability risk is now part of the same conversation: consumer advocates point to NERC's Level 3 data-center alert as the reason fast interconnection needs enforceable modeling, operating and ratepayer-protection standards.", src: ["benferc", "bennerc"] },
      { t: "Developer reality check: Equinix's Arthur Haubenstock argues that data centers often cannot simply behave as flexible grid loads, and CoreWeave's Heather McGeory shows the scale has moved from megawatts to gigawatts. That complicates any policy story that treats curtailment or on-site supply as an easy fix.", src: ["arthurwm", "heathermcgeory"] },
      { t: "The buildout is colliding with supply-chain physics: Briggs White points to 3- to 5-year gas-turbine lead times, 3- to 4-year transformer lead times and interconnection delays, so the FERC clock is only one part of a much larger delivery bottleneck.", src: ["briggswhite"] },
      { t: "Firm clean supply is the other half of the answer: Tim Latimer's Fervo work with Google and Lucia Tian's advanced-energy portfolio show why hyperscalers are pairing interconnection reform with geothermal, storage, nuclear and grid-optimization procurement, not only demand flexibility.", src: ["timlatimer", "luciatian"] },
      { t: "The hyperscaler line is not monolithic but it is explicit on cost assignment: post-order coverage keeps pairing speed-to-power with large-customer cost responsibility, grid-utilization strategies, and organized federal advocacy from the data-center sector.", src: ["amandapc", "joshlevi", "cymcneill", "davidyoung"] },
      { t: "AI competitiveness has become part of the power-grid argument: Equinix's Cy McGeady frames electricity supply as a bottleneck on U.S. AI dominance, while Tag Greason, Chase Lochmiller, Cully Cavness and Sara Axelrod show the operator side racing to deliver actual data-center capacity with energy attached.", src: ["cymcgeady", "taggreason", "chaselochmiller", "cullycavness", "saraaxelrod"] },
      { t: "Capital is watching energized gigawatts, not headline announcements: Shanu Mathew frames the investable question as which projects actually get power, interconnection and political permission, with FERC's reform aimed at slow and inconsistent rules.", src: ["shanumathew"] },
      { t: "The grid-connection problem has its own mechanics: Chris Gillett argues the country has enough electricity in aggregate, but the bottleneck is getting new loads and generation studied, connected and prioritized; Charles Hua adds that utility regulation and transparency shape whether consumers trust the answer.", src: ["chrisgillett", "charleshua"] },
      { t: "The public narrative is settling around guardrails, not a simple yes/no on data centers: Jamie Nolan's Energy Empire framing is that data centers can either become the Loudoun County cautionary tale or a local-bill ally, depending on the deal structure.", src: ["jamienolan"] },
      { t: "The Southeast remains the outside-the-RTO pressure point: Simon Mahan argues that data centers and manufacturers need regional transmission planning, not just local patches, or the region risks higher prices and power shortages.", src: ["simonmahan"] },
      { t: "Congress may not leave the issue to FERC orders alone: the POWER Up Act would write a 100 MW large-load category into federal law and push standardized transmission-level interconnection rules, while saying state and local siting, generation and retail-rate authority remain intact.", src: ["dcdpowerup"] },
    ],
    // outlet chips render from cited source records (each links to its SOURCES entry) — no uncited names.
    outlets: ["utilitydive", "rtoinsider", "latitude", "tdworld", "powermag", "rew", "akin", "sheppard", "natlaw", "aaf", "substack", "heatmap", "duanemorris", "bloomberglaw", "thehill", "dcknowledge", "enr", "ieee", "techcrunch", "apdata", "tomhardware", "dcdpowerup", "eenewsferc", "xschifman", "xnearco", "xhalcyon", "jigarferc", "benferc", "bennerc", "arthurwm", "jeffdennis", "simonmahan", "briggswhite", "heathermcgeory", "varunsivaram", "timlatimer", "jeffbladen", "jamienolan", "luciatian", "saraaxelrod", "chaselochmiller", "cullycavness", "amandapc", "charleshua", "chrisgillett", "shanumathew", "joshlevi", "cymcgeady", "cymcneill", "davidyoung", "taggreason", "redditecon", "reddittech"],
  };

  // Named commentary spanning the political spectrum (Tab 3). Each is the source's own
  // position, attributed and linked; lean is the commentator's general orientation on energy policy.
  const voices = [
    {
      name: "Travis Kavulla", affil: "American Affairs · NRG", lean: "right",
      take: "Wants grid access priced, not rationed: borrow the natural-gas ‘open season’ so large loads bid for transferable interconnection rights instead of queuing first-come, first-served. Reads the orders’ cost-causation push as a step toward that, but short of market pricing.",
      src: ["kavulla", "kavullali"],
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
      take: "Calls it ‘a very FERC-y approach’ and says the design targets the core challenges ‘on a region by region basis on a tight timeline.’ He approves of the region-specific §206 route as faster and more legally defensible than one national rule.",
      src: ["heatmap", "eenewsferc"],
    },
    {
      name: "Jennifer Danis", affil: "Institute for Policy Integrity", lean: "nonpartisan",
      take: "Reads the six-order route as built to survive appeal: a § 206 show cause yields ‘a much more robust and detailed administrative record’ tailored to each RTO, which she says ‘reduces future litigation entry points’ versus a single national rule.",
      src: ["bloomberglaw"],
    },
    {
      name: "Matthew Christiansen", affil: "Wilson Sonsini", lean: "nonpartisan",
      take: "On the federalism question: reads the orders as a legitimate exercise of FERC's transmission jurisdiction rather than an intrusion on the states. Says he doesn't think ‘anything that FERC proposed to do’ encroaches on state authority, so the state-versus-federal challenge critics expect starts from a narrow opening.",
      src: ["bloomberglaw"],
    },
    {
      name: "Jigar Shah", affil: "Deploy Action · former DOE Loan Programs Office", lean: "nonpartisan",
      take: "Reads the orders as a clever jurisdictional move: region-by-region § 206 orders avoid the federal-overreach fight while targeting the ‘speed to power’ bottleneck. His caveat is that FERC is not solving the price problem directly; data centers are an accelerant on a strained system, and the missing piece is a public capacity-and-demand picture.",
      src: ["jigarferc"],
    },
    {
      name: "Ben Inskeep", affil: "Citizens Action Coalition of Indiana", lean: "left",
      take: "Brings the consumer-advocate reliability lens: skeptical that data centers need a faster path to the grid, but encouraged that FERC is taking up large-load interconnection. His broader warning is that standards must protect ratepayers from negative stability, reliability and resiliency impacts as data centers proliferate.",
      src: ["benferc", "bennerc"],
    },
    {
      name: "Aniruddh Mohan", affil: "The Brattle Group", lean: "nonpartisan",
      take: "The post-order technical voice: flags the Maryland/PJM complaint as part of ‘increasing scrutiny on who pays’ for transmission to connect data centers, connecting the orders' cost-causation frame to a live regional fight.",
      src: ["mohanx"],
    },
    {
      name: "Arthur Haubenstock", affil: "Equinix", lean: "nonpartisan",
      take: "The data-center-operator reality check: says the industry’s power needs collide with local grid impacts, backup-generation limits, and the real constraints behind ‘BYOP / BYONCE’ flexibility. Useful counterweight to the idea that every large load can simply curtail or bring its own supply.",
      src: ["arthurwm"],
    },
    {
      name: "Jeff Dennis", affil: "Electricity Customer Alliance · Coefficient Policy Experts", lean: "nonpartisan",
      take: "The customer-affordability voice: supports FERC's move because it accelerates pathways for new large loads while reinforcing that those loads should bear the costs incurred to serve them, with more transparency and state coordination. In IEEE's coverage, he says FERC is threading the needle between speed-to-power and public concern over broader bill impacts.",
      src: ["jeffdennis", "ieee"],
    },
    {
      name: "Ben Schifman", affil: "Institute for Progress", lean: "nonpartisan",
      take: "The security-and-reliability skeptic: reads FERC's large-load action as meaningful interconnection reform, but flags that ‘security gaps remain’ as the grid absorbs more data-center demand.",
      src: ["xschifman"],
    },
    {
      name: "Simon Mahan", affil: "Southern Renewable Energy Association", lean: "nonpartisan",
      take: "The Southeast planning voice: argues that manufacturers and data centers are bringing jobs to the region, but without a modern transmission system ‘we risk higher energy prices, power shortages, and lost economic opportunities.’ His point sharpens the non-RTO coverage gap the orders do not directly solve.",
      src: ["simonmahan"],
    },
    {
      name: "Briggs White", affil: "Keystone Ascent", lean: "nonpartisan",
      take: "The buildout-and-supply-chain voice: sees hyperscaler demand as a physical infrastructure buildout, with co-location now assumed and emergency data-center load reduction ‘ripe for deeper industry analysis.’ His warning is that turbine, transformer and interconnection lead times force regulators to keep costs manageable while maintaining reliability.",
      src: ["briggswhite"],
    },
    {
      name: "Heather McGeory", affil: "CoreWeave", lean: "nonpartisan",
      take: "A hyperscaler power-procurement voice: says the conversation has moved from megawatts to gigawatts for individual data centers. Her presence in the discourse reinforces that AI infrastructure demand is no longer an abstract forecast; it is a siting, procurement and grid-modernization problem now.",
      src: ["heathermcgeory"],
    },
    {
      name: "Varun Sivaram", affil: "Emerald AI", lean: "nonpartisan",
      take: "The software-flexibility voice: argues data centers can become grid assets, not just fixed loads, by dynamically adjusting demand to relieve grid stress while maintaining performance.",
      src: ["varunsivaram"],
    },
    {
      name: "Tim Latimer", affil: "Fervo Energy", lean: "nonpartisan",
      take: "The firm-clean-power voice: Fervo's Google data-center deals show the supply-side counterpart to FERC's load-interconnection push: hyperscalers are also trying to procure 24/7 geothermal power near the places where AI load is growing.",
      src: ["timlatimer"],
    },
    {
      name: "Jeff Bladen", affil: "Verrus", lean: "nonpartisan",
      take: "The asset-backed-flexibility operator: argues a flexible data center can be a grid asset, not only a consumer, and that physical storage, controls and telemetry make that different from old demand-response programs.",
      src: ["jeffbladen"],
    },
    {
      name: "Jamie Nolan", affil: "Energy Empire · Nolan Strategic Communications", lean: "nonpartisan",
      take: "The public-narrative voice: frames data centers as a guardrails problem, not a binary good-or-bad story. Done wrong, they are the Loudoun County cautionary tale; done right, she argues they can become a local-bill ally rather than the villain driving bills up.",
      src: ["jamienolan"],
    },
    {
      name: "Lucia Tian", affil: "Google", lean: "nonpartisan",
      take: "The Google advanced-energy voice: frames AI's power demand as a race to secure carbon-free power through geothermal, nuclear, long-duration storage and grid optimization. That makes the hyperscaler story about procuring new clean supply, not only asking grid operators for faster interconnection.",
      src: ["luciatian"],
    },
    {
      name: "Sara Axelrod", affil: "Crusoe", lean: "nonpartisan",
      take: "The Crusoe policy voice: says AI compute is making energy the defining constraint and competitive advantage for data infrastructure, and frames Crusoe's answer as energy-first infrastructure that co-locates compute with abundant or stranded power.",
      src: ["saraaxelrod"],
    },
    {
      name: "Chase Lochmiller", affil: "Crusoe", lean: "nonpartisan",
      take: "The AI-campus builder voice: says developers are pairing data-center growth with behind-the-meter generation and siting near stranded or underused power. His Stargate work makes the large-load debate concrete: build compute where power can actually be delivered.",
      src: ["chaselochmiller"],
    },
    {
      name: "Cully Cavness", affil: "Crusoe", lean: "nonpartisan",
      take: "The bridge-to-grid voice: describes gas as a bridge to grid power at Abilene / Stargate, showing how AI data centers are turning into power-development projects before the grid can catch up.",
      src: ["cullycavness"],
    },
    {
      name: "Amanda Peterson Corio", affil: "Google", lean: "nonpartisan",
      take: "The Google grid-utilization voice: says the sector has to find solutions that better utilize the system. Google works on data-center flexibility, but she also argues it can be faster and more cost effective to pay other customers to shift load because idle chips are expensive.",
      src: ["amandapc"],
    },
    {
      name: "Charles Hua", affil: "PowerLines", lean: "nonpartisan",
      take: "The utility-regulation voice: calls data centers arguably the most important topic in energy, but warns that blaming every bill increase on data centers is too simple. His focus is utility incentives, transparency and whether regulators center consumers as the grid is rebuilt.",
      src: ["charleshua"],
    },
    {
      name: "Chris Gillett", affil: "Works in Progress", lean: "nonpartisan",
      take: "The interconnection-mechanics voice: argues America has enough electricity in aggregate; the hard part is getting new data centers and power plants studied and connected to the grid, and flexible connection rights could let some loads move faster.",
      src: ["chrisgillett"],
    },
    {
      name: "Shanu Mathew", affil: "Energy, power and infrastructure investor", lean: "nonpartisan",
      take: "The capital-markets voice: focuses on energized GW rather than announced demand, with power constraints and political resistance as the variables that decide which data-center projects become real. On FERC, he reads the reform as fixing slow, inconsistent interconnection rules and making full upgrade-cost responsibility part of the bargain.",
      src: ["shanumathew"],
    },
    {
      name: "Josh Levi", affil: "Data Center Coalition", lean: "nonpartisan",
      take: "The data-center trade-association voice: pushes back on data centers being singled out for grid impacts and argues the sector needs utilities, grid operators and policymakers to grow infrastructure and recognize data centers as part of the modern economy.",
      src: ["joshlevi"],
    },
    {
      name: "Cy McGeady", affil: "Equinix · former CSIS", lean: "nonpartisan",
      take: "The Equinix energy-policy voice: argues electricity supply is a bottleneck for U.S. AI dominance, with data-center investment moving toward regions where generation, permitting and land-use conditions allow rapid buildout.",
      src: ["cymcgeady"],
    },
    {
      name: "Cy McNeill", affil: "Data Center Coalition", lean: "nonpartisan",
      take: "The DCC federal-affairs voice: works the transmission, siting, permitting and energy-market advocacy lane for the data-center industry. Distinct from Cy McGeady at Equinix, McNeill represents the association's federal policy posture.",
      src: ["cymcneill"],
    },
    {
      name: "David Young", affil: "Equinix · Data Center Coalition", lean: "nonpartisan",
      take: "The data-center federal-policy voice: represents the Equinix/DCC lane in the coalition's Federal Policy Leadership Advisory Council, reinforcing that the industry is organizing around federal power, permitting and grid-access questions.",
      src: ["davidyoung"],
    },
    {
      name: "Tag Greason", affil: "QTS Data Centers", lean: "nonpartisan",
      take: "The data-center capacity-delivery voice: from the operator side, emphasizes hyperscale AI demand and the bottlenecks that determine whether capacity can actually be delivered, not just announced.",
      src: ["taggreason"],
    },
    {
      name: "Larry Gasteiger", affil: "WIRES (transmission trade group)", lean: "nonpartisan",
      take: "From the transmission-builder camp: reads the show cause route as the faster path, since ‘going through the show cause process makes a lot of sense, because you don't have all of the time lags associated with a lengthy rulemaking process.’",
      src: ["bloomberglaw"],
    },
    {
      name: "Chris Wright", affil: "U.S. Secretary of Energy", lean: "right",
      take: "The directing agency, declaring victory: DOE applauds the orders as speed-to-power that still protects consumers. Secretary Wright frames them as the Administration working to ‘remove barriers, accelerate development’ and to deliver on ‘President Trump's Ratepayer Protection Pledge.’",
      src: ["doeApplaud"],
    },
  ];

  const voiceThemes = [
    {
      title: "Cost responsibility is the center of gravity",
      body: "Across the post-order discussion, the basic question is not whether large loads should connect faster; it is whether the tariff makes the beneficiary carry the cost and risk of the upgrade.",
      quotes: [
        { q: "There’s no real quarantining of the cost caused by data centers to those data centers", src: "insideclimate" },
        { q: "those loads bear the costs incurred to serve them", src: "jeffdennis" },
        { q: "increasing scrutiny on who pays for transmission to connect data centers", src: "mohanx" },
        { q: "President Trump's Ratepayer Protection Pledge", src: "doeApplaud" },
      ],
    },
    {
      title: "The regional route is both substance and litigation strategy",
      body: "The six-order structure is being read as a deliberate alternative to one national template: faster than a rulemaking, more tailored to each market, and easier to defend on the record.",
      quotes: [
        { q: "far more substantively ambitious than the ANOPR", src: "utilitydive" },
        { q: "six regional answers to the same question, decided on six different timelines", src: "utilitydive" },
        { q: "a much more robust and detailed administrative record", src: "bloomberglaw" },
        { q: "reduces future litigation entry points", src: "bloomberglaw" },
      ],
    },
    {
      title: "Speed now depends on provable flexibility",
      body: "The strongest pro-speed argument treats data centers as controllable loads, but the quotes also show the hard edge: flexibility has to be operational, measurable, and worth something in the tariff.",
      quotes: [
        { q: "emergency data-center load reduction ripe for deeper industry analysis", src: "briggswhite" },
        { q: "flexible AI data centers can adjust demand dynamically and act as grid assets, not only as fixed loads", src: "varunsivaram" },
        { q: "asset-backed flexible data centers can operate as grid assets", src: "jeffbladen" },
        { q: "paying other customers to shift load can be faster and more cost effective than curtailing expensive data-center chips", src: "amandapc" },
      ],
    },
    {
      title: "Reliability and security remain live objections",
      body: "The order is not landing as a pure acceleration story. Consumer and security voices are treating faster interconnection as acceptable only if modeling, operating standards, and stability protections keep up.",
      quotes: [
        { q: "security gaps remain", src: "xschifman" },
        { q: "data centers need any more help with interconnection to the grid", src: "benferc" },
        { q: "standards and rules in place that protect ratepayers from any negative stability, reliability and resiliency impacts", src: "benferc" },
      ],
    },
    {
      title: "The physical buildout is bigger than the FERC clock",
      body: "The discourse keeps returning to the same physical constraint: the orders can compress process, but turbines, transformers, generation, local consent, and deliverable capacity still decide which projects energize.",
      quotes: [
        { q: "power conversations for individual data centers have moved from megawatts to gigawatts", src: "heathermcgeory" },
        { q: "gas-turbine, transformer and interconnection lead times", src: "briggswhite" },
        { q: "power constraints and political resistance", src: "shanumathew" },
        { q: "developers are pairing data-center growth with behind-the-meter generation and siting near stranded or underused power", src: "chaselochmiller" },
      ],
    },
    {
      title: "The organized-market focus leaves a Southeast gap",
      body: "The order covers the six RTO/ISO markets, while several reactions flag the regions outside that structure as exactly where transmission planning and interconnection practice may be weakest.",
      quotes: [
        { q: "non-RTO areas, which typically suffer from the worst transmission and interconnection practices", src: "utilitydive" },
        { q: "The Southeast needs a modern transmission system", src: "simonmahan" },
        { q: "we risk higher energy prices, power shortages, and lost economic opportunities", src: "simonmahan" },
      ],
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
      quotePg: 87,
      gist: "Defends the procedure: six tailored show cause orders instead of one rule, because §206 is faster and more ‘legally durable.’ Points to rulemakings like Order Nos. 2023 and 2222 still not fully implemented years on, and notes the six markets cover nearly two-thirds of FERC-jurisdictional load.",
      sources: { written: "Concurring statement, 195 FERC ¶ 61,211 (PJM) pp. 84–88; largely common across the six orders, with some per-order tailoring", spoken: "FERC open meeting, June 18, 2026 (youtube.com/watch?v=r7y-iDn-rkU, auto-caption)" },
      summary: "Swett frames the six orders as historic, urgent delivery on Secretary Wright's October 2025 charge, finding the status quo across the markets not good enough. He defends the choice of six tailored §206 show cause orders over a single rulemaking on two grounds: they fit each region's circumstances, and they move far faster than a NOPR (he points to Order Nos. 2023 and 2222 still not fully implemented years on). The six markets cover nearly two-thirds of FERC-jurisdictional load; he invites §205 filings and urges non-RTO regions to file too, leaving the door open to a future rule.",
      themes: [
        { name: "Historic, urgent delivery on the Secretary's charge", desc: "Casts the day as answering DOE Secretary Wright's October 2025 ANOPR directive, and ties the orders to a set of consumer- and market-facing goals.", quotes: [
          { t: "Today, we take historic action to push our country's electric markets and economy into the future—a future of fair cost allocation, unprecedented transparency for the American ratepayer, respect for states' rights, efficient markets and speed to power.", src: "written", pg: 84 },
          { t: "And now, through this suite of six orders, we deliver.", src: "written", pg: 84 },
          { t: "We promised some fireworks last month, and we are going to light the fuse today.", src: "spoken", at: "~3:00" } ] },
        { name: "The status quo is not good enough", desc: "The record shows most markets' existing rules are too slow and rigid to integrate large loads.", quotes: [
          { t: "The record prompted by the Secretary's ANOPR leaves no doubt that most of the markets (and their existing rules) are inherently slow and prohibitive of the dexterity necessary to adapt to and power societal evolution", src: "written", pg: 84 } ] },
        { name: "Tailored show-cause orders, not a one-size-fits-all rule", desc: "Six individualized §206 proceedings fit each region's circumstances and let the markets propose fixes first.", quotes: [
          { t: "an approach that honors the ANOPR principles but accounts for widening regional variation may now be more efficient than a one-size-fits-all rule.", src: "written", pg: 85 },
          { t: "Individual show cause proceedings will allow the Commission to ensure that solutions to the problems the Secretary identified are tailored to the specific, varied circumstances and market constructs of each region.", src: "written", pg: 86 } ] },
        { name: "Speed over the years-long rulemaking path", desc: "Show-cause moves faster than notice-and-comment; he cites prior rules still not fully implemented years later.", quotes: [
          { t: "proceeding via individual show cause orders will allow the Commission to act more quickly than through traditional rulemaking.", src: "written", pg: 86 } ] },
        { name: "Two-thirds of load now; an open door for the rest", desc: "Starts with the six RTO/ISO markets but invites §205 filings and encourages non-RTO regions to act, without foreclosing a future rule.", quotes: [
          { t: "The six markets together cover nearly two-thirds of load subject to Commission-jurisdictional rates, and therefore focusing initially on those regions is a prudent first step.", src: "written", pg: 87 },
          { t: "I encourage transmission providers and other stakeholders outside RTO/ISO regions to make individual filings to address the issues we discuss today.", src: "written", pg: 87 },
          { t: "FERC is no longer the sleepy, responsive agency of the past—our country cannot afford for it to be.", src: "written", pg: 87 } ] },
      ],
    },
    {
      key: "rosner", name: "David Rosner", role: "Commissioner", short: "Four pillars",
      quote: "Bring Your Own New Generation",
      quotePg: 93,
      gist: "Frames the orders as four pillars — protecting consumers, safeguarding reliability, enhancing transparency, fostering innovation. Stresses Cost Recovery Agreements so a data center that never shows up can’t shift costs onto residential customers, grid-enhancing technologies, and ‘Bring Your Own New Generation’ modeled on SPP’s HILLGA.",
      sources: { written: "Concurring statement, 195 FERC ¶ 61,211 (PJM) pp. 90–98; largely common across the six orders, with some per-order tailoring", spoken: "FERC open meeting, June 18, 2026 (youtube.com/watch?v=r7y-iDn-rkU, auto-caption)" },
      summary: "Rosner organizes the orders around four pillars: protecting consumers, safeguarding reliability, enhancing transparency, and fostering innovation. He leads with Cost Recovery Agreements so residential customers are not left paying for infrastructure built for a data center that never arrives, pushes grid-enhancing technologies and curbs on speculative interconnection requests, and frames flexible transmission service and Bring Your Own New Generation (modeled on SPP's HILLGA) as the innovation that connects load faster and cheaper. He calls the states essential partners and urges §205 filings inside and outside the RTOs.",
      themes: [
        { name: "Protecting consumers: Cost Recovery Agreements", desc: "Mandatory agreements make a large load, not other customers, bear the cost of infrastructure built to serve it if it never materializes.", quotes: [
          { t: "if new infrastructure is built to accommodate a data center, and that data center doesn't show up, residential customers are not left on the hook to pay the costs.", src: "written", pg: 91 },
          { t: "if new transmission infrastructure is built to serve a data center and that data center doesn't show up, other customers, especially regular consumers, will not be on the hook for those costs. Period.", src: "spoken", at: "~21:00" } ] },
        { name: "Safeguarding reliability", desc: "Study procedures and operational requirements should reflect large loads' novel characteristics and reliability impacts.", quotes: [
          { t: "They help ensure that RTO/ISOs use study procedures and operational requirements that reflect large loads' unique characteristics and the reliability impacts of connecting them to the grid.", src: "written", pg: 91 } ] },
        { name: "Enhancing transparency, deterring speculation", desc: "Make each upgrade's cost and beneficiary public, and add escalating readiness requirements to weed out speculative requests.", quotes: [
          { t: "if a Network Upgrade is built to connect a large load to the grid, consumers should know who that upgrade was built for and what it cost.", src: "written", pg: 92 },
          { t: "we target speculative projects by establishing escalating readiness requirements for distinct phases of the study process to deter duplicative or speculative requests for transmission service.", src: "written", pg: 92 } ] },
        { name: "Fostering innovation: flexible service and BYONG", desc: "Non-firm service for loads willing to curtail, plus studying electrically proximate load and generation together — Bring Your Own New Generation, modeled on SPP's HILLGA.", quotes: [
          { t: "To add new supply to the grid, we must create incentives for “Bring Your Own New Generation.”", src: "written", pg: 93 },
          { t: "today's orders direct other regions to follow SPP's lead in ways that work for them.", src: "written", pg: 94 },
          { t: "We need new generation of all kinds which means we need to make bring your own new generation.", src: "spoken", at: "~31:00" } ] },
        { name: "States are essential partners; file under §205", desc: "Respects the federal-State jurisdictional line and urges RTOs and non-RTO utilities alike to bring §205 proposals.", quotes: [
          { t: "States are essential partners in this work.", src: "written", pg: 94 },
          { t: "today's orders invite RTO/ISOs to respond by submitting proposals under FPA section 205.  I cannot encourage this enough.", src: "written", pg: 94 } ] },
      ],
    },
    {
      key: "see", name: "Lindsay S. See", role: "Commissioner", short: "Federalism + affordability",
      quote: "affordability must be at the forefront as we protect consumers",
      quotePg: 99,
      gist: "Two themes: large-load interconnection is a shared federal-State responsibility, so the orders should support state efforts rather than override them; and affordability must stay central. Pushes alternative transmission technologies to hold down network-upgrade costs and asks states what cost data they actually need.",
      sources: { written: "Concurring statement, 195 FERC ¶ 61,211 (PJM) pp. 98–103; largely common across the six orders, with some per-order tailoring", spoken: "FERC open meeting, June 18, 2026 (youtube.com/watch?v=r7y-iDn-rkU, auto-caption)" },
      summary: "See highlights two principles she says must stay central: large-load interconnection is a shared federal-State responsibility, so the orders should support State efforts rather than override them; and affordability must stay at the forefront. She presses alternative transmission technologies to hold down network-upgrade costs, asks the States what cost data they actually need, and frames the duty to assign costs to those who cause them as core customer protection.",
      themes: [
        { name: "New circumstances require adapting the grid", desc: "The pace and scale of large loads change operations, planning, and cost allocation faster than existing systems were built for.", quotes: [
          { t: "The pace and scale of emerging large loads create new circumstances that require us to adapt in how we build and manage the grid.", src: "written", pg: 98 },
          { t: "there is no substitute for getting out of the office to see what it actually takes to get steel in the ground", src: "spoken", at: "~37:00" } ] },
        { name: "A shared federal-State responsibility — support, don't override", desc: "Use FERC's authority on the parts it owns while respecting and aiding the States, whose role is statutorily preserved.", quotes: [
          { t: "exercising our authority fully without hamstringing our regulatory and industry partners means respecting the States.", src: "written", pg: 99 },
          { t: "Our action today is designed to support further State efforts in this urgent and fast-moving space, not override them.", src: "written", pg: 99 } ] },
        { name: "Affordability at the forefront", desc: "Protect consumers from unnecessary costs as demand rises, and get States the cost information they need.", quotes: [
          { t: "affordability must be at the forefront as we protect consumers from unnecessary costs in a time of rising demand.", src: "written", pg: 99 } ] },
        { name: "Alternative transmission technologies to hold costs down", desc: "ATTs can cut large-load network-upgrade costs; providers choosing traditional upgrades must justify why ATTs would not be cheaper or faster.", quotes: [
          { t: "if the transmission provider opts for traditional network upgrades, they must demonstrate why ATTs are not feasible or would not result in lower costs or a faster timeline for the large load interconnection customer.", src: "written", pg: 100 } ] },
        { name: "Assign costs to who causes them", desc: "Reaffirms cost responsibility — jurisdictional costs fall on the customers who drive or benefit from upgrades, not on families and small businesses.", quotes: [
          { t: "we reaffirm our responsibility to assign jurisdictional costs to the customers who drive or benefit from grid upgrades, not shift them onto families and small businesses.", src: "written", pg: 100 } ] },
      ],
    },
    {
      key: "chang", name: "Judy W. Chang", role: "Commissioner", short: "Records & cost causation",
      quote: "The FPA is fundamentally a customer protection statute",
      quotePg: 104,
      gist: "Focuses on building records that survive review under §206’s ex parte limits, calling the FPA ‘fundamentally a customer protection statute.’ Warns that cost-recovery agreements ‘untethered from any assessment of the actual cost’ of serving a load may not protect other customers, and notes the orders deliberately don’t assert the ANOPR’s broadest jurisdictional theory.",
      sources: { written: "Concurring statement, 195 FERC ¶ 61,211 (PJM) pp. 103–109; largely common across the six orders, with some per-order tailoring", spoken: "FERC open meeting, June 18, 2026 (youtube.com/watch?v=r7y-iDn-rkU, auto-caption) — remarks deferred to the written statement" },
      summary: "Chang focuses on procedure and customer protection. Because the Commission is acting through individual §206 show-cause proceedings rather than a rulemaking, she stresses the record in each region must be thorough, and §206's ex parte limits make that harder. She calls the FPA fundamentally a customer-protection statute and warns that cost-recovery agreements untethered from the actual cost of service may not protect other customers. She flags that extending the PJM co-location transmission services is a paradigm shift from Order No. 888 that must not create reliability risks, backs requiring evaluation of alternative transmission technologies, and notes the orders deliberately stop short of the ANOPR's broadest jurisdictional theory.",
      themes: [
        { name: "Restraint on jurisdiction; collaborate with the States", desc: "The orders deliberately do not assert the ANOPR's broadest jurisdictional theory, to ease state concerns about federal encroachment.", quotes: [
          { t: "The Commission does not pursue the broad assertion of jurisdictional authority contemplated in the Advanced Notice of Proposed Rulemaking, which I hope assuages concerns raised by our state colleagues that the Commission ought not encroach upon matters properly left to their jurisdiction.", src: "written", pg: 103 } ] },
        { name: "Build actionable records under §206's ex parte limits", desc: "Acting case-by-case (not by rulemaking) triggers ex parte restrictions, so a complete regional record matters even more.", quotes: [
          { t: "the Commission needs active participation from interested stakeholders to develop thorough records in each region.", src: "written", pg: 104 },
          { t: "the issues addressed by these orders will be subject to ex parte restrictions across the RTOs/ISO regions", src: "written", pg: 104 } ] },
        { name: "The FPA is a customer-protection statute", desc: "Guards against cost shifts; warns that revenue-contribution agreements untethered from actual cost may not protect other customers.", quotes: [
          { t: "The FPA is fundamentally a customer protection statute", src: "written", pg: 104 },
          { t: "bilateral agreements that simply provide transmission revenue contributions untethered from any assessment of the actual cost of providing transmission service induced by individual large loads may be insufficient to adequately protect other customers against unjustified cost shifts.", src: "written", pg: 105 } ] },
        { name: "New transmission services are a paradigm shift from Order No. 888", desc: "Extending the PJM co-location services runs the system tighter and must be weighed against reliability risk.", quotes: [
          { t: "These new transmission services represent a fundamental paradigm shift from the traditional network service and point-to-point transmission service models established in Order No. 888 that have been used across the country for the last three decades.", src: "written", pg: 107 },
          { t: "the Commission and grid operators must also be careful not to implement changes that create unforeseen reliability risks.", src: "written", pg: 107 } ] },
        { name: "Require evaluation of alternative transmission technologies", desc: "Each tariff is preliminarily unjust and unreasonable for lacking provisions that require considering ATTs to cut cost or time.", quotes: [
          { t: "each RTO/ISO's tariff is unjust and unreasonable because the tariff lacks clear and consistent provisions requiring the evaluation of alternative transmission technologies as potential solutions to accommodate an Eligible Customer's request for transmission service on behalf of a large load.", src: "written", pg: 107 } ] },
      ],
    },
    {
      key: "lacerte", name: "David LaCerte", role: "Commissioner", short: "Jurisdictional hardball",
      quote: "I am prepared to play jurisdictional hardball, if needed",
      quotePg: 113,
      gist: "The sharpest tone. Invites region-specific §205 proposals and offers operators the ‘first pen,’ but says he is ‘prepared to play jurisdictional hardball’ — if they don’t file real fixes, FERC will ‘dictat[e] the solutions for you.’ Ties the orders to state Ratepayer Protection Pledges.",
      sources: { written: "Concurring statement, 195 FERC ¶ 61,211 (PJM) pp. 111–114; largely common across the six orders, with some per-order tailoring", spoken: "FERC open meeting, June 18, 2026 (youtube.com/watch?v=r7y-iDn-rkU, auto-caption) — remarks deferred to the written statement" },
      summary: "LaCerte strikes the sharpest tone. He frames the moment as an inflection point and offers the RTOs the first wielder of the pen under §205 to bring region-specific fixes, with flexibility on timing, but says that freedom comes with responsibility. If they do not file adequate proposals, he is prepared to play jurisdictional hardball and FERC will dictate the solutions. He backs deploying alternative transmission technologies now and asks state commissions to ensure their retail tariffs insulate ratepayers from data-center cost impacts.",
      themes: [
        { name: "An inflection point that outpaces the system", desc: "Large-load growth is faster than the grid can handle; the orders choose decisive change over gridlock and half-measures.", quotes: [
          { t: "We are at an inflection point in the history of American energy infrastructure.", src: "written", pg: 111 },
          { t: "The extraordinary and rapid growth of large loads in RTOs and ISOs is faster than the current system can handle.", src: "written", pg: 111 },
          { t: "every gambler knows that the secret to surviving is knowing what to throw away and knowing what to keep.", src: "written", pg: 112 } ] },
        { name: "Use alternative transmission technologies now", desc: "Deploy ATTs to unlock existing capacity, speed interconnection, lower costs, and help prevent cost shifting.", quotes: [
          { t: "I also support the use of alternative transmission technologies to unlock every megawatt of existing capacity from our current transmission system.  We have the technology.  We should use it now", src: "written", pg: 111 } ] },
        { name: "First wielder of the pen — but responsibility comes with it", desc: "§205 lets the regions write the first proposal with flexibility on timing; that freedom carries an obligation to file real fixes.", quotes: [
          { t: "By inviting you to proceed under FPA section 205, we are giving you significant perks:  the benefits of first wielder of the pen", src: "written", pg: 113 },
          { t: "But such freedom comes with great and concomitant responsibility.", src: "written", pg: 113 } ] },
        { name: "Prepared to play jurisdictional hardball", desc: "If a region does not file an adequate §205 proposal, FERC will use its broad transmission jurisdiction and impose the remedy itself.", quotes: [
          { t: "I am prepared to play jurisdictional hardball, if needed.", src: "written", pg: 113 },
          { t: "any failure on your end to provide a sufficient FPA filing or filings to address the large-load-related concerns that we have identified will result in the Commission dictating the solutions for you.", src: "written", pg: 114 } ] },
        { name: "Ratepayer protection through region-specific tariffs", desc: "Asks state commissions to insulate ratepayers from data-center cost impacts, and favors tailored proposals over top-down mandates.", quotes: [
          { t: "ensure their large load retail tariff provisions insulate ratepayers from the negative impacts of data center growth.", src: "written", pg: 111 },
          { t: "not through top-down, one-size-fits-all mandates, but through consideration of region-specific proposals.", src: "written", pg: 112 } ] },
      ],
    },
  ];

  /* ------------------------------------------------ file / follow the dockets */
  const participate = {
    intro: "Each proceeding is open on the public record. Interventions, comments, and protests are filed in the relevant docket via FERC Online; anyone can follow filings in eLibrary or eSubscription. Reference the exact docket number on every submission.",
    // per-docket eLibrary docket-sheet links (enter the docket number if a link 404s on a new docket)
    dockets: [
      { item: "E-2", rto: "PJM co-location", docket: "EL25-49-002" },
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

  // Section IV "Briefing Questions" — the questions each show cause order directs the RTO/ISO to brief.
  // Templated across the six orders (each `v` verified verbatim in every applicable order's text); only
  // the page and SPP's omission differ. SPP already has the proximate-generation process (HILLGA), so its
  // order does not pose that question. `t`/`d` are the curator's plain-language label + gloss, not quotes.
  const briefing = {
    questions: [
      { id: "arrangements", t: "Protecting existing commercial arrangements", d: "A reasonable implementation period and time to finalize deals already signed or nearing completion, so the new rules don't disrupt them.", v: "what would be a reasonable implementation period to ensure minimal disruption to such existing commercial arrangements" },
      { id: "planning", t: "Planning impact of flexible transmission services", d: "How the proposed flexible (curtailable) large-load services would affect regional and local transmission planning.", v: "what, if any, potential impacts on regional and local transmission planning would arise from the introduction of the new transmission services discussed herein" },
      { id: "costshift", t: "Cost-shift protections", d: "Agreement structures, a minimum level of cost recovery, and financial security so large-load network-upgrade costs aren't shifted onto other customers.", v: "without the inclusion of cost shifting protections" },
      { id: "att", t: "Alternative transmission technologies", d: "Whether the tariff must require evaluating ATTs (e.g., dynamic line ratings, reconductoring) before selecting traditional network upgrades.", v: "requiring the evaluation of alternative transmission technologies" },
      { id: "proximate", t: "Generator interconnection for proximate / co-located load", d: "Market participation, mitigation, and resource-adequacy treatment for generation serving electrically proximate or co-located large load.", v: "to seek generator interconnection service" },
    ],
    pages: { "E-7": 69, "E-8": 73, "E-9": 51, "E-10": 75, "E-11": 74, "E-12": 78 },
    omit: { "E-9": ["proximate"] },
  };
  return { SOURCES, meta, kpis, timeline, toplines, categories, dockets, colocation, jurisdiction, regional, reception, media, voices, voiceThemes, comments, commissioners, briefing, participate };
})();
