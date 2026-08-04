#!/usr/bin/env node
// tools/verify-commish-tailoring.mjs — verify the site's claim that each commissioner's concurring
// statement is VERBATIM across all six §206 orders, except a small, explicit allowlist of documented
// exceptions: docs/js/data.js's per-docket `commishAside` fields (genuine additions), and LaCerte's
// confirmed RTO-name substitution (checked separately by verifyLacerteSubstitution() below).
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
// KNOWN LIMITATION, load-bearing: carries()'s ~60-char LCS threshold proves a sentence is PRESENT
// somewhere in the target, not that it is IDENTICAL. A sentence with one phrase swapped (a region name)
// still shares long runs with the original on both sides of the swap and passes this check as "found" —
// it cannot see an in-place edit, only a whole sentence appearing or disappearing. This is exactly how
// an earlier version of this tool missed LaCerte's real tailoring and reported him "fully verbatim" (a
// 2026-08-04 PR review caught it). A general "present vs. identical" classifier was attempted and
// reverted: exact-matching sentences one-to-one broke on ordinary page-break splicing (which shifts
// sentence boundaries even for genuinely-identical prose across orders with different page counts),
// flooding the output with false positives worse than the blind spot it was meant to fix. LaCerte's
// specific, confirmed pattern is checked directly instead (verifyLacerteSubstitution()) rather than
// through a general in-place-edit detector.
//
// This tool exists because the 2026-06-26 fix (issues.md) corrected an overclaim ("identical across all
// six") to a hedge ("largely common, with some per-order tailoring") based on a check that had the same
// false-positive problem this tool tolerates for. Current state (2026-08-04): three of five commissioners
// (Swett, Rosner, See) are fully verbatim; Chang has exactly one genuine addition (a CAISO footnote,
// E-10); LaCerte's statement names the respondent RTO directly in several sentences per order and is NOT
// verbatim — confirmed, not a false positive. The site's displayed quotes for him don't happen to include
// any of the swapped sentences, so what's shown remains accurate; only the "verbatim" provenance claim
// about his statement as a whole was wrong, and is corrected in data.js.
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
// False positives found by the OMISSION direction of this check (added after a 2026-08-04 PR review
// caught that the original addition-only check would silently pass an empty/truncated extraction —
// see MIN_STMT_LEN below for the other half of that fix). Two distinct mechanisms, both verified
// against the raw OCR text, neither a real content difference:
//  - swett/E-10: `statementSpans()`'s "strip the trailing signature block" regex is too aggressive. A
//    footnote that continues past where a commissioner's printed signature sits on the page (a normal
//    PDF page-layout artifact) gets cut along with the real signature block. Confirmed present in
//    CAISO's raw text (sed on the surrounding lines), positioned textually AFTER the "Laura V. Swett /
//    Chairman" signature — that's the reordering, not a missing footnote. Affects only this one pair;
//    the comprehensive bidirectional check running uniformly over all 25 pairs would have caught any
//    other instance, so this is documented rather than fixed at the regex level.
//  - chang/E-8, lacerte/E-9 + E-11: long, citation-heavy footnote sentences (case cites with pincites,
//    "id." chains) get fragmented differently by each order's own page breaks and footnote renumbering
//    — badly enough that no single contiguous run reaches carries()'s LCS threshold, even though grep
//    confirms the text is present verbatim in every order checked ("PG&E and Smart Wires" in MISO;
//    "535 U.S. 17" in both SPP and ISO-NE, alongside their PJM occurrence).
const KNOWN_OCR_NOISE = {
  swett: { "E-8": ["individual show cause 8 See"], "E-10": ["is a natural consequence of complex, nuanced efforts", "will continue to evaluate Commission directives"] },
  see: { "E-10": ["195 FERC ¶ 61,209"] },
  chang: { "E-8": ["PG&E and Smart Wires"] },
  lacerte: { "E-8": ["Kenny Rogers, The Gambler"], "E-9": ["535 U.S. 17"], "E-11": ["535 U.S. 17"] },
};

