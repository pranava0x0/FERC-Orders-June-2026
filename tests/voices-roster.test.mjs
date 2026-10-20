/* The "Who's quoted" roster on the Discourse tab (docs/js/app.js renderVoiceRoster).
 * D.voices went unrendered from 2026-06-29 to 2026-10-20 while it grew to 45 records, and nothing failed.
 * These tests run the real renderer (sliced out of app.js with the helpers it calls) over the real data,
 * so a voice that stops rendering, or a field that renders as "undefined", fails the suite.
 * run: node --test tests/voices-roster.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const docs = join(here, "..", "docs");
const D = (() => {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(join(docs, "js", "data.js"), "utf8"), ctx);
  return ctx.window.FERC_DATA;
})();
const app = readFileSync(join(docs, "js", "app.js"), "utf8");

// app.js is one IIFE indented two spaces; each helper below is a top-level declaration inside it that
// ends at the first line reading exactly "  }" (or "  ];" for the array).
function slice(startToken, endLine) {
  const i = app.indexOf(startToken);
  assert.ok(i >= 0, `app.js declares ${startToken.trim()}`);
  const j = app.indexOf("\n" + endLine + "\n", i);
  assert.ok(j > i, `found the end of ${startToken.trim()}`);
  return app.slice(i, j + endLine.length + 1);
}
const code = [
  slice("  function esc(", "  }"),
  slice("  function shortName(", "  }"),
  slice("  function srcChips(", "  }"),
  slice("  function renderVoiceRoster(", "  }"),
  "out = { html: renderVoiceRoster(D.voices), render: renderVoiceRoster };",
].join("\n");
const ctx = { D, out: null };
vm.createContext(ctx);
vm.runInContext(code, ctx);
const { html, render } = ctx.out;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

test("the Discourse tab renders the roster from D.voices", () => {
  assert.match(app, /accSection\("Who’s quoted",[\s\S]{0,400}renderVoiceRoster\(D\.voices \|\| \[\]\), false, \(D\.voices \|\| \[\]\)\.length\)/,
    "renderNews mounts the roster as a collapsible section with the voice count");
});

test("every voice carries the fields the roster reads, with resolvable sources", () => {
  assert.ok(D.voices.length >= 45, `voices count floor (${D.voices.length} >= 45)`);
  for (const v of D.voices) {
    for (const k of ["name", "affil", "take"]) {
      assert.ok(typeof v[k] === "string" && v[k].trim(), `${v.name || "(unnamed)"}: ${k} is a non-empty string`);
    }
    assert.ok(Array.isArray(v.src) && v.src.length, `${v.name}: has at least one source`);
    for (const id of v.src) assert.ok(D.SOURCES[id], `${v.name}: source "${id}" resolves in SOURCES`);
  }
});

test("the rendered roster contains every voice, once, with its source chips", () => {
  assert.ok(D.voices.length > 0, "there are voices to render");
  assert.doesNotMatch(html, /\bundefined\b|\bNaN\b/, "no data hole leaks into the markup");
  const rows = html.match(/<li class="voice-row">/g) || [];
  assert.equal(rows.length, D.voices.length, "one row per voice");
  for (const v of D.voices) {
    assert.ok(html.includes('<span class="voice-name">' + esc(v.name) + "</span>"), `${v.name} is rendered`);
    for (const id of v.src) {
      const s = D.SOURCES[id];
      assert.ok(html.includes('href="' + esc(s.archiveUrl || s.url) + '"'), `${v.name}: chip for "${id}" links to its source`);
    }
  }
  // Alphabetical, so a reader can find a name.
  const names = [...html.matchAll(/<span class="voice-name">([^<]*)<\/span>/g)].map((m) => m[1]);
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)), "voices are listed alphabetically");
});

test("the roster publishes no political-lean label (curator-only until reviewed)", () => {
  // Codex, PR 24 (P1): grouping 45 named people by an unreviewed left/center/right label.
  assert.doesNotMatch(html, /lean-pill|voice-group|Right of center|Left of center/);
  for (const v of D.voices.filter((x) => x.lean)) {
    assert.ok(!html.includes(">" + esc(v.lean) + "<"), `${v.name}: lean "${v.lean}" is not rendered`);
  }
});

test("missing fields render explicit placeholders, never blanks or undefined", () => {
  const bare = render([{}, { name: "X", lean: "libertarian", src: [] }]);
  assert.doesNotMatch(bare, /\bundefined\b|\bnull\b/);
  for (const ph of ["Name not recorded", "Affiliation not stated", "No summary recorded", "No source recorded"]) {
    assert.ok(bare.includes(ph), `placeholder "${ph}" renders`);
  }
  assert.equal((bare.match(/<li class="voice-row">/g) || []).length, 2, "every record renders, whatever fields it lacks");
});
