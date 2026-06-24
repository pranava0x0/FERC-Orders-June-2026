/* Build docs/js/comments-data.js (window.FERC_COMMENTS) for the Comments tab — derived from the
 * scraped manifest + the audit index + the extracted comment texts. Re-run after a download/audit pass.
 *
 *   sources/comments/rm26-4-comments.json   (273 comments: org, filed, acc, bucket, desc + bucket_labels)
 *   sources/comments/rm26-4-audit-index.json (downloaded / summarized status per accession)
 *   sources/comments/files/<acc>/*.txt        (extracted bodies -> theme prevalence)
 *        => docs/js/comments-data.js
 *
 * Run: node tools/build-comments-page-data.mjs
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const C = join(here, "..", "sources", "comments");
const cj = JSON.parse(readFileSync(join(C, "rm26-4-comments.json"), "utf8"));
const audit = JSON.parse(readFileSync(join(C, "rm26-4-audit-index.json"), "utf8"));
const auditByAcc = Object.fromEntries(audit.index.map((r) => [r.accession, r]));
const labels = cj.bucket_labels || {};

// filed "MM/DD/YYYY" -> sortable YYYYMMDD; round = comment-period phase by date
const sortKey = (filed) => { const [m, d, y] = filed.split("/"); return y + m.padStart(2, "0") + d.padStart(2, "0"); };
const roundOf = (filed) => {
  const [m, , y] = filed.split("/");
  if (y === "2025" && +m <= 11) return "initial";
  if (y === "2025" && +m === 12) return "reply";
  return "supplemental";
};
const ROUND_LABEL = { initial: "Initial comments", reply: "Reply comments", supplemental: "Supplemental comments" };

// ---- themes: keyword prevalence across the extracted bodies (a measured signal, not a semantic read) ----
const THEMES = [
  { key: "colo", label: "Co-location & behind-the-meter", re: /co-?locat|behind[- ]the[- ]meter|\bbtm\b/i },
  { key: "cost", label: "Cost allocation & cost-shifting", re: /cost[- ]?(allocation|shift|causation|responsibilit|recovery)|stranded (asset|cost)|cross[- ]subsidiz/i },
  { key: "reliability", label: "Reliability & resource adequacy", re: /reliabilit|resource adequacy|bulk[- ]power system|\bnerc\b/i },
  { key: "flex", label: "Flexible & curtailable load", re: /flexible load|load flexibilit|curtailab|curtailment|dispatchable load|demand response/i },
  { key: "study", label: "Study process, queue & readiness", re: /interconnection study|study process|cluster study|interconnection queue|readiness requirement|withdrawal penalt|study deposit/i },
  { key: "threshold", label: "Large-load definition & 20 MW threshold", re: /\b20 ?mw\b|size threshold|definition of (a )?large load|alternative threshold|megawatt threshold/i },
  { key: "byog", label: "Bring-your-own-generation & self-supply", re: /bring[- ]your[- ]own[- ]generation|\bbyog\b|self[- ]supply|co[- ]located generation|on-?site generation/i },
  { key: "speculative", label: "Speculative demand & over-forecasting", re: /speculativ|phantom load|double[- ]count|over[- ]?forecast|overstate.{0,10}demand/i },
  { key: "jurisdiction", label: "FERC jurisdiction & §206 authority", re: /jurisdiction|section 206|section 205|federal power act|\bfpa\b|state authority|retail (rate|service|jurisdiction)/i },
  { key: "datacenter", label: "Data centers & AI demand", re: /data cent(er|re)|hyperscal|artificial intelligence/i },
  { key: "gi2003", label: "Generator-interconnection parity (Order 2003)", re: /order no\.? ?2003|generator interconnection|\blgia\b|\blgip\b/i },
  { key: "ratepayer", label: "Ratepayer & consumer protection", re: /ratepayer|consumer protection|captive customer|residential customer|protect (consumers|customers)/i },
];
const themeCounts = Object.fromEntries(THEMES.map((t) => [t.key, 0]));

const bodyText = (acc) => {
  const d = join(C, "files", acc);
  if (!existsSync(d)) return "";
  return readdirSync(d).filter((f) => f.endsWith(".txt"))
    .map((f) => { try { return readFileSync(join(d, f), "utf8"); } catch { return ""; } }).join("\n");
};

let analyzed = 0;
const list = cj.comments.map((c) => {
  const a = auditByAcc[c.acc] || {};
  const txt = bodyText(c.acc);
  if (txt.length > 200) {
    analyzed++;
    for (const t of THEMES) if (t.re.test(txt)) themeCounts[t.key]++;
  }
  return { acc: c.acc, org: c.org, filed: c.filed, bucket: c.bucket, desc: c.desc,
           dl: a.downloaded ? 1 : 0, sum: a.summarized ? 1 : 0 };
}).sort((x, y) => (sortKey(x.filed) < sortKey(y.filed) ? -1 : sortKey(x.filed) > sortKey(y.filed) ? 1 : x.org.localeCompare(y.org)));

// respondent types: count per bucket, sorted desc
const typeCounts = {};
for (const c of cj.comments) typeCounts[c.bucket] = (typeCounts[c.bucket] || 0) + 1;
const respondentTypes = Object.entries(typeCounts)
  .map(([bucket, count]) => ({ bucket, label: labels[bucket] || bucket, count }))
  .sort((a, b) => b.count - a.count);

// rounds: count + date span per comment-period phase
const rounds = ["initial", "reply", "supplemental"].map((key) => {
  const xs = list.filter((c) => roundOf(c.filed) === key);
  return { key, label: ROUND_LABEL[key], count: xs.length,
           first: xs.length ? xs[0].filed : null, last: xs.length ? xs[xs.length - 1].filed : null };
}).filter((r) => r.count);

const themes = THEMES.map((t) => ({ key: t.key, label: t.label, count: themeCounts[t.key],
  pct: analyzed ? Math.round((themeCounts[t.key] / analyzed) * 100) : 0 }))
  .sort((a, b) => b.count - a.count);

const out = {
  captured: cj.captured_at,
  source_url: cj.source_url,
  total: cj.comments.length,
  analyzed,
  downloaded: audit.index.filter((r) => r.downloaded).length,
  summarized: audit.summarized,
  dateRange: { first: list[0].filed, last: list[list.length - 1].filed },
  rounds,
  respondentTypes,
  themes,
  bucketLabels: labels,
  list,
};

const banner = "/* GENERATED by tools/build-comments-page-data.mjs from sources/comments/. Do not edit by hand. */\n";
writeFileSync(join(here, "..", "docs", "js", "comments-data.js"), banner + "window.FERC_COMMENTS = " + JSON.stringify(out) + ";\n");
console.log(`comments-data.js: ${out.total} comments | analyzed ${analyzed} bodies | ${respondentTypes.length} respondent types | top theme: ${themes[0].label} (${themes[0].count})`);
