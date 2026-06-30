#!/usr/bin/env node
// tools/verify-quotes.mjs — sweep EVERY quoted string in docs/js/data.js and verify it against the
// committed source corpus (order texts, FERC/DOE texts, the discourse evidence file). One command that
// audits the whole site, beyond the per-feature unit tests — including the prose quotes (in `unique`,
// the Overview summary, toplines) that no test covers yet.
//
//   node tools/verify-quotes.mjs            # report + exit non-zero if a REQUIRED quote is unverified
//   node tools/verify-quotes.mjs --list     # also print every checked quote, not just the misses
//
// Two tiers:
//   REQUIRED — structured quote fields (order directives & findings, commissioner statements, discourse
//              voice/theme quotes, the Section IV briefing quotes). These MUST appear verbatim in their
//              designated source or the run fails.
//   PROSE    — embedded “…”/‘…’ spans of ≥16 chars in free copy (unique, summary, toplines, jurisdiction,
//              regional). Also required: if you put a span that long in quotes, it must resolve somewhere
//              in the corpus — otherwise tighten it or drop the quote marks. (The ≥16-char floor skips
//              short curator term-labels like ‘large load’.) Both tiers fail the run on a miss.
//   SPOKEN   — auto-caption quotes (YouTube), reported separately: not in committed text, so unverifiable.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LIST = process.argv.includes("--list");

function read(...p) {
  return readFileSync(join(ROOT, ...p), "utf8");
}

function loadData() {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(read("docs", "js", "data.js"), ctx, { filename: "docs/js/data.js" });
  return ctx.window.FERC_DATA;
}

// Same normalization the accuracy tests use: fold smart punctuation, expand §, strip inline OCR
// footnote markers ("technologies154"), drop non-alphanumerics, lowercase.
function loose(value) {
  return String(value)
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/ /g, " ")
    .replace(/§/g, " section ")
    .replace(/[–—]/g, "-")
    .replace(/([A-Za-z])\d{1,3}\b/g, "$1")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Longest common substring length — tolerates footnote splices / OCR breaks inside a long quote.
// Two row buffers are reused across iterations (the source `b` can be ~2.3M chars, so a fresh
// Int32Array per row of `a` was ~9MB/row of short-lived garbage; hoisting kills that latency cliff).
function lcsLength(a, b) {
  if (!a || !b) return 0;
  let prev = new Int32Array(b.length + 1);
  let cur = new Int32Array(b.length + 1);
  let best = 0;
  for (let i = 1; i <= a.length; i++) {
    cur.fill(0); // cells with no match this row must read 0, not the previous row's value
    const ai = a.charCodeAt(i - 1);
    for (let j = 1; j <= b.length; j++) {
      if (ai === b.charCodeAt(j - 1)) {
        const v = prev[j - 1] + 1;
        cur[j] = v;
        if (v > best) best = v;
      }
    }
    const tmp = prev;
    prev = cur;
    cur = tmp;
  }
  return best;
}

// A source "carries" a contiguous run when it appears verbatim, or shares a long common substring
// (cap the bar at 60 chars: 60 chars of specific legal text already prove it).
function carriesRun(run, normalizedSource) {
  const q = loose(run);
  if (!q) return false;
  if (normalizedSource.includes(q)) return true;
  const threshold = Math.min(q.length, 60, Math.max(24, Math.floor(q.length * 0.6)));
  return lcsLength(q, normalizedSource) >= threshold;
}

// A quote may splice non-contiguous passages with an ellipsis ("post … data … and cost estimates").
// Require EVERY substantial segment to appear in the source — stricter than checking the longest run.
function carries(quote, normalizedSource) {
  const segments = String(quote)
    .split(/…|\.\.\./)
    .map((s) => s.trim())
    .filter((s) => loose(s).length >= 12);
  if (!segments.length) return carriesRun(quote, normalizedSource);
  return segments.every((seg) => carriesRun(seg, normalizedSource));
}

// --- corpus ---------------------------------------------------------------
const orderText = {}; // "E-7" -> normalized full text
for (const file of readdirSync(join(ROOT, "sources", "text", "orders"))) {
  const m = file.match(/^e-(\d+)-/);
  if (m) orderText[`E-${m[1]}`] = loose(read("sources", "text", "orders", file));
}
const fercDoe = ["press-release", "fact-sheet", "summaries", "rm26-4", "doe-403-full"]
  .map((n) => loose(read("sources", "text", `${n}.txt`)))
  .join(" ¶ ");
const allOrders = Object.values(orderText).join(" ¶ ");
const wholeCorpus = `${allOrders} ¶ ${fercDoe}`;

const evidence = JSON.parse(read("sources", "voices-evidence.json"));
const evidenceText = loose(Object.values(evidence.voices).map((v) => v.evidence).join(" ¶ "));

