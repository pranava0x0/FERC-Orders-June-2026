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
});

test("every response to MISO's LARS filing shows which side it takes", () => {
  const g = record.groups.find((x) => x.id === "miso-lars");
  const responses = g.docs.filter((d) => d.filer !== "MISO" && !/^Individual/i.test(d.filer) && d.kind !== "filing");
  assert.ok(responses.length >= 20, `only ${responses.length} LARS responses`);
  for (const d of responses) assert.ok(d.side || d.stance, `${d.filer} (${d.accession}) shows no side`);
  // A party's own comments or protest carries a stance read from its text, so the list reads one way.
  // (An answer to another party's motion can be labeled by its title instead.)
  const own = responses.filter((d) => !/answer/i.test(d.kind));
  assert.ok(own.length >= 18, `only ${own.length} LARS comments and protests`);
  for (const d of own) assert.ok(d.position && /LARS/.test(d.stance || ""), `${d.filer} (${d.accession}): "${d.stance || d.side}" is not a read stance on LARS`);
  const nipsco = g.docs.find((d) => d.accession === "20261022-5130");
  assert.equal(nipsco.stance, "supports LARS");
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
  assert.match(html, /Geronimo Power · Asks FERC to reject · ER27-25-000/);
  const cards = html.slice(html.indexOf('id="positions"'), html.indexOf("</section>", html.indexOf('id="positions"'))).match(/<article /g) || [];
  assert.ok(cards.length >= 9, `only ${cards.length} positions on the LARS page`);
  assert.doesNotMatch(html, /<p class="meta">\s*·| · · /, "a position card has an empty label");
  assert.throws(() => read("docs", "reading", "discussion-er27-526.html"), /ENOENT/, "an extension motion alone made a discussion page");
  assert.match(execFileSync(process.execPath, ["tools/build-filing-readers.mjs", "--check"], { cwd: ROOT, encoding: "utf8" }), /Readers verified/);
});

test("procedure means the motion itself, not a party's answer about it", async () => {
  const { proceduralFiling } = await import("../tools/curation-queue.mjs");
  const proc = (title, filer = "Some Party") => proceduralFiling({ title, filer });
  assert.ok(proc("Expedited Motion for a Nine-Day Extension of Comment Deadline of Constellation Energy Generation, LLC"));
  assert.ok(proc("Motion of Community Organizations and Clean Energy Advocates for a 30-day extension of time"));
  assert.ok(proc("Errata Notice Extending Comment Period re PECO Energy Company", "SECRETARY OF THE COMMISSION, FERC"));
  assert.ok(!proc("Preliminary Answer of PJM Interconnection L.L.C. Opposing Fast-Track Processing and Motion for Extension of Time"));
  assert.ok(!proc("Motion to Intervene and Request for Clarification of Talen Energy Corporation"));
  assert.ok(!proc("Answer of the Organization of MISO States in support of the motion for abeyance"));
  assert.ok(!proc("Notice of Intervention and Protest of the Example Commission"));
  for (const t of ["Motion for Leave to Answer and Answer of X to Motion for Extension of Time",
    "Motion for Leave to Answer and Answer of X to the Motion for Abeyance and Request for Shortened Answer Period",
    "Request for Rehearing and Request for Expedited Action", "Request for Clarification and for Extension of Time",
    "Request for Rehearing of Order Granting Abeyance", "Motion to Protest and for Extension of Time"]) assert.ok(!proc(t), t);
  assert.ok(proc("Motion for Abeyance of Southwest Power Pool, Inc."));
});
