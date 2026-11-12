#!/usr/bin/env node
// Build sources/discourse/index.json: every Discourse item (commentary quotes, named voices, consensus and
// friction lines, stakeholder reception, and the filed positions in perspectives.json) as one flat list,
// each tagged with themes (sources/filings/themes.json keys) and the Filings proceedings it discusses.
//
// Tagging is deterministic keyword matching, so a refresh re-tags the same way every time. Overrides in
// sources/discourse/overrides.json (keyed by item id) replace the computed themes or groups for one item.
//
//   node tools/build-discourse-index.mjs          # write the index
//   node tools/build-discourse-index.mjs --check  # exit 1 if the committed index is stale
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { loadData } from "./build-seo.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "sources", "discourse", "index.json");
const read = (...p) => JSON.parse(readFileSync(join(ROOT, ...p), "utf8"));

export const THEME_RULES = {
  study: /\bqueue|\bstud(y|ies)\b|application process|interconnection process|alternative transmission|grid-enhancing|reconductor|speed to power|speed-to-power/i,
  cost: /\bcost|ratepayer|\bbills?\b|who pays|minimum (charge|take|bill)|cost shift|affordab/i,
  colo: /co-?locat|behind[- ]the[- ]meter|\bBTMG?\b|on-site generation|onsite generation/i,
  flex: /flexib|curtail|interruptib|demand response|non-firm|conditional service/i,
  proximate: /proximate|bring[- ]your[- ]own|\bBYO|self-suppl/i,
  registry: /registry|forecast|telemetry|definition of (a )?large load|50 MW/i,
  adequacy: /capacity (market|auction|price)|resource adequacy|backstop|\bauction|shortfall|\bRBP\b|reliability/i,
  retail: /\bstates?\b|retail|jurisdiction|state commission|PUC\b/i,
  credit: /collateral|credit requirement|withdrawal|exit fee|financial security/i,
  procedure: /abeyance|rehearing|deadline|extension|litigat|\bcourt\b|appeal/i,
};
// Which Filings proceedings an item talks about. RTO names map to their show cause docket.
export const GROUP_RULES = [
  ["pjm-large-load-definition", /ER26-3515|large load registry|\bregistry\b/i],
  ["pjm-backstop", /backstop|\bRBP\b|ER26-3380|ER27-454|ER27-330/i],
  ["exelon-prompt-auction", /Exelon|EL27-11|prompt auction/i],
  ["pjm-colocation", /co-?locat|EL25-49|\bE-2\b|Talen|Susquehanna/i],
  ["miso-lars", /\bLARS\b|ER27-25/i],
  ["miso-zgia", /zero-injection|ER26-3552/i],
  ["miso-irr", /ER26-3650|reliability requirements/i],
  ["spp-chills", /CHILLS|ER27-432/i],
  ["pjm-governance", /governance|AD26-7|Members Committee/i],
  ["reliability-conference", /AD26-8|technical conference/i],
  ["duke-nitsa", /\bDuke\b|ER26-2691/i],
  ["sc-pjm", /\bPJM\b|EL26-67|\bE-7\b/],
  ["sc-miso", /\bMISO\b|EL26-70|\bE-8\b/],
  ["sc-spp", /\bSPP\b|EL26-68|\bE-9\b/],
  ["sc-caiso", /\bCAISO\b|EL26-71|\bE-10\b/],
  ["sc-isone", /ISO-NE|ISO New England|EL26-72|\bE-11\b/],
  ["sc-nyiso", /\bNYISO\b|EL26-69|\bE-12\b/],
];
export function tag(text) {
  const themes = Object.entries(THEME_RULES).filter(([, re]) => re.test(text)).map(([k]) => k);
  const groups = GROUP_RULES.filter(([, re]) => re.test(text)).map(([g]) => g);
  return { themes: themes.slice(0, 4), groups };
}
const idOf = (kind, text) => kind + "-" + createHash("sha256").update(text).digest("hex").slice(0, 10);

