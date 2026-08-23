/* Regression guards for the August 2026 abeyance corpus (sources/text/abeyance/) and the per-docket
 * `abeyance` blocks that quote it.
 *
 * The point of this corpus is that the six orders which STOPPED the §206 clock are quoted from their own
 * text rather than from a docket-sheet description — the descriptions are demonstrably unreliable here
 * (accession 20260813-3026 names the wrong docket and the wrong parent order). So these tests check the
 * chain end to end: the text is committed, each docket points at a real order, the reset dates agree with
 * the procedural clock, and every displayed quote is verbatim in the corpus.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";
import { carries, loose, loadAbeyanceTexts } from "../tools/verify-quotes.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "sources", "text", "abeyance");

const D = (() => {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(join(ROOT, "docs", "js", "data.js"), "utf8"), ctx);
  return ctx.window.FERC_DATA;
})();

const manifest = JSON.parse(readFileSync(join(ROOT, "sources", "abeyance-manifest.json"), "utf8"));

test("the abeyance corpus is committed and non-empty", () => {
  assert.ok(existsSync(DIR), "sources/text/abeyance/ exists");
  const files = readdirSync(DIR).filter((f) => f.endsWith(".txt"));
  // Count floor, append-only: six abeyance orders, two errata, the extension notice, two compliance
  // transmittals, one show-cause answer. A drop here means an extraction silently stopped writing.
  assert.ok(files.length >= 12, `abeyance corpus count floor (${files.length} >= 12)`);
  for (const f of files) {
    const t = readFileSync(join(DIR, f), "utf8");
    assert.ok(t.length > 1000, `${f} has real body text (${t.length} chars)`);
    assert.match(t.split("\n")[0], /^FERC .+ — Docket \S+ — accession \d{8}-\d{4}/, `${f} carries its provenance header`);
  }
});

test("every manifest document points at committed text that exists", () => {
  assert.ok(manifest.documents.length >= 12, "manifest lists every document");
  for (const d of manifest.documents) {
    assert.ok(existsSync(join(ROOT, d.text)), `${d.accession} text exists at ${d.text}`);
    assert.match(d.accession, /^\d{8}-\d{4}$/, `${d.accession} is a well-formed accession`);
  }
});

test("all six §206 dockets record the order that paused them, with agreeing dates", () => {
  const six = D.dockets.filter((d) => /^EL26-6[789]|^EL26-7[012]/.test(d.docket));
  assert.equal(six.length, 6, "six §206 dockets");
  const texts = loadAbeyanceTexts();
  const corpus = Object.values(texts).join(" ¶ ");
  for (const d of six) {
    const a = d.abeyance;
    assert.ok(a, `${d.rto} records its abeyance order`);
    assert.match(a.accession, /^20260814-\d{4}$/, `${d.rto} abeyance accession is an Aug 14 issuance`);
    assert.match(a.cite, /^196 FERC ¶ 61,1(2[89]|3[0-3])$/, `${d.rto} cite is in the 196 FERC ¶ 61,128-133 block`);
    // data.js and the extracted file must agree on which document this is. Both the accession and the
    // reporter citation come from the document's own first page via extract-abeyance-docs.py, so this
    // catches a docket pointed at the wrong order — the failure mode the unreliable docket-sheet
    // descriptions invite. (It compares data.js against the extraction manifest, not against FERC's
    // servers; that the extraction itself matches the source is what `--check` is for.)
    const doc = manifest.documents.find((m) => m.accession === a.accession);
    assert.ok(doc, `${d.rto} accession ${a.accession} is a document in the abeyance manifest`);
    assert.equal(doc.docket, d.docket, `${a.accession} is filed in ${d.docket}`);
    assert.equal(doc.cite, a.cite, `${a.accession} citation agrees with the manifest`);
    // Every field the two renderers interpolate must exist, or they print the literal "undefined" into
    // the page. Caught at the data layer on purpose: a missing field should fail the build, not render
    // defensively as an empty string and hide that the data is incomplete.
    for (const k of ["accession", "cite", "kind", "issued", "due", "answers", "granted", "note"]) {
      assert.ok(typeof a[k] === "string" && a[k].length, `${d.rto} abeyance.${k} is a non-empty string`);
    }
    assert.ok(a.due > "2026-11-01" && a.due < "2026-12-01", `${d.rto} reset date is in November 2026 (${a.due})`);
    assert.ok(a.answers > a.due, `${d.rto} answers (${a.answers}) fall after responses (${a.due})`);
  }
  // SPP asked for 95 days rather than 90 and got them, so it is the one docket four days behind.
  const spp = six.find((d) => d.rto === "SPP");
  assert.equal(spp.abeyance.due, "2026-11-20", "SPP's reset date is Nov 20, not Nov 16");
  for (const d of six.filter((x) => x.rto !== "SPP")) {
    assert.equal(d.abeyance.due, "2026-11-16", `${d.rto} resets to Nov 16`);
  }
});

test("the procedural clock's revised date matches what the abeyance orders actually say", () => {
  const step = D.procedural.steps.find((s) => s.id === "showcause");
  assert.ok(step.revised, "the show-cause step records that it was reset");
  assert.equal(step.date, "2026-08-17", "the step keeps the order's own arithmetic date");
  // The board carries one date, so it must be the one that governs the most dockets, not the outlier.
  const due = D.dockets.filter((d) => d.abeyance).map((d) => d.abeyance.due);
  const majority = due.sort((a, b) => due.filter((x) => x === b).length - due.filter((x) => x === a).length)[0];
  assert.equal(step.revised.date, majority, "the revised date matches the per-docket majority");
  assert.match(step.revised.note, /SPP/, "the note names the docket the single date does not cover");
});

test("every displayed abeyance quote is exact in ITS OWN order's text, not merely somewhere in the corpus", () => {
  // Deliberately stricter than the site's usual carries() sweep, twice over. (1) Per FILE: checking the
  // union of all twelve texts cannot tell a docket quoting its own order from one quoting a sibling's,
  // and every one of these orders issued the same day from the same template. (2) EXACT containment,
  // no LCS fallback: two same-day FERC orders share well over the 60-char run carries() accepts, so the
  // per-file check alone still passed a deliberately misattributed sentence when tried. These texts are
  // DOCX-extracted with a clean text layer, so there is no OCR splicing to tolerate.
  const texts = loadAbeyanceTexts();
  const quoted = D.dockets.filter((d) => d.abeyance?.quote);
  assert.ok(quoted.length >= 4, `at least four dockets quote their order (${quoted.length})`);
  for (const d of quoted) {
    const key = String(d.docket).toLowerCase().replace(/-\d+$/, "");   // EL26-67-000 -> el26-67
    const own = Object.entries(texts).filter(([slug]) => slug.includes(key)).map(([, t]) => t).join(" ¶ ");
    assert.ok(own, `${d.rto}: found the committed text for ${d.docket}`);
    assert.ok(own.includes(loose(d.abeyance.quote)),
      `${d.rto} abeyance quote is exact in ${key}'s own order text:\n  ${d.abeyance.quote.slice(0, 120)}`);
  }
});

test("the abeyance orders carry no separate commissioner statements", () => {
  // Worth asserting rather than assuming: all five commissioners wrote separately on every June 18
  // order, and none wrote on the orders that stopped those same proceedings. If a later reissuance adds
  // a concurrence, this fails and the site's "no statements" framing needs revisiting.
  for (const f of readdirSync(DIR).filter((x) => x.startsWith("abeyance-"))) {
    const t = readFileSync(join(DIR, f), "utf8");
    assert.doesNotMatch(t, /\b(concurring|dissenting)\b/i, `${f} has no separate statement`);
  }
});
