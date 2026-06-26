/* The audit gate (tools/flag-summary.mjs) decides which v2 summaries get an independent LLM audit.
 * It must fire on intrinsic thinness and NOT on mere prior-divergence (the keyword prior over-detects).
 * These cases pin that behavior so a future tweak can't silently over- or under-flag.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { flagDecision } from "../tools/flag-summary.mjs";

const q = (n) => Array.from({ length: n }, (_, i) => ({ id: i + 1 }));

test("flags zero quotes", () => {
  assert.equal(flagDecision({ quotes: [], bins: [], lenses: {} }, {}, 5000).flagged, true);
});

test("flags too few quotes for a substantial body", () => {
  assert.equal(flagDecision({ quotes: q(2), bins: [{ stance: "support" }], lenses: { pr: ["cost"] } }, { pr: ["cost"] }, 12000).flagged, true);
});

test("scales the quote floor with filing size: 3 quotes on a 70k brief is thin", () => {
  // minQ = max(3, min(5, ceil(70000/30000)+1)) = 4, so 3 quotes flags
  assert.equal(flagDecision({ quotes: q(3), bins: [{ stance: "support" }], lenses: { pr: ["cost"] } }, { pr: ["cost"] }, 70000).flagged, true);
});

test("does NOT flag a well-quoted large filing", () => {
  assert.equal(flagDecision({ quotes: q(6), bins: [{ stance: "support" }, { stance: "oppose" }], lenses: { pr: ["cost", "study"] } }, { pr: ["cost"] }, 70000).flagged, false);
});

test("flags a substantive filing coded entirely neutral", () => {
  assert.equal(flagDecision({ quotes: q(4), bins: [{ stance: "neutral" }, { stance: "neutral" }], lenses: { pr: ["cost"] } }, {}, 5000).flagged, true);
});

test("flags when the prior found >=2 reform principles but the summary has none", () => {
  assert.equal(flagDecision({ quotes: q(4), bins: [{ key: "aq:jurisdiction", stance: "oppose" }], lenses: { pr: [] } }, { pr: ["cost", "study"] }, 5000).flagged, true);
});

test("does NOT flag a clean substantive summary, even when the prior over-detects", () => {
  // 4 quotes, has pr bins, mixed stances, prior lists extra pr keys the summary omits — must stay unflagged
  const r = flagDecision({ quotes: q(5), bins: [{ key: "pr:cost", stance: "support" }, { key: "pr:study", stance: "oppose" }], lenses: { pr: ["cost", "study"] } }, { pr: ["cost", "study", "colo", "flex"] }, 20000);
  assert.equal(r.flagged, false, "prior-only divergence must not flag: " + JSON.stringify(r.reasons));
});

test("does NOT flag a short filing with few but adequate quotes (small body)", () => {
  assert.equal(flagDecision({ quotes: q(2), bins: [{ stance: "support" }], lenses: { pr: ["study"] } }, { pr: ["study"] }, 3000).flagged, false);
});
