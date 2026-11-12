#!/usr/bin/env node
// Validate the per-document readings in sources/filings/documents/<slug>.json.
//
// One reading describes one document and quotes only that document. Every quote must appear
// verbatim (after the loose fold verify-quotes.mjs uses) on the page it cites in the committed page
// text, docs/reading/<slug>/source.json. The connection to the June 18 orders names anchor ids from
// sources/filings/order-anchors.json, whose own quotes are checked against the order pages.
//
//   node tools/validate-documents.mjs                 # every reading; exit 1 on any error
//   node tools/validate-documents.mjs a.json b.json   # just these files (an extraction agent checks its draft)
//   node tools/validate-documents.mjs --coverage      # also list catalog documents with no reading
//   node tools/validate-documents.mjs --strict        # coverage gaps fail the run too
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, basename, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loose } from "./verify-quotes.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "sources", "filings", "documents");
const read = (p) => JSON.parse(readFileSync(p, "utf8"));

export const RELATIONS = {
  responds: "Filed in one of the six show cause proceedings, answering what an order directed",
  implements: "Carries out, or is the order that sets, a directive the June orders rely on",
  parallel: "A separate proceeding on the same issue the orders address",
  precursor: "Came before the June orders and shaped them",
  procedural: "Changes the schedule or posture of a show cause proceeding",
  context: "Background with no direct tie to a directive",
};
const KEYS = new Set(["slug", "kind", "filer", "summary", "ask", "points", "throughLine", "themes", "figures", "reviewed"]);
// Prose rules for our own words (quotes are exempt): house style and the WRITING.md tells.
const PROSE = [
  [/—/, "em dash"],
  [/\b(delve|leverage|robust|seamless|pivotal|crucial|comprehensive|underscores?|highlights the importance|landscape|navigat(e|ing) the)\b/i, "model register word"],
  [/\bnot only\b|\bnot [^.,;]{1,40}, but\b/i, "contrast construction"],
  [/\b(it is worth noting|importantly|notably|in conclusion|overall,)\b/i, "filler"],
  [/\bthis (filing|document|report|letter) (is|was)\b/i, "self-narration"],
];

export function proseErrors(text, where) {
  const out = [];
  for (const [re, why] of PROSE) if (re.test(text)) out.push(`${where}: ${why} in "${text.slice(0, 80)}"`);
  return out;
}

const words = (s) => String(s || "").trim().split(/\s+/).filter(Boolean).length;
const digits = (v) => String(v).replace(/[^0-9.]/g, "").replace(/\.0+$/, "");

export function loadContext() {
  const catalog = read(join(ROOT, "docs", "reading", "catalog.json"));
  const themes = new Set(read(join(ROOT, "sources", "filings", "themes.json")).themes.map((t) => t.key));
  const anchorsFile = read(join(ROOT, "sources", "filings", "order-anchors.json"));
  const anchors = new Map(anchorsFile.orders.flatMap((o) => o.anchors.map((a) => [a.id, { ...a, slug: o.slug }])));
  return { catalog, bySlug: new Map(catalog.map((c) => [c.slug, c])), themes, anchors };
}

const pageCache = new Map();
export function pagesFor(slug) {
  if (!pageCache.has(slug)) {
    const f = join(ROOT, "docs", "reading", slug, "source.json");
    pageCache.set(slug, existsSync(f) ? read(f).pages.map((p) => ({ page: p.page, text: loose(p.text) })) : null);
  }
  return pageCache.get(slug);
}