// Rot guard: every entry above must actually match something real, or it's a stale filter silently
// suppressing nothing (harmless) — or worse, one that used to be a narrow, verified exception and is now
// matching something new and different (not harmless). A noise substring identifies a specific FLAGGED
// SENTENCE to skip, and that sentence can originate from either side of the comparison (the PJM baseline,
// for an omission being wrongly flagged; the target order, for an addition being wrongly flagged) — so a
// substring counts as live if it's found in EITHER the PJM (E-7) span or the target item's own span for
// that commissioner. Exported for a test to run.
export function verifyNoiseAllowlist() {
  const bad = [];
  for (const [key, byItem] of Object.entries(KNOWN_OCR_NOISE)) {
    const pjmStmt = (statementSpans("E-7")[key] || "").replace(/\s+/g, " ");
    for (const [item, substrings] of Object.entries(byItem)) {
      const targetStmt = (statementSpans(item)[key] || "").replace(/\s+/g, " ");
      for (const s of substrings) if (!pjmStmt.includes(s) && !targetStmt.includes(s)) bad.push({ key, item, substring: s });
    }
  }
  return bad;
}

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
// header text rather than by page number. Exported so a rot-guard test can check each KNOWN_OCR_NOISE
// entry still matches something real — an entry that matches nothing is either stale (the underlying
// text changed) or was never real to begin with, and either way should not silently keep suppressing.
export function statementSpans(item) {
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

// Real statements run 9,200-16,900 chars (checked 2026-08-03 across all 30 commissioner×order pairs);
// 3,000 is a floor with wide margin. Below it, `statementSpans()` almost certainly failed to find that
// commissioner's header (a truncated/empty `stmt` has nothing to compare, so the addition-only check
// below would silently report `ok: true` on a statement that was never actually read — caught in review).
const MIN_STMT_LEN = 3000;

export function verifyCommishTailoring(D = loadData()) {
  const pjmSpans = statementSpans("E-7");
  const allowed = allowedAsides(D);
  const results = []; // { key, item, novel, unexplained, omitted, tooShort, allowedCount, ok }

  for (const key of KEYS) {
    const pjmFull = pjmSpans[key] || "";
    const pjmText = loose(pjmFull);
    const pjmSentences = sentences(pjmFull);
    for (const item of NONPJM) {
      const spans = statementSpans(item);
      const stmt = spans[key] || "";
      const stmtText = loose(stmt);
      const noise = KNOWN_OCR_NOISE[key]?.[item] || [];
      const tooShort = stmt.length < MIN_STMT_LEN;

      // Additions: sentences in the non-PJM statement not found in PJM.
      const novel = sentences(stmt).filter((s) => !carries(s, pjmText)).filter((s) => !noise.some((n) => s.includes(n)));
      const allowedNotes = allowed[key]?.[item] || [];
      // A novel sentence is "explained" if it fuzzy-matches one of this docket's documented aside notes.
      const unexplained = novel.filter((s) => !allowedNotes.some((note) => carries(note, loose(s)) || carries(s, loose(note))));

      // Omissions (the reverse direction): every substantive PJM sentence must also carry into the
      // non-PJM statement. Without this, an empty or truncated `stmt` produces zero `novel` entries and
      // passes — omissions are never "explained" by a commishAside (that field documents additions only).
      const omitted = tooShort ? [] : pjmSentences.filter((s) => !carries(s, stmtText)).filter((s) => !noise.some((n) => s.includes(n)));

      const ok = !tooShort && unexplained.length === 0 && omitted.length === 0;
      results.push({ key, item, novel, unexplained, omitted, tooShort, stmtLen: stmt.length, allowedCount: allowedNotes.length, ok });
    }
  }
  return results;
}

// LaCerte's statement systematically names the respondent RTO by name in several sentences (verified
// 2026-08-04 against raw order text, after a PR review caught that the "verbatim in all six orders"
// claim was wrong for him specifically: "I expect PJM to design proposals" becomes "I expect CAISO
// and/or the Participating Transmission Owners to design proposals" in E-10, and the same pattern
// recurs for the other four). The sentence-level check above is structurally unable to see this kind of
// in-place edit: a sentence with one phrase swapped still shares long runs with the original on both
// sides of the swap, so it passes carries() as "present" even though it isn't the same sentence. A
// general "is this sentence merely present, or actually identical" classifier was attempted and
// reverted — it could not distinguish a real word swap from routine page-break/footnote splicing (which
// shifts sentence boundaries too, and floods a strict check with false positives). Instead, this checks
// the one thing that actually matters for catching a regression: LaCerte's substantive prose in every
// non-PJM order must not still say "PJM" outside the case-caption boilerplate at the top of his section
// (which legitimately cites "PJM Interconnection, L.L.C." in a footnote common to all six orders) — if
// it does, the known substitution didn't happen, or happened incompletely.
const CAPTION_BLEED_CHARS = 700; // party-list/footnote-citation text before LaCerte's own prose begins
// Two "PJM" mentions are legitimate and expected in every non-PJM order, confirmed identical across all
// five (2026-08-04): a historical/narrative reference ("the odyssey that we embarked upon first with
// PJM, then SPP, we now aggressively extend...") and a footnote citing the actual PJM Co-Location Order
// by its case name. Both are invariant facts, not addressee references, so they correctly stay "PJM"
// regardless of which order you're reading — unlike "I expect PJM to design proposals," which is a
// direct address to the respondent and does get substituted.
// "embarked upon first with" (the text before "PJM") is sometimes pushed outside the 40-char window by
// a page-break artifact landing right before it (e.g. MISO's "Docket No. EL26-70-000 - 3 -" bleed) — the
// after-side anchor catches that case since the splice never lands between "PJM" and what follows it.
const LACERTE_EXPECTED_PJM_MENTIONS = ["embarked upon first with", "then SPP, we now aggressively extend", "citing PJM Co-Location Order"];
export function verifyLacerteSubstitution(D = loadData()) {
  const results = [];
  for (const item of NONPJM) {
    const spans = statementSpans(item);
    const stmt = spans.lacerte || "";
    const body = stmt.slice(CAPTION_BLEED_CHARS).replace(/\s+/g, " ");
    const mentions = [...body.matchAll(/.{0,40}\bPJM\b.{0,40}/g)]
      .map((m) => m[0].trim())
      .filter((m) => !LACERTE_EXPECTED_PJM_MENTIONS.some((e) => m.includes(e)));
    results.push({ item, stmtLen: stmt.length, mentions, ok: stmt.length >= MIN_STMT_LEN && mentions.length === 0 });
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
      if (r.tooShort) console.log(`      ⚠ statement extraction suspiciously short (${r.stmtLen} chars, floor ${MIN_STMT_LEN}) — header regex likely failed to match; nothing meaningfully compared`);
      for (const s of r.unexplained) console.log(`      + added: ${s.slice(0, 200)}${s.length > 200 ? "…" : ""}`);
      for (const s of r.omitted) console.log(`      - missing: ${s.slice(0, 200)}${s.length > 200 ? "…" : ""}`);
    }
    console.log(`\nFAIL — ${bad.length} unexplained pair(s).`);
    process.exit(1);
  }
  console.log("\nOK.");

  const lacerte = verifyLacerteSubstitution();
  const lacerteBad = lacerte.filter((r) => !r.ok);
  console.log("\nLaCerte RTO-name substitution check — 'PJM' must not remain in his non-PJM statements");
  console.log("=".repeat(78));
  for (const r of lacerte) console.log(`  ${r.item}: ${r.mentions.length} leftover "PJM" mention(s)${r.stmtLen < MIN_STMT_LEN ? " [TOO SHORT]" : ""}`);
  if (lacerteBad.length) {
    for (const r of lacerteBad) for (const m of r.mentions) console.log(`    ✗ ${r.item}: …${m}…`);
    console.log(`\nFAIL — ${lacerteBad.length} order(s) with an unsubstituted "PJM" mention.`);
    process.exit(1);
  }
  console.log("OK — substitution confirmed complete in all five non-PJM orders.");
}
