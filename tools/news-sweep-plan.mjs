#!/usr/bin/env node
/* Build the query matrix for a news sweep, and validate what the sweep brings back.
 *
 * Searching is the expensive part of a refresh and the easiest to do badly: it drifts toward whatever
 * the search engine surfaces rather than what the site is actually missing. This tool makes the plan
 * deterministic. It knows every entity the site already tracks (dockets, citations, commissioners,
 * the 42 named voices, every SOURCES capture date) and emits a prioritized, deduplicated query list
 * with an explicit "since" date per lane, so the person or agent doing the searching spends its budget
 * on gaps rather than re-confirming what is already cited.
 *
 *   node tools/news-sweep-plan.mjs                 # print the plan (grouped, prioritized)
 *   node tools/news-sweep-plan.mjs --json          # same, machine-readable, for an agent prompt
 *   node tools/news-sweep-plan.mjs --queries 40    # cap the list (default 60)
 *   node tools/news-sweep-plan.mjs --check <file>  # validate a findings JSON before merging it
 *
 * The findings file the sweep writes back is checked, not trusted: every finding needs a url, a
 * publisher, a `published` date inside the window, and either a verbatim `quote` plus the `speaker` who
 * said it, or an explicit `snippetOnly: true`. That mirrors the site's own rule that a snippet-only
 * finding is a lead, never a publishable fact (REFRESH.md).
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (flag, dflt) => { const i = process.argv.indexOf(flag); return i === -1 ? dflt : process.argv[i + 1]; };

function loadData() {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(join(ROOT, "docs", "js", "data.js"), "utf8"), ctx);
  return ctx.window.FERC_DATA;
}

// ---- the vocabulary -------------------------------------------------------------------------
// Deliberately broad, and split by lane so a sweep can be run partially. Entity terms are pulled from
// the data where they exist (dockets, citations, commissioners, voices) so the plan cannot drift out of
// sync with the site; topic and event terms are curated, because they encode what this proceeding is
// actually about and no field on the site holds them.

const TOPIC_TERMS = [
  "large load interconnection", "show cause order", "data center interconnection",
  "co-located load", "behind-the-meter generation", "behind-the-meter netting",
  "Interim Network Integration Transmission Service", "Interim NITS",
  "contract demand transmission service", "flexible load service", "curtailable load",
  "bring your own generation", "electrically proximate generation",
  "cost causation", "cost shifting", "network upgrade cost allocation", "ratepayer protection",
  "speed to power", "interconnection queue reform", "large load tariff",
  "resource adequacy", "capacity auction", "reliability backstop procurement",
  "RTO governance reform", "stakeholder process reform",
  "load forecasting transparency", "NERC large load registration",
];

// What actually happened in the window. These are the terms that separate a July article from an
// August one, and the reason a topic-only sweep would miss the whole story.
const EVENT_TERMS = [
  "held in abeyance", "abeyance granted", "motion to hold in abeyance",
  "rescind show cause order", "non-public utility rescission",
  "November 16 2026 deadline", "90-day abeyance", "95 days",
  "errata show cause order", "partial compliance filing",
  "section 205 tariff filing", "extension of time co-location",
  "post-technical conference comments", "protest backstop auction",
];

const ELECTED_TERMS = [
  "senator data center electricity costs", "governor data center ratepayer",
  "state legislators data center transmission costs", "attorney general data center rates",
  "congressional letter FERC data center", "state commission FERC large load",
  "consumer advocate FERC data center costs",
];

// `rm264` has no dated clock of its own, so it is not in LANES, but a finding may legitimately be
// filed against it. Keep the two lists adjacent so they cannot drift.
const LANE_IDS = ["sc6", "e2", "gov", "context", "rm264"];
const LANES = [
  { id: "sc6", label: "The six-market §206 clock", since: "trackAsOf:sc6" },
  { id: "e2", label: "PJM co-location EL25-49", since: "trackAsOf:e2" },
  { id: "gov", label: "PJM governance AD26-7", since: "trackAsOf:gov" },
  { id: "context", label: "Market context", since: "trackAsOf:context" },
];

// ---- plan builder ---------------------------------------------------------------------------

function buildPlan(D, { windowStart, windowEnd, cap }) {
  const dockets = [...new Set(D.dockets.map((d) => d.docket.replace(/-000$/, "")))];
  const citations = [
    ...new Set(D.dockets.flatMap((d) => [d.cite, d.abeyance?.cite].filter(Boolean))),
  ];
  const commissioners = (D.commissioners || []).map((c) => c.name).filter(Boolean);
  const voices = (D.voices || []).map((v) => v.name).filter(Boolean);
  const rtos = D.dockets.map((d) => d.rto);

  // Every host already cited, so the sweep can tell "new outlet" from "outlet we already read" — and
  // every exact URL, which matters more. A host-only check passes an article the site already cites,
  // and a sweep will re-surface those: the first run of this tool returned two "new" commissioner
  // quotes that were already in news-evidence.json, from an article already in SOURCES as `udgov`.
  const knownHosts = new Set();
  const knownUrls = new Map(); // normalized url -> SOURCES key, so a duplicate names itself
  const normUrl = (u) => String(u).replace(/^https?:\/\/(www\.)?/, "").replace(/[/?#]+$/, "").toLowerCase();
  for (const [key, s] of Object.entries(D.SOURCES || {})) {
    try { knownHosts.add(new URL(s.url).hostname.replace(/^www\./, "")); } catch { /* non-URL source */ }
    if (s.url) knownUrls.set(normUrl(s.url), key);
  }
  // The newest capture on the site: anything older than this is not news to us.
  const captures = Object.values(D.SOURCES || {}).map((s) => s.published || s.captured).filter(Boolean);
  const newestCapture = captures.sort().at(-1) || windowStart;

  const q = [];
  const add = (lane, priority, query, why) => q.push({ lane, priority, query, why });

  // P1 — the event lane. What changed in the window, in the words a reporter would use.
  for (const t of EVENT_TERMS) add("sc6", 1, `FERC ${t} large load ${windowEnd.slice(0, 4)}`, "event term for the window");
  for (const d of dockets) add("sc6", 1, `FERC ${d} abeyance ruling`, `docket ${d} status`);

  // P1 — statements by the people whose words the site quotes directly.
  for (const c of commissioners) {
    add("sc6", 1, `"${c}" FERC large load show cause order statement`, "commissioner on the orders");
    add("gov", 2, `"${c}" PJM governance remarks`, "commissioner on governance");
  }
  for (const t of ELECTED_TERMS) add("context", 1, t, "elected official / advocate reaction");

  // P2 — the existing voices, to catch an updated take rather than a new speaker.
  for (const v of voices) add("sc6", 2, `"${v}" FERC show cause large load`, "existing voice, updated take");

  // P2 — citations, which only a specialist outlet would use, so they surface analysis not aggregation.
  for (const c of citations) add("sc6", 2, `"${c}"`, "reporter citation, finds specialist coverage");

  // P3 — the broad topical net, per RTO, to catch outlets not yet in SOURCES.
  for (const t of TOPIC_TERMS) add("sc6", 3, `${t} FERC ${windowEnd.slice(0, 4)}`, "topic term");
  for (const r of rtos) add("sc6", 3, `${r} large load tariff filing FERC`, `region ${r}`);

  const seen = new Set();
  const queries = q
    .filter((x) => { const k = x.query.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => a.priority - b.priority)
    .slice(0, cap);

  return {
    window: { start: windowStart, end: windowEnd },
    newestCapture,
    knownHosts: [...knownHosts].sort(),
    knownUrls: Object.fromEntries(knownUrls),
    lanes: LANES.map((l) => ({ ...l, since: D.tracks?.[l.id]?.status?.asOf || windowStart })),
    counts: { generated: q.length, deduped: seen.size, returned: queries.length },
    queries,
  };
}

