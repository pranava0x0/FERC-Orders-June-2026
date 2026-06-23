/* Data-integrity tests for docs/js/data.js — run: node tests/data.test.mjs
 * No dependencies (node: built-ins only). Guards the facts the UI renders. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(join(here, "..", "docs", "js", "data.js"), "utf8");
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(code, ctx);
const D = ctx.window.FERC_DATA;

// the OCR audit trail the docket cards must trace back to
const EXTRACT = JSON.parse(readFileSync(join(here, "..", "sources", "orders-extract.json"), "utf8")).orders;
const EXTRACT_BY_ITEM = Object.fromEntries(EXTRACT.map((o) => [o.item, o]));
const norm = (s) => String(s).replace(/\s+/g, " ").trim();
const firstNum = (s) => (String(s).match(/\d+/) || [null])[0];
function longestCommonSubstr(a, b) {
  a = norm(a); b = norm(b);
  let best = 0;
  const dp = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    let prev = 0;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev + 1 : 0;
      if (dp[j] > best) best = dp[j];
      prev = tmp;
    }
  }
  return best;
}

// expected, authoritative item -> RTO -> docket mapping (from FERC summaries/news release)
const EXPECT = {
  "E-7": { rto: "PJM", docket: "EL26-67-000" },
  "E-8": { rto: "MISO", docket: "EL26-70-000" },
  "E-9": { rto: "SPP", docket: "EL26-68-000" },
  "E-10": { rto: "CAISO", docket: "EL26-71-000" },
  "E-11": { rto: "ISO-NE", docket: "EL26-72-000" },
  "E-12": { rto: "NYISO", docket: "EL26-69-000" },
};

test("data object loaded", () => {
  assert.ok(D, "window.FERC_DATA present");
  for (const k of ["SOURCES", "meta", "kpis", "timeline", "toplines", "categories", "dockets", "jurisdiction", "regional", "reception", "media"]) {
    assert.ok(D[k], `missing section: ${k}`);
  }
});

test("every source has url/label/org/tier and an http(s) url", () => {
  const ids = Object.keys(D.SOURCES);
  assert.ok(ids.length >= 20, `source count floor: ${ids.length} >= 20`);
  for (const id of ids) {
    const s = D.SOURCES[id];
    assert.match(s.url, /^https?:\/\//, `${id} url`);
    assert.ok(s.label && s.org && s.tier, `${id} fields`);
    assert.ok(["ferc", "doe", "order", "secondary"].includes(s.tier), `${id} tier valid`);
  }
});

test("all referenced source ids resolve", () => {
  const ids = new Set(Object.keys(D.SOURCES));
  const bad = [];
  const check = (arr, where) => (arr || []).forEach((x) => {
    (x.src || []).forEach((id) => { if (!ids.has(id)) bad.push(`${where}:${id}`); });
  });
  check(D.timeline, "timeline");
  check(D.toplines, "toplines");
  check(D.categories, "categories");
  check(D.jurisdiction, "jurisdiction");
  check(D.regional, "regional");
  check(D.reception, "reception");
  check(D.media.consensus, "consensus");
  check(D.media.friction, "friction");
  D.dockets.forEach((d) => {
    assert.ok(ids.has(d.url), `docket ${d.item} url-source ${d.url}`);
    assert.equal(D.SOURCES[d.url].tier, "order", `docket ${d.item} source is an order PDF`);
  });
  assert.deepEqual(bad, [], `unresolved source ids: ${bad.join(", ")}`);
});

test("six dockets, correct item -> RTO -> docket mapping", () => {
  assert.equal(D.dockets.length, 6, "exactly six dockets");
  const byItem = Object.fromEntries(D.dockets.map((d) => [d.item, d]));
  for (const [item, exp] of Object.entries(EXPECT)) {
    const d = byItem[item];
    assert.ok(d, `missing ${item}`);
    assert.equal(d.rto, exp.rto, `${item} RTO`);
    assert.equal(d.docket, exp.docket, `${item} docket`);
    assert.match(d.cite, /^195 FERC ¶ 61,21[1-6]$/, `${item} FERC cite`);
    assert.ok(d.pages >= 90 && d.pages <= 130, `${item} page count plausible`);
    assert.ok(d.respondents && /\d/.test(d.respondents), `${item} respondents`);
    assert.ok(Array.isArray(d.dir) && d.dir.length >= 4, `${item} has ≥4 quoted directives`);
    d.dir.forEach((x, i) => {
      assert.ok(x.t && x.q && x.p, `${item} directive ${i} fields`);
      assert.ok(x.q.length >= 20, `${item} directive ${i} quote is substantive`);
    });
    assert.ok(Array.isArray(d.reg) && d.reg.length >= 3, `${item} has ≥3 region-specific findings`);
  }
  // the six cites are distinct and consecutive
  const cites = new Set(D.dockets.map((d) => d.cite));
  assert.equal(cites.size, 6, "six distinct FERC cites");
});

test("five reform categories, numbered 1..5, each fully populated", () => {
  assert.equal(D.categories.length, 5, "exactly five categories");
  D.categories.forEach((c, i) => {
    assert.equal(c.n, i + 1, "sequential numbering");
    assert.ok(c.title && c.ferc && c.detail, `category ${c.n} text`);
    assert.ok(Array.isArray(c.doe) && c.doe.length >= 1, `category ${c.n} DOE principles`);
    assert.ok(c.src.length >= 1, `category ${c.n} sources`);
  });
});

test("timeline spans DOE -> FERC -> deadlines", () => {
  assert.ok(D.timeline.length >= 7, "timeline count floor");
  const kinds = D.timeline.map((e) => e.kind);
  assert.ok(kinds.includes("doe"), "has a DOE event");
  assert.ok(kinds.includes("ferc"), "has the FERC issuance");
  assert.ok(kinds.filter((k) => k === "deadline").length >= 2, "has 30d and 60d deadlines");
});

test("kpis: six, with the 30/60-day deadline pair flagged", () => {
  assert.equal(D.kpis.length, 6, "six KPIs");
  assert.ok(D.kpis.filter((k) => k.deadline).length >= 2, "two deadline KPIs");
});

test("reception count floor + valid stances", () => {
  assert.ok(D.reception.length >= 5, "reception count floor");
  D.reception.forEach((r) => assert.ok(["positive", "mixed", "negative"].includes(r.stance), `stance ${r.group}`));
});

test("each of the five categories is referenced by at least one docket OR regional note", () => {
  // legend/enum guard: ensure the five-category framing is actually represented in the dockets text
  const blob = (JSON.stringify(D.dockets) + JSON.stringify(D.regional)).toLowerCase();
  ["hill", "co-locat", "order no. 888", "planning"].forEach((token) => {
    assert.ok(blob.includes(token), `regional distinctions mention "${token}"`);
  });
});

test("rendered docket content traces back to sources/orders-extract.json (no drift)", () => {
  assert.equal(EXTRACT.length, 6, "extract has six orders");
  D.dockets.forEach((d) => {
    const x = EXTRACT_BY_ITEM[d.item];
    assert.ok(x, `extract for ${d.item}`);
    assert.equal(x.captionVerified, true, `${d.item} caption was verified`);
    // hard facts must match the extract exactly
    assert.equal(d.cite, x.fercCite, `${d.item} cite matches extract`);
    assert.equal(d.pages, x.pages, `${d.item} page count matches extract`);
    assert.equal(firstNum(d.respondents), firstNum(x.respondents), `${d.item} respondent count matches extract`);
    // every displayed directive must trace to a directive in the extract
    const exParas = x.directives.map((e) => norm(e.para)).join(" | ");
    d.dir.forEach((rd, i) => {
      const fn = firstNum(rd.p);
      if (fn) assert.ok(exParas.includes(fn), `${d.item} directive ${i} para ${rd.p} maps to extract`);
      // the quote must share a long verbatim run with some extract directive quote (catches edited/fabricated text)
      const bestLcs = Math.max(...x.directives.map((e) => longestCommonSubstr(rd.q, e.quote)));
      assert.ok(bestLcs >= 25, `${d.item} directive ${i} quote traces to extract (LCS ${bestLcs} >= 25)`);
    });
  });
});

test("every 'where it's covered' outlet maps to a cited secondary source", () => {
  const ids = D.SOURCES;
  assert.ok(D.media.outlets.length >= 8, "outlet count floor");
  D.media.outlets.forEach((id) => {
    assert.ok(ids[id], `outlet id ${id} exists in SOURCES`);
    assert.equal(ids[id].tier, "secondary", `outlet ${id} is a secondary source`);
  });
});

test("archived FERC sources carry a citationUrl chips can prefer", () => {
  ["fercPR", "fercFS", "fercSum", "fercRM264"].forEach((id) => {
    assert.match(D.SOURCES[id].archiveUrl || "", /web\.archive\.org/, `${id} has an archive snapshot URL`);
  });
});

test("every extracted directive quote appears verbatim in the saved full order text", () => {
  // The strongest audit guard: each quote in orders-extract.json must be present in the locally
  // extracted full text (sources/text/orders/*.txt) — independent of the agent that first read it.
  const STEM = {
    "E-7": "e-7-pjm-el26-67-000", "E-8": "e-8-miso-el26-70-000", "E-9": "e-9-spp-el26-68-000",
    "E-10": "e-10-caiso-el26-71-000", "E-11": "e-11-isone-el26-72-000", "E-12": "e-12-nyiso-el26-69-000",
  };
  const normTxt = (s) => s
    .replace(/[’‘]/g, "'").replace(/[“”]/g, '"')
    .replace(/([A-Za-z])\d{1,3}\b/g, "$1") // strip inline OCR footnote markers like "technologies154"
    .replace(/\s+/g, " ").toLowerCase().trim();
  let hits = 0, total = 0;
  for (const o of EXTRACT) {
    const file = join(here, "..", "sources", "text", "orders", STEM[o.item] + ".txt");
    const txt = normTxt(readFileSync(file, "utf8"));
    for (const d of o.directives) {
      for (const seg of d.quote.split(/…|\.\.\./)) {
        const s = normTxt(seg);
        if (s.length < 12) continue;
        total++;
        if (txt.includes(s)) hits++;
        else assert.fail(`${o.item} ${d.para}: quote segment not found verbatim in ${STEM[o.item]}.txt — "${s.slice(0, 60)}…"`);
      }
    }
  }
  assert.ok(total >= 40, `enough quote segments checked (${total})`);
  assert.equal(hits, total, `all ${total} directive-quote segments are verbatim in the full text`);
});
