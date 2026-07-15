/* Contract for the record-to-rule crosswalk (docs/js/data.js → policyMap; policy-analysis-spec.md
 * Part 5 #2). Every curator claim has to trace: order quotes verbatim, forward links resolve to the
 * procedural clock and the Section IV questions, enums closed, no guessed status.
 * Run: node --test tests/policy-map.test.mjs   (node: built-ins only) */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";
import { carries, loose, loadOrderTexts } from "../tools/verify-quotes.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(join(here, "..", "docs", "js", "data.js"), "utf8");
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(code, ctx);
const D = ctx.window.FERC_DATA;

const MAP = D.policyMap;
const orderText = loadOrderTexts();
const issueIndex = JSON.parse(
  readFileSync(join(here, "..", "docs", "data", "comments", "issues", "index.json"), "utf8"),
);
const issueByKey = Object.fromEntries(issueIndex.map((i) => [i.key, i]));

const STATUSES = ["directed", "briefed", "resolved", "silent"];
const VEHICLES = ["compliance-filing", "e2-paper-hearing", "rm26-4-rule"];
const stepIds = new Set((D.procedural.steps || []).map((s) => s.id));
const briefingIds = new Set((D.briefing.questions || []).map((q) => q.id));

test("policyMap is a non-empty array", () => {
  assert.ok(Array.isArray(MAP) && MAP.length >= 10, `expected >= 10 rows, got ${MAP && MAP.length}`);
});

test("every row targets a real aq:/pr: issue, no duplicates, no region rows", () => {
  const seen = new Set();
  for (const r of MAP) {
    assert.ok(issueByKey[r.issue], `unknown issue key: ${r.issue}`);
    const ns = r.issue.split(":")[0];
    assert.ok(ns === "aq" || ns === "pr", `only aq:/pr: issues get rows, got ${r.issue}`);
    assert.ok(!seen.has(r.issue), `duplicate row for ${r.issue}`);
    seen.add(r.issue);
  }
});

test("status enum is closed", () => {
  for (const r of MAP) assert.ok(STATUSES.includes(r.status), `bad status "${r.status}" on ${r.issue}`);
});

test("every did.q is verbatim in its order text; did present iff not silent", () => {
  for (const r of MAP) {
    if (r.status === "silent") {
      assert.ok(!r.did, `silent row ${r.issue} must carry no directive quote`);
      continue;
    }
    assert.ok(r.did && r.did.q && r.did.order, `${r.issue} (${r.status}) needs a did.q + order`);
    const src = orderText[r.did.order];
    assert.ok(src, `${r.issue} cites unknown order ${r.did.order}`);
    assert.ok(carries(r.did.q, src), `${r.issue} did.q not found in ${r.did.order}: "${r.did.q.slice(0, 70)}"`);
    assert.ok(Number.isInteger(r.did.pg) && r.did.pg > 0, `${r.issue} needs a positive page cite`);
  }
});

test("next.vehicle enum closed; next.step and next.briefingId resolve to live surfaces", () => {
  for (const r of MAP) {
    assert.ok(r.next && VEHICLES.includes(r.next.vehicle), `${r.issue} bad next.vehicle "${r.next && r.next.vehicle}"`);
    if (r.next.step != null) assert.ok(stepIds.has(r.next.step), `${r.issue} next.step "${r.next.step}" not in procedural.steps`);
    if (r.next.briefingId != null) assert.ok(briefingIds.has(r.next.briefingId), `${r.issue} next.briefingId "${r.next.briefingId}" not in briefing.questions`);
  }
});

test("silent rows carry curator sources that exist in SOURCES", () => {
  for (const r of MAP) {
    if (r.status !== "silent") continue;
    assert.ok(Array.isArray(r.sources) && r.sources.length, `silent row ${r.issue} needs cited sources`);
    for (const s of r.sources) assert.ok(D.SOURCES[s], `${r.issue} cites unknown SOURCES id "${s}"`);
  }
});

test("seed rule: every status value appears at least once (no empty legend slot)", () => {
  const present = new Set(MAP.map((r) => r.status));
  for (const s of STATUSES) assert.ok(present.has(s), `no example row for status "${s}"`);
});

test("copy: no em-dashes in curator prose (no-ai-isms rule)", () => {
  for (const r of MAP) {
    for (const field of ["anopr", "note"]) {
      assert.ok(!/[—]/.test(r[field] || ""), `${r.issue}.${field} contains an em-dash`);
    }
  }
});

test("anopr and note are real curator prose, not empty", () => {
  for (const r of MAP) {
    assert.ok(loose(r.anopr).length > 20, `${r.issue} anopr too thin`);
    assert.ok(loose(r.note).length > 20, `${r.issue} note too thin`);
  }
});
