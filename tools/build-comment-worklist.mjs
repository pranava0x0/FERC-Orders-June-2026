/* Build sources/comments/.worklist.json — the per-comment task list the summarization workflow reads.
 * One row per RM26-4 comment that has a real extracted body but no summaries-v2/<acc>.json yet, with
 * the routing a subagent needs (body dir + .txt paths, primary = largest) and the keyword-lens prior
 * (aq/pr/rg) reused verbatim from the already-baked docs/js/comments-data.js — no regex duplication.
 *
 * Run: node tools/build-comment-worklist.mjs        (incremental: only comments still missing a v2 file)
 * Re-run any time; idempotent. The file is git-ignored scratch (regenerable from the repo).
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import vm from "node:vm";
import { validate } from "./validate-summaries.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..");
const C = join(ROOT, "sources", "comments");
const FILES = join(C, "files");
const V2 = join(C, "summaries-v2");
const MIN_CHARS = 400;   // below this the body is a scanned/empty stub — not summarizable
const LARGE = 120000;    // bodies above this carry exhibits; tell the agent to focus on the argument

const cj = JSON.parse(readFileSync(join(C, "rm26-4-comments.json"), "utf8"));
// "done" = a summary that passes the FULL validator (verbatim quotes + vocab + lens-union + lint), not
// just one that parses. A worker killed mid-Write can leave a file that parses but is broken; the
// lightweight check counted those as done and skipped the comment forever. Re-queue anything that
// doesn't fully validate so a chunk re-run self-heals.
// "done" = no HARD errors (missing fields, bad JSON, unknown vocab, lens mismatch, boilerplate/AI-register
// quotes). A low-coverage WARN (a quote just under the verbatim threshold) is a fidelity note for the human
// review pass, NOT a corruption — re-queuing on it loops forever when an agent keeps producing the same
// borderline quote. Hard errors still re-queue (so a truncated mid-write file self-heals).
const summaryUsable = (acc) => {
  if (!existsSync(join(V2, `${acc}.json`))) return false;
  try { return validate(`${acc}.json`).errs.length === 0; }
  catch { return false; }
};
const done = new Set(existsSync(V2) ? readdirSync(V2).filter((f) => f.endsWith(".json")).map((f) => f.replace(".json", "")).filter(summaryUsable) : []);
const flagships = new Set(existsSync(join(C, "summaries")) ? readdirSync(join(C, "summaries")).filter((f) => f.endsWith(".json")).map((f) => f.replace(".json", "")) : []);

// reuse the exact keyword lenses already computed into the page data (single source of truth)
const cmCtx = { window: {} };
vm.createContext(cmCtx);
vm.runInContext(readFileSync(join(ROOT, "docs", "js", "comments-data.js"), "utf8"), cmCtx);
const priorByAcc = Object.fromEntries((cmCtx.window.FERC_COMMENTS?.list || []).map((c) => [c.acc, { aq: c.aq || [], pr: c.pr || [], rg: c.rg || [] }]));

const dirForAcc = (acc) => { if (!existsSync(FILES)) return null; const n = readdirSync(FILES).find((x) => x === acc || x.startsWith(acc + "__")); return n ? join(FILES, n) : null; };

const rows = [];
let skippedNoText = 0, skippedDone = 0;
for (const c of cj.comments) {
  if (done.has(c.acc)) { skippedDone++; continue; }
  const d = dirForAcc(c.acc);
  if (!d) { skippedNoText++; continue; }
  const txts = readdirSync(d).filter((f) => f.endsWith(".txt"))
    .map((f) => ({ f, size: statSync(join(d, f)).size }))
    .sort((a, b) => b.size - a.size);
  const total = txts.reduce((s, t) => s + t.size, 0);
  if (total < MIN_CHARS) { skippedNoText++; continue; }
  const rel = (p) => relative(ROOT, p);
  rows.push({
    acc: c.acc,
    filer: c.org,
    org_type: c.bucket,
    filed: c.filed,
    dir: rel(d),
    primary: rel(join(d, txts[0].f)),
    txts: txts.map((t) => rel(join(d, t.f))),
    prior: priorByAcc[c.acc] || { aq: [], pr: [], rg: [] },
    chars: total,
    large: total > LARGE,
    flagship: flagships.has(c.acc),
  });
}
rows.sort((a, b) => a.chars - b.chars); // small bodies first → fast feedback when the workflow runs

writeFileSync(join(C, ".worklist.json"), JSON.stringify({ generated_for: "summaries-v2", count: rows.length, rows }, null, 2));

// `--next N` prints the next N accessions (smallest-first) as a JSON array — the chunk to feed the
// workflow's args.accs. Driven entirely by on-disk state, so it is interruption-safe and resumable.
const nextArg = process.argv.indexOf("--next");
if (nextArg !== -1) {
  const n = parseInt(process.argv[nextArg + 1], 10) || 40;
  process.stdout.write(JSON.stringify(rows.slice(0, n).map((r) => r.acc)) + "\n");
} else {
  console.log(`worklist: ${rows.length} comments to summarize (skipped ${skippedDone} already-done, ${skippedNoText} no-text). large=${rows.filter((r) => r.large).length}`);
  console.log(`buckets: ${JSON.stringify(rows.reduce((m, r) => ((m[r.org_type] = (m[r.org_type] || 0) + 1), m), {}))}`);
}
