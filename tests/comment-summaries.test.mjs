/* Regression guards for the auditable v2 comment summaries (sources/comments/summaries-v2/).
 * Reuses the real validator so the suite enforces the same fidelity bar the pipeline does:
 * every quote verbatim in its source body, controlled vocabulary, lenses = union(bins), no
 * AI-register/boilerplate. Plus a count floor (append-only) and one-example-per-enum so no
 * stance-map / lens-chip slot ever renders empty.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { validate, VOCAB } from "../tools/validate-summaries.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const DIR = join(here, "..", "sources", "comments", "summaries-v2");
const files = readdirSync(DIR).filter((f) => f.endsWith(".json"));
const load = (f) => JSON.parse(readFileSync(join(DIR, f), "utf8"));

test("every v2 summary is valid: verbatim quotes, controlled vocab, lenses = union(bins), clean prose", () => {
  const failures = [];
  for (const f of files) { const r = validate(f); if (r.errs.length) failures.push(`${r.acc}: ${r.errs.join("; ")}`); }
  assert.equal(failures.length, 0, "invalid summaries:\n" + failures.join("\n"));
});

test("summary corpus meets its count floor (append-only — never silently drops)", () => {
  assert.ok(files.length >= 268, `summaries-v2 count floor (${files.length} >= 268)`);
});

test("each reform principle, ANOPR question, and region is engaged by >=1 summary (no empty legend slot)", () => {
  const seen = { aq: new Set(), pr: new Set(), rg: new Set() };
  for (const f of files) {
    const s = load(f);
    for (const ns of ["aq", "pr", "rg"]) for (const k of (s.lenses && s.lenses[ns]) || []) seen[ns].add(k);
  }
  for (const k of VOCAB.PR) assert.ok(seen.pr.has(k), `reform principle pr:${k} has >=1 summary`);
  for (const k of VOCAB.AQ) assert.ok(seen.aq.has(k), `ANOPR question aq:${k} has >=1 summary`);
  for (const k of VOCAB.RG) assert.ok(seen.rg.has(k), `region rg:${k} has >=1 summary`);
});

test("every summary is provisional (verified:false) and traces to a source body", () => {
  for (const f of files) {
    const s = load(f);
    assert.equal(s.provenance && s.provenance.verified, false, `${s.accession} provenance.verified is false (AI-synthesized values are provisional)`);
    assert.ok(s.source_text, `${s.accession} carries a source_text pointer`);
    assert.ok(Array.isArray(s.quotes) && s.quotes.length >= 1, `${s.accession} has >=1 quote (the atomic unit)`);
  }
});
