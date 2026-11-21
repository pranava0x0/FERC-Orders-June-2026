// Positions read for this site: who supports or opposes each filing, and the queue of replies still to read.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { queue, WATCH } from "../tools/curation-queue.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p) => readFileSync(join(ROOT, ...p), "utf8");
const voices = JSON.parse(read("sources", "filings", "perspectives.json"));
const record = (() => { const w = {}; vm.runInNewContext(read("docs", "js", "record-data.js"), { window: w }); return w.FERC_RECORD; })();
const STANCES = ["supports", "supports with changes", "opposes in part", "opposes", "asks FERC to reject", "procedural"];

test("every position with a stance carries the filer's own words and a valid stance", () => {
  const staked = voices.filter((v) => v.stance !== undefined);
  assert.ok(staked.length >= 9, `only ${staked.length} positions carry a stance`);
  for (const v of staked) {
    assert.ok(STANCES.includes(v.stance), `${v.title}: stance "${v.stance}"`);
    assert.ok(v.quote && Number.isInteger(v.quote_page) && v.quote_page > 0, `${v.title}: a stance needs a quote and its PDF page`);
    assert.match(v.url, /accession_number=\d{8}-\d{4}/, `${v.title}: a stance belongs to an eLibrary filing`);
  }
});

test("every watched proceeding id exists, and every reply in one has been read", () => {
  const q = queue(), ids = new Set(q.map((x) => x.id));
  for (const id of WATCH) assert.ok(ids.has(id), `WATCH names unknown proceeding ${id}`);
  const lars = q.find((x) => x.id === "miso-lars");
  assert.ok(lars.total >= 22, `LARS shows only ${lars.total} responses; the queue is reading nothing`);
  const open = q.filter((x) => WATCH.includes(x.id)).flatMap((x) => x.open.map((r) => `${x.id} ${r.accession} ${r.filer}`));
  assert.deepEqual(open, [], "replies not yet read (run node tools/curation-queue.mjs, add positions to perspectives.json)");
});

test("the queue treats requests for more time and FERC notices as procedure", () => {
  const q = queue(), all = q.flatMap((x) => x.open);
  for (const acc of ["20261119-5279", "20261118-5011", "20261118-3051", "20261118-3050"]) {
    assert.ok(!all.some((r) => r.accession === acc), `${acc} counted as a response`);
  }
  const miso = q.find((x) => x.id === "miso-large-load");
  assert.equal(miso.total, 0, "MISO's Nov 16 proceeding has only an extension motion and an individual's comments");
});

test("every response to MISO's LARS filing shows which side it takes", () => {
  const g = record.groups.find((x) => x.id === "miso-lars");
  const responses = g.docs.filter((d) => d.filer !== "MISO" && !/^Individual/i.test(d.filer) && d.kind !== "filing");
  assert.ok(responses.length >= 20, `only ${responses.length} LARS responses`);
  for (const d of responses) assert.ok(d.side || d.stance, `${d.filer} (${d.accession}) shows no side`);
  const nipsco = g.docs.find((d) => d.accession === "20261022-5130");
  assert.equal(nipsco.stance, "supports the proposal");
  assert.ok(nipsco.position && nipsco.position.quote, "a read position ships its quote to the Filings row");
});

test("a joint filer's name comes from its position, not eLibrary's run-together list", () => {
  const g = record.groups.find((x) => x.id === "miso-lars");
  const d = g.docs.find((x) => x.accession === "20261023-5191");
  assert.equal(d.filer, "Southern Minnesota Municipal Power Agency and WPPI Energy");
});

test("the discussion page leads with positions and drops procedure-only dockets", () => {
  const html = read("docs", "reading", "discussion-er27-25.html");
  assert.match(html, /<h2>Positions read for this site<\/h2>/);
  assert.match(html, /Asks FERC to reject · ER27-25-000/);
  assert.throws(() => read("docs", "reading", "discussion-er27-526.html"), /ENOENT/, "an extension motion alone made a discussion page");
  assert.match(execFileSync(process.execPath, ["tools/build-filing-readers.mjs", "--check"], { cwd: ROOT, encoding: "utf8" }), /Readers verified/);
});
