import assert from "node:assert/strict";
import { test } from "node:test";
import { verifyAllQuotes } from "../tools/verify-quotes.mjs";

// Whole-site quote audit: every structured quote in docs/js/data.js must appear in its committed
// source. This is the single sweep behind `node tools/verify-quotes.mjs`; the per-feature suites
// still test each surface in detail, but this guards anything they miss (the prose quotes especially).
const { required, prose } = verifyAllQuotes();

test("every required (structured) quote is verbatim in its committed source", () => {
  const miss = required.filter((r) => !r.ok);
  assert.equal(
    miss.length,
    0,
    `unverified quotes:\n${miss.map((m) => `  ${m.label}: ${m.quote.slice(0, 80)}`).join("\n")}`,
  );
  // coverage floor — the sweep must actually be reaching the data, not silently checking nothing
  assert.ok(required.length >= 195, `quote coverage floor: ${required.length} >= 195`);
});

// news-tracks-plan.md Part 5 #5. Timeline event bodies were swept by nothing before the 2026-07-28
// refresh, so a named speaker's quote could reach the rail backed by no captured source. The floor
// above would still pass if the timeline sweep were dropped and other quotes were added, so name the
// surface and the specific spans: these are the ones a reader would most reasonably take as verbatim.
test("named-speaker news quotes on the timeline are backed by captured evidence", () => {
  const fromTimeline = required.filter((r) => r.label.startsWith('timeline "'));
  assert.ok(fromTimeline.length >= 3, `timeline sweep is reaching event bodies (${fromTimeline.length} >= 3)`);
  for (const needle of ["grave legitimacy crisis", "openly discussing leaving the RTO", "cultural quagmire"]) {
    const hit = fromTimeline.find((r) => r.quote.includes(needle));
    assert.ok(hit, `a timeline body quotes "${needle}"`);
    assert.ok(hit.ok, `"${needle}" resolves in sources/news-evidence.json`);
  }
});

test("every embedded prose quote resolves somewhere in the corpus", () => {
  const miss = prose.filter((r) => !r.ok);
  assert.equal(
    miss.length,
    0,
    `prose quotes not found in corpus (tighten or de-quote):\n${miss.map((m) => `  ${m.label}: ${m.quote.slice(0, 80)}`).join("\n")}`,
  );
});
