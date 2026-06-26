/* Deterministic gate: should this v2 summary get an independent LLM audit? No model — pure heuristics
 * over the written summary and its keyword prior (from .worklist.json). The extract agent self-critiques
 * in-context; this flags the ~quarter where an independent skeptic actually earns its tokens.
 *
 * Run: node tools/flag-summary.mjs 20251121-5440   ->  prints {"flagged":bool,"reasons":[...]}
 * Importable: `import { flagDecision } from "./flag-summary.mjs"` (the CLI is main-guarded).
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..");

// Flag only on INTRINSIC thinness, not prior-divergence. The keyword prior over-detects (it matches a
// word anywhere), and the LLM is correctly selective — PNNL's finding is that the LLM UNDER-selects vs.
// experts, so "prior found X the summary omits" is usually the LLM being right, not a miss. Auditing all
// such divergences wasted ~5 Sonnet audits per 10-chunk (all returned "defensible, no change").
export function flagDecision(s, prior, chars) {
  const reasons = [];
  const q = s.quotes || [], bins = s.bins || [];
  const pr = new Set((s.lenses && s.lenses.pr) || []);
  // 1. too few quotes for the body's substance — the expected minimum scales with filing size (a
  //    3-quote summary of a 100k-char brief is still thin), floored at 3 and capped at 5.
  if (q.length === 0) reasons.push("zero quotes");
  else if (chars > 8000) {
    const minQ = Math.max(3, Math.min(5, Math.ceil(chars / 30000) + 1));
    if (q.length < minQ) reasons.push(`only ${q.length} quote(s) on a ${Math.round(chars / 1000)}k body (expected >= ${minQ})`);
  }
  // 2. a substantive filing coded with no position at all
  if (bins.length > 1 && bins.every((b) => b.stance === "neutral")) reasons.push("every bin is neutral");
  // 3. missed the reform-principle dimension entirely (no pr bins at all, but the prior found several)
  if (pr.size === 0 && ((prior && prior.pr) || []).length >= 2) reasons.push(`no reform-principle bin but prior found ${prior.pr.join(", ")}`);
  return { flagged: reasons.length > 0, reasons };
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const acc = process.argv[2];
  if (!acc) { console.log(JSON.stringify({ flagged: false, reasons: ["no accession"] })); process.exit(0); }
  const sumPath = join(ROOT, "sources", "comments", "summaries-v2", `${acc}.json`);
  if (!existsSync(sumPath)) { console.log(JSON.stringify({ flagged: true, reasons: ["summary file missing"] })); process.exit(0); }
  const s = JSON.parse(readFileSync(sumPath, "utf8"));
  const wlPath = join(ROOT, "sources", "comments", ".worklist.json");
  const row = existsSync(wlPath) ? (JSON.parse(readFileSync(wlPath, "utf8")).rows || []).find((r) => r.acc === acc) : null;
  const prior = (row && row.prior) || { aq: [], pr: [], rg: [] };
  const chars = (row && row.chars) || 0;
  console.log(JSON.stringify(flagDecision(s, prior, chars)));
}