// Sweep every quote in FERC_DATA and classify it. Exported so a test can assert zero required misses;
// the CLI block below prints a human report.
export function verifyAllQuotes(D = loadData()) {
const required = []; // { label, quote, ok }
const prose = []; // { label, quote, ok } — embedded prose quotes; also required to resolve in the corpus
const spoken = []; // { label, quote } — cannot be verified against committed text

const req = (label, quote, source) => required.push({ label, quote, ok: carries(quote, source) });
const adv = (label, quote, source = wholeCorpus) => prose.push({ label, quote, ok: carries(quote, source) });

// Pull free-prose quoted spans: “double” quotes and ‘single’ quotes whose close isn't an inner
// apostrophe (’ not followed by a letter). Skip very short spans (term-labels like ‘large load’).
function proseQuotes(text) {
  const out = [];
  for (const m of String(text).matchAll(/[“]([^”]+)[”]/g)) out.push(m[1]);
  for (const m of String(text).matchAll(/"([^"]+)"/g)) out.push(m[1]); // straight double-quotes, if any
  for (const m of String(text).matchAll(/[‘](.+?)[’](?![A-Za-z])/g)) out.push(m[1]);
  return out.filter((q) => loose(q).length >= 16);
}

// 1) Order directives + distinct findings (REQUIRED) — every order, incl. the E-2 co-location order.
for (const d of [...D.dockets, D.colocation].filter(Boolean)) {
  const t = orderText[d.item] || "";
  for (const x of d.dir || []) req(`${d.item} directive "${x.p}"`, x.q, t);
  for (const r of d.reg || []) if (r.a) req(`${d.item} finding`, r.a, t);
}

// 2) Commissioner statements (REQUIRED). The headline quote is templated across all six §206 orders;
//    written theme quotes live in the PJM (E-7) text. Spoken quotes are auto-captions (YouTube) — report
//    them, don't fail on them. The E-2 Chang override is checked against the E-2 text on its own page.
for (const c of D.commissioners || []) {
  for (const item of ["E-7", "E-8", "E-9", "E-10", "E-11", "E-12"]) {
    req(`commissioner ${c.key} headline in ${item}`, c.quote, orderText[item] || "");
  }
  for (const th of c.themes || []) {
    for (const q of th.quotes || []) {
      if (q.src === "written") req(`commissioner ${c.key} theme`, q.t, orderText["E-7"] || "");
      else spoken.push({ label: `commissioner ${c.key} spoken`, quote: q.t });
    }
  }
}
if (D.colocation?.commish) {
  for (const [k, v] of Object.entries(D.colocation.commish)) {
    req(`E-2 commissioner ${k}`, v.quote, orderText["E-2"] || "");
  }
}

// 3) Discourse voices + themes (REQUIRED) — quoted phrases must appear in the captured evidence file.
for (const v of D.voices || []) {
  for (const m of v.take.matchAll(/[‘](.+?)[’](?![A-Za-z])/g)) {
    if (loose(m[1]).length >= 6) req(`voice "${v.name}"`, m[1], evidenceText);
  }
}
for (const th of D.voiceThemes || []) {
  for (const q of th.quotes || []) req(`voice theme "${th.title}"`, q.q, evidenceText);
}

// Section IV briefing quotes (REQUIRED) — templated across the six §206 orders, so check each against the
// union of order texts. (These render on every §206 card; they must NOT silently attach to a card whose
// order doesn't contain them, e.g. the E-2 final order.)
for (const q of D.briefing?.questions || []) req(`briefing "${q.id}"`, q.v, allOrders);

// 4) Free prose (ADVISORY) — the orienting copy with embedded quotes but no unit test.
for (const d of [...D.dockets, D.colocation].filter(Boolean)) {
  for (const q of proseQuotes(d.unique || "")) adv(`${d.item} unique`, q, orderText[d.item] || wholeCorpus);
}
for (const p of D.meta?.summary || []) for (const q of proseQuotes(p)) adv("Overview summary", q);
for (const t of D.toplines || []) for (const p of t.body || []) for (const q of proseQuotes(p)) adv(`topline "${t.h}"`, q);
for (const b of D.jurisdiction || []) for (const q of proseQuotes(b.body)) adv(`jurisdiction "${b.h}"`, q, fercDoe);
for (const b of D.regional || []) for (const q of proseQuotes(b.body)) adv(`regional "${b.h}"`, q);

  return { required, prose, spoken };
}

// --- CLI report (only when run directly, not when imported by a test) ------
if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  const { required, prose, spoken } = verifyAllQuotes();
  const reqMiss = required.filter((r) => !r.ok);
  const proseMiss = prose.filter((r) => !r.ok);

  const section = (title, rows) => {
    if (!rows.length) return;
    console.log(`\n${title}`);
    for (const r of rows) console.log(`  ✗ ${r.label}: “${r.quote.slice(0, 96)}${r.quote.length > 96 ? "…" : ""}”`);
  };

  console.log("Quote verification — docs/js/data.js against the committed source corpus");
  console.log("=".repeat(74));
  console.log(`REQUIRED quotes : ${required.length - reqMiss.length}/${required.length} verified`);
  console.log(`PROSE quotes    : ${prose.length - proseMiss.length}/${prose.length} resolved in corpus`);
  console.log(`SPOKEN (caption): ${spoken.length} not verifiable here (auto-caption, off the committed text)`);

  if (LIST) for (const r of [...required, ...prose]) console.log(`  ${r.ok ? "✓" : "✗"} ${r.label}: “${r.quote.slice(0, 80)}…”`);

  section("REQUIRED quotes NOT found in their source (fix):", reqMiss);
  section("PROSE quotes NOT found in corpus (tighten the quote or drop the quote marks):", proseMiss);

  console.log("");
  if (reqMiss.length || proseMiss.length) {
    console.log(`FAIL — ${reqMiss.length} required + ${proseMiss.length} prose quote(s) unverified.`);
    process.exit(1);
  }
  console.log(`OK — all ${required.length} required and ${prose.length} prose quotes verified.`);
}
