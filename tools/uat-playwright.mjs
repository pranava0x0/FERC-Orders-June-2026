// Headless UAT sweep: the REFRESH.md console check, run at two viewports, plus measured reader depth.
//
//   python3 -m http.server 8131 --directory docs &      # serve first; 127.0.0.1, never localhost
//   node tools/uat-playwright.mjs                        # tables to stdout, exit 1 on any failure
//   node tools/uat-playwright.mjs --base URL --out DIR   # default base http://127.0.0.1:8131/
//   node tools/uat-playwright.mjs --json                 # the full result object on stdout instead
//
// Needs only `playwright` (resolved from Node's global path; the repo stays dependency-free). Writes
// exactly two screenshots (the Overview above the fold, 375x812 and 1280x800) plus results.json to --out
// (default: <os tmpdir>/ferc-uat), so no binary lands in the repo.
//
// What fails the run (exit 1): a tab or Comments sub-tab that never rendered (no panel, empty text, or the
// route did not select it), the words "undefined"/"NaN" in rendered text or in an href/aria-label/title,
// horizontal overflow on any panel, any console error or uncaught page error, any failed or >=400 request,
// and a reader goal whose target cannot be found or never comes into view. Every check reports how many
// things it looked at, and an empty set is a failure, never a pass.
//
// Interaction depth, per reader goal, from a fresh load of the Overview (base URL, no hash):
//   clicks  taps on real elements, each preceded by the scroll needed to bring that element into view
//   typed   keyboard entries (one per field filled)
//   hswipe  horizontal swipes inside an overflow-x container (the tablist at 375px)
//   scroll  total vertical scroll, in viewport heights, measured from window.scrollY before/after
// "In view" means the element's top edge sits below the sticky tablist and its first min(h, 40) px are
// above the viewport bottom, read from getBoundingClientRect after every step. Each goal has candidate
// paths; the reported one minimises clicks + typed + hswipe + scroll (one viewport of scroll costs the
// same as one tap). Clicks are dispatched with el.click() AFTER the measured scroll, so Playwright's own
// auto-scroll never hides a scroll the reader would have had to do.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const argv = process.argv.slice(2);
const arg = (name, def) => { const i = argv.indexOf(name); return i >= 0 && argv[i + 1] ? argv[i + 1] : def; };
const BASE = arg("--base", "http://127.0.0.1:8131/");
const OUT = resolve(arg("--out", join(tmpdir(), "ferc-uat")));
const JSON_OUT = argv.includes("--json");
const WAIT = 700;
const FALLBACK_CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const EXPECTED_TABS = ["overview", "timeline", "reforms", "dockets", "comments", "news"];
const VIEWPORTS = [
  { name: "mobile", width: 375, height: 812, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { name: "desktop", width: 1280, height: 800, isMobile: false, hasTouch: false, deviceScaleFactor: 1 },
];

// ---- reader goals: candidate paths, each a list of steps and a target resolver (page-side source) ----
// Step kinds: { click: <resolver> }, { open: <resolver of a <details>> } (taps its summary only when
// closed), { type: <resolver>, text }. A resolver is a JS expression evaluated in the page that yields an
// Element or null. `label` is what the report prints for the step.
const Q = (sel) => `document.querySelector(${JSON.stringify(sel)})`;
const GOALS = [
  { id: "a", goal: "Current status line of the §206 track (Where things stand)", candidates: [
    { steps: [], target: `(document.querySelector('.stand-row a[href$="/sc6"]')||{}).closest?.('.stand-row')?.querySelector('.stand-line')||null` },
    { steps: [{ label: "tab Timeline", click: Q("#tab-timeline") }], target: Q('.trk-card[data-track="sc6"] .trk-status') },
  ] },
  { id: "b", goal: "Next deadline", candidates: [
    { steps: [], target: `(()=>{const e=document.getElementById('masthead-fresh');return e&&!e.hidden?e:null})()` , note: "masthead chip" },
    { steps: [], target: Q('.proc-step[aria-current="date"]'), note: "procedural board 'next' row" },
  ] },
  { id: "c", goal: "Filing matrix (procedural board, what has been filed)", candidates: [
    { steps: [], target: Q("#fm-h") },
    { steps: [{ label: "Overview jump: Filing matrix", click: Q('.jump-btn[data-jump="#fm-h"]') }], target: Q("#fm-h") },
  ] },
  { id: "d", goal: "Commissioner statements", candidates: [
    { steps: [], target: Q(".commish-list .commish-rowcard") },
    { steps: [{ label: "Overview jump: Commissioners", click: Q('.jump-btn[data-jump="#commish-h"]') }], target: Q(".commish-list .commish-rowcard") },
    { steps: [{ label: "tab Dockets", click: Q("#tab-dockets") }, { label: "open E-7 commissioner block", open: Q("#panel-dockets details.docket details.dcom") }],
      target: Q("#panel-dockets details.docket details.dcom[open] .commish-row") },
  ] },
  { id: "e", goal: "Newest timeline event (latest dated on or before today)", candidates: [
    { steps: [{ label: "tab Timeline", click: Q("#tab-timeline") }], target: "__newestEvent()" },
    { steps: [{ label: "Where-things-stand link for that event's track", click: "__newestTrackLink()" }], target: "__newestEvent()" },
    { steps: [{ label: "tab Timeline", click: Q("#tab-timeline") }, { label: "Jump to the latest event", click: Q("#tl-jump") }], target: "__newestEvent()" },
  ] },
  { id: "f", goal: "EL26-67 order PDF link (Dockets tab)", candidates: [
    { steps: [{ label: "tab Dockets", click: Q("#tab-dockets") }, { label: "open the EL26-67 card", open: "__docket('EL26-67')" }],
      target: `(__docket('EL26-67')||document).querySelector('.order-link')` },
  ] },
  { id: "g", goal: "Comments by-issue policy map", candidates: [
    { steps: [{ label: "tab Comments", click: Q("#tab-comments") }, { label: "sub-tab By issue", click: Q("#cmsub-issue") }], target: Q("#cmsec-issue .cm-pm-landing") },
    { steps: [{ label: "tab Comments", click: Q("#tab-comments") }, { label: "policy-map promo card", click: Q(".cm-pm-promo") }], target: Q("#cmsec-issue .cm-pm-landing") },
    { steps: [{ label: "procedural board 'record issues' link", click: Q("#panel-overview a.proc-lands") }], target: Q("#cmsec-issue .cm-pm-landing") },
  ] },
  { id: "h", goal: "A comment by organisation via All-comments search (Constellation)", candidates: [
    { steps: [{ label: "tab Comments", click: Q("#tab-comments") }, { label: "sub-tab All comments", click: Q("#cmsub-summaries") },
      { label: "tap search box", click: Q("#cm-search") }, { label: "type 'Constellation'", type: Q("#cm-search"), text: "Constellation" }],
      target: `[...document.querySelectorAll('#cmsec-summaries .cm-row:not([hidden])')].find(r=>/Constellation/i.test(r.querySelector('.cm-row-org')?.textContent||''))||null` },
  ] },
  { id: "i", goal: "Latest news / Discourse quote", candidates: [
    { steps: [{ label: "tab Discourse", click: Q("#tab-news") }, { label: "open 'Commentary themes'", open: "__accWith('.wave')" }], target: "__latestQuote()" },
  ] },
];

// Page-side helpers the resolvers above call. Installed on every page before any script runs.
const HELPERS = `
window.__docket = (id) => [...document.querySelectorAll('#panel-dockets details.docket')].find(d => d.querySelector('summary')?.textContent.includes(id) || d.textContent.includes(id + '-000')) || null;
window.__accWith = (sel) => [...document.querySelectorAll('details.acc')].find(d => d.querySelector(sel) && d.offsetParent !== null) || null;
window.__newestIdx = () => { const D = window.FERC_DATA, today = new Date().toISOString().slice(0, 10); let best = -1;
  (D.timeline || []).forEach((e, i) => { const iso = String(e.iso || '').slice(0, 10); if (iso && iso <= today && (best < 0 || iso >= String(D.timeline[best].iso).slice(0, 10))) best = i; }); return best; };
window.__newestEvent = () => { const i = __newestIdx(); return i < 0 ? null : (document.querySelectorAll('#panel-timeline .tl-item')[i] || null); };
window.__newestTrackLink = () => { const i = __newestIdx(); const t = i < 0 ? null : window.FERC_DATA.timeline[i].track; return t ? document.querySelector('.stand-link[href="#timeline/track/' + t + '"]') : null; };
window.__latestQuoteText = () => { const D = window.FERC_DATA; let best = null;
  (D.voiceThemes || []).forEach(t => (t.quotes || []).forEach(q => { const s = D.SOURCES[q.src] || {}; const d = s.published || s.captured || '';
    if (!best || d > best.d) best = { d, q: q.q }; })); return best; };
window.__latestQuote = () => { const b = __latestQuoteText(); if (!b) return null;
  return [...document.querySelectorAll('#panel-news blockquote')].find(x => x.textContent.includes(b.q.slice(0, 40))) || null; };
`;

// ---------------------------------------------------------------------------------------------------
const failures = [];
const fail = (vp, area, msg) => failures.push({ viewport: vp, area, msg });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch() {
  try { return await chromium.launch(); }
  catch (e) {
    if (!existsSync(FALLBACK_CHROME)) throw e;
    return chromium.launch({ executablePath: FALLBACK_CHROME });
  }
}

function watch(page, sink) {
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") sink.console.push({ type: m.type(), text: m.text() }); });
  page.on("pageerror", (e) => sink.console.push({ type: "pageerror", text: String(e.message || e) }));
  page.on("requestfailed", (r) => sink.failedRequests.push({ url: r.url(), reason: r.failure()?.errorText || "failed" }));
  page.on("response", (r) => { sink.responses++; if (r.status() >= 400) sink.failedRequests.push({ url: r.url(), reason: "HTTP " + r.status() }); });
}

async function freshPage(browser, vp, sink) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor });
  await ctx.addInitScript(HELPERS);
  const page = await ctx.newPage();
  watch(page, sink);
  await page.goto(BASE, { waitUntil: "load" });
  await page.waitForFunction(() => (document.getElementById("panel-overview")?.innerText || "").length > 0, null, { timeout: 10000 });
  await sleep(WAIT);
  return { ctx, page };
}