// A quote may cite one page (pg) or a run that crosses a page break (pg..pgEnd).
export function quoteOnPage(slug, quote, pg, pgEnd) {
  const pages = pagesFor(slug);
  if (!pages) return `no page text for ${slug}`;
  const q = loose(quote);
  if (!q) return "empty quote";
  const first = pg == null ? 1 : pg, last = pgEnd == null ? first : pgEnd;
  if (pages.length === 1 && pg != null && pg !== 1) return `unpaginated document cited at p. ${pg}`;
  if (first < 1 || last > pages.length || last < first) return `page ${first}${last !== first ? "-" + last : ""} out of range (1-${pages.length})`;
  const span = pages.slice(first - 1, last).map((p) => p.text).join(" ");
  if (span.includes(q)) return null;
  const elsewhere = pages.find((p) => p.text.includes(q));
  return elsewhere ? `quote is on p. ${elsewhere.page}, cited p. ${first}` : `quote not found on p. ${first}: "${quote.slice(0, 70)}"`;
}

export function validateReading(doc, ctx, file = doc.slug + ".json") {
  const errs = [];
  const at = basename(file);
  for (const k of Object.keys(doc)) if (!KEYS.has(k)) errs.push(`${at}: unknown key ${k}`);
  if (!doc.slug || basename(file, ".json") !== doc.slug) errs.push(`${at}: slug must match the file name`);
  const entry = ctx.bySlug.get(doc.slug);
  if (!entry) { errs.push(`${at}: ${doc.slug} is not in docs/reading/catalog.json`); return errs; }
  if (/\border\b/.test(entry.kind) && /^e-\d+-/.test(doc.slug)) errs.push(`${at}: the June orders are summarized from data.js, not here`);

  if (doc.kind != null && (typeof doc.kind !== "string" || words(doc.kind) > 6)) errs.push(`${at}: kind corrects the catalog's document type in 6 words or fewer`);
  const n = words(doc.summary);
  if (n < 8 || n > 70) errs.push(`${at}: summary should run 8-70 words (has ${n})`);
  errs.push(...proseErrors(doc.summary || "", `${at} summary`));
  if (doc.ask != null) {
    if (typeof doc.ask !== "string" || words(doc.ask) > 40) errs.push(`${at}: ask must be one line of 40 words or fewer`);
    errs.push(...proseErrors(doc.ask, `${at} ask`));
  }

  const pts = Array.isArray(doc.points) ? doc.points : [];
  const minPts = entry.tokens < 600 ? 1 : 2;
  if (pts.length < minPts || pts.length > 10) errs.push(`${at}: ${pts.length} points (want ${minPts}-10)`);
  const seen = new Set();
  pts.forEach((p, i) => {
    const w = `${at} point ${i + 1}`;
    if (!p || typeof p.point !== "string" || typeof p.quote !== "string") { errs.push(`${w}: needs point and quote`); return; }
    for (const k of Object.keys(p)) if (!["point", "quote", "pg", "pgEnd"].includes(k)) errs.push(`${w}: unknown key ${k}`);
    if (words(p.point) > 28) errs.push(`${w}: point runs ${words(p.point)} words (max 28)`);
    if (words(p.quote) < 5 || words(p.quote) > 70) errs.push(`${w}: quote should be 5-70 words`);
    errs.push(...proseErrors(p.point, w));
    const key = loose(p.quote);
    if (seen.has(key)) errs.push(`${w}: duplicate quote`);
    seen.add(key);
    const miss = quoteOnPage(doc.slug, p.quote, p.pg ?? null, p.pgEnd ?? null);
    if (miss) errs.push(`${w}: ${miss}`);
  });

  const tl = doc.throughLine;
  if (!tl || typeof tl !== "object") errs.push(`${at}: throughLine is required`);
  else {
    if (!RELATIONS[tl.relation]) errs.push(`${at}: throughLine.relation must be one of ${Object.keys(RELATIONS).join(", ")}`);
    if (!Array.isArray(tl.anchors)) errs.push(`${at}: throughLine.anchors must be an array`);
    else {
      if (tl.relation !== "context" && !tl.anchors.length) errs.push(`${at}: throughLine needs at least one order anchor unless relation is context`);
      for (const a of tl.anchors) if (!ctx.anchors.has(a)) errs.push(`${at}: unknown order anchor ${a}`);
    }
    if (words(tl.text) < 6 || words(tl.text) > 60) errs.push(`${at}: throughLine.text should run 6-60 words`);
    errs.push(...proseErrors(tl.text || "", `${at} throughLine`));
  }

  const th = Array.isArray(doc.themes) ? doc.themes : [];
  if (th.length < 1 || th.length > 4) errs.push(`${at}: 1-4 themes required`);
  for (const t of th) if (!ctx.themes.has(t)) errs.push(`${at}: unknown theme ${t}`);

  (doc.figures || []).forEach((f, i) => {
    const w = `${at} figure ${i + 1}`;
    if (!f || typeof f.label !== "string" || typeof f.value !== "number" || typeof f.unit !== "string" || typeof f.quote !== "string") { errs.push(`${w}: needs label, numeric value, unit and quote`); return; }
    if (!loose(f.quote).replace(/ /g, "").includes(digits(f.value).replace(/\./g, "")) && !f.quote.replace(/[,\s]/g, "").includes(digits(f.value))) errs.push(`${w}: quote does not show the value ${f.value}`);
    const miss = quoteOnPage(doc.slug, f.quote, f.pg ?? null, f.pgEnd ?? null);
    if (miss) errs.push(`${w}: ${miss}`);
  });
  return errs;
}

