/* Classify and tally the RM26-4-000 docket-sheet manifest scraped from FERC eLibrary.
 * Input:  sources/comments/rm26-4-manifest.raw.json (array of {cat, org, filed, acc, desc})
 * Output: sources/comments/rm26-4-comments.json (provenance + stats + categorized comment list)
 * Run:    node tools/analyze-comments.mjs
 * Stats are mechanical from the manifest; stakeholder buckets use keyword rules (first match wins).
 * The manifest is the scraped record of WHO filed and WHAT TYPE — not the comment bodies. */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const RAW = join(here, "..", "sources", "comments", "rm26-4-manifest.raw.json");
const OUT = join(here, "..", "sources", "comments", "rm26-4-comments.json");
const rows = JSON.parse(readFileSync(RAW, "utf8"));

// The docket sheet labels these two filings as unaffiliated individuals, but the downloaded filings
// identify their organizations. Keep the scraped value as org_raw while making the evidence-backed
// correction reproducible on every refresh.
const ORG_OVERRIDES = {
  "20251110-5121": "Texas Blockchain Council",
  "20251114-5063": "VEIR Inc.",
};

const has = (s, ...subs) => subs.some((x) => s.toLowerCase().includes(x.toLowerCase()));

// Filing type from the description (one type per filing).
function filingType(r) {
  const d = r.desc || "";
  if (r.cat === "Issued By") return "ferc_notice";
  if (/Secretary of Energy/i.test(r.org) || /Secretary of Energy's letter/i.test(d)) return "doe_anopr";
  if (/Motion to Intervene|Notice of Intervention/i.test(d)) return "intervention";
  if (/Extension of Time|Answer in Support|update the service list|request to update/i.test(d)) return "procedural";
  if (/\bComments?\b|Comment of/i.test(d)) return "comment";
  return "other";
}

// Stakeholder bucket for an organization (ordered; first hit wins).
function bucket(org, desc) {
  const o = org || "";
  if (has(o, "Individual No Affiliation")) return "individual";
  if (has(o, "US SENATOR", "US Senate", "Senator", "Member of Congress", "House of Representatives", "Governor", "UNITED STATES CONGRESS", "COMMITTEE ON ENERGY")) return "elected";
  if (has(o, "Monitoring Analytics", "Market Monitoring Unit", "Market Monitor", "Independent Market Monitor")) return "market_monitor";
  if (has(o, "ISO New England", "PJM Interconnection", "Midcontinent Independent", "Southwest Power Pool, Inc", "New York Independent System", "California Independent System", "ISO-NE", "NYISO", "CAISO") && !has(o, "Organization of", "States Committee", "Transmission Owner")) return "rto_iso";
  if (has(o, "Organization of MISO States", "Organization of PJM States", "States Committee on Electricity", "NESCOE", "New England States Committee")) return "state_assoc";
  if (has(o, "Consumer Advocate", "People's Counsel", "Consumers' Counsel", "Consumers Counsel", "Public Advocate", "Consumer Counsel", "Attorney General", "Division of the Public Advocate", "Coalition for Affordable Utility", "Utility Consumer Advocate", "Utility Intervention Unit", "Ohio Federal Energy Advocate")) return "consumer_advocate";
  if (has(o, "Public Service Commission", "Public Utilities Commission", "Public Utility Commission", "Corporation Commission", "Commerce Commission", "Public Regulation Commission", "Board of Public Utilities", "Department of Public Utilities", "State Reliability Council", "Utilities Commission", "Regulatory Utility Commissioners", "Conference of State Legislatures", "Energy Administration", "Power Review Board", "Department of Stat")) return "state_commission";
  if (has(o, "Public Citizen", "Sierra Club", "Center for Biological Diversity", "Environmental Law", "Land Trust", "Alliance for Tribal", "Natural Resources Defense", "Earthjustice", "Union of Concerned Scientists", "Pew Charitable", "Yakama Nation", "Congress of American Indians", "Confederated Tribes")) return "enviro";
  if (has(o, "R Street", "Institute for Progress", "David Gardiner", "ClearPath", "Niskanen", "Brattle", "RAND", "Cato Institute", "Competitive Enterprise", "Prime Mover Institute", "Harvard Electricity", "MCC Economics")) return "think_tank";
  if (has(o, "Data Center", "Digital Energy Council", "Digital Power Network", "Google", "Amazon", "Microsoft", "Meta ", "Tract Holding", "Paces AI", "PACES", "Emerald AI", "Critical Loop", "Information Technology Industry", "Crusoe", "OpenAI", "Equinix", "Iron Mountain", "Splight", "SPLIGHT", "CoreWeave", "Nvidia", "NVIDIA", "Oracle", "Switch, Ltd", "Infrastructure Masons", "GridCARE", "American Terawatt")) return "data_center";
  if (has(o, "Demand", "CPower", "Enerwise", "Voltus", "Enchanted Rock", "Mainspring", "Advanced Energy Management", "Energy Management Alliance")) return "demand_flex";
  if (has(o, "Clean Power", "Solar Energy Industries", "Advanced Energy United", "Business Council for Sustainable", "SMA Solar", "American Council on Renewable", "ACORE", "Clean Energy Buyers", "Clean Energy Grid", "Rewiring America", "Energy Storage", "Clean Energy Association", "Thermal Battery", "LEAN Energy")) return "clean_energy";
  if (has(o, "Industrial Energy Consumers", "Industrial Customer", "Transmission Customers", "Steel Manufacturers", "Forest & Paper", "Businesses Advocating Tariff", "ELCON", "Electricity Consumers", "Chamber of Commerce", "Electricity Customer Alliance", "American Chemistry Council")) return "industrial";
  if (has(o, "Petroleum Institute", "Public Gas Association", "Chevron", "Natural Gas Supply", "Gas Association", "ETX Upstream")) return "oil_gas";
  if (has(o, "Electric Power Supply Association", "EPSA")) return "generator_ipp";
  if (has(o, "North American Electric Reliability", "NERC")) return "reliability";
  if (has(o, "WIRES", "Large Public Power Council", "Public Power Association", "Edison Electric", "Energy Trading Institute", "Energy Credit Association", "Electric Cooperative", "REMC", "Municipal Utilities", "Community Choice", "Community Energy", "Public Power", "Cooperative", "Consumer Energy Alliance", "WATT and AMP", "America's Power", "Transmission Access Policy", "Power for Tomorrow", "Energy Association", "Blockchain Council")) return "trade_assoc";
  // generators / IPPs / storage developers — named companies
  if (has(o, "NRG", "Vistra", "Constellation", "LS Power", "Brookfield", "Geronimo", "Pattern Energy", "Arevia", "Arevon", "Eolian", "Clearway", "Longroad", "Treaty Oak", "Calibrant", "AES", "Fervo", "FuelCell", "GridStor", "VC Renewables", "Engie", "ENGIE", "Enel", "Avangrid", "Invenergy", "EDP Power", "EDF Power", "RWE", "Terraflux", "Salt River Project", "Balancing Authority", "Fluence", "CO2EFFICIENT", "Verrus", "Buckeye Power", "Tesla", "Helion", "Oklo", "esVolta", "Shell Energy", "Nuclear", "GridStor")) return "generator_ipp";
  // transmission owners / vertically-integrated utilities
  if (has(o, "Duke Energy", "FirstEnergy", "Eversource", "Pacific Gas", "Consolidated Edison", "PSEG", "Public Service Electric", "Public Service Company", "Portland General", "Avista", "Alliant", "Otter Tail", "Tucson Electric", "Cleco", "Duquesne", "American Transmission Company", "Old Dominion", "Sunflower", "Wabash Valley", "Southern Maryland Electric", "Northeastern", "ITC Holdings", "Entergy", "Consumers Energy", "National Grid", "PPL", "Indicated PJM Transmission Owners", "Transmission Owner Group", "Transmission Owners", "American Electric Power", "Exelon", "Oncor", "Southern California Edison", "Long Island Power", "Power Company", "Electric Company", "Electric Delivery", "Energy Corporation", "Power Corporation", "Power Cooperative", "Power District", "Holdings Corp")) return "transmission_owner";
  return "other";
}

const BUCKET_LABELS = {
  rto_iso: "RTOs / ISOs",
  state_commission: "State commissions",
  state_assoc: "State commissions (collectives)",
  consumer_advocate: "Consumer advocates",
  transmission_owner: "Transmission owners / utilities",
  data_center: "Data centers, hyperscalers & tech",
  generator_ipp: "Generators / IPPs / developers",
  clean_energy: "Clean energy & storage",
  demand_flex: "Demand response / flexible load",
  industrial: "Industrial & large customers",
  think_tank: "Think tanks & research",
  reliability: "Reliability (NERC)",
  oil_gas: "Oil, gas & fuels",
  trade_assoc: "Trade associations & power groups",
  enviro: "Environmental & public interest",
  market_monitor: "Market monitors",
  elected: "Elected officials",
  individual: "Individuals",
  other: "Other / uncategorized",
};

const enriched = rows.map((r) => {
  const correctedOrg = ORG_OVERRIDES[r.acc];
  const row = correctedOrg ? { ...r, org_raw: r.org, org: correctedOrg } : r;
  return { ...row, type: filingType(row), bucket: bucket(row.org, row.desc) };
});
const comments = enriched.filter((r) => r.type === "comment");

const tally = (arr, key) => arr.reduce((m, r) => ((m[r[key]] = (m[r[key]] || 0) + 1), m), {});
const byType = tally(enriched, "type");
const commentsByBucket = tally(comments, "bucket");

// unique organizations that filed a substantive comment (collapse multi-party headers loosely)
const commentOrgs = new Set(comments.filter((r) => r.bucket !== "individual").map((r) => r.org));
const individuals = comments.filter((r) => r.bucket === "individual").length;

// timeline: filings per day; flag the Nov 21, 2025 comment-deadline spike
const toISO = (s) => { const [mm, dd, yy] = (s || "").split("/"); return yy && mm && dd ? `${yy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}` : ""; };
const byDay = tally(enriched, "filed");
const peakDay = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0];
const isoDates = enriched.map((r) => toISO(r.filed)).filter(Boolean).sort();