// ---- 1. panel sweep + performance ----
async function sweep(browser, vp, sink) {
  const { ctx, page } = await freshPage(browser, vp, sink);
  const perf = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const res = performance.getEntriesByType("resource").map((r) => ({ name: r.name.replace(location.origin, ""), type: r.initiatorType, transferSize: r.transferSize, bodySize: r.encodedBodySize }));
    const total = (nav ? nav.transferSize : 0) + res.reduce((a, r) => a + r.transferSize, 0);
    return { loadMs: nav ? Math.round(nav.loadEventEnd - nav.startTime) : null, dclMs: nav ? Math.round(nav.domContentLoadedEventEnd - nav.startTime) : null,
      documentBytes: nav ? nav.transferSize : null, resources: res, totalBytes: total, requests: 1 + res.length, domNodes: document.getElementsByTagName("*").length };
  });
  mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: join(OUT, `overview-${vp.width}x${vp.height}.png`) });

  const tabs = await page.$$eval('.tabs [role="tab"][data-tab]', (els) => els.map((e) => e.getAttribute("data-tab")));
  if (!tabs.length) fail(vp.name, "tabs", "no tabs found in the tablist");
  for (const t of EXPECTED_TABS) if (!tabs.includes(t)) fail(vp.name, "tabs", `expected tab #${t} missing from the tablist`);

  const views = [];
  for (const t of tabs) views.push({ tab: t, hash: "#" + t, sel: "#panel-" + t });
  if (tabs.includes("comments")) {
    const subs = await page.evaluate(() => (window.CommentsRoute && window.CommentsRoute.SUBS) || []);
    if (!subs.length) fail(vp.name, "comments", "CommentsRoute.SUBS is empty: no sub-tabs to check");
    for (const s of subs) views.push({ tab: "comments", sub: s, hash: "#comments/" + s, sel: "#cmsec-" + s });
  }
  const panels = [];
  for (const v of views) {
    await page.evaluate((h) => { location.hash = h; }, v.hash);
    await sleep(WAIT);
    const m = await page.evaluate(({ sel, tab, sub }) => {
      const p = document.querySelector(sel);
      const tabSel = document.getElementById("tab-" + tab)?.getAttribute("aria-selected") === "true";
      const subSel = sub ? document.getElementById("cmsub-" + sub)?.getAttribute("aria-selected") === "true" : true;
      if (!p) return { missing: true, tabSel, subSel };
      const text = p.innerText || "";
      const holes = [];
      p.querySelectorAll("[href],[aria-label],[title]").forEach((el) => ["href", "aria-label", "title"].forEach((a) => {
        const val = el.getAttribute(a); if (val && /\b(undefined|NaN)\b/.test(val)) holes.push(a + "=" + val.slice(0, 80));
      }));
      const de = document.documentElement;
      return { missing: false, tabSel, subSel, hidden: p.hidden || p.offsetParent === null, len: text.length,
        undef: /\bundefined\b/.test(text), nan: /\bNaN\b/.test(text), attrHoles: holes, overflowX: de.scrollWidth - de.clientWidth,
        nodes: p.getElementsByTagName("*").length, docNodes: document.getElementsByTagName("*").length,
        heightVh: +(de.scrollHeight / innerHeight).toFixed(1), panelPx: Math.round(p.getBoundingClientRect().height) };
    }, v);
    const name = v.sub ? `comments/${v.sub}` : v.tab;
    panels.push({ name, ...m });
    if (m.missing) { fail(vp.name, name, `panel ${v.sel} not in the DOM`); continue; }
    if (!m.tabSel || !m.subSel) fail(vp.name, name, `route ${v.hash} did not select its tab/sub-tab`);
    if (m.hidden) fail(vp.name, name, "panel is hidden after routing to it");
    if (!m.len) fail(vp.name, name, "panel rendered no text");
    if (m.undef) fail(vp.name, name, "rendered text contains 'undefined'");
    if (m.nan) fail(vp.name, name, "rendered text contains 'NaN'");
    if (m.attrHoles.length) fail(vp.name, name, `${m.attrHoles.length} attribute(s) contain undefined/NaN: ${m.attrHoles[0]}`);
    if (m.overflowX !== 0) fail(vp.name, name, `horizontal overflow ${m.overflowX}px`);
  }
  if (!panels.length) fail(vp.name, "panels", "no panels were checked");
  const afterSweepRequests = await page.evaluate(() => 1 + performance.getEntriesByType("resource").length);
  await ctx.close();
  return { perf: { ...perf, requestsAfterSweep: afterSweepRequests }, panels };
}

