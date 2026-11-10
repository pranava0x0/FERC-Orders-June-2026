#!/usr/bin/env node
// tools/verify-record.mjs — prove every quote on the Filings and Commissioners tabs against the committed
// corpus, by page or by timestamp. Strict on purpose: a quote must appear verbatim (after the same loose
// fold verify-quotes.mjs uses) on the page it cites, or within the caption block at the second it cites.
// verify-quotes.mjs tolerates footnote splices with a longest-common-substring test; this one does not,
// so pick quotes that sit inside one sentence and do not cross a footnote.
//
//   node tools/verify-record.mjs                    # both files; exit 1 on any miss
//   node tools/verify-record.mjs <file.json> ...    # just these (an extraction agent checks its own draft)
//
// Inputs:
//   sources/filings/tenets.json     groups → docs (slug → sources/text/abeyance/<slug>.txt) → tenets → quotes {d, q, pg}
//   sources/videos/chapters.json    videos (id → sources/videos/text/<id>.txt) → chapters + quotes {who, at, q}

import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loose } from "./verify-quotes.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULTS = [join(ROOT, "sources", "filings", "tenets.json"), join(ROOT, "sources", "videos", "chapters.json")];
const COMMISSIONERS = new Set(["swett", "rosner", "see", "chang", "lacerte"]);
const SIDES = new Set(["for", "against", "mixed", "neutral"]);

// "--- PAGE N ---" markers split the extracted text; page N is the PDF page, which is what #page=N opens.
export function pagesOf(text) {
  const pages = new Map();
  const parts = text.split(/^--- PAGE (\d+) ---$/m);
  for (let i = 1; i < parts.length; i += 2) pages.set(Number(parts[i]), parts[i + 1]);
  return pages;
}

export function secondsOf(at) {
  const m = /^(?:(\d+):)?(\d{1,2}):(\d{2})$/.exec(String(at || ""));
  return m ? (Number(m[1] || 0) * 3600 + Number(m[2]) * 60 + Number(m[3])) : null;
}

// Caption blocks are "[hh:mm:ss] text" lines of ~30 s.
export function blocksOf(text) {
  const out = [];
  for (const line of text.split("\n")) {
    const m = /^\[(\d{2}):(\d{2}):(\d{2})\] (.*)$/.exec(line);
    if (m) out.push({ s: +m[1] * 3600 + +m[2] * 60 + +m[3], t: m[4] });
  }
  return out;
}

const WORDS = (s) => loose(s).split(" ").filter(Boolean).length;

function checkFilings(json, errs, counts) {
  const groups = json.groups || [];
  if (!groups.length) errs.push("tenets.json: no groups");
  const slugs = new Set();
  for (const g of groups) {
    const at = `group ${g.id}`;
    if (!g.id || !g.title || !g.docket) errs.push(`${at}: needs id, title, docket`);
    const docs = new Map();
    for (const d of g.docs || []) {
      if (slugs.has(d.slug)) errs.push(`${at}: doc ${d.slug} listed twice`);
      slugs.add(d.slug);
      const p = join(ROOT, "sources", "text", "abeyance", `${d.slug}.txt`);
      if (!existsSync(p)) { errs.push(`${at}: no committed text for ${d.slug}`); continue; }
      for (const k of ["accession", "date", "filer", "kind"]) if (!d[k]) errs.push(`${at}/${d.slug}: needs ${k}`);
      // A DOCX notational order has no pages: its whole body is "page 0" and its quotes carry no pg.
      const raw = readFileSync(p, "utf8");
      const pages = pagesOf(raw);
      docs.set(d.slug, pages.size ? pages : new Map([[0, raw]]));
      counts.docs++;
    }
    if (!docs.size) errs.push(`${at}: no docs`);
    const cited = new Set();
    for (const t of g.tenets || []) {
      const tat = `${at} tenet "${String(t.tenet).slice(0, 50)}"`;
      if (!t.tenet) errs.push(`${tat}: empty tenet`);
      else if (WORDS(t.tenet) > 16) errs.push(`${tat}: tenet is ${WORDS(t.tenet)} words; keep it to 16`);
      if (t.side && !SIDES.has(t.side)) errs.push(`${tat}: side must be one of ${[...SIDES]}`);
      if (!(t.quotes || []).length) errs.push(`${tat}: no quotes`);
      for (let q of t.quotes || []) {
        counts.quotes++;
        const pages = docs.get(q.d);
        if (!pages) { errs.push(`${tat}: quote cites ${q.d}, not a doc in this group`); continue; }
        cited.add(q.d);
        if (pages.has(0) && pages.size === 1) {
          if (q.pg != null) errs.push(`${tat}: ${q.d} has no pages; drop pg`);
          q = { ...q, pg: 0 };
        } else if (!Number.isInteger(q.pg)) errs.push(`${tat}: ${q.d} quote needs an integer pg`);
        const lq = loose(q.q);
        if (WORDS(q.q) < 6) errs.push(`${tat}: quote under 6 words: "${q.q}"`);
        const page = loose(pages.get(q.pg) || "");
        const span = loose((pages.get(q.pg) || "") + " " + (pages.get(q.pg + 1) || ""));
        if (!page) errs.push(`${tat}: ${q.d} has no page ${q.pg}`);
        else if (!span.includes(lq)) {
          let found = null;
          for (const [n, txt] of pages) if (loose(txt).includes(lq)) { found = n; break; }
          errs.push(`${tat}: not on ${q.d} p.${q.pg}${found ? ` (found on p.${found})` : " (not found anywhere)"}: "${q.q.slice(0, 80)}"`);
        } else counts.ok++;
      }
    }
    for (const s of docs.keys()) if (!cited.has(s)) errs.push(`${at}: doc ${s} is listed but no tenet quotes it`);
  }
}

