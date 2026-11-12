#!/usr/bin/env node
// tools/build-record-data.mjs — bake docs/js/record-data.js from the verified record sources.
//
//   sources/filings/proceedings.json  the Filings tab's proceedings and their link to the June orders
//   sources/filings/documents/*.json  one reading per document: summary, ask, page-cited points, link to the orders
//   docs/reading/catalog.json         every document in the reading room (which documents exist)
//   sources/filings/tenets.json       earlier hand-curated document metadata (filer names, sides, PDF links)
//   sources/videos/manifest.json    every commissioner video we hold a transcript for
//   sources/videos/chapters.json    the Commissioners tab: per-video table of contents and timestamped quotes
//
// The output is loaded only when the Filings or Commissioners tab opens, so the first paint does not pay for it. Run tools/verify-record.mjs
// first: this script bakes, it does not check quotes.
//
//   node tools/build-record-data.mjs          # write docs/js/record-data.js
//   node tools/build-record-data.mjs --check  # exit 1 if the committed file differs from a fresh build

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "docs", "js", "record-data.js");
const readJSON = (...p) => JSON.parse(readFileSync(join(ROOT, ...p), "utf8"));

// Catalog filer strings concatenate parties with no separator ("Sierra ClubNatural Resources Defense
// Council ,Clean Grid Alliance ,"). Split them back into names; the full list stays on the document.
export function filerList(raw) {
  // Corporate suffixes after a comma belong to the name before them ("Organization of MISO States, Inc.").
  const SUFFIX = /^(Inc\.?|L\.?L\.?C\.?|LLC|L\.?P\.?|Corp\.?|Co\.?|Ltd\.?)$/i;
  const fixed = String(raw || "").replace("FERCCOMMISSIONERS", "FERC, COMMISSIONERS");
  // Split only at a seam after a word that ends an organization's name, so camel-case names
  // (SunZia, DesertLink, FirstEnergy) survive. Commas inside parentheses are not separators.
  const END = "Change|Consumers|Services|Company|Commission|Counsel|Club|Council|Association|Agency|Authority|Office|Coalition|Board|Advocate|Corporation|Center|Committee|Group|Alliance|General|Cooperative|Project|States|Customers|Owners|Inc\\.|COUNSEL|ADVOCATE|AGENCY|COMMISSION|GENERAL";
  const seam = new RegExp(",(?![^()]*\\))|(?<=(?:" + END + "))(?=[A-Z])");
  const parts = fixed.replace(/\s+,/g, ",").split(seam).map((x) => prettyName(x.trim())).filter(Boolean);
  const out = [];
  for (const p of parts) { if (SUFFIX.test(p) && out.length) out[out.length - 1] += ", " + p; else out.push(p); }
  return out;
}
// eLibrary records some filers in capitals. Title-case those, keeping known acronyms; raw stays in the catalog.
const ACRONYMS = new Set(["FERC", "PJM", "MISO", "SPP", "NYISO", "CAISO", "ISO", "NE", "DC", "US", "U.S.", "LLC", "L.L.C.", "PTO", "AC", "OCA", "PSC", "CUB", "NRDC", "ACP", "SREA"]);
const SMALL = new Set(["of", "and", "the", "for", "on", "in"]);
export function prettyName(x) {
  if (!x || /[a-z]/.test(x)) return x;
  return x.split(/(\s+)/).map((w, i) => /^\s+$/.test(w) || ACRONYMS.has(w.replace(/[(),]/g, "")) ? w : (i && SMALL.has(w.toLowerCase())) ? w.toLowerCase() : w.charAt(0) + w.slice(1).toLowerCase().replace(/(['’-])(\w)/g, (m, a, b) => a + b)).join("");
}
export function filerLabel(list) {
  if (!list.length) return null;
  if (list.length <= 2) return list.join(" and ");
  return list[0] + " and " + (list.length - 1) + " others";
}

export function build() {
  const filings = readJSON("sources", "filings", "tenets.json");
  const proceedings = readJSON("sources", "filings", "proceedings.json").groups;
  const themes = readJSON("sources", "filings", "themes.json").themes;
  const anchorsFile = readJSON("sources", "filings", "order-anchors.json");
  const catalog = readJSON("docs", "reading", "catalog.json");
  const manifest = readJSON("sources", "videos", "manifest.json");
  const chapters = readJSON("sources", "videos", "chapters.json");
  const meta = new Map(manifest.map((v) => [v.id, v]));
  const docMeta = new Map(readJSON("sources", "abeyance-manifest.json").documents.map((d) => [d.slug, d]));
  const anchorIndex = new Map(anchorsFile.orders.flatMap((o) => o.anchors.map((a) => [a.id, { item: o.item, rto: o.rto, label: a.label, para: a.para, pg: a.pg, pdf: "orders/" + o.slug + ".pdf", quote: a.quote }])));
  const usedAnchors = new Set();
  const useAnchors = (ids) => { for (const id of ids || []) { if (!anchorIndex.has(id)) throw Error("unknown order anchor " + id); usedAnchors.add(id); } };

  // Earlier hand-curated document entries (filer names, sides, publisher PDF links) win over the catalog.
  const curated = new Map();
  for (const g of filings.groups) for (const d of g.docs) curated.set(d.slug, { ...d, group: g.id });
  const SC = { "EL26-67": "sc-pjm", "EL26-68": "sc-spp", "EL26-69": "sc-nyiso", "EL26-70": "sc-miso", "EL26-71": "sc-caiso", "EL26-72": "sc-isone" };
  const byId = new Map(proceedings.map((g) => [g.id, { ...g, docs: [] }]));
  const groupOf = (c) => {
    const cur = curated.get(c.slug);
    if (cur && cur.group !== "show-cause-since-june" && byId.has(cur.group)) return cur.group;
    if (/,/.test(c.group || "") && /^EL26-(6[7-9]|7[0-2])/.test(c.docket || "")) return "sc-multi";
    const sc = SC[(c.docket || "").slice(0, 7)];
    if (sc) return sc;
    const hit = proceedings.find((g) => (g.match || []).some((m) => String(c.docket || "").startsWith(m)));
    if (!hit) throw Error("no proceeding for " + c.slug + " (" + c.docket + ")");
    return hit.id;
  };
  let readings = 0, points = 0;
  const pointsBySlug = new Map();
  for (const c of catalog) {
    if (c.parent || /^e-\d+-/.test(c.slug)) continue;
    const cur = curated.get(c.slug) || {};
    const dm = docMeta.get(c.slug) || {};
    const list = filerList(c.filer);
    const file = join(ROOT, "sources", "filings", "documents", c.slug + ".json");
    const r = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
    if (r) { readings++; points += r.points.length; useAnchors(r.throughLine.anchors); }
    const doc = {
      slug: c.slug, accession: c.accession || cur.accession || null, date: cur.date || c.issued,
      filer: (r && r.filer) || cur.filer || filerLabel(list) || (c.slug.startsWith("pjm-") ? "PJM" : /^S\. Hrg/.test(c.docket) ? "Senate Energy and Natural Resources Committee" : c.docket),
      ...(list.length > 2 ? { filers: list } : {}),
      kind: (r && r.kind) || cur.kind || c.kind, title: c.title, docket: c.docket, pages: c.pages ?? cur.pages ?? null,
      ...(cur.side ? { side: cur.side } : {}),
      ...(cur.pdfUrl || dm.source_url ? { pdfUrl: cur.pdfUrl || dm.source_url } : {}),
      url: c.url || null,
      ...(r ? { summary: r.summary, ask: r.ask ?? null, npoints: r.points.length, link: r.throughLine, themes: r.themes, ...(r.figures?.length ? { figures: r.figures } : {}) } : {}),
    };
    byId.get(groupOf(c)).docs.push(doc);
    if (r) pointsBySlug.set(c.slug, r.points);
  }
  const order = proceedings.map((g) => g.id);
  const groups = [...byId.values()].filter((g) => g.docs.length).map((g) => {
    useAnchors(g.link && g.link.anchors);
    const docs = g.docs.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.filer.localeCompare(b.filer)));
    const themeCount = {};
    for (const d of docs) for (const t of d.themes || []) themeCount[t] = (themeCount[t] || 0) + 1;
    const { match, ...rest } = g;
    return { ...rest, docs, newest: docs[0].date, themes: Object.keys(themeCount).sort((a, b) => themeCount[b] - themeCount[a]) };
  }).sort((a, b) => (a.kind !== b.kind ? (a.kind === "show-cause" ? -1 : 1) : a.kind === "show-cause" ? order.indexOf(a.id) - order.indexOf(b.id) : a.newest < b.newest ? 1 : -1));
  const anchors = Object.fromEntries([...usedAnchors].sort().map((id) => [id, anchorIndex.get(id)]));
  const videos = chapters.videos.map((v) => {
    const m = meta.get(v.id) || {};
    return {
      id: v.id, title: m.title || v.title, channel: m.channel || v.channel, date: m.date || v.date,
      captionSource: m.captionSource || "auto", transcriptSlug: m.transcriptSlug || null,
      event: v.event || m.event, duration_s: m.duration_s ?? null,
      speakers: v.speakers || m.speakers || [], chapters: v.chapters || [], quotes: v.quotes || [],
    };
  }).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  // Each proceeding's quoted points ship in their own file, fetched when the reader opens it.
  const pointFiles = Object.fromEntries(groups.map((g) => [g.id, Object.fromEntries(g.docs.filter((d) => pointsBySlug.has(d.slug)).map((d) => [d.slug, pointsBySlug.get(d.slug)]))]));
  return { data: { asOf: filings.asOf, videosAsOf: chapters.asOf, themes, anchors, groups, videos }, pointFiles, stats: { readings, points } };
}

function render(data) {
  return "/* Generated by tools/build-record-data.mjs from sources/filings/ (proceedings, documents, tenets) and sources/videos/. Do not edit. */\n" +
    "window.FERC_RECORD = " + JSON.stringify(data) + ";\n";
}

function main() {
  for (const p of [["sources", "filings", "tenets.json"], ["sources", "videos", "chapters.json"], ["sources", "videos", "manifest.json"]]) {
    if (!existsSync(join(ROOT, ...p))) { console.error(`✗ missing ${p.join("/")}`); process.exit(1); }
  }
  const built = build(), data = built.data;
  if (!data.groups.length || !data.videos.length) { console.error("✗ nothing to bake: no groups or no videos"); process.exit(1); }
  const out = render(data);
  const pfDir = join(ROOT, "docs", "data", "filings");
  const pf = Object.entries(built.pointFiles).map(([id, v]) => [join(pfDir, id + ".json"), JSON.stringify(v) + "\n"]);
  if (process.argv.includes("--check")) {
    const same = existsSync(OUT) && readFileSync(OUT, "utf8") === out && pf.every(([f, t]) => existsSync(f) && readFileSync(f, "utf8") === t);
    console.log(same ? `✓ record-data.js is current (${data.groups.length} proceedings, ${data.videos.length} videos)` : "✗ record-data.js is stale: run node tools/build-record-data.mjs");
    process.exit(same ? 0 : 1);
  }
  writeFileSync(OUT, out);
  mkdirSync(pfDir, { recursive: true });
  for (const [f, t] of pf) writeFileSync(f, t);
  const q = built.stats.points, docs = data.groups.reduce((n, g) => n + g.docs.length, 0);
  const vq = data.videos.reduce((n, v) => n + v.quotes.length, 0);
  console.log(`✓ wrote docs/js/record-data.js: ${data.groups.length} proceedings, ${docs} documents, ${built.stats.readings} with readings, ${q} filing quotes, ${data.videos.length} videos, ${vq} spoken quotes, ${(out.length / 1024).toFixed(0)} KB`);
}

if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) main();
