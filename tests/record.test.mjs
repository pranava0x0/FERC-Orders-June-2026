// The Filings and Commissioners tabs: verified sources, a baked file that matches them, nothing empty.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p) => readFileSync(join(ROOT, ...p), "utf8");
const tenets = JSON.parse(read("sources", "filings", "tenets.json"));
const chapters = JSON.parse(read("sources", "videos", "chapters.json"));
const manifest = JSON.parse(read("sources", "videos", "manifest.json"));

const run = (...args) => execFileSync(process.execPath, args, { cwd: ROOT, encoding: "utf8", stdio: "pipe" });

test("every Filings and Commissioners quote is on its cited page or at its cited second", () => {
  const out = run("tools/verify-record.mjs");
  assert.match(out, /^✓ \d+\/\d+ quotes verified/m);
});

test("docs/js/record-data.js is baked from the current sources", () => {
  assert.match(run("tools/build-record-data.mjs", "--check"), /^✓/m);
});

test("the record is not empty: every proceeding has tenets, every video has a contents list", () => {
  assert.ok(tenets.groups.length >= 5, `only ${tenets.groups.length} proceedings`);
  for (const g of tenets.groups) {
    assert.ok(g.tenets.length > 0, `${g.id} has no tenets`);
    assert.ok(g.docs.length > 0, `${g.id} has no documents`);
    assert.ok(g.short && g.short.length <= 24, `${g.id} needs a short jump label`);
  }
  assert.ok(chapters.videos.length >= 3, `only ${chapters.videos.length} videos`);
  for (const v of chapters.videos) assert.ok(v.chapters.length > 0, `${v.id} has no chapters`);
  assert.ok(chapters.videos.some((v) => v.quotes.length > 0), "no video carries a quote");
});

test("every video on the tab is in the manifest with a committed transcript", () => {
  const ids = new Set(manifest.map((v) => v.id));
  for (const v of chapters.videos) {
    assert.ok(ids.has(v.id), `${v.id} is not in sources/videos/manifest.json`);
    assert.ok(existsSync(join(ROOT, "sources", "videos", "text", `${v.id}.txt`)), `${v.id} has no transcript`);
  }
});

test("each commissioner appears in at least one video quote", () => {
  const who = new Set(chapters.videos.flatMap((v) => v.quotes.map((q) => q.who)));
  for (const k of ["swett", "rosner", "see", "chang", "lacerte"]) assert.ok(who.has(k), `no spoken quote from ${k}`);
});

test("tenet copy carries no em dashes and no AI-register words", () => {
  const BANNED = /\b(underscores?|highlights?|robust|seamless(ly)?|leverag(e|es|ing)|crucial|landscape|delve|pivotal|navigat(e|es|ing))\b/i;
  const lines = [
    ...tenets.groups.flatMap((g) => [g.title, g.status || "", ...g.tenets.map((t) => t.tenet)]),
    ...chapters.videos.flatMap((v) => [v.event || "", ...v.chapters.map((c) => c.title), ...v.quotes.map((q) => q.tenet || "")]),
  ];
  assert.ok(lines.length > 50);
  for (const l of lines) {
    assert.doesNotMatch(l, /—/, `em dash in: ${l}`);
    assert.doesNotMatch(l, BANNED, `AI-register word in: ${l}`);
  }
});

test("index.html has a tab and a panel for every route app.js knows", () => {
  const html = read("docs", "index.html");
  const app = read("docs", "js", "app.js");
  const tabs = JSON.parse(app.match(/var TABS = (\[[^\]]+\])/)[1]);
  assert.equal(tabs.length, 7);
  for (const t of tabs) {
    assert.match(html, new RegExp(`id="tab-${t}"`), `no tab button for ${t}`);
    assert.match(html, new RegExp(`id="panel-${t}"`), `no panel for ${t}`);
  }
});

test("a tab whose phone label is aria-hidden still has an accessible name", () => {
  const html = read("docs", "index.html");
  const tabs = [...html.matchAll(/<button class="tab"[^>]*>[\s\S]*?<\/button>/g)].map((m) => m[0]);
  assert.equal(tabs.length, 7);
  for (const t of tabs) if (/tab-short" aria-hidden="true"/.test(t)) assert.match(t, /aria-label="[^"]+"/, `no accessible name: ${t.slice(0, 80)}`);
});

test("a failed shared data load reaches every tab waiting on it", () => {
  const app = read("docs", "js", "app.js");
  const onerror = app.slice(app.indexOf("s.onerror = function () {"), app.indexOf("document.head.appendChild(s);"));
  assert.match(onerror, /waiting\.forEach/, "onerror must update every queued panel, as onload does");
});

test("a Filings deep link is settled before activate() rewrites the hash", () => {
  const app = read("docs", "js", "app.js");
  const branch = app.slice(app.indexOf('} else if (tab === "filings" && rest) {'), app.indexOf('} else if (tab === "commissioners") {'));
  assert.ok(branch.indexOf("filingHash = rest") >= 0 && branch.indexOf("filingHash = rest") < branch.indexOf('activate("filings"'),
    "filingHash must take the incoming route before activate() writes the URL");
});

test("routing to a proceeding clears a theme filter left by an earlier route", () => {
  const app = read("docs", "js", "app.js");
  const fn = app.slice(app.indexOf("function routeFiling(rest) {"), app.indexOf("function wireFilings() {"));
  assert.match(fn, /if \(filingTheme\) applyTheme\(panel, ""\)/, "a proceeding route must apply the unfiltered state");
});
