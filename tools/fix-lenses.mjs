/* Deterministically set a summary's `lenses` = union of its bins' aq/pr/rg keys (topic excluded).
 * `lenses` is purely derived, so the extract agent should never hand-author it — that mismatch was the
 * single most common validation failure and cost a self-fix tool-loop per comment. The agent runs this
 * right after writing the file, so `lenses` is correct by construction and validation passes first try.
 *
 * Run: node tools/fix-lenses.mjs 20251205-5261   (also accepts a path; no arg = every summaries-v2 file)
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const DIR = join(here, "..", "sources", "comments", "summaries-v2");

function fix(file) {
  const p = file.includes("/") ? file : join(DIR, file.endsWith(".json") ? file : `${file}.json`);
  const s = JSON.parse(readFileSync(p, "utf8"));
  const u = { aq: new Set(), pr: new Set(), rg: new Set() };
  for (const b of s.bins || []) { const [ns, k] = (b.key || "").split(":"); if (u[ns]) u[ns].add(k); }
  const next = { aq: [...u.aq], pr: [...u.pr], rg: [...u.rg] };
  const changed = JSON.stringify(s.lenses || {}) !== JSON.stringify(next);
  s.lenses = next;
  if (changed) writeFileSync(p, JSON.stringify(s, null, 2) + "\n");
  return { acc: s.accession, changed, lenses: next };
}

const arg = process.argv[2];
const files = arg ? [arg] : (existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith(".json")) : []);
if (!files.length) { console.error(`fix-lenses: no summaries-v2 files found in ${DIR}; nothing was checked.`); process.exit(1); }
let n = 0, bad = 0;
for (const f of files) {
  try { const r = fix(f); if (r.changed) n++; if (arg || r.changed) console.log(`${r.changed ? "fixed" : "ok"} ${r.acc}: lenses ${JSON.stringify(r.lenses)}`); }
  catch (e) { bad++; console.log(`skip ${f}: ${e.message}`); } // one unreadable file must not abort the batch
}
console.log(`\n${files.length - bad} of ${files.length} checked, ${n} lenses recomputed${bad ? `, ${bad} skipped` : ""}.`);
// The batch finishes, but a skip is not success: the extract agent runs this on the file it just wrote,
// and a missing or truncated file used to print "skip" and exit 0.
if (bad) process.exit(1);
