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
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const C = join(here, "..", "sources", "comments");
const FILES = join(C, "files");
// body dir is named "<accession>__<org-slug>"; resolve it (tolerating an older bare name)
const dirForAcc = (acc) => { if (!existsSync(FILES)) return null; const n = readdirSync(FILES).find((x) => x === acc || x.startsWith(acc + "__")); return n ? join(FILES, n) : null; };
const cj = JSON.parse(readFileSync(join(C, "rm26-4-comments.json"), "utf8"));
const audit = JSON.parse(readFileSync(join(C, "rm26-4-audit-index.json"), "utf8"));
const auditByAcc = Object.fromEntries(audit.index.map((r) => [r.accession, r]));
const labels = cj.bucket_labels || {};

// the audited quote-centric v2 summaries (one JSON per text-extracted comment): the AUTHORITATIVE
// lenses + a plain synthesis (overall_summary + named, stanced bins). The keyword pass below is only
// a fallback for any text body that lacks a v2 summary. See sources/comments/summarization-spec.md.
const V2DIR = join(C, "summaries-v2");
const v2ByAcc = {};
if (existsSync(V2DIR)) for (const f of readdirSync(V2DIR).filter((f) => f.endsWith(".json"))) {
  try { const s = JSON.parse(readFileSync(join(V2DIR, f), "utf8")); v2ByAcc[s.accession] = s; } catch { /* skip unreadable */ }
}

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

// per-comment tags: which of the five reform principles (the orders' categories) and which of the six
// show-cause-order RTO regions each comment engages, detected by keyword in its extracted body.
const PRINCIPLES = [
  { key: "study", label: "Study process & alt-tech", re: /interconnection study|study process|cluster study|interconnection queue|readiness|withdrawal penalt|study deposit|alternative (transmission )?technolog|grid[- ]enhancing|advanced conductor|dynamic line rating|reconductor/i },
  { key: "cost", label: "Cost allocation & transparency", re: /cost allocation|cost[- ]shift|cost causation|cost responsibilit|cross[- ]subsidiz|stranded (asset|cost)|cost transparency/i },
  { key: "colo", label: "Co-location / behind-the-meter", re: /co-?locat|behind[- ]the[- ]meter|\bbtm\b/i },
  { key: "flex", label: "Flexible-load services", re: /flexible load|load flexibilit|curtailab|curtailment|dispatchable load|demand response|controllable load|interruptible/i },
  { key: "proximate", label: "Proximate-generation interconnection", re: /bring[- ]your[- ]own[- ]generation|\bbyog\b|proximate generation|co-?located generation|self[- ]supply|on-?site generation|hybrid (facilit|interconnection)/i },
];
const REGIONS = [
  { key: "pjm", label: "PJM", re: /\bpjm\b/i },
  { key: "miso", label: "MISO", re: /\bmiso\b|midcontinent iso/i },
  { key: "spp", label: "SPP", re: /\bspp\b|southwest power pool/i },
  { key: "caiso", label: "CAISO", re: /\bcaiso\b|california iso|california independent system operator/i },
  { key: "isone", label: "ISO-NE", re: /iso[- ]?ne\b|iso new england|\bnepool\b|new england/i },
  { key: "nyiso", label: "NYISO", re: /\bnyiso\b|new york iso|new york independent system operator/i },
];
// the DOE §403 ANOPR's eight "Principles for Reform" (¶18–25) — the questions the comment period posed.
// desc = a plain-language reading of each point (shown in the UI; not a quote).
const ANOPR_QUESTIONS = [
  { key: "jurisdiction", label: "Transmission-only jurisdiction", desc: "Limit FERC's reach to interconnections made directly to transmission (the seven-factor test), so state authority over generation and retail is untouched.", re: /seven[- ]factor|directly to (the )?transmission|retail (jurisdiction|authority|sales|service)|state (jurisdiction|authority)|local distribution/i },
  { key: "threshold", label: "The 20 MW threshold", desc: "Apply the reforms to new loads over 20 MW; DOE asked whether that line is right, or needed at all.", re: /\b20 ?mw\b|megawatt threshold|size threshold|alternative threshold|definition of (a )?large load|whether (such )?a threshold/i },
  { key: "jointstudy", label: "Study load with generation", desc: "Study large loads and hybrid facilities together with generation, to site them efficiently and cut network upgrades.", re: /studied together|study load and generation|jointly stud|together with generating facilities/i },
  { key: "deposits", label: "Deposits, readiness, penalties", desc: "Standardize study deposits, readiness requirements, and withdrawal penalties to deter speculative projects.", re: /study deposit|readiness requirement|withdrawal penalt|commercial readiness|deter speculative|financial penalt/i },
  { key: "hybridrights", label: "Hybrid injection/withdrawal rights", desc: "Study hybrid load-plus-generation facilities by the injection and withdrawal rights they request.", re: /injection.{0,8}(and|or|\/).{0,8}withdrawal|withdrawal right|injection right|hybrid.{0,15}right/i },
  { key: "protection", label: "System-protection facilities", desc: "Require hybrids to install protection that blocks injections or withdrawals beyond their granted rights.", re: /system protection|unauthorized (injection|withdrawal)|operational limitation|protection facilit/i },
  { key: "expedited", label: "Expedited curtailable study", desc: "Fast-track the study of loads and hybrids that agree to be curtailable and dispatchable.", re: /expedited stud|curtailab|dispatchable|serial interconnection|60[- ]day|controllable load|interruptib/i },
  { key: "upgradecost", label: "100% network-upgrade cost", desc: "Make large loads pay 100% of the network upgrades they trigger; DOE asked about a crediting mechanism.", re: /100% of (the )?network upgrade|network upgrade cost|crediting mechanism|cost responsib.{0,15}upgrade/i },
];

