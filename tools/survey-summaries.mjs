#!/usr/bin/env node
/* Survey the comment-summary corpus for defects nothing is checking yet.
 *
 * This is the DISCOVERY counterpart to validate-summaries.mjs, and the distinction matters:
 *   - validate-summaries.mjs enforces KNOWN failure modes. It is a gate; it fails the build.
 *   - this reports DISTRIBUTIONS and smells, so a defect nobody has thought to check for is visible.
 *     It never fails; it prints and exits 0.
 *
 * The reason it exists: on 2026-08-23 the corpus passed every check we had, and a throwaway version of
 * this script found three real defects in a few minutes — 99 quotes the page was silently dropping,
 * three bins rendering a stance with no supporting quote, and three org_type values written as human
 * labels. All three are now hard checks in the validator. The next three will not be, which is the
 * point of keeping this around instead of rewriting it from scratch each time.
 *
 *   node tools/survey-summaries.mjs            # full report
 *   node tools/survey-summaries.mjs --brief    # just the counts that should be zero
 *
 * When something here is a genuine defect rather than a smell, promote it to validate-summaries.mjs
 * with a negative control, and leave the survey line in place so the distribution stays visible.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "sources", "comments", "summaries-v2");
const MANIFEST = join(ROOT, "sources", "comments", "rm26-4-comments.json");
const BRIEF = process.argv.includes("--brief");

if (!existsSync(DIR)) { console.log("no summaries-v2/ yet"); process.exit(0); }

const files = readdirSync(DIR).filter((f) => f.endsWith(".json"));
const buckets = existsSync(MANIFEST)
  ? new Map(JSON.parse(readFileSync(MANIFEST, "utf8")).comments.map((c) => [c.acc, c.bucket]))
  : new Map();

const hard = {           // these should all be zero; a non-zero is a defect, not a smell
  asymmetricLinks: [], orphanQuotes: [], quotelessBins: [], duplicateQuotes: [],
  zeroQuoteFiles: [], orgTypeOffVocab: [], absolutePaths: [], unorderedQuoteIds: [],
};
const soft = {           // distributions worth a human read, not necessarily wrong
  stances: new Map(), orgTypes: new Map(), binNames: new Map(), topicBins: new Map(),
  allNeutralFiles: [], quoteCounts: [], binCounts: [],
};
const bump = (m, k) => m.set(k, (m.get(k) || 0) + 1);

for (const f of files) {
  const s = JSON.parse(readFileSync(join(DIR, f), "utf8"));
  const acc = s.accession, quotes = s.quotes || [], bins = s.bins || [];
  soft.quoteCounts.push(quotes.length);
  soft.binCounts.push(bins.length);
  bump(soft.orgTypes, s.org_type);

  if (!quotes.length) hard.zeroQuoteFiles.push(acc);
  if (typeof s.source_text === "string" && s.source_text.startsWith("/")) hard.absolutePaths.push(acc);
  const expected = buckets.get(acc);
  if (expected && s.org_type !== expected) hard.orgTypeOffVocab.push(`${acc}: "${s.org_type}" != "${expected}"`);

  // Both directions of quote-to-bin membership must agree; only bins[].quote_ids reaches the page.
  const binOf = new Map(bins.map((b) => [b.key, new Set(b.quote_ids || [])]));
  for (const q of quotes) {
    for (const bk of q.bins || []) {
      if (binOf.has(bk) && !binOf.get(bk).has(q.id)) hard.asymmetricLinks.push(`${acc} q${q.id} -> ${bk} (page drops it)`);
    }
  }
  for (const b of bins) {
    for (const id of b.quote_ids || []) {
      const q = quotes.find((x) => x.id === id);
      if (q && !(q.bins || []).includes(b.key)) hard.asymmetricLinks.push(`${acc} ${b.key} -> q${id} (quote disagrees)`);
    }
    if (!(b.quote_ids || []).length) hard.quotelessBins.push(`${acc} ${b.key} "${b.name}"`);
    const ids = b.quote_ids || [];
    if (ids.join() !== ids.slice().sort((x, y) => x - y).join()) hard.unorderedQuoteIds.push(`${acc} ${b.key} [${ids}]`);
    bump(soft.stances, b.stance);
    bump(soft.binNames, b.name);
    if (String(b.key).startsWith("topic:")) bump(soft.topicBins, b.key);
  }

  const used = new Set(bins.flatMap((b) => b.quote_ids || []));
  for (const q of quotes) if (!used.has(q.id)) hard.orphanQuotes.push(`${acc} q${q.id}`);

  const seen = new Map();
  for (const q of quotes) {
    const k = String(q.text || "").replace(/\s+/g, " ").trim().toLowerCase();
    if (seen.has(k)) hard.duplicateQuotes.push(`${acc} q${q.id} duplicates q${seen.get(k)}`);
    else seen.set(k, q.id);
  }
  if (bins.length && bins.every((b) => b.stance === "neutral")) soft.allNeutralFiles.push(acc);
}

const sum = (a) => a.reduce((x, y) => x + y, 0);
console.log(`survey-summaries — ${files.length} files, ${sum(soft.quoteCounts)} quotes, ${sum(soft.binCounts)} bins\n`);

console.log("SHOULD BE ZERO");
let defects = 0;
for (const [k, v] of Object.entries(hard)) {
  defects += v.length;
  console.log(`  ${v.length === 0 ? "ok  " : "  ->"} ${String(v.length).padStart(4)}  ${k}`);
  if (v.length && !BRIEF) for (const x of v.slice(0, 8)) console.log(`          ${x}`);
  if (v.length > 8 && !BRIEF) console.log(`          ... and ${v.length - 8} more`);
}

if (!BRIEF) {
  console.log("\nDISTRIBUTIONS (read, don't assert)");
  console.log(`  stances      ${JSON.stringify(Object.fromEntries(soft.stances))}`);
  console.log(`  org_types    ${soft.orgTypes.size} distinct`);
  console.log(`  all-neutral  ${soft.allNeutralFiles.length} file(s)${soft.allNeutralFiles.length ? ": " + soft.allNeutralFiles.join(", ") : ""}`);
  console.log(`               (a status report with no positions is legitimately neutral — check, don't assume)`);
  const reused = [...soft.binNames].filter(([, c]) => c > 2).sort((a, b) => b[1] - a[1]);
  console.log(`\n  bin names reused >2x (casing drift / generic-name smell): ${reused.length}`);
  for (const [n, c] of reused.slice(0, 12)) console.log(`     ${String(c).padStart(3)}x  ${n}`);
  console.log(`\n  emergent topic: bins: ${soft.topicBins.size} distinct across ${files.length} files`);
  const topics = [...soft.topicBins].sort((a, b) => b[1] - a[1]);
  for (const [n, c] of topics.slice(0, 10)) console.log(`     ${String(c).padStart(3)}x  ${n}`);
  console.log(`     (near-synonyms here are the sprawl signal: state-authority vs state-jurisdiction,`);
  console.log(`      tariff-transparency vs transparency vs queue-transparency)`);
}

console.log(`\n${defects} item(s) in the should-be-zero set.` +
  (defects ? " Each is a defect: fix it, then add the check to validate-summaries.mjs." : ""));
