// Page-weight budget for the first load of docs/index.html.
//
// comments-data.js (~490 KB raw, ~109 KB gzip) is read only by the Comments tab. Loading it as a
// blocking <script> made it the single largest thing on every visit and held the load event back by
// seconds on a phone connection (2026-11-02: 1.8 s to load on fast 4G, 6.5 s on slow 4G, live). It is now
// a low-priority prefetch that app.js executes on first open of that tab. These tests keep it there and
// fail loud if the blocking bytes creep back up.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const docs = join(dirname(fileURLToPath(import.meta.url)), "..", "docs");
const html = readFileSync(join(docs, "index.html"), "utf8");
const app = readFileSync(join(docs, "js", "app.js"), "utf8");

test("comments-data.js is prefetched, never a blocking script", () => {
  assert.doesNotMatch(html, /<script[^>]+src="js\/comments-data\.js/, "comments-data.js is back as a blocking <script>");
  const link = html.match(/<link rel="prefetch" id="cm-data" as="script" href="(js\/comments-data\.js\?v=[0-9a-f]{10})">/);
  assert.ok(link, "index.html must carry <link rel=prefetch id=cm-data> with a stamped token");
  assert.match(app, /link: "cm-data"/, "app.js must load the Comments data from the cm-data link");
});

test("record-data.js (Filings, Commissioners) is prefetched, never a blocking script", () => {
  assert.doesNotMatch(html, /<script[^>]+src="js\/record-data\.js/, "record-data.js is a blocking <script>");
  const link = html.match(/<link rel="prefetch" id="rec-data" as="script" href="(js\/record-data\.js\?v=[0-9a-f]{10})">/);
  assert.ok(link, "index.html must carry <link rel=prefetch id=rec-data> with a stamped token");
  assert.match(app, /filings: \{ link: "rec-data"/, "the Filings tab must load from the rec-data link");
  assert.match(app, /commissioners: \{ link: "rec-data"/, "the Commissioners tab must load from the rec-data link");
});

test("blocking first-load assets stay under the gzip budget", () => {
  const refs = [...html.matchAll(/<(?:script[^>]+src|link rel="stylesheet" href)="([^"?]+)/g)].map((m) => m[1]);
  assert.ok(refs.length >= 3, `expected the stylesheet and scripts, found ${refs.length} references`);
  const files = ["index.html", ...refs];
  const gz = files.reduce((n, f) => n + gzipSync(readFileSync(join(docs, f)), { level: 9 }).length, 0);
  // 178 KB on 2026-11-02 (index 11, styles 16, data 112, route 1, app 39). Raise deliberately, not by drift.
  const BUDGET = 220 * 1024;
  assert.ok(gz <= BUDGET, `blocking first-load weight is ${Math.round(gz / 1024)} KB gzip across ${files.join(", ")}; budget ${BUDGET / 1024} KB`);
});
