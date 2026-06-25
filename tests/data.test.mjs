/* Data-integrity tests for docs/js/data.js — run: node tests/data.test.mjs
 * No dependencies (node: built-ins only). Guards the facts the UI renders. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
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
    // the committed audit artifacts: both the downloaded document body and its extracted text
    assert.ok(s.files[0].path && existsSync(join(here, "..", s.files[0].path)), `${f.acc} downloaded document committed`);
    assert.ok(s.files[0].text && existsSync(join(here, "..", s.files[0].text)), `${f.acc} extracted text committed`);
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

test("deployed site (docs/) ships only the order PDFs and links comments via eLibrary", () => {
  // GitHub Pages publishes only docs/. Comment PDFs live in sources/comments/files/ (committed to
  // the repo, not deployed); the only PDFs allowed under docs/ are the six §206 orders, which are
  // served because the inline #page= citations open them. Keeps the published payload small and
  // enforces the "in GitHub, not on Pages unless absolutely needed" policy in code.
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
  const docsRoot = join(here, "..", "docs");
  const pdfs = walk(docsRoot).filter((p) => p.toLowerCase().endsWith(".pdf"));
  const stray = pdfs.filter((p) => !p.includes("/docs/orders/"));
  assert.equal(stray.length, 0, `no non-order PDFs under docs/ (found: ${stray.map((p) => p.split("/docs/")[1]).join(", ")})`);
  assert.ok(pdfs.length >= 6, `the six order PDFs are present under docs/orders/ (found ${pdfs.length})`);

  // the deployed JS must not href/src a repo-only comment file (it would 404 on Pages)
  const badHref = /(?:href|src)\s*[:=]\s*["'`][^"'`]*sources\/comments/i;
  for (const f of ["data.js", "app.js"]) {
    assert.ok(!badHref.test(readFileSync(join(docsRoot, "js", f), "utf8")), `${f} links no repo-only sources/comments file`);
  }

  // every flagship card points at its eLibrary filing, not a local copy
  for (const fl of D.comments.flagships) {
    assert.match(fl.elibrary, /^https:\/\/elibrary\.ferc\.gov\//, `${fl.acc} flagship links to eLibrary`);
  }
});

test("comments-data.js (Comments tab) is consistent with the scraped manifest", () => {
  // Generated by tools/build-comments-page-data.mjs from sources/comments/. Guards the timeline list,
  // respondent-type counts, and theme prevalence the Comments tab renders — so a stale regen fails loud.
  const cmCtx = { window: {} };
  vm.createContext(cmCtx);
  vm.runInContext(readFileSync(join(here, "..", "docs", "js", "comments-data.js"), "utf8"), cmCtx);
  const CM = cmCtx.window.FERC_COMMENTS;
  const src = JSON.parse(readFileSync(join(here, "..", "sources", "comments", "rm26-4-comments.json"), "utf8"));
  const N = src.comments.length;
  assert.ok(CM, "FERC_COMMENTS present");
  assert.ok(N >= 273, `comment count floor (${N} >= 273)`); // append-only: never drops below the captured set
  assert.equal(CM.total, N, "total matches manifest");
  assert.equal(CM.list.length, N, "list covers every comment");

  const key = (f) => { const [m, d, y] = f.split("/"); return y + m.padStart(2, "0") + d.padStart(2, "0"); };
  for (let i = 1; i < CM.list.length; i++) assert.ok(key(CM.list[i - 1].filed) <= key(CM.list[i].filed), `list is in filing order at row ${i}`);
  assert.equal(CM.dateRange.first, CM.list[0].filed, "dateRange.first is the earliest filing");
  assert.equal(CM.dateRange.last, CM.list[N - 1].filed, "dateRange.last is the latest filing");

  assert.equal(CM.respondentTypes.reduce((s, t) => s + t.count, 0), N, "respondent-type counts sum to total");
  const recount = {};
  for (const c of src.comments) recount[c.bucket] = (recount[c.bucket] || 0) + 1;
  for (const t of CM.respondentTypes) assert.equal(t.count, recount[t.bucket], `respondent type ${t.bucket} count matches the manifest`);

  for (const c of CM.list) {
    assert.ok(c.acc && c.org && c.filed && c.bucket, `row ${c.acc} has the fields the list renders`);
    assert.ok((c.dl === 0 || c.dl === 1) && (c.sum === 0 || c.sum === 1), `row ${c.acc} download/summary flags are 0/1`);
  }

  assert.ok(CM.themes.length >= 8, "top themes are present");
  for (const t of CM.themes) {
    assert.ok(t.pct >= 0 && t.pct <= 100, `theme ${t.key} prevalence is a percentage`);
    assert.ok(t.count <= CM.analyzed, `theme ${t.key} count never exceeds the analyzed corpus`);
  }
  assert.ok(CM.downloaded >= 270, `downloaded-body floor (${CM.downloaded} >= 270)`);

  // per-comment metadata lenses: ANOPR comment-period questions (8), reform principles (5), regions (6)
  assert.equal(CM.anoprQuestions.length, 8, "eight ANOPR comment-period questions");
  assert.equal(CM.principles.length, 5, "five reform principles");
  assert.equal(CM.regions.length, 6, "six order regions");
  for (const q of CM.anoprQuestions) assert.ok(q.label && q.desc, `ANOPR question ${q.key} has a label + plain-language description`);
  const QKEYS = new Set(CM.anoprQuestions.map((q) => q.key)), PKEYS = new Set(CM.principles.map((p) => p.key)), RKEYS = new Set(CM.regions.map((r) => r.key));
  for (const agg of [...CM.anoprQuestions, ...CM.principles, ...CM.regions]) {
    assert.ok(agg.count <= CM.analyzed && agg.pct >= 0 && agg.pct <= 100, `tag ${agg.key} count/pct in range`);
  }
  for (const c of CM.list) {
    assert.ok(Array.isArray(c.aq) && Array.isArray(c.pr) && Array.isArray(c.rg), `row ${c.acc} has question/principle/region arrays`);
    for (const k of c.aq) assert.ok(QKEYS.has(k), `row ${c.acc} ANOPR question ${k} is a known key`);
    for (const k of c.pr) assert.ok(PKEYS.has(k), `row ${c.acc} principle ${k} is a known key`);
    for (const k of c.rg) assert.ok(RKEYS.has(k), `row ${c.acc} region ${k} is a known key`);
  }
  // every aggregate count equals the number of rows carrying that tag (no double-count drift)
  for (const q of CM.anoprQuestions) assert.equal(q.count, CM.list.filter((c) => c.aq.includes(q.key)).length, `question ${q.key} count matches rows`);
  for (const p of CM.principles) assert.equal(p.count, CM.list.filter((c) => c.pr.includes(p.key)).length, `principle ${p.key} count matches rows`);
  for (const r of CM.regions) assert.equal(r.count, CM.list.filter((c) => c.rg.includes(r.key)).length, `region ${r.key} count matches rows`);
});

test("comment body directories are named with the submitter (traceable to filer)", () => {
  // The path names who filed: files/<accession>__<org-slug>/. Guards the traceability convention.
  const FILES = join(here, "..", "sources", "comments", "files");
  const dirs = readdirSync(FILES).filter((d) => /^20\d{6}-\d{4}/.test(d));
  const orgByAcc = Object.fromEntries(
    JSON.parse(readFileSync(join(here, "..", "sources", "comments", "rm26-4-comments.json"), "utf8")).comments.map((c) => [c.acc, c.org]));
  const slug = (s) => (s || "").replace(/&/g, " and ").replace(/[^A-Za-z0-9 -]/g, "").trim()
    .replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50).replace(/-+$/, "") || "unknown";
  assert.ok(dirs.length >= 270, `comment body dirs present (${dirs.length})`);
  for (const d of dirs) {
    const m = d.match(/^(20\d{6}-\d{4})__(.+)$/);
    assert.ok(m, `dir "${d}" follows <accession>__<org-slug>`);
    assert.ok(orgByAcc[m[1]] !== undefined, `dir ${d} maps to a known accession`);
    assert.equal(m[2], slug(orgByAcc[m[1]]), `dir ${d} suffix is the submitter slug`);
  }
});

test("SEO + accessibility essentials are present in the deployed shell", () => {
  const docs = join(here, "..", "docs");
  const html = readFileSync(join(docs, "index.html"), "utf8");
  // accessibility shell
  assert.match(html, /<html lang="en">/, "html carries a lang");
  assert.match(html, /class="skip-link"/, "skip-link present");
  assert.ok(/role="banner"/.test(html) && /role="main"/.test(html) && /role="contentinfo"/.test(html), "landmark roles present");
  assert.match(html, /name="viewport"/, "viewport meta present");
  // SEO
  assert.match(html, /rel="canonical"/, "canonical link present");
  assert.match(html, /name="robots"/, "robots meta present");
  assert.match(html, /property="og:url"/, "og:url present");
  const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(ld, "JSON-LD present");
  assert.doesNotThrow(() => JSON.parse(ld[1]), "JSON-LD is valid JSON");
  // robots.txt + sitemap.xml
  assert.ok(existsSync(join(docs, "robots.txt")), "robots.txt present");
  assert.match(readFileSync(join(docs, "robots.txt"), "utf8"), /Sitemap:/, "robots.txt references the sitemap");
  assert.match(readFileSync(join(docs, "sitemap.xml"), "utf8"), /pranava0x0\.github\.io\/FERC-Orders-June-2026/, "sitemap uses the canonical host");
});

test("every inventoried comment has its body on disk (download completeness)", () => {
  // Regression for the bulk pull + the validation/recovery pass: catches a re-broken download,
  // a missing extension-heal, or a broken dir resolver. fitz-free (filesystem only).
  const C = join(here, "..", "sources", "comments");
  const inv = JSON.parse(readFileSync(join(C, "rm26-4-files.json"), "utf8")).files;
  const FILES = join(C, "files");
  const dirs = readdirSync(FILES);
  const dirForAcc = (acc) => dirs.find((d) => d === acc || d.startsWith(acc + "__"));
  const KNOWN_MISSING = new Set(["20251121-5225"]); // ETI: renders but won't download (issues.md)
  const missing = [];
  for (const [acc, files] of Object.entries(inv)) {
    if (!files || !files.length) continue; // genuinely attachment-less filing
    const dir = dirForAcc(acc);
    const ok = dir && readdirSync(join(FILES, dir)).some((f) => /\.(pdf|docx?|txt)$/i.test(f));
    if (!ok && !KNOWN_MISSING.has(acc)) missing.push(acc);
  }
  assert.deepEqual(missing, [], `every inventoried comment body is on disk (missing: ${missing.join(", ")})`);
});
