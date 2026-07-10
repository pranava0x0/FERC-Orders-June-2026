/* Guards for the §206 procedural clock (D.procedural) rendered on the Overview tab and the masthead chip.
 * The dates are derived and drive a compliance persona's deadlines, so pin them: valid, chronological,
 * cited, and consistent with the periods quoted from the orders (sources/orders-extract.json → deadlines). */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(join(here, "..", "docs", "js", "data.js"), "utf8"), ctx);
const D = ctx.window.FERC_DATA;
const P = D.procedural;

const isISO = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const days = (a, b) => Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);

test("procedural clock exists and is attributed", () => {
  assert.ok(P, "D.procedural is present");
  assert.ok(isISO(P.issued), "issued is an ISO date");
  assert.ok(P.source && D.SOURCES[P.source], "the derived-date source resolves in SOURCES");
  assert.ok(Array.isArray(P.steps) && P.steps.length >= 5, "at least the five clock steps");
});

test("every step is fully authored (label, period, cite, description)", () => {
  for (const s of P.steps) {
    for (const f of ["id", "label", "period", "cite", "desc"]) {
      assert.ok(s[f] && String(s[f]).trim(), `${s.id || "step"} has a ${f}`);
    }
  }
  assert.equal(new Set(P.steps.map((s) => s.id)).size, P.steps.length, "step ids are unique");
});

test("dated steps are valid, on/after issuance, and chronological", () => {
  const dated = P.steps.filter((s) => s.date);
  assert.ok(dated.length >= 4, "most steps carry a derived date");
  let prev = P.issued;
  for (const s of dated) {
    assert.ok(isISO(s.date), `${s.id} date is ISO`);
    assert.ok(days(P.issued, s.date) >= 0, `${s.id} is on/after issuance`);
    assert.ok(days(prev, s.date) >= 0, `${s.id} is not before the previous step`);
    prev = s.date;
  }
});

test("the relative response window has no fixed date (it opens after the 60-day filing)", () => {
  const resp = P.steps.find((s) => s.id === "response");
  assert.ok(resp, "a response-window step exists");
  assert.equal(resp.date, null, "response window is intentionally undated");
  assert.ok(/filing/i.test(resp.dateNote || ""), "its note explains it is relative to the filing");
});

test("the derived dates match the periods quoted from the orders (21/30/45/60 days)", () => {
  const byId = Object.fromEntries(P.steps.map((s) => [s.id, s]));
  // business-day roll can push a date a day or two past the raw period; allow a small window
  const near = (id, period) => { const d = days(P.issued, byId[id].date); assert.ok(d >= period && d <= period + 3, `${id} ≈ ${period} days (got ${d})`); };
  near("intervene", 21);
  near("report", 30);
  near("abeyance", 45);
  near("showcause", 60);
});