export function buildIndex() {
  const D = loadData();
  const persp = read("sources", "filings", "perspectives.json");
  const overrides = existsSync(join(ROOT, "sources", "discourse", "overrides.json")) ? read("sources", "discourse", "overrides.json") : {};
  // Document → proceeding, from the baked Filings record, so a filed position links to its proceeding.
  const rec = readFileSync(join(ROOT, "docs", "js", "record-data.js"), "utf8");
  const R = JSON.parse(rec.slice(rec.indexOf("{"), rec.lastIndexOf("}") + 1));
  const docGroup = new Map(R.groups.flatMap((g) => g.docs.map((d) => [d.slug, g.id])));
  const dateOf = (src) => { const s = D.SOURCES[src] || {}; return s.published || s.captured || null; };
  const items = [];
  const push = (it) => {
    const t = tag([it.text, it.title, it.who].filter(Boolean).join(" "));
    const o = overrides[it.id] || {};
    items.push({ ...it, themes: o.themes || t.themes, groups: [...new Set([...(it.groups || []), ...(o.groups || t.groups)])] });
  };
  for (const t of D.voiceThemes || []) for (const q of t.quotes || [])
    push({ id: idOf("quote", q.q), kind: "quote", text: q.q, title: t.title, src: [q.src], date: dateOf(q.src), wave: t.wave || 1 });
  for (const v of D.voices || []) push({ id: idOf("voice", v.name + v.take), kind: "voice", who: v.name, affil: v.affil, text: v.take, src: v.src, date: (v.src || []).map(dateOf).filter(Boolean).sort().pop() || null });
  for (const c of D.media.consensus || []) push({ id: idOf("consensus", c.t), kind: "consensus", text: c.t, src: c.src, date: (c.src || []).map(dateOf).filter(Boolean).sort().pop() || null });
  for (const c of D.media.friction || []) push({ id: idOf("friction", c.t), kind: "friction", text: c.t, src: c.src, date: (c.src || []).map(dateOf).filter(Boolean).sort().pop() || null });
  for (const r of D.reception || []) push({ id: idOf("reception", r.group + r.body), kind: "reception", who: r.group, stance: r.stance, text: r.body, src: r.src, date: (r.src || []).map(dateOf).filter(Boolean).sort().pop() || null });
  // perspectives.json repeats one statement once per document it bears on; merge those into one item.
  const merged = new Map();
  for (const p of persp) {
    const k = p.title + "\u0000" + p.speaker + "\u0000" + p.text;
    if (merged.has(k)) merged.get(k).slugs.push(...p.slugs.filter((s) => !merged.get(k).slugs.includes(s)));
    else merged.set(k, { ...p, slugs: [...p.slugs] });
  }
  for (const p of merged.values()) {
    const docs = p.slugs.map((s) => ({ slug: s, group: docGroup.get(s) || null }));
    push({ id: idOf("filed", p.title + p.speaker + p.text), kind: "filed", who: p.speaker, title: p.title, text: p.text, url: p.url, locator: p.locator, docs, groups: docs.map((d) => d.group).filter(Boolean), date: null });
  }
  const seen = new Set();
  for (const it of items) { if (seen.has(it.id)) throw Error("duplicate discourse id " + it.id); seen.add(it.id); }
  const groupLabels = Object.fromEntries(read("sources", "filings", "proceedings.json").groups.map((g) => [g.id, g.short]));
  const themeLabels = Object.fromEntries(read("sources", "filings", "themes.json").themes.map((t) => [t.key, t.label]));
  return { groupLabels, themeLabels, note: "Generated by tools/build-discourse-index.mjs from data.js and sources/filings/perspectives.json. Do not edit; use sources/discourse/overrides.json.", items };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const text = JSON.stringify(buildIndex(), null, 1) + "\n";
  if (process.argv.includes("--check")) {
    const ok = existsSync(OUT) && readFileSync(OUT, "utf8") === text;
    console.log(ok ? "✓ discourse index is current" : "✗ sources/discourse/index.json is stale: run node tools/build-discourse-index.mjs");
    process.exit(ok ? 0 : 1);
  }
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, text);
  const items = JSON.parse(text).items, by = {};
  for (const it of items) by[it.kind] = (by[it.kind] || 0) + 1;
  const untagged = items.filter((i) => !i.groups.length).length;
  console.log(`✓ wrote sources/discourse/index.json: ${items.length} items ${JSON.stringify(by)}; ${untagged} link to no proceeding`);
}