// ---- findings validation --------------------------------------------------------------------
// A findings file is data coming back from an untrusted sweep, so it is checked the way the comment
// summaries are: shape, window, and evidence. Nothing here judges whether a claim is TRUE — only
// whether it is the kind of thing that may ship without further verification.

export function checkFindings(findings, { windowStart, windowEnd, knownHosts = [], knownUrls = {}, knownQuotes = [] }) {
  const errs = [];
  const warn = [];
  if (!Array.isArray(findings)) return { errs: ["findings must be an array"], warn };
  const known = new Set(knownHosts);
  findings.forEach((f, i) => {
    const at = `finding[${i}]${f.speaker ? ` (${f.speaker})` : ""}`;
    // Parse rather than prefix-test: "https://" satisfies /^https?:\/\// but throws in `new URL`, and the
    // catch below assumed any throw had already been reported, so a malformed URL passed with 0 errors.
    let parsedUrl = null;
    try { parsedUrl = f.url ? new URL(f.url) : null; } catch { parsedUrl = null; }
    if (!parsedUrl || !/^https?:$/.test(parsedUrl.protocol) || !parsedUrl.hostname)
      errs.push(`${at}: needs a valid http(s) url (got ${JSON.stringify(f.url)})`);
    if (!f.publisher) errs.push(`${at}: needs a publisher`);
    if (!f.published || !/^\d{4}-\d{2}-\d{2}$/.test(f.published)) errs.push(`${at}: needs an ISO published date`);
    else if (f.published < windowStart || f.published > windowEnd)
      errs.push(`${at}: published ${f.published} is outside the sweep window ${windowStart}..${windowEnd}`);
    if (f.snippetOnly) {
      warn.push(`${at}: snippet-only, ships as a lead not a fact`);
    } else {
      if (!f.quote) errs.push(`${at}: needs a verbatim quote, or snippetOnly: true`);
      if (!f.speaker) errs.push(`${at}: a quote needs the speaker who said it`);
      if (f.quote && f.quote.length < 25) errs.push(`${at}: quote too short to be worth attributing`);
    }
    if (!f.lane) errs.push(`${at}: needs a lane (${LANE_IDS.join(" | ")})`);
    else if (!LANE_IDS.includes(f.lane)) errs.push(`${at}: unknown lane "${f.lane}" (expected ${LANE_IDS.join(" | ")})`);
    if (parsedUrl) {
      const host = parsedUrl.hostname.replace(/^www\./, "");
      if (!known.has(host)) warn.push(`${at}: ${host} is a NEW outlet, not yet in SOURCES`);
      const norm = String(f.url).replace(/^https?:\/\/(www\.)?/, "").replace(/[/?#]+$/, "").toLowerCase();
      if (knownUrls[norm]) errs.push(`${at}: this exact URL is ALREADY cited as SOURCES.${knownUrls[norm]} — not a new finding`);
    }
    // A quote we already display is not new even from a different write-up of the same remarks. Two
    // guards against false positives, because this is a WARNING, not a rejection: a short quote can be
    // an innocent substring of a long evidence blob (a 42-char span inside the PJM auction blob matched
    // an unrelated quote about a different auction), so require a substantial overlap before saying so.
    if (f.quote) {
      const q = f.quote.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      const MIN_OVERLAP = 60;
      const hit = q.length >= MIN_OVERLAP && knownQuotes.find((k) => k.includes(q) || (k.length >= MIN_OVERLAP && q.includes(k)));
      if (hit) warn.push(`${at}: this quote looks ALREADY captured in news-evidence.json — check before treating it as new`);
    }
  });
  return { errs, warn };
}

// ---- cli -------------------------------------------------------------------------------------
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const D = loadData();
  const windowStart = arg("--from", "2026-07-01");
  // Today, not meta.newsCapture: a sweep runs BEFORE the capture stamp is bumped, so defaulting to the
  // stamp would reject every article published since the last refresh.
  const windowEnd = arg("--to", new Date().toISOString().slice(0, 10));
  const capRaw = arg("--queries", "60");
  const cap = parseInt(capRaw, 10);
  if (!Number.isFinite(cap) || cap < 1) {
    console.error(`--queries needs a positive integer (got ${JSON.stringify(capRaw)}). An empty plan reads as "nothing to sweep".`);
    process.exit(2);
  }

  // `--check` with no operand (or an empty shell variable) used to fall through to the ordinary plan and
  // exit 0, so an automated refresh would read "validated" from a run that validated nothing.
  if (process.argv.includes("--check")) {
    const operand = arg("--check", null);
    if (!operand || operand.startsWith("--")) {
      console.error("--check needs a findings file. Refusing to print a plan and exit 0, which would read as a clean validation.");
      process.exit(2);
    }
  }
  const checkFile = arg("--check", null);
  if (checkFile) {
    if (!existsSync(checkFile)) { console.error(`no such findings file: ${checkFile}`); process.exit(1); }
    const parsed = JSON.parse(readFileSync(checkFile, "utf8"));
    const findings = Array.isArray(parsed) ? parsed : (parsed && parsed.findings);
    if (!Array.isArray(findings)) {
      console.log(`FAIL  ${checkFile}: expected an array of findings, or an object with a "findings" array.`);
      process.exit(1);
    }
    const plan = buildPlan(D, { windowStart, windowEnd, cap });
    // Everything already displayed, so a finding cannot be "new" just because a sweep resurfaced it.
    const evPath = join(ROOT, "sources", "news-evidence.json");
    const knownQuotes = existsSync(evPath)
      ? Object.values(JSON.parse(readFileSync(evPath, "utf8")).items || {})
          .map((v) => String(v.evidence || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim())
          .filter((x) => x.length > 30)
      : [];
    const { errs, warn } = checkFindings(findings, {
      windowStart, windowEnd, knownHosts: plan.knownHosts, knownUrls: plan.knownUrls, knownQuotes,
    });
    for (const w of warn) console.log(`WARN  ${w}`);
    for (const e of errs) console.log(`FAIL  ${e}`);
    console.log(`\n${findings.length} finding(s): ${errs.length} error(s), ${warn.length} warning(s).`);
    process.exit(errs.length ? 1 : 0);
  }

  const plan = buildPlan(D, { windowStart, windowEnd, cap });
  if (process.argv.includes("--json")) { console.log(JSON.stringify(plan, null, 2)); process.exit(0); }

  console.log(`News sweep plan — window ${plan.window.start} to ${plan.window.end}`);
  console.log("=".repeat(70));
  console.log(`Newest source already on the site: ${plan.newestCapture}`);
  console.log(`Outlets already cited: ${plan.knownHosts.length}`);
  console.log(`Per-lane "new since": ${plan.lanes.map((l) => `${l.id}=${l.since}`).join("  ")}`);
  console.log(`Queries: ${plan.counts.generated} generated, ${plan.counts.deduped} unique, ${plan.counts.returned} returned\n`);
  let last = null;
  for (const q of plan.queries) {
    if (q.priority !== last) { console.log(`\n── P${q.priority} ──`); last = q.priority; }
    console.log(`  [${q.lane}] ${q.query}`.padEnd(78) + `· ${q.why}`);
  }
}
