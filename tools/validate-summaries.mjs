/* Validate quote-centric comment summaries (sources/comments/summaries-v2/*.json) against the schema
 * in summarization-spec.md and against the source text. The key check is quote fidelity: a quote must
 * be verbatim in the body — but the fitz-extracted .txt interleaves footnotes ("16 See ANOPR…") and
 * "--- PAGE N ---" markers mid-sentence, so we verify the quote is covered by verbatim runs allowing
 * source-side insertions, rather than one exact substring. Catches hallucination/paraphrase; tolerates
 * extraction noise. Quotes are checked against the concat of EVERY .txt in the comment's body dir
 * (resolved from the accession), so a quote from any attachment validates, not just the primary file.
 *
 * Run:  node tools/validate-summaries.mjs              (validate every summary)
 *       node tools/validate-summaries.mjs 20251121-5440  (validate one accession — used by subagents)
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..");
const DIR = join(ROOT, "sources", "comments", "summaries-v2");
const FILES = join(ROOT, "sources", "comments", "files");
const AQ = new Set(["jurisdiction", "threshold", "jointstudy", "deposits", "hybridrights", "protection", "expedited", "upgradecost"]);
const PR = new Set(["study", "cost", "colo", "flex", "proximate"]);
const RG = new Set(["pjm", "miso", "spp", "caiso", "isone", "nyiso"]);
const STANCES = new Set(["support", "oppose", "mixed", "neutral"]);
export const VOCAB = { AQ, PR, RG, STANCES };

const norm = (x) => x.replace(/[​‌‍﻿⁠]/g, "").replace(/---\s*PAGE\s*\d+\s*---/g, " ").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();

// Deterministic style + quality checks (free; would otherwise need an LLM audit pass).
// AI-register words and em-dashes are banned in curator prose (not in quotes — those are verbatim).
const BANNED = /\b(delve|leverage|robust|seamless|intricate|multifaceted|underscore|pivotal|realm|tapestry)\b/i;
const PHRASE = /it'?s worth noting|in today'?s|plays? a (crucial|key|vital|pivotal) role/i;
const EMDASH = /—|–/; // em/en dash in prose — write ranges and asides as "to" / commas
function lintProse(label, text) {
  if (!text) return [];
  const out = [];
  const m = text.match(BANNED); if (m) out.push(`${label}: AI-register word "${m[0]}"`);
  const p = text.match(PHRASE); if (p) out.push(`${label}: AI-register phrase "${p[0]}"`);
  if (EMDASH.test(text)) out.push(`${label}: em/en dash in prose (use "to" or a comma)`);
  return out;
}
// quotes that are caption/signature boilerplate carry no position — they should never be quoted
const BOILERPLATE = /UNITED STATES OF AMERICA|BEFORE THE FEDERAL ENERGY REGULATORY|CERTIFICATE OF SERVICE|Respectfully submitted|hereby certif/i;

// a comment body dir is named "<accession>__<org-slug>" (tolerate an older bare "<accession>")
const dirForAcc = (acc) => { if (!existsSync(FILES)) return null; const n = readdirSync(FILES).find((x) => x === acc || x.startsWith(acc + "__")); return n ? join(FILES, n) : null; };
// the source against which quotes are checked: every .txt in the comment's body dir, concatenated
function sourceTextFor(s) {
  const d = dirForAcc(s.accession);
  if (d) {
    const txts = readdirSync(d).filter((f) => f.endsWith(".txt"));
    if (txts.length) return txts.map((f) => { try { return readFileSync(join(d, f), "utf8"); } catch { return ""; } }).join("\n");
  }
  const p = join(ROOT, s.source_text || "");
  return existsSync(p) ? readFileSync(p, "utf8") : null;
}

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

export function validate(file) {
  const s = JSON.parse(readFileSync(join(DIR, file), "utf8"));
  const errs = [];
  for (const k of ["accession", "filer", "source_text", "overall_summary", "quotes", "bins", "lenses"]) if (s[k] == null) errs.push(`missing ${k}`);
  const srcText = sourceTextFor(s);
  if (srcText == null) { errs.push(`no body text found for ${s.accession} (source_text: ${s.source_text})`); return { acc: s.accession, errs, lowQuotes: [] }; }
  const nsrc = norm(srcText);

  const qids = new Set((s.quotes || []).map((q) => q.id));
  const binKeys = new Set((s.bins || []).map((b) => b.key));
  const lowQuotes = [];
  for (const q of s.quotes || []) {
    const cov = verbatimCoverage(q.text, nsrc);
    if (cov < 0.92) lowQuotes.push({ id: q.id, cov: +cov.toFixed(2) });
    for (const bk of q.bins || []) if (!binKeys.has(bk)) errs.push(`quote ${q.id} -> unknown bin ${bk}`);
    if (BOILERPLATE.test(q.text)) errs.push(`quote ${q.id} is caption/signature boilerplate, not a position`);
  }
  // deterministic style lint on the curator-written prose (quotes are exempt — they are verbatim)
  errs.push(...lintProse("overall_summary", s.overall_summary));
  for (const q of s.quotes || []) errs.push(...lintProse(`quote ${q.id} concern`, q.concern));
  for (const b of s.bins || []) { errs.push(...lintProse(`bin ${b.key} name`, b.name)); errs.push(...lintProse(`bin ${b.key} description`, b.description)); }
  const union = { aq: new Set(), pr: new Set(), rg: new Set() };
  for (const b of s.bins || []) {
    const [ns, k] = b.key.split(":");
    if (ns === "aq" && !AQ.has(k)) errs.push(`bin aq:${k} not in vocab`);
    if (ns === "pr" && !PR.has(k)) errs.push(`bin pr:${k} not in vocab`);
    if (ns === "rg" && !RG.has(k)) errs.push(`bin rg:${k} not in vocab`);
    if (!["aq", "pr", "rg", "topic"].includes(ns)) errs.push(`bin ${b.key} unknown namespace`);
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

// resolve a CLI argument (an accession or a filename) to the summary file in summaries-v2/
function fileForArg(arg) {
  if (arg.endsWith(".json")) return arg;
  return `${arg}.json`;
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  if (!existsSync(DIR)) { console.log("no summaries-v2/ yet"); process.exit(0); }
  const arg = process.argv[2];
  const files = arg ? [fileForArg(arg)] : readdirSync(DIR).filter((f) => f.endsWith(".json"));
  let bad = 0, warn = 0;
  for (const f of files) {
    if (!existsSync(join(DIR, f))) { console.log(`FAIL ${f}: not found in summaries-v2/`); bad++; continue; }
    const r = validate(f);
    const status = r.errs.length ? "FAIL" : r.lowQuotes.length ? "WARN" : "ok";
    if (r.errs.length || r.lowQuotes.length) console.log(`${status} ${r.acc}: ${r.errs.join("; ") || ""}${r.lowQuotes.length ? " low-coverage quotes " + JSON.stringify(r.lowQuotes) : ""}`);
    if (r.errs.length) bad++; else if (r.lowQuotes.length) warn++;
  }
  console.log(`\n${files.length} summaries checked, ${bad} with errors, ${warn} with low-coverage quotes.`);
  process.exit(bad ? 1 : 0);
}
