/* Data-integrity tests for docs/js/data.js — run: node tests/data.test.mjs
 * No dependencies (node: built-ins only). Guards the facts the UI renders. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
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
  for (const k of ["SOURCES", "meta", "kpis", "timeline", "toplines", "categories", "dockets", "jurisdiction", "regional", "reception", "media", "voices", "commissioners", "comments"]) {
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
  check(D.voices, "voices");
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
    d.reg.forEach((r, i) => {
      assert.ok(r && typeof r.t === "string" && r.t.length >= 20, `${item} reg ${i} has substantive text`);
      if (r.pg != null) assert.ok(r.p && typeof r.a === "string" && Number.isInteger(r.pg), `${item} reg ${i} page cite has p/pg/a`);
    });
    // what's-unique-per-system enrichment
    assert.ok(typeof d.unique === "string" && d.unique.length >= 40, `${item} has a 'what's unique' summary`);
    assert.ok(Array.isArray(d.asks) && d.asks.length >= 1, `${item} has ≥1 system-specific ask`);
    // full respondent roster traces to the stated count exactly (OCR caption recount)
    assert.ok(Array.isArray(d.respondentList) && d.respondentList.length === Number(firstNum(d.respondents)),
      `${item} respondentList length (${(d.respondentList || []).length}) matches stated count (${firstNum(d.respondents)})`);
    d.respondentList.forEach((r, i) => assert.ok(typeof r === "string" && r.length >= 3, `${item} respondent ${i} is a real name`));
    assert.equal(new Set(d.respondentList).size, d.respondentList.length, `${item} respondent list has no duplicates`);
  }
  // the six cites are distinct and consecutive
  const cites = new Set(D.dockets.map((d) => d.cite));
  assert.equal(cites.size, 6, "six distinct FERC cites");
  // the distinct-findings counts intentionally vary (not a forced uniform list per docket)
  assert.ok(new Set(D.dockets.map((d) => d.reg.length)).size >= 2, "distinct-findings counts vary across dockets");
});

test("commissioner statements: five, with per-order page cites that carry the quote", () => {
  assert.ok(Array.isArray(D.commissioners) && D.commissioners.length === 5, "five commissioner statements");
  const KEYS = ["swett", "rosner", "see", "chang", "lacerte"];
  const byKey = Object.fromEntries(D.commissioners.map((c) => [c.key, c]));
  assert.deepEqual([...D.commissioners.map((c) => c.key)].sort(), [...KEYS].sort(), "keys are the five commissioners");
  for (const c of D.commissioners) {
    assert.ok(c.name && c.role && c.short && c.gist && c.quote, `${c.name} has name/role/short/gist/quote`);
    assert.ok(c.gist.length >= 80, `${c.name} gist is substantive`);
  }
  const STEM = {
    "E-7": "e-7-pjm-el26-67-000", "E-8": "e-8-miso-el26-70-000", "E-9": "e-9-spp-el26-68-000",
    "E-10": "e-10-caiso-el26-71-000", "E-11": "e-11-isone-el26-72-000", "E-12": "e-12-nyiso-el26-69-000",
  };
  const loose = (s) => s.replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").toLowerCase();
  const pagesOf = (item) => {
    const raw = readFileSync(join(here, "..", "sources", "text", "orders", STEM[item] + ".txt"), "utf8");
    const parts = raw.split(/--- PAGE (\d+) ---/);
    const map = new Map([[1, parts[0]]]);
    for (let i = 1; i < parts.length; i += 2) map.set(Number(parts[i]), parts[i + 1] || "");
    return map;
  };
  // every per-docket commissioner cite must land on a page that actually carries the quote in THAT order
  for (const d of D.dockets) {
    assert.ok(d.commishPages, `${d.item} has commishPages`);
    const pages = pagesOf(d.item);
    for (const key of KEYS) {
      const pg = d.commishPages[key];
      assert.ok(Number.isInteger(pg) && pg >= 1 && pg <= d.pages, `${d.item} ${key} page ${pg} within 1..${d.pages}`);
      const q = loose(byKey[key].quote);
      assert.ok(loose(pages.get(pg) || "").includes(q), `${d.item} ${key} p.${pg} carries the quote "${byKey[key].quote}"`);
    }
  }
});

test("RM26-4 comment corpus: stats present and stakeholder buckets sum to the comment total", () => {
  const c = D.comments;
  assert.ok(c && c.filings >= 400 && c.total >= 200, "headline comment stats present");
  assert.ok(Array.isArray(c.buckets) && c.buckets.length >= 10, "stakeholder buckets present");
  const sum = c.buckets.reduce((s, b) => s + b.n, 0);
  assert.equal(sum, c.total, `bucket counts (${sum}) sum to the comment total (${c.total})`);
  c.buckets.forEach((b, i) => {
    assert.ok(b.label && typeof b.n === "number" && b.n > 0, `bucket ${i} has label + count`);
    assert.ok(b.note && b.note.length >= 20, `bucket ${i} has a position note`);
  });
  assert.ok(c.interventions >= 1 && c.orgs >= 1 && c.peakN >= 1, "secondary stats present");
  assert.match(c.url, /elibrary\.ferc\.gov/, "links to the eLibrary docket sheet");
  // flagship comments read in full
  assert.ok(Array.isArray(c.flagships) && c.flagships.length >= 5, "flagship summaries present");
  const CATS = ["study", "cost", "colo", "flex", "proximate"];
  c.flagships.forEach((f, i) => {
    assert.ok(f.acc && f.filer && f.bucketLabel && f.summary && f.summary.length >= 40, `flagship ${i} fields`);
    assert.match(f.elibrary, /elibrary\.ferc\.gov.*accession_Number=20\d{6}-\d{4}/, `flagship ${i} eLibrary link`);
    CATS.forEach((k) => assert.ok(f.stances && f.stances[k], `flagship ${i} stance ${k}`));
  });
});

test("comment audit trail: every flagship threads website -> summary JSON -> downloaded file", () => {
  for (const f of D.comments.flagships) {
    const sumPath = join(here, "..", "sources", "comments", "summaries", `${f.acc}.json`);
    assert.ok(existsSync(sumPath), `summary JSON exists for ${f.filer} (${f.acc})`);
    const s = JSON.parse(readFileSync(sumPath, "utf8"));
    assert.equal(s.accession, f.acc, `${f.acc} summary accession matches`);
    assert.ok(Array.isArray(s.files) && s.files.length >= 1, `${f.acc} summary lists a file`);
    // the committed audit artifact is the extracted text (the source binary is gitignored, re-derivable)
    assert.ok(s.files[0].text && existsSync(join(here, "..", s.files[0].text)), `${f.acc} extracted text exists in the repo`);
  }
  // the per-accession file inventory covers all comments
  const files = JSON.parse(readFileSync(join(here, "..", "sources", "comments", "rm26-4-files.json"), "utf8"));
  assert.ok(files.stats.accessions >= 270 && files.stats.with_files >= 260, "file inventory covers the comment set");
});

test("distinct findings: every page cite lands on a page carrying the finding's anchor text", () => {
  const STEM = {
    "E-7": "e-7-pjm-el26-67-000", "E-8": "e-8-miso-el26-70-000", "E-9": "e-9-spp-el26-68-000",
    "E-10": "e-10-caiso-el26-71-000", "E-11": "e-11-isone-el26-72-000", "E-12": "e-12-nyiso-el26-69-000",
  };
  const loose = (s) => s.replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").toLowerCase();
  const pagesOf = (item) => {
    const parts = readFileSync(join(here, "..", "sources", "text", "orders", STEM[item] + ".txt"), "utf8").split(/--- PAGE (\d+) ---/);
    const map = new Map([[1, parts[0]]]);
    for (let i = 1; i < parts.length; i += 2) map.set(Number(parts[i]), parts[i + 1] || "");
    return map;
  };
  let checked = 0;
  for (const d of D.dockets) {
    const pages = pagesOf(d.item);
    for (const r of d.reg) {
      if (r.pg == null) continue;
      assert.ok(r.pg >= 1 && r.pg <= d.pages, `${d.item} finding p.${r.pg} within 1..${d.pages}`);
      assert.ok(loose(pages.get(r.pg) || "").includes(loose(r.a)), `${d.item} finding p.${r.pg} carries anchor "${r.a}"`);
      checked++;
    }
  }
  assert.ok(checked >= 20, `enough page-anchored findings checked (${checked})`);
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