// ---- 2. interaction depth ----
// Measured geometry of an element relative to the viewport and the sticky tablist.
async function geom(page, handle) {
  return page.evaluate((el) => {
    if (!el || !el.isConnected) return null;
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) return { visible: false };
    const tabs = document.querySelector(".tabs");
    const tr = tabs ? tabs.getBoundingClientRect() : null;
    const occ = tr && tr.top <= 0.5 && !tabs.contains(el) ? tr.bottom : 0;   // stuck tablist covers the top
    return { visible: true, top: r.top, left: r.left, right: r.right, h: r.height, vh: innerHeight, vw: innerWidth, occ };
  }, handle);
}

async function resolveEl(page, expr) {
  const h = await page.evaluateHandle(`(() => { try { return ${expr}; } catch (e) { return null; } })()`);
  const el = h.asElement();
  if (!el) { await h.dispose(); return null; }
  return el;
}

// Bring `expr` into view as a reader would, counting the scroll. Returns {ok, scrollPx, hswipe}.
async function bringIntoView(page, expr) {
  let scrollPx = 0, hswipe = 0;
  for (let i = 0; i < 4; i++) {
    const el = await resolveEl(page, expr);
    const g = el && await geom(page, el);
    if (!g || !g.visible) { if (el) await el.dispose(); return { ok: false, scrollPx, hswipe, why: el ? "not visible" : "not found" }; }
    const need = Math.min(g.h, 40);
    let dy = 0;
    if (g.top < g.occ) dy = g.top - g.occ - 8;
    else if (g.top + need > g.vh) dy = g.top + need - g.vh;
    if (g.left < 0 || g.right > g.vw) {             // horizontally clipped: swipe the scroll container
      const moved = await page.evaluate((e) => {
        let c = e.parentElement;
        while (c && !(/(auto|scroll)/.test(getComputedStyle(c).overflowX) && c.scrollWidth > c.clientWidth)) c = c.parentElement;
        if (!c) return false;
        const r = e.getBoundingClientRect(), cr = c.getBoundingClientRect();
        c.scrollLeft += r.right > cr.right ? r.right - cr.right + 8 : r.left - cr.left - 8;
        return true;
      }, el);
      if (moved) hswipe++;
    }
    await el.dispose();
    if (Math.abs(dy) < 1) return { ok: true, scrollPx, hswipe };
    const before = await page.evaluate(() => scrollY);
    await page.evaluate((d) => window.scrollBy(0, d), dy);
    await sleep(120);
    const after = await page.evaluate(() => scrollY);
    scrollPx += Math.abs(after - before);
    if (Math.abs(after - before) < 1) return { ok: true, scrollPx, hswipe, note: "page end" }; // cannot scroll further; it is as visible as it gets
  }
  return { ok: true, scrollPx, hswipe };
}

