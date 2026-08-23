/* Reconcile the two directions of quote-to-bin membership in summaries-v2.
 *
 * The spec (sources/comments/summarization-spec.md) builds a summary bottom-up: extract quotes,
 * BIN each quote (`quotes[].bins`), then name/describe each bin "synthesized from that bin's quotes,
 * with a stance and the `quote_ids` it rests on". So `bins[].quote_ids` is DERIVED from `quotes[].bins`
 * and the two must agree exactly.
 *
 * They didn't. Across the corpus 99 quotes named a bin whose `quote_ids` omitted them, and 54 bins
 * claimed a quote that didn't name them back. Only `bins[].quote_ids` reaches the built site
 * (build-comments-page-data.mjs), so each of those 99 was a quote the extractor had assigned to a bin
 * and the page silently dropped from that bin's evidence.
 *
 * Reconciliation is a UNION, and it is one-directional in principle: a membership asserted on either
 * side is a membership. That only ever adds evidence the extractor itself asserted; it never invents
 * one. Idempotent: re-running on reconciled files is a no-op.
 *
 * Run:  node tools/reconcile-summary-bins.mjs [--dry-run]
 * Guard: validate-summaries.mjs now fails on any asymmetry, so this cannot silently regress.
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const DIR = join(here, "..", "sources", "comments", "summaries-v2");
const dry = process.argv.includes("--dry-run");

let changedFiles = 0, addedToBins = 0, addedToQuotes = 0, reordered = 0;

for (const f of readdirSync(DIR).filter((x) => x.endsWith(".json"))) {
  const path = join(DIR, f);
  const raw = readFileSync(path, "utf8");
  const s = JSON.parse(raw);
  const quotes = s.quotes || [];
  const bins = s.bins || [];
  const binByKey = new Map(bins.map((b) => [b.key, b]));
  const qById = new Map(quotes.map((q) => [q.id, q]));
  let touched = false;

  // quote names a bin -> that bin must list the quote
  for (const q of quotes) {
    for (const key of q.bins || []) {
      const b = binByKey.get(key);
      if (!b) continue; // dangling key is a separate error the validator reports
      b.quote_ids = b.quote_ids || [];
      if (!b.quote_ids.includes(q.id)) { b.quote_ids.push(q.id); addedToBins++; touched = true; }
    }
  }
  // bin lists a quote -> that quote must name the bin
  for (const b of bins) {
    for (const id of b.quote_ids || []) {
      const q = qById.get(id);
      if (!q) continue;
      q.bins = q.bins || [];
      if (!q.bins.includes(b.key)) { q.bins.push(b.key); addedToQuotes++; touched = true; }
    }
  }
  // Sort BEFORE the early exit: an already-symmetric file can still hold its quote_ids out of order
  // (20251121-5493 held [8,9,7]), and skipping the sort left the rendered evidence out of document
  // order in exactly the files that needed no other repair. Numeric ids, so `a - c` is the right
  // comparator; sorting is idempotent, so a second run is still a no-op.
  for (const b of bins) {
    const before = (b.quote_ids || []).join(",");
    b.quote_ids = (b.quote_ids || []).slice().sort((a, c) => a - c);
    if (b.quote_ids.join(",") !== before) { reordered++; touched = true; }
  }
  if (!touched) continue;
  changedFiles++;
  if (!dry) writeFileSync(path, JSON.stringify(s, null, 2) + (raw.endsWith("\n") ? "\n" : ""));
}

console.log(
  `${dry ? "[dry-run] " : ""}reconciled ${changedFiles} file(s): ` +
  `+${addedToBins} quote_ids on bins (evidence the page was dropping), ` +
  `+${addedToQuotes} bin keys on quotes, ${reordered} bin(s) reordered into document order.`
);