const bodyText = (acc) => {
  const d = dirForAcc(acc);
  if (!d) return "";
  return readdirSync(d).filter((f) => f.endsWith(".txt"))
    .map((f) => { try { return readFileSync(join(d, f), "utf8"); } catch { return ""; } }).join("\n");
};

// per-letter bin detail, fetched lazily by the Comments tab when a row's analysis is opened. The
// comments-data.js row carries only {key,name,stance} chips (loaded up front, must stay light); the
// description + the verbatim quotes that back each bin are too heavy to embed across 268 letters
// (~1.8 MB), so they live in one small file per letter under docs/data/comments/<acc>.json.
let analyzed = 0;
const detailWrites = [];
const list = cj.comments.map((c) => {
  const a = auditByAcc[c.acc] || {};
  const v2 = v2ByAcc[c.acc];
  const txt = bodyText(c.acc);
  let pr = [], rg = [], aq = [];
  const item = { acc: c.acc, org: c.org, filed: c.filed, bucket: c.bucket, desc: c.desc,
                 dl: a.downloaded ? 1 : 0, sum: a.summarized ? 1 : 0 };
  if (txt.length > 200) { analyzed++; for (const t of THEMES) if (t.re.test(txt)) themeCounts[t.key]++; } // themes = measured keyword prevalence
  if (v2) {
    // audited LLM summary present → lenses + synthesis come from it (the authoritative read)
    aq = (v2.lenses && v2.lenses.aq) || [];
    pr = (v2.lenses && v2.lenses.pr) || [];
    rg = (v2.lenses && v2.lenses.rg) || [];
    item.s2 = 1;
    item.summary = v2.overall_summary || "";
    item.bins = (v2.bins || []).map((b) => ({ k: b.key, n: b.name, s: b.stance })); // key, short name, stance
    // the lazy-loaded detail: each bin's plain description + the verbatim quotes that back it.
    // quote_ids reference quotes[].id (1-based id, NOT array index); a bin can be legitimately quoteless.
    const qById = Object.fromEntries((v2.quotes || []).map((q) => [q.id, q]));
    detailWrites.push({ acc: c.acc, detail: { acc: c.acc, bins: (v2.bins || []).map((b) => {
      // quotes stay verbatim strings (the fidelity guard); `pages` is a parallel array of the source
      // page each quote starts on (null when unlocatable), so the UI can cite "p. N" per quote.
      const qs = (b.quote_ids || []).map((id) => qById[id]).filter(Boolean);
      return { key: b.key, name: b.name, stance: b.stance, desc: b.description || "",
        quotes: qs.map((q) => q.text), pages: qs.map((q) => (q.page == null ? null : q.page)) };
    }) } });
  } else if (txt.length > 200) {
    // no v2 summary yet → fall back to keyword detection so the row still carries lens chips
    pr = PRINCIPLES.filter((p) => p.re.test(txt)).map((p) => p.key);
    rg = REGIONS.filter((r) => r.re.test(txt)).map((r) => r.key);
    aq = ANOPR_QUESTIONS.filter((q) => q.re.test(txt)).map((q) => q.key);
  }
  item.aq = aq; item.pr = pr; item.rg = rg;
  return item;
}).sort((x, y) => (sortKey(x.filed) < sortKey(y.filed) ? -1 : sortKey(x.filed) > sortKey(y.filed) ? 1 : x.org.localeCompare(y.org)));
const summarized2 = list.filter((c) => c.s2).length;

