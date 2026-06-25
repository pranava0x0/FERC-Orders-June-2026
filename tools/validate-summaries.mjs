/* Validate quote-centric comment summaries (sources/comments/summaries-v2/*.json) against the schema
 * in summarization-spec.md and against the source text. The key check is quote fidelity: a quote must
 * be verbatim in the body — but the fitz-extracted .txt interleaves footnotes ("16 See ANOPR…") and
 * "--- PAGE N ---" markers mid-sentence, so we verify the quote is covered by verbatim runs allowing
 * source-side insertions, rather than one exact substring. Catches hallucination/paraphrase; tolerates
 * extraction noise. Run: node tools/validate-summaries.mjs
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..");
const DIR = join(ROOT, "sources", "comments", "summaries-v2");
const AQ = new Set(["jurisdiction", "threshold", "jointstudy", "deposits", "hybridrights", "protection", "expedited", "upgradecost"]);
const PR = new Set(["study", "cost", "colo", "flex", "proximate"]);
const RG = new Set(["pjm", "miso", "spp", "caiso", "isone", "nyiso"]);
const STANCES = new Set(["support", "oppose", "mixed", "neutral"]);

const norm = (x) => x.replace(/---\s*PAGE\s*\d+\s*---/g, " ").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();

// quote is verbatim if its normalized text is covered (>=92%) by runs (>=8 chars) found in the source,
// allowing source-side gaps (footnotes / page markers spliced into the body by the PDF text layer).
function verbatimCoverage(quote, nsrc) {
  const nq = norm(quote);
  if (!nq) return 0;
  if (nsrc.includes(nq)) return 1;
  let pos = 0, covered = 0;
  while (pos < nq.length) {
    let len = 0, lo = 1, hi = nq.length - pos;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (nsrc.includes(nq.slice(pos, pos + mid))) { len = mid; lo = mid + 1; } else hi = mid - 1; }
    if (len < 8) { pos++; continue; }
    covered += len; pos += len;
  }
  return covered / nq.length;
}

function validate(file) {
  const s = JSON.parse(readFileSync(join(DIR, file), "utf8"));
  const errs = [];
  for (const k of ["accession", "filer", "source_text", "overall_summary", "quotes", "bins", "lenses"]) if (s[k] == null) errs.push(`missing ${k}`);
  const srcPath = join(ROOT, s.source_text || "");
  if (!existsSync(srcPath)) { errs.push(`source_text missing: ${s.source_text}`); return { acc: s.accession, errs, lowQuotes: [] }; }
  const nsrc = norm(readFileSync(srcPath, "utf8"));

  const qids = new Set((s.quotes || []).map((q) => q.id));
  const binKeys = new Set((s.bins || []).map((b) => b.key));
  const lowQuotes = [];
  for (const q of s.quotes || []) {
    const cov = verbatimCoverage(q.text, nsrc);
    if (cov < 0.92) lowQuotes.push({ id: q.id, cov: +cov.toFixed(2) });
    for (const bk of q.bins || []) if (!binKeys.has(bk)) errs.push(`quote ${q.id} -> unknown bin ${bk}`);
  }
  const union = { aq: new Set(), pr: new Set(), rg: new Set() };
  for (const b of s.bins || []) {
    const [ns, k] = b.key.split(":");
    if (ns === "aq" && !AQ.has(k)) errs.push(`bin aq:${k} not in vocab`);
    if (ns === "pr" && !PR.has(k)) errs.push(`bin pr:${k} not in vocab`);
    if (ns === "rg" && !RG.has(k)) errs.push(`bin rg:${k} not in vocab`);
    if (ns !== "topic" && union[ns]) union[ns].add(k);
    if (!STANCES.has(b.stance)) errs.push(`bin ${b.key} bad stance ${b.stance}`);
    for (const id of b.quote_ids || []) if (!qids.has(id)) errs.push(`bin ${b.key} -> unknown quote ${id}`);
  }
  for (const ns of ["aq", "pr", "rg"]) {
    const got = new Set(s.lenses?.[ns] || []);
    if (got.size !== union[ns].size || [...union[ns]].some((k) => !got.has(k))) errs.push(`lenses.${ns} != union(bins)`);
  }
  return { acc: s.accession, errs, lowQuotes };
}

if (!existsSync(DIR)) { console.log("no summaries-v2/ yet"); process.exit(0); }
const files = readdirSync(DIR).filter((f) => f.endsWith(".json"));
let bad = 0;
for (const f of files) {
  const r = validate(f);
  const status = r.errs.length ? "FAIL" : r.lowQuotes.length ? "WARN" : "ok";
  if (r.errs.length || r.lowQuotes.length) console.log(`${status} ${r.acc}: ${r.errs.join("; ") || ""}${r.lowQuotes.length ? " low-coverage quotes " + JSON.stringify(r.lowQuotes) : ""}`);
  if (r.errs.length) bad++;
}
console.log(`\n${files.length} summaries checked, ${bad} with errors.`);
process.exit(bad ? 1 : 0);
