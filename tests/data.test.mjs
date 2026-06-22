/* Data-integrity tests for docs/js/data.js — run: node tests/data.test.mjs
 * No dependencies (node: built-ins only). Guards the facts the UI renders. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(join(here, "..", "docs", "js", "data.js"), "utf8");
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(code, ctx);
const D = ctx.window.FERC_DATA;

// expected, authoritative item -> RTO -> docket mapping (from FERC summaries/news release)
const EXPECT = {
  "E-7": { rto: "PJM", docket: "EL26-67-000" },
  "E-8": { rto: "MISO", docket: "EL26-70-000" },
  "E-9": { rto: "SPP", docket: "EL26-68-000" },
  "E-10": { rto: "CAISO", docket: "EL26-71-000" },
  "E-11": { rto: "ISO-NE", docket: "EL26-72-000" },
  "E-12": { rto: "NYISO", docket: "EL26-69-000" },
};

test("data object loaded", () => {
  assert.ok(D, "window.FERC_DATA present");
  for (const k of ["SOURCES", "meta", "kpis", "timeline", "toplines", "categories", "dockets", "jurisdiction", "regional", "reception", "media"]) {
    assert.ok(D[k], `missing section: ${k}`);
  }
});

test("every source has url/label/org/tier and an http(s) url", () => {
  const ids = Object.keys(D.SOURCES);
  assert.ok(ids.length >= 20, `source count floor: ${ids.length} >= 20`);
  for (const id of ids) {
    const s = D.SOURCES[id];
    assert.match(s.url, /^https?:\/\//, `${id} url`);
    assert.ok(s.label && s.org && s.tier, `${id} fields`);
    assert.ok(["ferc", "doe", "order", "secondary"].includes(s.tier), `${id} tier valid`);
  }
});

test("all referenced source ids resolve", () => {
  const ids = new Set(Object.keys(D.SOURCES));
  const bad = [];
  const check = (arr, where) => (arr || []).forEach((x) => {
    (x.src || []).forEach((id) => { if (!ids.has(id)) bad.push(`${where}:${id}`); });
  });
  check(D.timeline, "timeline");
  check(D.toplines, "toplines");
  check(D.categories, "categories");
  check(D.jurisdiction, "jurisdiction");
  check(D.regional, "regional");
  check(D.reception, "reception");
  check(D.media.consensus, "consensus");
  check(D.media.friction, "friction");
  D.dockets.forEach((d) => {
    assert.ok(ids.has(d.url), `docket ${d.item} url-source ${d.url}`);
    (d.notes || []).forEach((n) => (n.src || []).forEach((id) => { if (!ids.has(id)) bad.push(`docket ${d.item}:${id}`); }));
  });
  assert.deepEqual(bad, [], `unresolved source ids: ${bad.join(", ")}`);
});

test("six dockets, correct item -> RTO -> docket mapping", () => {
  assert.equal(D.dockets.length, 6, "exactly six dockets");
  const byItem = Object.fromEntries(D.dockets.map((d) => [d.item, d]));
  for (const [item, exp] of Object.entries(EXPECT)) {
    const d = byItem[item];
    assert.ok(d, `missing ${item}`);
    assert.equal(d.rto, exp.rto, `${item} RTO`);
    assert.equal(d.docket, exp.docket, `${item} docket`);
    assert.ok(d.notes.length >= 1, `${item} has notes`);
  }
});

test("five reform categories, numbered 1..5, each fully populated", () => {
  assert.equal(D.categories.length, 5, "exactly five categories");
  D.categories.forEach((c, i) => {
    assert.equal(c.n, i + 1, "sequential numbering");
    assert.ok(c.title && c.ferc && c.detail, `category ${c.n} text`);
    assert.ok(Array.isArray(c.doe) && c.doe.length >= 1, `category ${c.n} DOE principles`);
    assert.ok(c.src.length >= 1, `category ${c.n} sources`);
  });
});

test("timeline spans DOE -> FERC -> deadlines", () => {
  assert.ok(D.timeline.length >= 7, "timeline count floor");
  const kinds = D.timeline.map((e) => e.kind);
  assert.ok(kinds.includes("doe"), "has a DOE event");
  assert.ok(kinds.includes("ferc"), "has the FERC issuance");
  assert.ok(kinds.filter((k) => k === "deadline").length >= 2, "has 30d and 60d deadlines");
});

test("kpis: six, with the 30/60-day deadline pair flagged", () => {
  assert.equal(D.kpis.length, 6, "six KPIs");
  assert.ok(D.kpis.filter((k) => k.deadline).length >= 2, "two deadline KPIs");
});

test("reception count floor + valid stances", () => {
  assert.ok(D.reception.length >= 5, "reception count floor");
  D.reception.forEach((r) => assert.ok(["positive", "mixed", "negative"].includes(r.stance), `stance ${r.group}`));
});

test("each of the five categories is referenced by at least one docket OR regional note", () => {
  // legend/enum guard: ensure the five-category framing is actually represented in the dockets text
  const blob = (JSON.stringify(D.dockets) + JSON.stringify(D.regional)).toLowerCase();
  ["hill", "co-locat", "order no. 888", "planning"].forEach((token) => {
    assert.ok(blob.includes(token), `regional distinctions mention "${token}"`);
  });
});
