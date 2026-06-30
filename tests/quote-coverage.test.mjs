import assert from "node:assert/strict";
import { test } from "node:test";
import { verifyAllQuotes } from "../tools/verify-quotes.mjs";

// Whole-site quote audit: every structured quote in docs/js/data.js must appear in its committed
// source. This is the single sweep behind `node tools/verify-quotes.mjs`; the per-feature suites
// still test each surface in detail, but this guards anything they miss (the prose quotes especially).
const { required, advisory } = verifyAllQuotes();

test("every required (structured) quote is verbatim in its committed source", () => {
  const miss = required.filter((r) => !r.ok);
  assert.equal(
    miss.length,
    0,
    `unverified quotes:\n${miss.map((m) => `  ${m.label}: ${m.quote.slice(0, 80)}`).join("\n")}`,
  );
  // coverage floor — the sweep must actually be reaching the data, not silently checking nothing
  assert.ok(required.length >= 150, `quote coverage floor: ${required.length} >= 150`);
});

test("every advisory prose quote resolves somewhere in the corpus", () => {
  const miss = advisory.filter((r) => !r.ok);
  assert.equal(
    miss.length,
    0,
    `prose quotes not found in corpus (tighten or de-quote):\n${miss.map((m) => `  ${m.label}: ${m.quote.slice(0, 80)}`).join("\n")}`,
  );
});
