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
      // Prefer the fixed archive snapshot for FERC pages (the live ferc.gov page is Cloudflare-gated / 403).
      var href = s.archiveUrl || s.url;
      var titleBits = s.label + ", " + s.org + (s.note ? " · " + s.note : "");
      if (s.archiveUrl) titleBits += " · Opens the archived snapshot; live page: " + s.url;
      var title = esc(titleBits);
      return '<a class="src-chip" data-tier="' + s.tier + '" href="' + esc(href) + '" target="_blank" rel="noopener noreferrer" title="' + title + '">' + esc(shortName(id)) + "</a>";
    }).join("");
    return '<div class="srcs"><span class="label">Sources</span>' + chips + "</div>";
  }
  function head(h2, lede) {
    return '<div class="section-head"><h2>' + esc(h2) + "</h2>" + (lede ? '<p class="lede">' + esc(lede) + "</p>" : "") + "</div>";
  }
  function paras(arr) { return arr.map(function (p) { return "<p>" + esc(p) + "</p>"; }).join(""); }

  /* ---- TAB: Overview (stats + at-a-glance + background) ---- */
  function renderOverview() {
    var stats = '<div class="kpis">' + D.kpis.map(function (k) {
      return '<div class="kpi' + (k.deadline ? " deadline" : "") + '"><div class="v">' + esc(k.value) +
        '</div><div class="l">' + esc(k.label) + '</div><div class="s">' + esc(k.sub) + "</div></div>";
    }).join("") + "</div>";

    var m = D.meta;
    var glance = '<dl class="glance">' +
      "<div><dt>Authority</dt><dd>" + esc(m.authority) + "</dd></div>" +
      '<div><dt>Items &amp; dockets</dt><dd class="mono">' + esc(m.items) + "</dd></div>" +
      '<div><dt>Reporter cite</dt><dd class="mono">' + esc(m.citeRange) + "</dd></div>" +
      "<div><dt>Commission</dt><dd>" + esc(m.commissioners) + "</dd></div>" +
      '<div><dt>As of</dt><dd class="mono">' + esc(m.capture) + "</dd></div>" +
      "</dl>";

    return head("Overview", m.subtitle) +
      '<div class="overview-bg">' + paras(m.summary) + "</div>" +
      stats + glance;
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
      return '<div class="card analysis"><div class="tier-flag t-analysis">Analysis: synthesis</div>' +
        "<h3>" + esc(c.h) + "</h3>" + paras(c.body) + srcChips(c.src) + "</div>";
    }).join("") + "</div>";

    return head("Timeline: DOE §403 directive to FERC §206 orders",
      "How an Oct. 2025 DOE directive became six near-simultaneous show cause orders on a 30/60-day clock.") +
      tl +
      head("Toplines: the strategic shift",
      "Why tailored §206 show cause orders instead of a generic NOPR, and what it signals.") +
      top;
  }

  /* ---- TAB: Reforms (the five categories + jurisdiction + regional) ---- */
  function renderReforms() {
    var cats = D.categories.map(function (c, i) {
      return '<details class="cat"' + (i === 0 ? " open" : "") + '><summary>' +
        '<span class="cat-no">' + c.n + "</span>" +
        '<span class="cat-title">' + esc(c.title) + "</span>" +
        '<span class="cat-chev">›</span></summary>' +
        '<div class="cat-body">' +
        '<div class="cat-ferc"><span class="label">FERC mandate text</span>“' + esc(c.ferc) + "”</div>" +
        '<p class="cat-detail">' + esc(c.detail) + "</p>" +
        '<div class="cat-doe"><span class="label">Underlying DOE ANOPR principles</span><ul>' +
        c.doe.map(function (d) { return "<li>" + esc(d) + "</li>"; }).join("") + "</ul></div>" +
        srcChips(c.src) + "</div></details>";
    }).join("");

    var jur = '<div class="blocks two">' + D.jurisdiction.map(function (b) {
      return '<div class="block' + (/30-day/.test(b.h) ? " warn" : "") + '"><h4>' + esc(b.h) + "</h4><p>" + esc(b.body) + "</p>" + srcChips(b.src) + "</div>";
    }).join("") + "</div>";

    var reg = '<div class="blocks two">' + D.regional.map(function (b) {
      return '<div class="block"><h4>' + esc(b.h) + "</h4><p>" + esc(b.body) + "</p>" + srcChips(b.src) + "</div>";
    }).join("") + "</div>";

    return head("The five reform categories",
      "Each tailored order tees up the same five categories. FERC's mandate text is quoted; the underlying DOE ANOPR principles show the mechanics.") + cats +
      head("Jurisdictional & contractual protections",
      "Where FERC draws the federal/state line, and how it shields existing deals.") + jur +
      head("Regional distinctions at a glance", "The variations FERC says the orders were designed to reflect.") + reg;
  }

  /* ---- TAB: Dockets (the six order cards + how to participate) ---- */
  function renderDockets() {
    var docs = '<div class="dockets">' + D.dockets.map(function (d) {
      var so = D.SOURCES[d.url];
      // Link to the committed copy under docs/orders/ (served by GitHub Pages, same-origin) so the
      // PDF opens inline and #page= works; the official ferc.gov source sits behind Cloudflare.
      var orderLink = '<span class="order-links"><a class="order-link" data-tier="order" target="_blank" rel="noopener noreferrer" href="' +
        esc(d.pdf) + '" title="Open the ' + esc(d.item) + " order PDF (committed copy of the ferc.gov original)\">Order PDF ↗</a>" +
        '<a class="order-src" target="_blank" rel="noopener noreferrer" href="' + esc(so.url) +
        '" title="Official source on ferc.gov (Cloudflare-gated; the committed copy mirrors it)">ferc.gov ↗</a></span>';
      var directives = '<div class="dir"><span class="label">Directs the respondent to address</span>' +
        d.dir.map(function (x) {
          var cite;
          if (x.pg) {
            // Link the cite to the exact PDF page that carries this directive's quoted text.
            // The order PDF is committed under docs/orders/ and served with the site, so #page=
            // opens it inline at that page. FERC PDFs don't keep paragraph numbers in their text
            // layer, so the page is anchored to where the quoted language appears (verified by tests).
            cite = '<a class="dir-para mono" href="' + esc(d.pdf) + "#page=" + x.pg +
              '" target="_blank" rel="noopener noreferrer" aria-label="Open the ' + esc(d.item) +
              " order PDF at page " + x.pg + '" title="' + esc(d.item) + " order PDF, opens to p. " + x.pg +
              " (the page carrying this quoted directive)\">" + esc(x.p) +
              '<span class="ext" aria-hidden="true">↗</span></a>';
          } else {
            cite = '<span class="dir-para mono">' + esc(x.p) + "</span>";
          }
          return '<div class="dir-item"><div class="dir-head"><span class="dir-topic">' + esc(x.t) +
            "</span>" + cite + "</div>" +
            '<span class="dir-quote">“' + esc(x.q) + '”</span></div>';
        }).join("") + "</div>";
      var region = '<details class="dreg"><summary>Region-specific findings (' + d.reg.length + ")</summary><ul>" +
        d.reg.map(function (r) { return "<li>" + esc(r) + "</li>"; }).join("") + "</ul></details>";
      return '<div class="docket"><div class="docket-spine"><span class="item">' + esc(d.item) +
        '</span><span class="docket-no">' + esc(d.docket) + "</span></div>" +
        '<div class="docket-main">' +
        '<div class="docket-head"><div class="docket-id"><span class="rto">' + esc(d.rto) +
        '</span> <span class="rto-full">' + esc(d.rtoFull) + "</span></div>" + orderLink + "</div>" +
        '<div class="docket-cite mono">' + esc(d.cite) + " · " + esc(d.pages) + " pp · " + esc(d.respondents) + "</div>" +
        '<div class="docket-tags"><span class="docket-status">' + esc(d.status) + '</span><span class="region mono">' + esc(d.region) + "</span></div>" +
        directives + region +
        "</div></div>";
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

    return head("The six dockets: E-7 through E-12",
      "Same §206 spine, region-specific application. Directives and findings below are quoted from each order PDF (downloaded & OCR'd, captions verified) with paragraph cites; the order's FERC reporter cite, length, and named respondents head each card.") + docs +
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

    var outlets = '<div class="section-head"><h2>Where it’s being covered</h2><p class="lede">Each links to the cited source.</p></div><div class="outlets">' +
      D.media.outlets.map(function (id) {
        var s = D.SOURCES[id]; if (!s) return "";
        return '<a class="outlet" href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer" title="' + esc(s.label + ", " + s.org) + '">' + esc(shortName(id)) + "</a>";
      }).join("") + "</div>";

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
      '<span><i style="background:#6b7280;border:1px dashed #6b7280"></i> Order PDF, downloaded &amp; OCR’d</span></div>';

    var srcList = "<ul>" + Object.keys(D.SOURCES).map(function (id) {
      var s = D.SOURCES[id];
      return "<li><strong>" + esc(shortName(id)) + ":</strong> " +
        '<a href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' + esc(s.label) + "</a>, " +
        esc(s.org) + " · <em>" + esc(s.captured) + "</em>" + (s.note ? " · " + esc(s.note) : "") + "</li>";
    }).join("") + "</ul>";

    document.getElementById("provenance-body").innerHTML =
      "<p>Three evidence tiers are kept visibly distinct so a confident-sounding synthesis never reads as quoted order text:</p>" + legend +
      "<h4>What is primary</h4>" +
      "<p>The <strong>DOE §403 letter</strong> (16 pp.) was downloaded from energy.gov and text-extracted directly. FERC's <strong>news release, fact sheet, meeting summaries, and the RM26-4 docket page</strong> are official FERC text, posted at the June 18, 2026 open meeting and live on ferc.gov; quoted here against Internet Archive snapshots dated June 18 to 20, 2026 so the citations stay fixed to a specific capture even as the live pages change.</p>" +
      "<h4>The six order PDFs, retrieved &amp; OCR’d</h4>" +
      "<p>Automated clients (curl, server-side fetch, the PDF-fetch tool, the Wayback crawler) are all blocked by Cloudflare on <span class='mono'>ferc.gov/media/e-7…e-12</span>. The six orders were therefore opened in a real browser that passes the challenge, downloaded, and text-extracted (OCR) on 2026-06-22. Each one's <strong>page-1 caption was verified</strong> (FERC reporter cite, respondent RTO, docket number, the title “Order Instituting Proceeding Under Section 206,” and the issued date) before any of its text was used. The per-order directives in Tab 2 are quoted from those PDFs with paragraph cites (e.g. “P 77”); the structured extract is committed at <span class='mono'>sources/orders-extract.json</span>. Each cite is a link that opens the order PDF to the page carrying that quoted text. The six PDFs are committed under <span class='mono'>docs/orders/</span> and served with the site, so the links open inline at the right page (each order's official ferc.gov URL is listed under All sources below). FERC's published PDFs drop paragraph numbers from their text layer, so a link is anchored to the page where the quoted language appears, not to a paragraph index. A test checks every link lands on a page that carries its quote. All six orders are 195 FERC ¶ 61,211 to 61,216, 92 to 119 pp, issued June 18, 2026.</p>" +
      "<h4>Derived dates</h4>" +
      "<p>The 30-day and 60-day periods are stated by FERC. The specific calendar due-dates are derived from the June 18, 2026 issuance (business-day-adjusted figures attributed to the National Law Review analysis).</p>" +
      "<h4>All sources</h4>" + srcList +
      "<p style='margin-top:10px'><em>Capture date 2026-06-22. Independent analysis; not affiliated with FERC or DOE.</em></p>";
  }

  /* ---- tablist ---- */
  var TABS = ["overview", "timeline", "reforms", "dockets", "news"];
  var renderers = { overview: renderOverview, timeline: renderTimeline, reforms: renderReforms, dockets: renderDockets, news: renderNews };
  var rendered = {};

  function panelFor(name) { return document.getElementById("panel-" + name); }
  function tabFor(name) { return document.getElementById("tab-" + name); }

  // Tabs are sticky; on a user-initiated switch, scroll back up to the tablist so the new
  // (often shorter) panel starts at the top instead of leaving the viewport stranded mid-page.
  function scrollToTabsTop() {
    var main = document.getElementById("main");
    if (main && window.pageYOffset > main.offsetTop) window.scrollTo(0, main.offsetTop);
  }

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
    if (next !== null) { e.preventDefault(); activate(TABS[next], true); scrollToTabsTop(); }
  }

  function init() {
    renderProvenance();
    TABS.forEach(function (t) {
      var tab = tabFor(t);
      tab.addEventListener("click", function () { activate(t, false); scrollToTabsTop(); });
      tab.addEventListener("keydown", onKey);
    });
    var initial = (location.hash || "").replace("#", "");
    activate(TABS.indexOf(initial) >= 0 ? initial : "overview", false);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