async function runCandidate(browser, vp, sink, cand) {
  const { ctx, page } = await freshPage(browser, vp, sink);
  const vh = vp.height;
  let clicks = 0, typed = 0, hswipe = 0, scrollPx = 0;
  const path = [];
  try {
    for (const st of cand.steps) {
      const expr = st.click || st.open || st.type;
      if (st.open) {
        const isOpen = await page.evaluate(`(() => { const d = ${expr}; return d ? !!d.open : null; })()`);
        if (isOpen === null) return { ok: false, why: `step '${st.label}': details not found`, path };
        if (isOpen) { path.push(st.label + " (already open)"); continue; }
      }
      const tapExpr = st.open ? `(${expr}).querySelector(':scope > summary')` : expr;
      const v = await bringIntoView(page, tapExpr);
      scrollPx += v.scrollPx; hswipe += v.hswipe;
      if (!v.ok) return { ok: false, why: `step '${st.label}': ${v.why}`, path };
      if (st.type) {
        await page.evaluate(({ e, text }) => { const el = eval(e); el.focus(); el.value = text; el.dispatchEvent(new Event("input", { bubbles: true })); }, { e: expr, text: st.text });
        typed++;
      } else {
        await page.evaluate((e) => eval(e).click(), tapExpr);
        clicks++;
      }
      path.push(st.label);
      await sleep(WAIT);
    }
    const v = await bringIntoView(page, cand.target);
    scrollPx += v.scrollPx; hswipe += v.hswipe;
    if (!v.ok) return { ok: false, why: `target ${v.why}`, path };
    const scroll = +(scrollPx / vh).toFixed(2);
    return { ok: true, clicks, typed, hswipe, scroll, cost: +(clicks + typed + hswipe + scroll).toFixed(2), path, note: cand.note || v.note || "" };
  } finally { await ctx.close(); }
}

