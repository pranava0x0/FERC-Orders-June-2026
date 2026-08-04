#!/usr/bin/env node
// tools/verify-commish-tailoring.mjs — verify the site's claim that each commissioner's concurring
// statement is VERBATIM across all six §206 orders, except a small, explicit allowlist of documented
// exceptions (docs/js/data.js's per-docket `commishAside` fields).
//
//   node tools/verify-commish-tailoring.mjs          # report + exit non-zero on any unexplained divergence
//
// Method: locate each commissioner's statement by its own "NAME, ROLE, concurring:" header (NOT by
// `commishPages`, which cites only the page of the headline pull-quote and can sit mid-statement — using
// it as a section boundary silently truncates the comparison). Diff every substantive sentence of each
// non-PJM order's statement against the PJM baseline using the project's own fuzzy matcher
// (carries()/loose() from verify-quotes.mjs), which tolerates the footnote/page-break splices the OCR
// layer interleaves — a naive substring check flags those splices as false "tailoring".
//
// This tool exists because the 2026-06-26 fix (issues.md) corrected an overclaim ("identical across all
// six") to a hedge ("largely common, with some per-order tailoring") based on a check that itself had the
// same false-positive problem this tool tolerates for. Redone properly (2026-08-03): four of five
// commissioners are fully verbatim; the fifth (Chang) has exactly one genuine addition, on CAISO (E-10).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { carries, loose } from "./verify-quotes.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p) => readFileSync(join(ROOT, ...p), "utf8");

function loadData() {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(read("docs", "js", "data.js"), ctx, { filename: "docs/js/data.js" });
  return ctx.window.FERC_DATA;
}

const ORDER_STEMS = {
  "E-7": "e-7-pjm-el26-67-000", "E-8": "e-8-miso-el26-70-000", "E-9": "e-9-spp-el26-68-000",
  "E-10": "e-10-caiso-el26-71-000", "E-11": "e-11-isone-el26-72-000", "E-12": "e-12-nyiso-el26-69-000",
};
const KEYS = ["swett", "rosner", "see", "chang", "lacerte"];
const NONPJM = ["E-8", "E-9", "E-10", "E-11", "E-12"];

// Known false positives from THIS TOOL's sentence-splitting, not real content divergence: a footnote
// happens to sit at a page break in one order but mid-paragraph in another, so a naive sentence boundary
// glues the footnote's citation text onto neighboring prose differently per order. Manually verified
// (2026-08-03) against the raw OCR text that each of these is the SAME footnote/sentence as the PJM
// baseline, just spliced differently — not a data.js `commishAside`, because there is no actual content
// difference to document. Matched by a short, distinctive substring so a real future change still trips it.
const KNOWN_OCR_NOISE = {
  swett: { "E-8": ["individual show cause 8 See"] },
  see: { "E-10": ["195 FERC ¶ 61,209"] },
  lacerte: { "E-8": ["Kenny Rogers, The Gambler"] },
};

// Documented exceptions: commissioner key -> docket item -> the exact additional note(s) already
// captured as that docket's `commishAside`. Anything else "novel" found is an UNEXPLAINED divergence —
// either new tailoring nobody surfaced yet, or a false positive in this tool's sentence-splitting that
// needs a look. Either way, the run should fail loudly rather than silently pass.
function allowedAsides(D) {
  const out = {}; // key -> item -> [noteText, ...]
  for (const d of D.dockets) {
    if (!d.commishAside) continue;
    for (const [key, aside] of Object.entries(d.commishAside)) {
      (out[key] ||= {})[d.item] = [...(out[key]?.[d.item] || []), aside.note];
    }
  }
  return out;
}

function rawOf(item) {
  return read("sources", "text", "orders", ORDER_STEMS[item] + ".txt").replace(/--- PAGE \d+ ---/g, " ");
}

// One commissioner's statement text per order, keyed by commissioner surname (lowercased), located by
// header text rather than by page number.
function statementSpans(item) {
  const text = rawOf(item);
  const re = /([A-Z]+),\s*(?:Chairman|Commissioner),\s*concurring:?/g;
  const hits = [...text.matchAll(re)].map((m) => ({ key: m[1].toLowerCase(), idx: m.index, end: m.index + m[0].length }));
  hits.sort((a, b) => a.idx - b.idx);
  const spans = {};
  for (let i = 0; i < hits.length; i++) {
    const start = hits[i].end;
    const end = i + 1 < hits.length ? hits[i + 1].idx : text.length;
    spans[hits[i].key] = text.slice(start, end).replace(/________+[\s\S]*$/, "");
  }
  return spans;
}

// Substantive prose sentences only: drop short fragments, footnote-numbered starts, and citation-heavy
// runs (a high digit density means the "sentence" is mostly a case cite / statute string that footnote
// splicing glued onto real prose, not a content difference worth flagging).
function sentences(text) {
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed
    .split(/(?<=[.;])\s+(?=[A-Z"“])/)
    .map((s) => s.trim())
    .filter((s) => loose(s).length >= 40)
    .filter((s) => !/^\d+\s/.test(s))
    .filter((s) => (s.match(/\d/g) || []).length < s.length * 0.15);
}

export function verifyCommishTailoring(D = loadData()) {
  const pjmSpans = statementSpans("E-7");
  const allowed = allowedAsides(D);
  const results = []; // { key, item, novel: [sentence,...], allowedCount, ok }

  for (const key of KEYS) {
    const pjmText = loose(pjmSpans[key] || "");
    for (const item of NONPJM) {
      const spans = statementSpans(item);
      const stmt = spans[key] || "";
      const noise = KNOWN_OCR_NOISE[key]?.[item] || [];
      const novel = sentences(stmt).filter((s) => !carries(s, pjmText)).filter((s) => !noise.some((n) => s.includes(n)));
      const allowedNotes = allowed[key]?.[item] || [];
      // A novel sentence is "explained" if it fuzzy-matches one of this docket's documented aside notes.
      const unexplained = novel.filter((s) => !allowedNotes.some((note) => carries(note, loose(s)) || carries(s, loose(note))));
      results.push({ key, item, novel, unexplained, allowedCount: allowedNotes.length, ok: unexplained.length === 0 });
    }
  }
  return results;
}

if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  const results = verifyCommishTailoring();
  const bad = results.filter((r) => !r.ok);
  console.log("Commissioner-statement tailoring check — every non-PJM order vs. the PJM baseline");
  console.log("=".repeat(78));
  console.log(`${results.length - bad.length}/${results.length} commissioner×order pairs: fully verbatim or match a documented commishAside.`);
  if (bad.length) {
    console.log("\nUnexplained divergence(s) — either new tailoring to add as a commishAside, or a false positive to investigate:");
    for (const r of bad) {
      console.log(`\n  ✗ ${r.key} / ${r.item}:`);
      for (const s of r.unexplained) console.log(`      • ${s.slice(0, 200)}${s.length > 200 ? "…" : ""}`);
    }
    console.log(`\nFAIL — ${bad.length} unexplained pair(s).`);
    process.exit(1);
  }
  console.log("\nOK.");
}
