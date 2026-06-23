/* app.js — renders FERC_DATA into the three tab panels and wires the tablist.
   No dependencies, no network. Data is authored in data.js (single source of truth). */
(function () {
  "use strict";
  var D = window.FERC_DATA;
  if (!D) { document.getElementById("main").innerHTML = "<p class='noscript'>Data failed to load (js/data.js).</p>"; return; }

  /* ---- helpers ---- */
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function shortName(id) {
    var s = D.SOURCES[id];
    if (!s) return id;
    if (s.tier === "order") return id.toUpperCase().replace(/^E/, "E-"); // e7 -> E-7
    if (s.tier === "doe") return "DOE §403";
    if (s.tier === "ferc") {
      return { fercPR: "FERC release", fercFS: "FERC fact sheet", fercSum: "FERC summaries", fercRM264: "RM26-4 page" }[id] || "FERC";
    }
    return s.org.split("(")[0].trim(); // secondary -> org
  }
  function srcChips(ids) {
    if (!ids || !ids.length) return "";
    var chips = ids.map(function (id) {
      var s = D.SOURCES[id];
      if (!s) return "";
      var title = esc(s.label + " — " + s.org + (s.note ? " · " + s.note : ""));
      var rel = "noopener noreferrer";
      var dashed = s.tier === "order" ? ' aria-label="order PDF (not machine-retrieved; opens FERC source)"' : "";
      return '<a class="src-chip" data-tier="' + s.tier + '" href="' + esc(s.url) + '" target="_blank" rel="' + rel + '" title="' + title + '"' + dashed + ">" + esc(shortName(id)) + "</a>";
    }).join("");
    return '<div class="srcs"><span class="label">Sources</span>' + chips + "</div>";
  }
  function head(h2, lede) {
    return '<div class="section-head"><h2>' + esc(h2) + "</h2>" + (lede ? '<p class="lede">' + esc(lede) + "</p>" : "") + "</div>";
  }
  function paras(arr) { return arr.map(function (p) { return "<p>" + esc(p) + "</p>"; }).join(""); }

  /* ---- KPIs ---- */
  function renderKpis() {
    document.getElementById("kpis").innerHTML = D.kpis.map(function (k) {
      return '<div class="kpi' + (k.deadline ? " deadline" : "") + '"><div class="v">' + esc(k.value) +
        '</div><div class="l">' + esc(k.label) + '</div><div class="s">' + esc(k.sub) + "</div></div>";
    }).join("");
  }

  /* ---- TAB 1 ---- */
  function renderTimeline() {
    var tl = '<div class="timeline">' + D.timeline.map(function (e) {
      return '<div class="tl-item ' + e.kind + '"><div class="tl-date">' + esc(e.date) +
        '<span class="kindpill ' + e.kind + '">' + e.kind + "</span></div>" +
        '<div class="tl-title">' + esc(e.title) + "</div>" +
        '<div class="tl-body">' + esc(e.body) + "</div>" + srcChips(e.src) + "</div>";
    }).join("") + "</div>";

    var top = '<div class="cards cols-3">' + D.toplines.map(function (c) {
      return '<div class="card analysis"><div class="tier-flag t-analysis">Analysis — synthesis</div>' +
        "<h3>" + esc(c.h) + "</h3>" + paras(c.body) + srcChips(c.src) + "</div>";
    }).join("") + "</div>";

    return head("Timeline — DOE §403 directive to FERC §206 orders",
      "How an Oct. 2025 DOE directive became six near-simultaneous show cause orders on a 30/60-day clock.") +
      tl +
      head("Toplines — the strategic shift",
      "Why tailored §206 show cause orders instead of a generic NOPR — and what it signals.") +
      top;
  }

  /* ---- TAB 2 ---- */
  function renderDockets() {
    var cats = D.categories.map(function (c, i) {
      return '<details class="cat"' + (i === 0 ? " open" : "") + '><summary>' +
        '<span class="cat-no">' + c.n + "</span>" +
        '<span class="cat-title">' + esc(c.title) + "</span>" +
        '<span class="cat-chev">›</span></summary>' +
        '<div class="cat-body">' +
        '<div class="cat-ferc"><span class="label">FERC — mandate text</span>“' + esc(c.ferc) + "”</div>" +
        '<p class="cat-detail">' + esc(c.detail) + "</p>" +
        '<div class="cat-doe"><span class="label">Underlying DOE ANOPR principles</span><ul>' +
        c.doe.map(function (d) { return "<li>" + esc(d) + "</li>"; }).join("") + "</ul></div>" +
        srcChips(c.src) + "</div></details>";
    }).join("");

    var docs = '<div class="dockets">' + D.dockets.map(function (d) {
      var directives = '<div class="dir"><span class="label">Directs the respondent to address</span>' +
        d.dir.map(function (x) {
          return '<div class="dir-item"><span class="dir-topic">' + esc(x.t) + '</span>' +
            '<span class="dir-quote">“' + esc(x.q) + '”</span>' +
            '<span class="dir-para mono">' + esc(x.p) + "</span></div>";
        }).join("") + "</div>";
      var region = '<div class="dreg"><span class="label">Region-specific findings</span><ul>' +
        d.reg.map(function (r) { return "<li>" + esc(r) + "</li>"; }).join("") + "</ul></div>";
      return '<div class="docket"><div class="docket-spine"><span class="item">' + esc(d.item) +
        '</span><span class="docket-no">' + esc(d.docket) + "</span></div>" +
        '<div class="docket-main"><div class="docket-id"><div class="rto">' + esc(d.rto) +
        '</div><div class="rto-full">' + esc(d.rtoFull) + "</div></div>" +
        '<div class="docket-cite mono">' + esc(d.cite) + " · " + esc(d.pages) + " pp · " + esc(d.respondents) + "</div>" +
        '<div class="region">' + esc(d.region) + '</div>' +
        '<span class="docket-status">' + esc(d.status) + "</span>" +
        directives + region +
        '<div class="srcs"><span class="label">Order PDF</span><a class="src-chip" data-tier="order" target="_blank" rel="noopener noreferrer" href="' +
        esc(D.SOURCES[d.url].url) + '" title="' + esc(D.SOURCES[d.url].label + " — downloaded & OCR'd 2026-06-22") + '">' + esc(d.cite) + "</a></div>" +
        "</div></div>";
    }).join("") + "</div>";

    var jur = '<div class="blocks two">' + D.jurisdiction.map(function (b) {
      return '<div class="block' + (/30-day/.test(b.h) ? " warn" : "") + '"><h4>' + esc(b.h) + "</h4><p>" + esc(b.body) + "</p>" + srcChips(b.src) + "</div>";
    }).join("") + "</div>";

    var reg = '<div class="blocks two">' + D.regional.map(function (b) {
      return '<div class="block"><h4>' + esc(b.h) + "</h4><p>" + esc(b.body) + "</p>" + srcChips(b.src) + "</div>";
    }).join("") + "</div>";

    var p = D.participate;
    var partRows = '<div class="docket-links">' + p.dockets.map(function (d) {
      return '<a class="docket-link" target="_blank" rel="noopener noreferrer" href="' + esc(p.docketSheet(d.docket)) +
        '" title="Open the eLibrary docket sheet for ' + esc(d.docket) + '"><span class="dl-item">' + esc(d.item) +
        '</span><span class="dl-rto">' + esc(d.rto) + '</span><span class="dl-no mono">' + esc(d.docket) + "</span></a>";
    }).join("") + "</div>";
    var partLinks = '<div class="action-links">' + p.links.map(function (l) {
      return '<a class="action-link" target="_blank" rel="noopener noreferrer" href="' + esc(l.url) + '"><strong>' +
        esc(l.label) + "</strong><span>" + esc(l.note) + "</span></a>";
    }).join("") + "</div>";
    var participate = '<p class="lede" style="margin-bottom:14px">' + esc(p.intro) + "</p>" + partRows + partLinks;

    return head("The five reform categories",
      "Each tailored order tees up the same five categories. FERC's mandate text is quoted; the underlying DOE ANOPR principles show the mechanics.") + cats +
      head("The six dockets — E-7 through E-12",
      "Same §206 spine, region-specific application. Directives and findings below are quoted from each order PDF (downloaded & OCR'd, captions verified) with paragraph cites; the order's FERC reporter cite, length, and named respondents head each card.") + docs +
      head("Jurisdictional & contractual protections",
      "Where FERC draws the federal/state line, and how it shields existing deals.") + jur +
      head("Regional distinctions at a glance", "The variations FERC says the orders were designed to reflect.") + reg +
      head("File or follow the dockets", "Every proceeding is open on the public record. Use the exact docket number on any submission.") + participate;
  }

  /* ---- TAB 3 ---- */
  function renderNews() {
    var rec = '<div class="reception">' + D.reception.map(function (r) {
      return '<div class="recep ' + r.stance + '"><div class="recep-head"><span class="recep-group">' + esc(r.group) +
        '</span><span class="stance-pill ' + r.stance + '">' + r.stance + "</span></div>" +
        "<p>" + esc(r.body) + "</p>" + srcChips(r.src) + "</div>";
    }).join("") + "</div>";

    var disc = '<div class="discourse"><div class="disc-col consensus"><h3>Points of consensus</h3><div class="disc-list">' +
      D.media.consensus.map(function (c) { return '<div class="disc-item">' + esc(c.t) + srcChips(c.src) + "</div>"; }).join("") +
      '</div></div><div class="disc-col friction"><h3>Points of friction</h3><div class="disc-list">' +
      D.media.friction.map(function (c) { return '<div class="disc-item">' + esc(c.t) + srcChips(c.src) + "</div>"; }).join("") +
      "</div></div></div>";

    var outlets = '<div class="section-head"><h2>Where it’s being covered</h2></div><div class="outlets">' +
      D.media.outlets.map(function (o) { return '<span class="outlet">' + esc(o) + "</span>"; }).join("") + "</div>";

    return head("Industry reception",
      "How the shift from the DOE ANOPR to FERC's show cause orders lands across stakeholder camps. Stance reflects the synthesized read of the cited sources, not a FERC determination.") + rec +
      head("Media & discourse", "The dominant narratives in energy trade press and policy circles.") + disc + outlets;
  }

  /* ---- provenance ---- */
  function renderProvenance() {
    var legend = '<div class="legend">' +
      '<span><i style="background:#0b2545"></i> FERC primary (issuance text)</span>' +
      '<span><i style="background:#5b3a8a"></i> DOE primary (§403 letter)</span>' +
      '<span><i style="background:#1a4480"></i> Secondary analysis</span>' +
      '<span><i style="background:#6b7280;border:1px dashed #6b7280"></i> Order PDF — downloaded &amp; OCR’d</span></div>';

    var srcList = "<ul>" + Object.keys(D.SOURCES).map(function (id) {
      var s = D.SOURCES[id];
      return "<li><strong>" + esc(shortName(id)) + ":</strong> " +
        '<a href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' + esc(s.label) + "</a> — " +
        esc(s.org) + " · <em>" + esc(s.captured) + "</em>" + (s.note ? " · " + esc(s.note) : "") + "</li>";
    }).join("") + "</ul>";

    document.getElementById("provenance-body").innerHTML =
      "<p>Three evidence tiers are kept visibly distinct so a confident-sounding synthesis never reads as quoted order text:</p>" + legend +
      "<h4>What is primary</h4>" +
      "<p>The <strong>DOE §403 letter</strong> (16 pp.) was downloaded from energy.gov and text-extracted directly. FERC's <strong>news release, fact sheet, meeting summaries, and the RM26-4 docket page</strong> are official FERC text, posted at the June 18, 2026 open meeting and live on ferc.gov; quoted here against Internet Archive snapshots dated June 18–20, 2026 so the citations stay fixed to a specific capture even as the live pages change.</p>" +
      "<h4>The six order PDFs — retrieved &amp; OCR’d</h4>" +
      "<p>Automated clients (curl, server-side fetch, the PDF-fetch tool, the Wayback crawler) are all blocked by Cloudflare on <span class='mono'>ferc.gov/media/e-7…e-12</span>. The six orders were therefore opened in a real browser that passes the challenge, downloaded, and text-extracted (OCR) on 2026-06-22. Each one's <strong>page-1 caption was verified</strong> — FERC reporter cite, respondent RTO, docket number, the title “Order Instituting Proceeding Under Section 206,” and the issued date — before any of its text was used. The per-order directives in Tab 2 are quoted from those PDFs with paragraph cites (e.g. “P 77”); the structured extract is committed at <span class='mono'>sources/orders-extract.json</span>. All six orders are 195 FERC ¶ 61,211–61,216, 92–119 pp, issued June 18, 2026.</p>" +
      "<h4>Derived dates</h4>" +
      "<p>The 30-day and 60-day periods are stated by FERC. The specific calendar due-dates are derived from the June 18, 2026 issuance (business-day-adjusted figures attributed to the National Law Review analysis).</p>" +
      "<h4>All sources</h4>" + srcList +
      "<p style='margin-top:10px'><em>Capture date 2026-06-22. Independent analysis; not affiliated with FERC or DOE.</em></p>";
  }

  /* ---- tablist ---- */
  var TABS = ["timeline", "dockets", "news"];
  var renderers = { timeline: renderTimeline, dockets: renderDockets, news: renderNews };
  var rendered = {};

  function panelFor(name) { return document.getElementById("panel-" + name); }
  function tabFor(name) { return document.getElementById("tab-" + name); }

  function activate(name, focus) {
    TABS.forEach(function (t) {
      var sel = t === name;
      var tab = tabFor(t), panel = panelFor(t);
      tab.setAttribute("aria-selected", sel ? "true" : "false");
      tab.tabIndex = sel ? 0 : -1;
      panel.hidden = !sel;
      if (sel) {
        if (!rendered[t]) { panel.innerHTML = renderers[t](); rendered[t] = true; }
        if (focus) tab.focus();
      }
    });
    if (history.replaceState) history.replaceState(null, "", "#" + name);
    else location.hash = name;
  }

  function onKey(e) {
    var i = TABS.indexOf(e.target.getAttribute("data-tab"));
    if (i < 0) return;
    var next = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % TABS.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    if (next !== null) { e.preventDefault(); activate(TABS[next], true); }
  }

  function init() {
    renderKpis();
    renderProvenance();
    TABS.forEach(function (t) {
      var tab = tabFor(t);
      tab.addEventListener("click", function () { activate(t, false); });
      tab.addEventListener("keydown", onKey);
    });
    var initial = (location.hash || "").replace("#", "");
    activate(TABS.indexOf(initial) >= 0 ? initial : "timeline", false);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