// stance breakdown per reform principle, across the comments whose audited summary engages it.
// Lets a newcomer see the lay of the land: who supports vs opposes each reform, with a denominator.
const STANCE_KEYS = ["support", "oppose", "mixed", "neutral"];
const principleStances = PRINCIPLES.map((p) => {
  const tally = { support: 0, oppose: 0, mixed: 0, neutral: 0 };
  for (const c of list) { const b = (c.bins || []).find((x) => x.k === "pr:" + p.key); if (b && tally[b.s] != null) tally[b.s]++; }
  return { key: p.key, label: p.label, ...tally, total: STANCE_KEYS.reduce((s, k) => s + tally[k], 0) };
});

// Consensus map: stakeholder type x reform principle, each cell tallying the audited stances of that
// bucket's letters that engage that principle. Powers the heatmap on the Themes sub-tab. Buckets with
// too little audited signal are dropped (a 1-letter row reads as fake certainty); sorted by engagement.
const STANCE_NET = { support: 1, neutral: 0, mixed: 0, oppose: -1 };
const bucketStances = [...new Set(list.map((c) => c.bucket))].map((bk) => {
  // Audited letters only: the cells tally stances from `bins` (present only on audited summaries), and
  // the UI labels `letters` as "audited letters from this camp" — so the denominator must match (a bucket
  // with unaudited filings would otherwise overstate it, e.g. data centers 29 vs 28 audited).
  const cs = list.filter((c) => c.bucket === bk && c.s2);
  const cells = PRINCIPLES.map((p) => {
    const tally = { support: 0, oppose: 0, mixed: 0, neutral: 0 };
    for (const c of cs) { const b = (c.bins || []).find((x) => x.k === "pr:" + p.key); if (b && tally[b.s] != null) tally[b.s]++; }
    const total = STANCE_KEYS.reduce((s, k) => s + tally[k], 0);
    // net = support − oppose; the UI bands net/total to colour the cell (not the plurality stance, which
    // would flatten a broadly-supportive corpus to one colour and hide the contested cells).
    const net = STANCE_KEYS.reduce((s, k) => s + STANCE_NET[k] * tally[k], 0);
    return { key: p.key, ...tally, total, net };
  });
  const engaged = cells.reduce((s, c) => s + c.total, 0);
  return { bucket: bk, label: labels[bk] || bk, letters: cs.length, engaged, cells };
}).filter((r) => r.engaged >= 4).sort((a, b) => b.engaged - a.engaged);

// aggregate the per-comment lens tags. Denominator is the audited-summary set (the lenses come from
// those summaries now), not the slightly larger keyword-analyzed set used for the themes.
const tagStats = (defs, field) => defs.map((d) => {
  const count = list.filter((c) => c[field].includes(d.key)).length;
  return { key: d.key, label: d.label, count, pct: summarized2 ? Math.round((count / summarized2) * 100) : 0 };
});
const principles = tagStats(PRINCIPLES, "pr");
const regions = tagStats(REGIONS, "rg");
const anoprQuestions = tagStats(ANOPR_QUESTIONS, "aq").map((q) => ({ ...q, desc: ANOPR_QUESTIONS.find((d) => d.key === q.key).desc }));

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
  summarized2,
  dateRange: { first: list[0].filed, last: list[list.length - 1].filed },
  rounds,
  respondentTypes,
  themes,
  anoprQuestions,
  principles,
  principleStances,
  bucketStances,
  regions,
  bucketLabels: labels,
  list,
};

const banner = "/* GENERATED by tools/build-comments-page-data.mjs from sources/comments/. Do not edit by hand. */\n";
writeFileSync(join(here, "..", "docs", "js", "comments-data.js"), banner + "window.FERC_COMMENTS = " + JSON.stringify(out) + ";\n");

// emit the per-letter bin detail (lazy-loaded by the Comments tab). One small file per audited
// letter; rebuilt fresh each run so a removed/renamed summary never leaves an orphan behind.
const DETAIL = join(here, "..", "docs", "data", "comments");
rmSync(DETAIL, { recursive: true, force: true });
mkdirSync(DETAIL, { recursive: true });
for (const { acc, detail } of detailWrites) writeFileSync(join(DETAIL, acc + ".json"), JSON.stringify(detail));

console.log(`comments-data.js: ${out.total} comments | ${summarized2} audited summaries | analyzed ${analyzed} bodies | ${respondentTypes.length} respondent types | top theme: ${themes[0].label} (${themes[0].count})`);
console.log(`bin detail: ${detailWrites.length} per-letter files -> docs/data/comments/`);