async function depth(browser, vp, sink) {
  const out = [];
  for (const g of GOALS) {
    const tried = [];
    for (const c of g.candidates) tried.push(await runCandidate(browser, vp, sink, c));
    const ok = tried.filter((t) => t.ok).sort((a, b) => a.cost - b.cost);
    if (!ok.length) fail(vp.name, `goal ${g.id}`, `no path reached the target: ${tried.map((t) => t.why).join("; ")}`);
    out.push({ id: g.id, goal: g.goal, best: ok[0] || null, candidates: tried });
  }
  if (!out.length) fail(vp.name, "goals", "no reader goals were measured");
  return out;
}

// ---- report ----
function table(rows, cols) {
  const w = cols.map((c) => Math.max(c.length, ...rows.map((r) => String(r[c] ?? "").length)));
  const line = (vals) => vals.map((v, i) => String(v ?? "").padEnd(w[i])).join("  ");
  return [line(cols), line(w.map((n) => "-".repeat(n))), ...rows.map((r) => line(cols.map((c) => r[c])))].join("\n");
}

async function main() {
  try { const r = await fetch(BASE); if (!r.ok) throw new Error("HTTP " + r.status); }
  catch (e) { console.error(`uat-playwright: ${BASE} is not reachable (${e.message}). Serve docs/ first: python3 -m http.server 8131 --directory docs`); process.exit(2); }
  const browser = await launch();
  const result = { base: BASE, ranAt: new Date().toISOString(), viewports: {} };
  try {
    for (const vp of VIEWPORTS) {
      const sink = { console: [], failedRequests: [], responses: 0 };
      const s = await sweep(browser, vp, sink);
      const d = await depth(browser, vp, sink);
      const dedupe = (arr) => [...new Map(arr.map((x) => [JSON.stringify(x), x])).values()];
      const consoleMsgs = dedupe(sink.console), failed = dedupe(sink.failedRequests);
      consoleMsgs.filter((m) => m.type !== "warning").forEach((m) => fail(vp.name, "console", `${m.type}: ${m.text.slice(0, 160)}`));
      failed.forEach((f) => fail(vp.name, "network", `${f.reason}: ${f.url}`));
      if (!sink.responses) fail(vp.name, "network", "no responses observed: nothing was loaded");
      result.viewports[vp.name] = { size: `${vp.width}x${vp.height}`, ...s, depth: d, console: consoleMsgs, failedRequests: failed, responsesObserved: sink.responses };
    }
  } finally { await browser.close(); }
  result.failures = failures;
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, "results.json"), JSON.stringify(result, null, 2));

  if (JSON_OUT) console.log(JSON.stringify(result, null, 2));
  else {
    for (const [name, v] of Object.entries(result.viewports)) {
      const p = v.perf;
      console.log(`\n== ${name} ${v.size} · load ${p.loadMs} ms · DCL ${p.dclMs} ms · ${p.requests} req · ${(p.totalBytes / 1024).toFixed(0)} KB · ${p.domNodes} nodes · console ${v.console.length} · failed req ${v.failedRequests.length}`);
      console.log(table(v.panels.map((x) => ({ panel: x.name, len: x.len, undef: x.undef, nan: x.nan, attr: (x.attrHoles || []).length, overflowX: x.overflowX, nodes: x.nodes, heightVh: x.heightVh })),
        ["panel", "len", "undef", "nan", "attr", "overflowX", "nodes", "heightVh"]));
      console.log();
      console.log(table(v.depth.map((g) => ({ goal: g.id, clicks: g.best?.clicks ?? "-", typed: g.best?.typed ?? "-", hswipe: g.best?.hswipe ?? "-", scrollVh: g.best?.scroll ?? "-", cost: g.best?.cost ?? "FAIL",
        path: g.best ? (g.best.path.join(" > ") || "(none: on load)") + (g.best.note ? ` [${g.best.note}]` : "") : "" })), ["goal", "clicks", "typed", "hswipe", "scrollVh", "cost", "path"]));
    }
    const nPanels = Object.values(result.viewports).reduce((a, v) => a + v.panels.length, 0);
    const nGoals = Object.values(result.viewports).reduce((a, v) => a + v.depth.length, 0);
    console.log(`\n${failures.length ? "✗" : "✓"} ${nPanels} panel checks · ${nGoals} goal measurements · ${failures.length} failure(s) · results + screenshots in ${OUT}`);
    failures.forEach((f) => console.log(`  ✗ [${f.viewport}] ${f.area}: ${f.msg}`));
  }
  process.exit(failures.length ? 1 : 0);
}

main().catch((e) => { console.error("uat-playwright: crashed:", e); process.exit(2); });