export function validateAnchors(ctx) {
  const errs = [];
  for (const a of ctx.anchors.values()) {
    const last = Math.min(a.pg + 1, (pagesFor(a.slug) || []).length || a.pg);
    const miss = quoteOnPage(a.slug, a.quote.replace(/\s*…\s*/g, " "), a.pg, last);
    // Directive quotes in data.js may elide with an ellipsis; check each fragment on the page.
    if (miss && a.quote.includes("…")) {
      // An elision can join a fragment mid-clause; a leading conjunction belongs to our splice, not the source.
      const parts = a.quote.split("…").map((s) => s.trim().replace(/^(and|or|but) /i, "")).filter((s) => words(s) >= 3);
      if (!parts.length) errs.push(`anchor ${a.id}: no fragment long enough to check`);
      const bad = parts.filter((s) => quoteOnPage(a.slug, s, a.pg, Math.min(a.pg + 1, pagesFor(a.slug).length)));
      if (bad.length) errs.push(`anchor ${a.id}: fragment not on p. ${a.pg}: "${bad[0].slice(0, 60)}"`);
    } else if (miss) errs.push(`anchor ${a.id}: ${miss}`);
  }
  return errs;
}

export function loadReadings(files) {
  const list = files.length ? files.map((f) => resolve(f)) : existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith(".json")).sort().map((f) => join(DIR, f)) : [];
  return list.map((f) => ({ file: f, doc: read(f) }));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const files = args.filter((a) => !a.startsWith("--"));
  const ctx = loadContext();
  const readings = loadReadings(files);
  if (!readings.length) { console.error("validate-documents: no readings found; nothing was checked"); process.exit(2); }
  const errs = files.length ? [] : validateAnchors(ctx);
  let quotes = 0;
  for (const { file, doc } of readings) { errs.push(...validateReading(doc, ctx, file)); quotes += (doc.points || []).length + (doc.figures || []).length; }
  const covered = new Set(readings.map((r) => r.doc.slug));
  const gaps = ctx.catalog.filter((c) => !c.parent && !/^e-\d+-/.test(c.slug) && !covered.has(c.slug)).map((c) => c.slug);
  for (const e of errs) console.error("✗ " + e);
  if (args.includes("--coverage") || args.includes("--strict")) for (const g of gaps) console.log("· no reading: " + g);
  console.log(`validate-documents: ${readings.length} readings, ${quotes} quotes checked on their pages, ${ctx.anchors.size} order anchors; ${errs.length} errors; ${gaps.length} catalog documents without a reading`);
  process.exit(errs.length || (args.includes("--strict") && gaps.length) ? 1 : 0);
}
