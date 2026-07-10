/* Round-trip + grammar tests for docs/js/comments-route.js — run: node --test tests/comments-route.test.mjs
 * The Comments-tab URL grammar is a single source of truth shared with app.js; these guard that
 * parse(serialize(state)) is stable and that the readable forms map to the states the router expects. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(join(here, "..", "docs", "js", "comments-route.js"), "utf8");
const ctx = {};
vm.createContext(ctx);
vm.runInContext(code, ctx);
const raw = ctx.CommentsRoute;
// parse() builds objects inside the vm realm, whose prototype differs from this realm's — deepEqual
// treats them as unequal. Normalize through JSON so structural comparison works across realms.
const norm = (o) => JSON.parse(JSON.stringify(o));
const R = { serialize: raw.serialize, SUBS: raw.SUBS, DEFAULT_SUB: raw.DEFAULT_SUB, parse: (s) => norm(raw.parse(s)) };

test("exports parse + serialize + the sub-tab vocabulary", () => {
  assert.equal(typeof R.parse, "function");
  assert.equal(typeof R.serialize, "function");
  assert.ok(Array.isArray(R.SUBS) && R.SUBS.includes("summaries"));
  assert.equal(R.DEFAULT_SUB, "overview");
});

test("readable forms parse to the expected state", () => {
  assert.deepEqual(R.parse(""), { sub: "overview", acc: null, params: {} });
  assert.deepEqual(R.parse("/types"), { sub: "types", acc: null, params: {} });
  assert.deepEqual(R.parse("/summaries"), { sub: "summaries", acc: null, params: {} });
  // a row permalink implies the All-comments sub
  assert.deepEqual(R.parse("/c=20251104-5015"), { sub: "summaries", acc: "20251104-5015", params: {} });
  // sub + readable state (used by the By-issue / All-comments views)
  assert.deepEqual(R.parse("/summaries?q=stranded"), { sub: "summaries", acc: null, params: { q: "stranded" } });
  // a leading slash is optional
  assert.deepEqual(R.parse("types"), { sub: "types", acc: null, params: {} });
});

test("serialize produces the readable, back-compatible forms", () => {
  assert.equal(R.serialize({ sub: "overview" }), "comments");
  assert.equal(R.serialize({}), "comments");
  assert.equal(R.serialize({ sub: "summaries" }), "comments/summaries");
  assert.equal(R.serialize({ acc: "20251104-5015" }), "comments/c=20251104-5015");
  assert.equal(R.serialize({ sub: "summaries", params: { q: "pjm" } }), "comments/summaries?q=pjm");
  // empty param values are dropped, keys are ordered
  assert.equal(R.serialize({ sub: "issue", params: { id: "pr:cost", q: "" } }), "comments/issue?id=pr%3Acost");
});

test("round-trips every representative state through serialize -> parse", () => {
  const strip = (s) => s.replace(/^#?comments\/?/, ""); // serialize() includes the "comments" prefix
  const states = [
    { sub: "overview", acc: null, params: {} },
    { sub: "types", acc: null, params: {} },
    { sub: "summaries", acc: null, params: {} },
    { sub: "summaries", acc: "20251104-5015", params: {} },
    { sub: "summaries", acc: null, params: { q: "stranded cost", f: "rg:pjm,pr:cost" } },
    { sub: "issue", acc: null, params: { id: "pr:cost" } },
  ];
  for (const s of states) {
    const back = R.parse(strip(R.serialize(s)));
    // acc-bearing states normalize to the summaries sub; compare on the fields the router acts on
    assert.deepEqual(back, { sub: s.acc ? "summaries" : s.sub, acc: s.acc, params: s.params }, JSON.stringify(s));
  }
});