function checkVideos(json, errs, counts) {
  const videos = json.videos || [];
  if (!videos.length) errs.push("chapters.json: no videos");
  for (const v of videos) {
    const at = `video ${v.id}`;
    const p = join(ROOT, "sources", "videos", "text", `${v.id}.txt`);
    if (!existsSync(p)) { errs.push(`${at}: no transcript`); continue; }
    counts.docs++;
    const blocks = blocksOf(readFileSync(p, "utf8"));
    const last = blocks.length ? blocks[blocks.length - 1].s : 0;
    let prev = -1;
    for (const c of v.chapters || []) {
      const s = secondsOf(c.at);
      if (s === null) errs.push(`${at}: chapter "${c.title}" has a bad timestamp ${c.at}`);
      else {
        if (s < prev) errs.push(`${at}: chapters out of order at ${c.at}`);
        if (s > last + 60) errs.push(`${at}: chapter ${c.at} is past the end of the transcript`);
        prev = s;
      }
      if (!c.title) errs.push(`${at}: chapter at ${c.at} has no title`);
    }
    for (const q of v.quotes || []) {
      counts.quotes++;
      const qat = `${at} @${q.at}`;
      if (!COMMISSIONERS.has(q.who) && !q.whoName) errs.push(`${qat}: who must be a commissioner key or carry whoName`);
      const s = secondsOf(q.at);
      if (s === null) { errs.push(`${qat}: bad timestamp`); continue; }
      // The block that starts at or before the cited second, plus the next one, so a quote that runs
      // across a 30 s boundary still verifies; nothing further away counts.
      const i = blocks.findIndex((b, k) => b.s <= s && (k === blocks.length - 1 || blocks[k + 1].s > s));
      const win = i < 0 ? "" : loose(blocks.slice(i, i + 2).map((b) => b.t).join(" "));
      const lq = loose(q.q);
      if (WORDS(q.q) < 6) errs.push(`${qat}: quote under 6 words`);
      if (!win.includes(lq)) {
        const hit = blocks.find((b, k) => loose(b.t + " " + (blocks[k + 1]?.t || "")).includes(lq));
        errs.push(`${qat}: not in the caption block at that time${hit ? ` (found at ${hit.s}s)` : " (not found)"}: "${q.q.slice(0, 80)}"`);
      } else counts.ok++;
    }
  }
}

function main() {
  const files = process.argv.slice(2).length ? process.argv.slice(2).map((f) => resolve(f)) : DEFAULTS;
  const errs = [];
  const counts = { docs: 0, quotes: 0, ok: 0 };
  for (const f of files) {
    if (!existsSync(f)) { errs.push(`${f}: missing`); continue; }
    const json = JSON.parse(readFileSync(f, "utf8"));
    if (json.groups) checkFilings(json, errs, counts);
    else if (json.videos) checkVideos(json, errs, counts);
    else errs.push(`${f}: neither {groups} nor {videos}`);
  }
  for (const e of errs) console.error("✗ " + e);
  if (!counts.quotes) errs.push("no quotes checked");
  console.log(`${errs.length ? "✗" : "✓"} ${counts.ok}/${counts.quotes} quotes verified across ${counts.docs} source(s)` +
    (errs.length ? ` · ${errs.length} problem(s)` : ""));
  process.exit(errs.length ? 1 : 0);
}

if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) main();
