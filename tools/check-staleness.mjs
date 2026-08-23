// Advisory staleness checker for the news-refresh loop (news-tracks-plan.md Part 4 step 4).
//
//   node tools/check-staleness.mjs            # report
//   node tools/check-staleness.mjs --strict   # exit 1 if anything is flagged
//
// Deliberately NOT part of `node --test`. Every check here is a comparison against today, so a CI
// test would start failing on a quiet Tuesday with no code change, and the fix is a human going and
// looking at eLibrary. It runs in the refresh loop, where an operator can act on it.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const STRICT = process.argv.includes("--strict");
const STALE_DAYS = 45; // an asOf older than this is worth a fresh sweep

function loadData() {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(join(ROOT, "docs", "js", "data.js"), "utf8"), ctx, { filename: "docs/js/data.js" });
  return ctx.window.FERC_DATA;
}

const D = loadData();
const today = new Date();
today.setHours(0, 0, 0, 0);
const isPast = (iso) => /^\d{4}-\d{2}-\d{2}$/.test(iso || "") && new Date(iso + "T00:00:00") < today;
const daysOld = (iso) => Math.floor((today - new Date(iso + "T00:00:00")) / 86400000);

const flags = [];
const flag = (area, msg) => flags.push({ area, msg });

// 1) The deadline-conversion rule. A dated deadline event that has passed may not sit there in the
//    future tense: the refresh either replaces it with what was observed, or appends an explicit
//    "window closed, nothing observed" event. We can't detect intent, so look for the marker language
//    the converted entries use and flag the rest for a human read.
for (const e of D.timeline || []) {
  if (e.kind !== "deadline" || !isPast(e.iso)) continue;
  const converted = /has closed|window closed|closed:|see the filing matrix|our checks/i.test(e.body || "");
  if (!converted) {
    flag("timeline", `passed deadline still reads as pending: "${e.title}" (${e.iso}). Convert it or append a window-closed event.`);
  }
}

// 2) Track clocks that have run out. A track card advertising a next date in the past is the most
//    visible way this site can look abandoned.
for (const [id, t] of Object.entries(D.tracks || {})) {
  if (t.next && isPast(t.next.date)) {
    flag("tracks", `track "${id}" next.date ${t.next.date} is in the past ("${t.next.label}"). Advance it or replace it.`);
  }
  if (t.status && isPast(t.status.asOf) && daysOld(t.status.asOf) > STALE_DAYS) {
    flag("tracks", `track "${id}" status is ${daysOld(t.status.asOf)} days old (${t.status.asOf}).`);
  }
}

// 3) Capture stamps.
for (const [label, iso] of [
  ["meta.newsCapture", D.meta?.newsCapture],
  ["procedural.filings.asOf", D.procedural?.filings?.asOf],
]) {
  if (!iso) flag("stamps", `${label} is missing.`);
  else if (daysOld(iso) > STALE_DAYS) flag("stamps", `${label} is ${daysOld(iso)} days old (${iso}).`);
}

// 4) Steps whose deadline has passed with nothing observed in any docket. Not necessarily wrong (the
//    checks may genuinely have found nothing), but it is the queue for the next eLibrary session.
//    A step FERC has formally reset (`revised`) is measured against the reset date instead: the
//    original date passing is then arithmetic, not a missed filing, and flagging it would read as a
//    coverage gap when the deadline simply moved.
const F = D.procedural?.filings;
if (F) {
  const stepById = Object.fromEntries((D.procedural.steps || []).map((s) => [s.id, s]));
  for (const stepId of F.steps || []) {
    const step = stepById[stepId];
    if (!step) continue;
    const operative = step.revised?.date || step.date;
    const observed = new Set((F.rows || []).filter((r) => r.step === stepId).map((r) => r.docket));
    // A docket can carry its own reset date for this step (SPP got 95 days rather than 90), so measure
    // each docket against its own where it has one. Flagging SPP on the day the OTHER five come due
    // would report a coverage gap that does not exist.
    const dueFor = (d) => (stepId === "showcause" && d.abeyance?.due) || operative;
    const missing = (D.dockets || [])
      .filter((d) => !observed.has(d.docket) && isPast(dueFor(d)))
      .map((d) => `${d.rto} (${dueFor(d)})`);
    if (missing.length) {
      flag("filings", `"${step.label}"${step.revised?.date ? " (revised)" : ""} passed with nothing observed for: ${missing.join(", ")}.`);
    }
  }
  const unverified = (F.rows || []).filter((r) => r.status === "filed-reported" || r.status === "signaled");
  if (unverified.length) {
    flag("filings", `${unverified.length} row(s) still press-sourced, awaiting an eLibrary accession: ` +
      unverified.map((r) => `${r.docket}/${r.step}`).join(", "));
  }
}

const byArea = flags.reduce((m, f) => ((m[f.area] = m[f.area] || []).push(f.msg), m), {});
console.log("Staleness check — docs/js/data.js against today’s date");
console.log("=".repeat(64));
if (!flags.length) {
  console.log("Nothing flagged.");
} else {
  for (const [area, msgs] of Object.entries(byArea)) {
    console.log(`\n${area}`);
    for (const m of msgs) console.log(`  • ${m}`);
  }
  console.log(`\n${flags.length} item(s) flagged. These are prompts for a refresh, not test failures.`);
}
if (STRICT && flags.length) process.exit(1);
