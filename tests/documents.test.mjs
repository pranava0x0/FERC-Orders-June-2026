// The per-document readings, the proceedings registry, the order anchors and the Discourse index.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadContext, loadReadings, validateReading, validateAnchors, proseErrors } from "../tools/validate-documents.mjs";
import { filerList, prettyName } from "../tools/build-record-data.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p) => readFileSync(join(ROOT, ...p), "utf8");
const record = () => { const s = read("docs", "js", "record-data.js"); return JSON.parse(s.slice(s.indexOf("{"), s.lastIndexOf("}") + 1)); };

test("every per-document reading validates: quotes on their pages, known anchors, house style", () => {
  const ctx = loadContext(), readings = loadReadings([]);
  assert.ok(readings.length >= 167, "readings went missing: " + readings.length);
  const have = new Set(readings.map((r) => r.doc.slug));
  const missing = ctx.catalog.filter((c) => !c.parent && !/^e-\d+-/.test(c.slug) && !have.has(c.slug)).map((c) => c.slug);
  assert.deepEqual(missing, [], "every reading-room document needs a reading");
  const errs = validateAnchors(ctx);
  for (const { file, doc } of readings) errs.push(...validateReading(doc, ctx, file));
  assert.deepEqual(errs, []);
});

test("a reading that quotes another document's page fails", () => {
  const ctx = loadContext();
  const doc = JSON.parse(read("sources", "filings", "documents", "compliance-er26-3515-pjm.json"));
  doc.points = [{ point: "Borrowed words.", quote: "We find that PJM’s proposed Large Load Registry is just and reasonable", pg: 20 }];
  assert.ok(validateReading(doc, ctx).some((e) => /point 1/.test(e)), "a quote from the October order must not pass on PJM's compliance filing");
});

test("prose rules catch the tells our own summaries must avoid", () => {
  assert.ok(proseErrors("PJM leverages a robust registry — not only fast, but cheap.", "x").length >= 2);
  assert.deepEqual(proseErrors("PJM asks FERC to accept the registry by Oct 12.", "x"), []);
});

test("order anchors and the Discourse index are generated from their sources", () => {
  for (const t of ["build-order-anchors.mjs", "build-discourse-index.mjs"]) execFileSync(process.execPath, [join(ROOT, "tools", t), "--check"], { stdio: "pipe" });
});

test("every reading-room document lands in exactly one Filings proceeding", () => {
  const R = record(), cat = JSON.parse(read("docs", "reading", "catalog.json"));
  const want = cat.filter((c) => !c.parent && !/^e-\d+-/.test(c.slug)).map((c) => c.slug).sort();
  const got = R.groups.flatMap((g) => g.docs.map((d) => d.slug)).sort();
  assert.ok(want.length > 100);
  assert.deepEqual(got, want);
});

test("every proceeding states its link to the June orders, and every cited anchor resolves", () => {
  const R = record();
  for (const g of R.groups) {
    assert.ok(g.link && g.link.text, g.id + " has no link to the orders");
    for (const id of g.link.anchors) assert.ok(R.anchors[id], g.id + " cites unknown anchor " + id);
    for (const d of g.docs) for (const id of (d.link && d.link.anchors) || []) assert.ok(R.anchors[id], d.slug + " cites unknown anchor " + id);
  }
  const sc = R.groups.filter((g) => g.kind === "show-cause").map((g) => g.id);
  for (const k of ["sc-pjm", "sc-miso", "sc-spp", "sc-caiso", "sc-isone", "sc-nyiso"]) assert.ok(sc.includes(k), "missing " + k);
});

test("reader pages carry no other party's words inside a document's reading", () => {
  const dir = join(ROOT, "docs", "reading");
  let n = 0;
  for (const slug of readdirSync(dir)) {
    const f = join(dir, slug, "index.html");
    if (!existsSync(f)) continue;
    n++;
    assert.doesNotMatch(readFileSync(f, "utf8"), /Related public statement|class="position"/, slug);
  }
  assert.ok(n > 100);
});

test("filer names split at organization seams and keep corporate suffixes", () => {
  assert.deepEqual(filerList("Organization of MISO States, Inc."), ["Organization of MISO States, Inc."]);
  assert.deepEqual(filerList("Sierra ClubNatural Resources Defense Council ,Clean Grid Alliance ,"), ["Sierra Club", "Natural Resources Defense Council", "Clean Grid Alliance"]);
  assert.deepEqual(filerList("Southern California Edison Company ,SunZia Transmission, LLC ,"), ["Southern California Edison Company", "SunZia Transmission, LLC"]);
  assert.deepEqual(filerList("NATURAL GAS SUPPLY ASSOCIATION (DC)"), ["Natural Gas Supply Association (DC)"]);
  assert.equal(prettyName("US HOUSE OF REPRESENTATIVES"), "US House of Representatives");
});

test("every Discourse item has a kind, text and a way back to its source", () => {
  const X = JSON.parse(read("sources", "discourse", "index.json")).items;
  assert.ok(X.length > 200);
  for (const it of X) {
    assert.ok(it.kind && it.text, it.id);
    assert.ok((it.src && it.src.length) || it.url, it.id + " has no source");
  }
});

test("review round 1 regressions: filers that merged or split wrongly", () => {
  assert.deepEqual(filerList("American Electric Power Service CorporationEvergy, Inc."), ["American Electric Power Service Corporation", "Evergy, Inc."]);
  assert.deepEqual(filerList("SECRETARY OF THE COMMISSION,FERCCOMMISSIONERS AND IMMEDIATE STAFF (THE COMMISSION)"), ["Secretary of the Commission", "FERC", "Commissioners and Immediate Staff (the Commission)"]);
  assert.deepEqual(filerList("Council of the City of New Orleans, Louisiana ,"), ["Council of the City of New Orleans, Louisiana"]);
  assert.deepEqual(filerList("Eolian, L.P."), ["Eolian, L.P."]);
});

test("review round 1 regressions: tools/refresh.sh never pipes a check into tail or grep", () => {
  const sh = read("tools", "refresh.sh");
  assert.doesNotMatch(sh, /^(?!#).*(verify-quotes|validate-documents|--test)[^\n]*\|/m, "a piped check reports the pipe's exit status, not the check's");
});

test("review round 1 regressions: #reforms routes, and a theme filter keeps its own address", () => {
  const app = read("docs", "js", "app.js");
  assert.equal((app.match(/TABS\.indexOf\(p\.tab\) >= 0 \|\| p\.tab === "reforms"/g) || []).length, 2, "both hash entry points accept #reforms");
  assert.match(app, /loadPoints\(g\);\n[^\n]*\n[^\n]*\n\s*if \(filingTheme\) return;/, "the toggle handler leaves the theme URL alone");
});