const stats = {
  total_filings: enriched.length,
  by_type: byType,
  substantive_comments: comments.length,
  org_comments: comments.length - individuals,
  individual_comments: individuals,
  unique_commenting_orgs: commentOrgs.size,
  interventions: byType.intervention || 0,
  comments_by_bucket: Object.fromEntries(
    Object.entries(commentsByBucket).sort((a, b) => b[1] - a[1]).map(([k, v]) => [BUCKET_LABELS[k] || k, v])
  ),
  busiest_day: { date: peakDay[0], filings: peakDay[1] },
  date_range: { first: isoDates[0], last: isoDates[isoDates.length - 1] },
};

const out = {
  docket: "RM26-4-000",
  title: "Interconnection of Large Loads to the Interstate Transmission System (DOE §403 ANOPR)",
  source: "FERC eLibrary docket sheet, scraped via the browser past Cloudflare",
  source_url: "https://elibrary.ferc.gov/eLibrary/docketsheet?docket_number=RM26-4-000",
  captured_at: "2026-06-24",
  note: "Manifest of all filings (who filed, filing type, date, accession). Stakeholder buckets are keyword-derived. Filing bodies were not downloaded; position summaries are provisional and must be audited against the PDFs.",
  bucket_labels: BUCKET_LABELS,
  stats,
  comments: comments.map((r) => ({
    org: r.org,
    ...(r.org_raw ? { org_raw: r.org_raw } : {}),
    filed: r.filed,
    acc: r.acc,
    bucket: r.bucket,
    desc: r.desc,
  })),
};
writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log("=== RM26-4-000 comment manifest ===");
console.log(JSON.stringify(stats, null, 2));
console.log("\nuncategorized comment orgs:", comments.filter((r) => r.bucket === "other").map((r) => r.org).slice(0, 40));
