/* app.js — renders FERC_DATA into the three tab panels and wires the tablist.
   No dependencies. Data is authored in data.js (single source of truth); the Comments tab
   additionally lazy-loads one small per-letter bin-detail file on demand (docs/data/comments/). */
(function () {
  "use strict";
  // cache-buster for the lazily fetched bin-detail JSON; keep in sync with index.html's ?v= tokens.
  var ASSET_VER = "20260629b";
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
    if (s.tier === "doe") return { doe403: "DOE §403", doeApplaud: "DOE statement" }[id] || "DOE";
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
  function isFederalSource(id) {
    var s = D.SOURCES[id];
    if (!s) return false;
    var href = s.url || "";
    return s.tier === "ferc" || s.tier === "doe" || s.tier === "order" ||
      /^https?:\/\/([^/]+\.)?(ferc|energy)\.gov\b/i.test(href);
  }
  function publicSrcChips(ids) {
    return srcChips((ids || []).filter(function (id) { return !isFederalSource(id); }));
  }
  function commissionerQuoteCite(c, pg) {
    var d = D.dockets && D.dockets[0];
    if (!d || !pg) return "";
    var so = D.SOURCES[d.url];
    return '<span class="commish-cite"><span class="dir-para mono">p. ' + pg + "</span>" +
      '<a class="cite-link" href="' + esc(d.pdf) + "#page=" + pg + '" target="_blank" rel="noopener noreferrer" aria-label="Open ' +
      esc(c.name) + "'s PJM concurring statement in the committed order PDF at page " + pg +
      '" title="Committed PJM order PDF, opens inline to p. ' + pg + '">PDF <span class="ext" aria-hidden="true">↗</span></a>' +
      '<a class="cite-link" href="' + esc(so.url) + "#page=" + pg + '" target="_blank" rel="noopener noreferrer" aria-label="Open the official ferc.gov PJM order at page ' +
      pg + '" title="Official ferc.gov source, page ' + pg + '">gov <span class="ext" aria-hidden="true">↗</span></a></span>';
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

    var commish = "";
    if (D.commissioners && D.commissioners.length) {
      // expandable themed read of each statement (themes + verbatim quotes), shown when authored.
      // Written quotes are verbatim from the order text; spoken quotes are from the open-meeting
      // auto-caption transcript and labeled as such (machine transcription, may be approximate).
      var themed = function (c) {
        if (!c.themes || !c.themes.length) return "";
        var blocks = c.themes.map(function (th) {
          var qs = (th.quotes || []).map(function (q) {
            var sp = q.src === "spoken";
            return '<li class="commish-q ' + (sp ? "spoken" : "written") + '">“' + esc(q.t) + "”" +
              (sp ? '<span class="commish-q-src">spoken · auto-caption' + (q.at ? " · " + esc(q.at) : "") + "</span>" : commissionerQuoteCite(c, q.pg)) + "</li>";
          }).join("");
          return '<div class="commish-theme"><h5 class="commish-theme-h">' + esc(th.name) + "</h5>" +
            (th.desc ? '<p class="commish-theme-d">' + esc(th.desc) + "</p>" : "") +
            (qs ? '<ul class="commish-qs">' + qs + "</ul>" : "") + "</div>";
        }).join("");
        var last = c.name.split(" ").pop();
        var srcs = c.sources ? '<p class="commish-srcs">Sources: ' + esc(c.sources.written) +
          (c.sources.spoken ? "; " + esc(c.sources.spoken) : "") + "</p>" : "";
        return '<details class="commish-full"><summary><span class="commish-full-label">Read ' + esc(last) +
          "’s themes &amp; quotes</span><span class=\"commish-full-n mono\">" + c.themes.length + " themes</span></summary>" +
          (c.summary ? '<p class="commish-sum">' + esc(c.summary) + "</p>" : "") + blocks + srcs + "</details>";
      };
      var cards = D.commissioners.map(function (c) {
        return '<article class="commish-rowcard"><div class="commish"><div class="commish-head"><span class="commish-name">' + esc(c.name) +
          '</span><span class="commish-role">' + esc(c.role) + '</span><span class="commish-tag">' + esc(c.short) + "</span></div>" +
          '<p class="commish-gist">' + esc(c.gist) + "</p>" +
          '<div class="commish-quote">“…' + esc(c.quote) + '…”' + commissionerQuoteCite(c, c.quotePg) + "</div></div>" + themed(c) + "</article>";
      }).join("");
      commish = head("What each commissioner emphasized",
        "All five joined every order unanimously; their concurring statements diverge in emphasis. Each row opens into that commissioner’s themes and page-cited quotes, without changing the layout of the other commissioners.") +
        '<div class="commish-list">' + cards + "</div>";
    }

    return head("Overview", m.subtitle) +
      '<div class="overview-bg">' + paras(m.summary) + "</div>" +
      stats + glance + commish;
  }

  /* ---- TAB 1 ---- */
  function renderTimeline() {
    var tl = '<div class="timeline">' + D.timeline.map(function (e) {
      return '<div class="tl-item ' + e.kind + '"><div class="tl-date">' + esc(e.date) +
        '<span class="kindpill ' + e.kind + '">' + esc(e.kind) + "</span></div>" +
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

  // Per-order commissioner block. For the six §206 orders the concurrences are largely common, so
  // each row shows the commissioner's substantive gist + headline quote, cited to THIS order's page.
  // E-2 carries a `commish` override (only Chang wrote separately) with its own order-specific read.
  function commishBlock(d, so) {
    if (!D.commissioners) return "";
    var override = d.commish || null;
    var list = D.commissioners.filter(function (c) {
      return override ? override[c.key] : (d.commishPages && d.commishPages[c.key]);
    });
    if (!list.length) return "";
    var rows = list.map(function (c) {
      var ov = override && override[c.key];
      var pg = ov ? ov.pg : d.commishPages[c.key];
      var gist = ov ? ov.gist : c.gist;
      var quote = ov ? ov.quote : c.quote;
      var links = pg ? '<span class="commish-cite"><span class="dir-para mono">p. ' + pg + "</span>" +
        '<a class="cite-link" href="' + esc(d.pdf) + "#page=" + pg + '" target="_blank" rel="noopener noreferrer" aria-label="Open ' + esc(c.name) +
        "’s statement in the committed " + esc(d.item) + " order PDF at page " + pg + '" title="Committed PDF, opens inline to p. ' + pg +
        '">PDF <span class="ext" aria-hidden="true">↗</span></a>' +
        '<a class="cite-link" href="' + esc(so.url) + "#page=" + pg + '" target="_blank" rel="noopener noreferrer" aria-label="Open the official ferc.gov ' + esc(d.item) +
        " order at page " + pg + '" title="Official ferc.gov source, page ' + pg + '">gov <span class="ext" aria-hidden="true">↗</span></a></span>' : "";
      return '<div class="commish-row"><div class="commish-row-head"><span class="commish-name">' + esc(c.name) +
        '</span><span class="commish-tag">' + esc(c.short) + "</span>" + links + "</div>" +
        (gist ? '<p class="commish-rgist">' + esc(gist) + "</p>" : "") +
        '<div class="commish-quote">“…' + esc(quote) + '…”</div></div>';
    }).join("");
    var note = override ? "" :
      '<p class="commish-block-note">The five concurrences are largely common across the six orders; full themes and quotes are on the Overview tab. The page cites here open <em>this</em> order’s PDF.</p>';
    return '<details class="dreg dcom"><summary>What the commissioners said in this order (' + list.length + ")</summary>" +
      note + '<div class="commish-rows">' + rows + "</div></details>";
  }

  /* ---- TAB: Dockets (the six §206 order cards + the E-2 co-location order + how to participate) ---- */
  function renderDockets() {
    function renderDocketCard(d, idx) {
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
            // Two ways to reach the cited page: the committed PDF under docs/orders/ (same-origin, so
            // #page= opens inline and jumps reliably) and the official ferc.gov source (#page= lands
            // when the browser opens it inline past Cloudflare). FERC PDFs drop paragraph numbers from
            // their text layer, so the page is anchored to where the quoted text appears (tested).
            cite = '<span class="dir-cite"><span class="dir-para mono">' + esc(x.p) + "</span>" +
              '<a class="cite-link" href="' + esc(d.pdf) + "#page=" + x.pg +
              '" target="_blank" rel="noopener noreferrer" aria-label="Open the committed ' + esc(d.item) +
              " order PDF at page " + x.pg + '" title="Committed PDF, opens inline to p. ' + x.pg +
              '">PDF <span class="ext" aria-hidden="true">↗</span></a>' +
              '<a class="cite-link" href="' + esc(so.url) + "#page=" + x.pg +
              '" target="_blank" rel="noopener noreferrer" aria-label="Open the official ferc.gov ' + esc(d.item) +
              " order at page " + x.pg + '" title="Official ferc.gov source, page-precise when it opens inline">gov <span class="ext" aria-hidden="true">↗</span></a></span>';
          } else {
            cite = '<span class="dir-para mono">' + esc(x.p) + "</span>";
          }
          return '<div class="dir-item"><div class="dir-head"><span class="dir-topic">' + esc(x.t) +
            "</span>" + cite + "</div>" +
            '<span class="dir-quote">“' + esc(x.q) + '”</span></div>';
        }).join("") + "</div>";
      var unique = d.unique ? '<div class="docket-unique"><span class="label">What’s unique to ' + esc(d.rto) + '</span><p>' + esc(d.unique) + "</p></div>" : "";
      var asks = (d.asks && d.asks.length) ? '<div class="docket-asks"><span class="label">What FERC presses ' + esc(d.rto) + ' on</span><ul>' +
        d.asks.map(function (a) { return "<li>" + esc(a) + "</li>"; }).join("") + "</ul></div>" : "";
      // Section IV briefing questions: the formal questions the order directs the RTO/ISO to brief.
      // Templated across orders (data.js `briefing`); page link to where § IV opens in this order's PDF.
      var briefing = "";
      if (D.briefing && D.briefing.questions) {
        var bOmit = (D.briefing.omit && D.briefing.omit[d.item]) || [];
        var bpg = D.briefing.pages && D.briefing.pages[d.item];
        var bqs = D.briefing.questions.filter(function (q) { return bOmit.indexOf(q.id) < 0; });
        var bCite = bpg ? '<span class="brief-cite"><span class="dir-para mono">§ IV, p. ' + bpg + "</span>" +
          '<a class="cite-link" href="' + esc(d.pdf) + "#page=" + bpg + '" target="_blank" rel="noopener noreferrer" aria-label="Open the committed ' + esc(d.item) + " order PDF at the Section IV page " + bpg + '" title="Committed PDF, opens inline to p. ' + bpg + '">PDF <span class="ext" aria-hidden="true">↗</span></a>' +
          '<a class="cite-link" href="' + esc(so.url) + "#page=" + bpg + '" target="_blank" rel="noopener noreferrer" aria-label="Open the official ferc.gov ' + esc(d.item) + " order at page " + bpg + '" title="Official ferc.gov source, page ' + bpg + '">gov <span class="ext" aria-hidden="true">↗</span></a></span>' : "";
        briefing = '<details class="dreg dbrief"><summary>The Section IV briefing questions (' + bqs.length + ")</summary>" +
          (bCite ? '<div class="brief-head">' + bCite + "</div>" : "") +
          '<ol class="brief-list">' + bqs.map(function (q) {
            return '<li class="brief-item"><span class="brief-topic">' + esc(q.t) + "</span>" +
              '<p class="brief-desc">' + esc(q.d) + "</p>" +
              '<span class="brief-quote">“…' + esc(q.v) + '…”</span></li>';
          }).join("") + "</ol></details>";
      }
      // Per-order commissioner statements, cited to THIS order's pages (helper below).
      var commish = commishBlock(d, so);
      var region = '<details class="dreg"><summary>What’s distinct about ' + esc(d.rto) + " (" + d.reg.length + ")</summary><ul>" +
        d.reg.map(function (r) {
          var rc = "";
          if (r.p && r.pg) {
            // Same convention as the directive cites: link to the PDF page where the finding's text
            // appears (FERC PDFs drop paragraph numbers from their text layer); both PDF + gov paths.
            rc = ' <span class="reg-cite"><span class="dir-para mono">' + esc(r.p) + "</span>" +
              '<a class="cite-link" href="' + esc(d.pdf) + "#page=" + r.pg + '" target="_blank" rel="noopener noreferrer" aria-label="Open the committed ' + esc(d.item) +
              " order PDF at page " + r.pg + '" title="Committed PDF, opens inline to p. ' + r.pg + '">PDF <span class="ext" aria-hidden="true">↗</span></a>' +
              '<a class="cite-link" href="' + esc(so.url) + "#page=" + r.pg + '" target="_blank" rel="noopener noreferrer" aria-label="Open the official ferc.gov ' + esc(d.item) +
              " order at page " + r.pg + '" title="Official ferc.gov source, page ' + r.pg + '">gov <span class="ext" aria-hidden="true">↗</span></a></span>';
          } else if (r.p) {
            rc = ' <span class="dir-para mono">' + esc(r.p) + "</span>";
          }
          return "<li>" + esc(r.t) + rc + "</li>";
        }).join("") + "</ul></details>";
      var roster = (d.respondentList && d.respondentList.length) ?
        '<details class="dreg dros"><summary>All ' + d.respondentList.length + " named respondents</summary><ul class=\"roster\">" +
        d.respondentList.map(function (r) { return "<li>" + esc(r) + "</li>"; }).join("") + "</ul></details>" : "";
      // Accordion: collapsed by default (first open) so all cards fit on one screen; expand for detail.
      var track = d.track ? '<span class="docket-track">' + esc(d.track) + "</span>" : "";
      return '<details class="docket' + (d.track ? " docket-colo" : "") + '"' + (idx === 0 ? " open" : "") + ">" +
        '<summary class="docket-sum"><span class="item">' + esc(d.item) + "</span>" +
        '<span class="docket-sum-id"><span class="rto">' + esc(d.rto) + "</span> " + track + '<span class="rto-full">' + esc(d.rtoFull) + "</span>" +
        '<span class="docket-cite mono">' + esc(d.cite) + " · " + esc(d.pages) + " pp · " + esc(d.respondents) + "</span></span>" +
        '<span class="docket-status">' + esc(d.status) + '</span><span class="region mono">' + esc(d.region) + "</span>" +
        '<span class="chev" aria-hidden="true">›</span></summary>' +
        '<div class="docket-body">' + orderLink + unique + directives + asks + briefing + commish + region + roster + "</div></details>";
    }
    // The six §206 show cause orders, then the E-2 co-location order they build on (collapsed, labeled).
    var six = D.dockets.map(renderDocketCard).join("");
    var colo = D.colocation
      ? '<div class="docket-section-label">The order finalizing PJM’s co-location services</div>' + renderDocketCard(D.colocation, 1)
      : "";
    var docs = '<div class="dockets">' + six + colo + "</div>";

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

    return head("The dockets: E-7 through E-12, plus the E-2 co-location order",
      "Every §206 order runs the same spine — the five categories, the clock, and the jurisdictional line are in the Reforms tab; each card here is the region-specific variation. Open one for what’s unique to that system, the page-cited directives and distinct findings, the Section IV asks, what each commissioner said about that order, and every named respondent. After the six sits Item E-2 (EL25-49-002), the order on rehearing decided the same morning that finalizes the PJM co-location services the six extend.") +
      docs +
      head("File or follow the dockets", "Every proceeding is open on the public record. Use the exact docket number on any submission.") + participate;
  }

  /* ---- TAB 3 ---- */
  function renderNews() {
    var recItems = D.reception.filter(function (r) { return !/^FERC\b/.test(r.group); });
    var rec = '<div class="reception">' + recItems.map(function (r) {
      return '<div class="recep ' + r.stance + '"><div class="recep-head"><span class="recep-group">' + esc(r.group) +
        '</span><span class="stance-pill ' + r.stance + '">' + esc(r.stance) + "</span></div>" +
        "<p>" + esc(r.body) + "</p>" +
        '<div class="source-line">' + publicSrcChips(r.src) + "</div></div>";
    }).join("") + "</div>";

    var disc = '<div class="discourse"><div class="disc-col consensus"><h3>Points of consensus</h3><div class="disc-list">' +
      D.media.consensus.map(function (c) { return '<div class="disc-item">' + esc(c.t) + publicSrcChips(c.src) + "</div>"; }).join("") +
      '</div></div><div class="disc-col friction"><h3>Points of friction</h3><div class="disc-list">' +
      D.media.friction.map(function (c) { return '<div class="disc-item">' + esc(c.t) + publicSrcChips(c.src) + "</div>"; }).join("") +
      "</div></div></div>";

    var outlets = '<div class="section-head"><h2>Where it’s being covered</h2><p class="lede">Each links to the cited source.</p></div><div class="outlets">' +
      D.media.outlets.filter(function (id) { return !isFederalSource(id); }).map(function (id) {
        var s = D.SOURCES[id]; if (!s) return "";
        return '<a class="outlet" href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer" title="' + esc(s.label + ", " + s.org) + '">' + esc(shortName(id)) + "</a>";
      }).join("") + "</div>";

    var quoteThemes = '<div class="quote-themes">' + (D.voiceThemes || []).map(function (t) {
      var qs = (t.quotes || []).map(function (q) {
        return '<li><blockquote>“' + esc(q.q) + '”</blockquote>' + srcChips([q.src]) + "</li>";
      }).join("");
      return '<section class="quote-theme"><h3>' + esc(t.title) + '</h3><p>' + esc(t.body) + '</p><ul class="quote-list">' + qs + "</ul></section>";
    }).join("") + "</div>";

    // The RM26-4 comment period (stats, respondent types, themes/categories, and the full searchable
    // filing list) lives in its own Comments tab now; Discourse keeps a short pointer.
    var commentsBlock = D.comments ? (head("Public comments: the RM26-4 ANOPR docket",
      "All " + D.comments.filings + " filings were scraped from FERC eLibrary; " + (window.FERC_COMMENTS ? window.FERC_COMMENTS.downloaded : "270+") +
      " comment bodies were downloaded and text-analyzed. The full searchable filing list, the top themes and categories, and the respondent-type breakdown are in the Comments tab.") +
      '<p class="cm-jump-wrap"><a class="cm-jump" href="#comments">Open the Comments tab →</a></p>') : "";

    return head("Industry reception",
      "How the shift from the DOE ANOPR to FERC's show cause orders lands across stakeholder camps. Stance reflects the synthesized read of the cited sources, not a FERC determination.") + rec +
      commentsBlock +
      head("Commentary themes with quoted source lines",
      "Themes from the post-order discourse, with the underlying quoted statements linked under each theme. Commentary gathered " + D.meta.discourseCapture + " (the order record is as of " + D.meta.capture + ").") + quoteThemes +
      head("Media & discourse", "The dominant narratives in energy trade press and policy circles.") + disc + outlets;
  }

  /* ---- TAB: Comments (RM26-4 comment period — list, themes, respondent types) ---- */
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function fmtD(mdy) { if (!mdy) return ""; var p = String(mdy).split("/"); return MON[+p[0] - 1] + " " + (+p[1]) + ", " + p[2]; }
  function eli(acc) { return "https://elibrary.ferc.gov/eLibrary/filelist?accession_Number=" + acc; }
  function roundOf(filed) { var p = String(filed).split("/"); if (p[2] === "2025" && +p[0] <= 11) return "initial"; if (p[2] === "2025" && +p[0] === 12) return "reply"; return "supplemental"; }
  function stanceClass(s) { return /support/.test(s) ? "support" : /oppose/.test(s) ? "oppose" : /mixed/.test(s) ? "mixed" : "neutral"; }
  // bin-detail lens grouping: each bin key is "<ns>:<slug>"; group the positions by namespace, in the
  // same order the rest of the Comments tab uses (ANOPR questions, reform principles, regions, then emergent topics).
  var LENS_ORDER = ["aq", "pr", "rg", "topic"];
  var LENS_LABEL = { aq: "Comment-period questions", pr: "Reform principles", rg: "Order regions", topic: "Other topics raised" };

  function renderComments() {
    var CM = window.FERC_COMMENTS;
    if (!CM) return head("The RM26-4 comment period", "Comment data did not load (js/comments-data.js).");
    var CL = { study: "Study", cost: "Cost", colo: "Co-loc", flex: "Flex", proximate: "Prox-gen" };
    var RG = { pjm: "PJM", miso: "MISO", spp: "SPP", caiso: "CAISO", isone: "ISO-NE", nyiso: "NYISO" };
    var AQ = { jurisdiction: "Jurisdiction", threshold: "20 MW", jointstudy: "Joint study", deposits: "Deposits", hybridrights: "Hybrid rights", protection: "Protection", expedited: "Expedited", upgradecost: "Upgrade cost" };

    var statRow = '<div class="cm-stats">' +
      [[CM.total, "comments filed"], [CM.respondentTypes.length, "respondent types"], [CM.downloaded, "bodies downloaded"], [CM.summarized2, "audited summaries"]]
        .map(function (s) { return '<div class="cm-stat"><span class="v">' + esc(String(s[0])) + '</span><span class="l">' + esc(s[1]) + "</span></div>"; }).join("") + "</div>";

    var rounds = '<div class="cm-rounds">' + CM.rounds.map(function (r) {
      return '<div class="cm-round"><span class="cm-round-n mono">' + r.count + '</span><span class="cm-round-l">' + esc(r.label) +
        '</span><span class="cm-round-d mono">' + esc(fmtD(r.first)) + " – " + esc(fmtD(r.last)) + "</span></div>";
    }).join("") + "</div>";

    // respondent types: count + the full distinct-organization roster per camp (collapse past 10)
    var orgsByBucket = {};
    CM.list.forEach(function (c) { (orgsByBucket[c.bucket] = orgsByBucket[c.bucket] || []).push(c.org); });
    Object.keys(orgsByBucket).forEach(function (b) { orgsByBucket[b] = Array.from(new Set(orgsByBucket[b])).sort(function (a, z) { return a.localeCompare(z); }); });
    var maxT = CM.respondentTypes.reduce(function (m, t) { return Math.max(m, t.count); }, 1);
    var ORG_CAP = 3;
    var types = '<div class="cm-types">' + CM.respondentTypes.map(function (t) {
      var orgs = orgsByBucket[t.bucket] || [];
      var pill = function (o) { return '<span class="cm-eg">' + esc(o) + "</span>"; };
      var pills;
      if (orgs.length <= ORG_CAP) {
        pills = orgs.map(pill).join("");
      } else {
        pills = orgs.slice(0, ORG_CAP).map(pill).join("") +
          '<span class="cm-eg-rest">' + orgs.slice(ORG_CAP).map(pill).join("") + "</span>" +
          '<button type="button" class="cm-showmore" aria-expanded="false" data-n="' + orgs.length + '">Show all ' + orgs.length + "</button>";
      }
      return '<div class="cm-type"><div class="cm-bhead"><span class="cm-label">' + esc(t.label) + '</span><span class="cm-n mono">' + t.count + "</span></div>" +
        '<div class="cm-bar"><span style="width:' + Math.round((t.count / maxT) * 100) + '%"></span></div>' +
        '<div class="cm-egs">' + pills + "</div></div>";
    }).join("") + "</div>";

    // themes: keyword prevalence across the analyzed bodies (a measured signal, not a coded position)
    var themes = '<div class="cm-themes">' + CM.themes.map(function (t) {
      return '<div class="cm-theme"><div class="cm-bhead"><span class="cm-label">' + esc(t.label) + '</span><span class="cm-n mono">' + t.pct + '%</span></div>' +
        '<div class="cm-bar theme"><span style="width:' + t.pct + '%"></span></div>' +
        '<p class="cm-note mono">' + t.count + " of " + CM.analyzed + " comments mention it</p></div>";
    }).join("") + "</div>";

    // per-comment reform-principle + order-region tags, aggregated into two bar groups
    var prRegBar = function (t) {
      return '<div class="cm-theme"><div class="cm-bhead"><span class="cm-label">' + esc(t.label) + '</span><span class="cm-n mono">' + t.pct + '%</span></div>' +
        '<div class="cm-bar prin"><span style="width:' + t.pct + '%"></span></div>' +
        '<p class="cm-note mono">' + t.count + " of " + CM.summarized2 + "</p></div>";
    };
    var prReg = '<div class="cm-prreg three">' +
      '<div><h3 class="cm-sub">Comment-period questions</h3><div class="cm-themes one">' + CM.anoprQuestions.map(prRegBar).join("") + "</div></div>" +
      '<div><h3 class="cm-sub">Reform principles</h3><div class="cm-themes one">' + CM.principles.map(prRegBar).join("") + "</div></div>" +
      '<div><h3 class="cm-sub">Order regions</h3><div class="cm-themes one">' + CM.regions.map(prRegBar).join("") + "</div></div></div>";

    // stance map: where commenters land on each reform principle, read from the audited summaries
    var ST_LBL = { sup: "Support", opp: "Oppose", mix: "Mixed", neu: "No position" };
    var stanceBars = "";
    if (CM.principleStances && CM.principleStances.length) {
      var stLegend = '<div class="cm-stancelegend">' +
        '<span class="key sup">Support</span><span class="key opp">Oppose</span><span class="key mix">Mixed</span><span class="key neu">No position</span></div>';
      var stRows = CM.principleStances.map(function (p) {
        var seg = function (k, cls) { var n = p[k]; return n ? '<span class="seg ' + cls + '" style="flex:' + n + '" title="' + n + " " + ST_LBL[cls] + '">' + (n >= 10 ? n : "") + "</span>" : ""; };
        return '<div class="cm-stancerow"><div class="cm-bhead"><span class="cm-label">' + esc(p.label) + '</span><span class="cm-n mono">' + p.total + "</span></div>" +
          '<div class="cm-stancebar" role="img" aria-label="' + esc(p.label) + ": " + p.support + " support, " + p.oppose + " oppose, " + p.mixed + " mixed, " + p.neutral + ' no position">' +
          seg("support", "sup") + seg("oppose", "opp") + seg("mixed", "mix") + seg("neutral", "neu") + "</div></div>";
      }).join("");
      stanceBars = stLegend + '<div class="cm-stancebars">' + stRows + "</div>";
    }

    var rowsByRound = {};
    CM.list.forEach(function (c) { var k = roundOf(c.filed); (rowsByRound[k] = rowsByRound[k] || []).push(c); });
    var allQ = []; // every row's search string, collected so the tag bar can show real match counts
    var listHtml = CM.rounds.map(function (r) {
      var items = (rowsByRound[r.key] || []).map(function (c) {
        var badge = c.s2 ? '<span class="cm-badge dl" title="Audited summary available"><span aria-hidden="true">✓</span><span class="sr-only">audited summary</span></span>'
          : c.dl ? '<span class="cm-badge sum" title="Downloaded but image-only (no text layer) — not summarized"><span aria-hidden="true">○</span><span class="sr-only">scanned, not summarized</span></span>'
          : '<span class="cm-badge no" title="Body not downloaded — eLibrary serves it inline"><span aria-hidden="true">–</span><span class="sr-only">not downloaded</span></span>';
        var type = CM.bucketLabels[c.bucket] || c.bucket;
        var aqChips = (c.aq || []).map(function (k) { return '<button type="button" class="cm-tag aq" data-f="' + esc(AQ[k]) + '" title="Filter the list by: ' + esc(AQ[k]) + '">' + esc(AQ[k]) + "</button>"; }).join("");
        var prChips = (c.pr || []).map(function (k) { return '<button type="button" class="cm-tag pr ' + k + '" data-f="' + esc(CL[k]) + '" title="Filter the list by: ' + esc(CL[k]) + '">' + esc(CL[k]) + "</button>"; }).join("");
        var rgChips = (c.rg || []).map(function (k) { return '<button type="button" class="cm-tag rg" data-f="' + esc(RG[k]) + '" title="Filter the list by: ' + esc(RG[k]) + '">' + esc(RG[k]) + "</button>"; }).join("");
        var grp = function (label, chips) { return chips ? '<span class="sr-only">' + label + ": </span>" + chips : ""; };
        var groups = [grp("Comment-period questions", aqChips), grp("Reform principles", prChips), grp("Regions", rgChips)].filter(Boolean);
        var tags = groups.length ? '<div class="cm-row-tags">' + groups.join('<span class="cm-tagsep" aria-hidden="true"></span>') + "</div>" : "";
        // search index: org/type/lens labels + the overall summary + each position's name. (The bin
        // descriptions and verbatim quotes are deliberately left out — they're lazy-loaded per letter,
        // too heavy to fold into every row's up-front index.)
        var q = (c.org + " " + c.desc + " " + type + " " + (c.aq || []).map(function (k) { return AQ[k]; }).join(" ") + " " + (c.pr || []).map(function (k) { return CL[k]; }).join(" ") + " " + (c.rg || []).map(function (k) { return RG[k]; }).join(" ") + " " + (c.summary || "") + " " + (c.bins || []).map(function (b) { return b.n; }).join(" ")).toLowerCase();
        allQ.push(q);
        // expandable audited read: the plain summary, the positions as stance-colored chips (loaded
        // up front), and — fetched on open — each position's description + the verbatim quotes it draws on
        var analysis = "";
        if (c.s2 && c.summary) {
          var binChips = (c.bins || []).map(function (b) {
            var st = stanceClass(b.s);
            return '<span class="cm-bin ' + st + '">' + esc(b.n) + '<span class="sr-only"> (' + esc(b.s) + ")</span></span>";
          }).join("");
          analysis = '<details class="cm-analysis" data-acc="' + esc(c.acc) + '"><summary><span class="cm-analysis-label">Read the audited analysis</span>' +
            '<span class="cm-analysis-n mono">' + (c.bins ? c.bins.length : 0) + " positions</span></summary>" +
            '<p class="cm-analysis-sum">' + esc(c.summary) + "</p>" +
            (binChips ? '<div class="cm-bins" aria-label="Positions, colored by the filer\'s stance">' + binChips + "</div>" : "") +
            '<div class="cm-bindetail" data-state=""></div>' +
            '<p class="cm-analysis-foot">Each position below carries the filer’s own stance and the verbatim quotes behind it; those quotes are the audit trail, committed in the repository. The stance shown is the filer’s own, read from its words.</p></details>';
        }
        return '<li class="cm-row" data-q="' + esc(q) + '">' +
          '<div class="cm-row-top"><span class="cm-row-date mono">' + esc(fmtD(c.filed)) + "</span>" + badge +
          '<span class="cm-row-org">' + esc(c.org) + "</span>" +
          '<span class="cm-row-type">' + esc(type) + "</span>" +
          '<a class="cm-row-link" href="' + esc(eli(c.acc)) + '" target="_blank" rel="noopener noreferrer" title="Open eLibrary filing ' + esc(c.acc) + '">eLibrary <span class="ext" aria-hidden="true">↗</span></a></div>' +
          '<p class="cm-row-desc">' + esc(c.desc) + "</p>" + tags + analysis + "</li>";
      }).join("");
      return '<section class="cm-listgroup"><h3 class="cm-listgroup-h">' + esc(r.label) + ' <span class="mono">' + r.count + "</span></h3><ul class=\"cm-list\">" + items + "</ul></section>";
    }).join("");
    var filter = '<div class="cm-filter"><input type="search" id="cm-search" placeholder="Filter by organization, type, position, or description…" aria-label="Filter the comment list" autocomplete="off" /><span class="cm-filter-count mono" id="cm-count">' + CM.total + " of " + CM.total + "</span></div>";
    var src = '<div class="srcs"><span class="label">Source</span><a class="src-chip" data-tier="ferc" href="' + esc(CM.source_url) + '" target="_blank" rel="noopener noreferrer" title="FERC eLibrary docket sheet for RM26-4-000">eLibrary · RM26-4 docket sheet</a></div>';

    // discoverable filter vocabulary: a collapsible bar of every lens tag with the count of rows each
    // matches. Count is the text-search count (over the same row strings the filter scans), so it equals
    // the result you get clicking the chip. Chips reuse .cm-tag and the existing chip-click filter.
    var tagCount = function (label) { var t = label.toLowerCase(); return allQ.reduce(function (n, s) { return n + (s.indexOf(t) >= 0 ? 1 : 0); }, 0); };
    var tagChip = function (cls, label) { return '<button type="button" class="cm-tag ' + cls + '" data-f="' + esc(label) + '" title="Filter the list by: ' + esc(label) + '">' + esc(label) + ' <span class="cm-tag-n">' + tagCount(label) + "</span></button>"; };
    var tagGroup = function (heading, cls, map) { return '<div class="cm-tagbar-group"><span class="cm-tagbar-label">' + esc(heading) + "</span>" + Object.keys(map).map(function (k) { return tagChip(cls, map[k]); }).join("") + "</div>"; };
    var tagBar = '<details class="cm-tagbar" open><summary><span class="cm-tagbar-sum">Filter by tag</span><span class="cm-tagbar-hint mono">click any tag · counts = comments mentioning it</span></summary>' +
      '<div class="cm-tagbar-body">' + tagGroup("Comment-period questions", "aq", AQ) + tagGroup("Reform principles", "pr", CL) + tagGroup("Regions", "rg", RG) + "</div></details>";

    // three sub-tabs cut the scroll: the overall picture, the respondent mix, and the comment list itself
    var subtab = function (id, label, sel) {
      return '<button class="cm-subtab" role="tab" id="cmsub-' + id + '" aria-controls="cmsec-' + id + '" aria-selected="' + (sel ? "true" : "false") + '"' + (sel ? "" : ' tabindex="-1"') + ' data-sub="' + id + '">' + esc(label) + "</button>";
    };
    var subnav = '<div class="cm-subtabs" role="tablist" aria-label="Comment-period views">' +
      subtab("overview", "Themes & categories", true) + subtab("types", "Respondent types", false) + subtab("summaries", "All comments", false) + "</div>";

    var secOverview = '<section class="cm-sec" id="cmsec-overview" role="tabpanel" aria-labelledby="cmsub-overview">' +
      head("The RM26-4 comment period",
        CM.total + " comments were filed on DOE's large-load ANOPR (Docket RM26-4-000) between " + fmtD(CM.dateRange.first) + " and " + fmtD(CM.dateRange.last) +
        ", scraped from FERC eLibrary on " + CM.captured + ". " + CM.downloaded + " of " + CM.total + " bodies are downloaded; " + CM.summarized2 + " carry an audited summary. The other " + (CM.total - CM.summarized2) + " are four image-only scans (no text layer, awaiting OCR) and one filing eLibrary serves inline rather than releasing for download.") +
      statRow + rounds +
      head("Top themes", "How often each issue surfaces across the " + CM.analyzed + " text-analyzed bodies — a measured keyword prevalence, not a coding of each filer's position.") + themes +
      head("Where commenters land on each reform", "For each of the five June-order reform principles, the share of audited summaries whose filer supports, opposes, is mixed, or takes no position — read from the filer's own words. Across " + CM.summarized2 + " audited filings.") + stanceBars +
      head("What the comments engage", "Three lenses, tagged per comment from its audited summary: the DOE ANOPR's eight comment-period questions, the five June-order reform principles, and the six show-cause-order regions. A comment can carry several. Across " + CM.summarized2 + " audited filings.") + prReg +
      "</section>";

    var secTypes = '<section class="cm-sec" id="cmsec-types" role="tabpanel" aria-labelledby="cmsub-types" hidden>' +
      head("Who commented", "Every organization that filed, grouped by stakeholder type. The number is filings; larger camps list the first three — open “Show all” for the full roster. Types are keyword-derived from the filer and the filing text.") + types +
      "</section>";

    var secSummaries = '<section class="cm-sec" id="cmsec-summaries" role="tabpanel" aria-labelledby="cmsub-summaries" hidden>' +
      head("All " + CM.total + " comments, in filing order", "Grouped by comment round, oldest first. " + CM.summarized2 + " carry an audited summary — open “Read the audited analysis” on any row for the plain read, then each position grouped by lens with its description and the verbatim quotes behind it. Each row also shows the lenses it engages and links to its eLibrary filing. Filter by org, type, lens, position, or any word in a summary.") +
      filter + tagBar + '<div class="cm-listwrap">' + listHtml + '</div><p class="cm-empty" id="cm-empty" role="status" hidden>No comments match your search. Try a broader term, or clear the filter.</p>' + src + "</section>";

    return subnav + secOverview + secTypes + secSummaries;
  }

  function wireComments() {
    // sub-tab switching within the Comments panel
    var subs = ["overview", "types", "summaries"];
    var showSub = function (name) {
      subs.forEach(function (s) {
        var btn = document.getElementById("cmsub-" + s), sec = document.getElementById("cmsec-" + s);
        if (!btn || !sec) return;
        var on = s === name;
        btn.setAttribute("aria-selected", on ? "true" : "false");
        btn.tabIndex = on ? 0 : -1;
        sec.hidden = !on;
      });
    };
    subs.forEach(function (s) {
      var btn = document.getElementById("cmsub-" + s);
      if (!btn) return;
      btn.addEventListener("click", function () { showSub(s); });
      btn.addEventListener("keydown", function (e) {
        var i = subs.indexOf(s), n = null;
        if (e.key === "ArrowRight") n = (i + 1) % subs.length;
        else if (e.key === "ArrowLeft") n = (i - 1 + subs.length) % subs.length;
        else if (e.key === "Home") n = 0;
        else if (e.key === "End") n = subs.length - 1;
        if (n !== null) { e.preventDefault(); var t = document.getElementById("cmsub-" + subs[n]); showSub(subs[n]); t.focus(); }
      });
    });
    // "Show all" toggles for the respondent-type rosters (camps with >10 organizations)
    [].slice.call(document.querySelectorAll("#panel-comments .cm-showmore")).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var egs = btn.closest(".cm-egs");
        var open = egs.classList.toggle("expanded");
        btn.setAttribute("aria-expanded", open ? "true" : "false");
        btn.textContent = open ? "Show fewer" : "Show all " + btn.getAttribute("data-n");
      });
    });

    // list filter (within the summaries sub-tab)
    var input = document.getElementById("cm-search"), count = document.getElementById("cm-count");
    if (!input) return;
    var rows = [].slice.call(document.querySelectorAll("#panel-comments .cm-row"));
    var groups = [].slice.call(document.querySelectorAll("#panel-comments .cm-listgroup"));
    var empty = document.getElementById("cm-empty");
    input.addEventListener("input", function () {
      var q = input.value.trim().toLowerCase(), shown = 0;
      rows.forEach(function (r) { var hit = !q || r.getAttribute("data-q").indexOf(q) >= 0; r.hidden = !hit; if (hit) shown++; });
      groups.forEach(function (g) { g.hidden = !g.querySelector(".cm-row:not([hidden])"); });
      count.textContent = shown + " of " + rows.length;
      if (empty) empty.hidden = shown !== 0; // explicit empty state — never leave a blank panel
    });
    // clicking a lens chip — in the tag bar or on any row — pre-fills the search and filters
    // (the search box stays the primary control). Scoped to the summaries section so it covers both.
    var summariesSec = document.getElementById("cmsec-summaries");
    if (summariesSec) summariesSec.addEventListener("click", function (e) {
      var chip = e.target.closest(".cm-tag");
      if (!chip || !chip.dataset.f) return;
      input.value = chip.dataset.f;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.focus();
      input.scrollIntoView({ block: "nearest" });
    });

    // lazy-load each audited row's bin detail (description + verbatim quotes) the first time its
    // analysis is opened. The detail is one small file per letter (docs/data/comments/<acc>.json),
    // too heavy to embed across 268 letters; the chips above render up front from comments-data.js.
    var detailCache = {};
    var binItemHtml = function (b, acc) {
      var st = stanceClass(b.stance);
      var pages = b.pages || [];
      var quotes = (b.quotes || []).map(function (q, i) {
        // Page cite links to the filing on eLibrary (the served site can't host the comment PDFs, and
        // eLibrary isn't page-anchorable, so the page number is the locator + the filing is the link).
        var pg = pages[i];
        var cite = pg != null
          ? ' <a class="cm-bq-cite" href="' + esc(eli(acc)) + '" target="_blank" rel="noopener noreferrer" title="Open the eLibrary filing (p. ' + pg + ' of the source document)">p. ' + pg + '<span class="ext" aria-hidden="true"> ↗</span></a>'
          : "";
        return '<li class="cm-bq">“' + esc(q) + "”" + cite + "</li>";
      }).join("");
      return '<div class="cm-binitem ' + st + '">' +
        '<div class="cm-binitem-head"><span class="cm-binitem-name">' + esc(b.name) + "</span>" +
        '<span class="cm-binitem-stance ' + st + '">' + esc(b.stance) + "</span></div>" +
        (b.desc ? '<p class="cm-binitem-desc">' + esc(b.desc) + "</p>" : "") +
        (quotes ? '<ul class="cm-bqs">' + quotes + "</ul>" : '<p class="cm-bq-none mono">No verbatim quote is binned to this position.</p>') +
        "</div>";
    };
    var lensGroupHtml = function (label, items, acc) {
      return '<section class="cm-lensgroup"><h4 class="cm-lensgroup-h">' + esc(label) +
        '<span class="cm-lensgroup-n mono">' + items.length + "</span></h4>" +
        items.map(function (b) { return binItemHtml(b, acc); }).join("") + "</section>";
    };
    var nsOf = function (b) { return String(b.key).split(":")[0]; };
    var renderBinDetail = function (box, d) {
      var bins = d.bins || [];
      var acc = d.acc;
      var html = LENS_ORDER.map(function (ns) {
        var items = bins.filter(function (b) { return nsOf(b) === ns; });
        return items.length ? lensGroupHtml(LENS_LABEL[ns], items, acc) : "";
      }).join("");
      // defensive: any bin whose namespace isn't one of the known lenses still gets shown
      var rest = bins.filter(function (b) { return LENS_ORDER.indexOf(nsOf(b)) < 0; });
      if (rest.length) html += lensGroupHtml("Other positions", rest, acc);
      box.innerHTML = html || '<p class="cm-bin-error">No positions found.</p>';
      box.setAttribute("data-state", "done");
      box.setAttribute("aria-busy", "false");
    };
    var hydrate = function (details) {
      var box = details.querySelector(".cm-bindetail"), acc = details.getAttribute("data-acc");
      if (!box || !acc) return;
      var state = box.getAttribute("data-state");
      if (state === "loading" || state === "done") return;
      if (detailCache[acc]) { renderBinDetail(box, detailCache[acc]); return; }
      box.setAttribute("data-state", "loading");
      box.setAttribute("aria-busy", "true");
      box.innerHTML = '<p class="cm-bin-loading mono" role="status">Loading the quotes…</p>';
      fetch("data/comments/" + acc + ".json?v=" + ASSET_VER)
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (d) { detailCache[acc] = d; renderBinDetail(box, d); })
        .catch(function () {
          box.setAttribute("data-state", "error");
          box.setAttribute("aria-busy", "false");
          box.innerHTML = '<p class="cm-bin-error" role="status">Couldn’t load the quotes here. They’re committed in the repository under <span class="mono">sources/comments/summaries-v2/</span>.</p>';
        });
    };
    // toggle doesn't bubble, so listen per <details>; only audited rows carry .cm-analysis (~268)
    [].slice.call(document.querySelectorAll("#panel-comments .cm-analysis")).forEach(function (d) {
      d.addEventListener("toggle", function () { if (d.open) hydrate(d); });
    });
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
      "<p>Automated clients (curl, server-side fetch, the PDF-fetch tool, the Wayback crawler) are all blocked by Cloudflare on <span class='mono'>ferc.gov/media/e-7…e-12</span>. The six orders were therefore opened in a real browser that passes the challenge, downloaded, and text-extracted (OCR) on 2026-06-22. Each one's <strong>page-1 caption was verified</strong> (FERC reporter cite, respondent RTO, docket number, the title “Order Instituting Proceeding Under Section 206,” and the issued date) before any of its text was used. The per-order directives in Tab 2 are quoted from those PDFs with paragraph cites (e.g. “P 77”); the structured extract is committed at <span class='mono'>sources/orders-extract.json</span>. Each cite offers two links to that page: <strong>PDF</strong> (the committed copy under <span class='mono'>docs/orders/</span>, served with the site so it opens inline and jumps reliably) and <strong>gov</strong> (the official ferc.gov source, page-precise when the browser opens it inline past Cloudflare). FERC's published PDFs drop paragraph numbers from their text layer, so a link is anchored to the page where the quoted language appears, not to a paragraph index. A test checks every link lands on a page that carries its quote. All six orders are 195 FERC ¶ 61,211 to 61,216, 92 to 119 pp, issued June 18, 2026.</p>" +
      "<h4>The RM26-4 public comments, summarized</h4>" +
      "<p>Every comment on the DOE ANOPR was scraped from FERC eLibrary; the bodies were downloaded and text-extracted, then summarized the auditable way (PNNL's “CommentNEPA” method). Verbatim quotes are pulled from each filing, binned to the reform principles, ANOPR questions, and regions (plus emergent topics), and each bin carries the <strong>filer's own stance</strong> and a plain description built from its quotes. A validator confirms every quote appears verbatim in its source, and a flagged minority get a second, independent LLM check. These per-comment summaries are <strong>AI-generated and provisional</strong> — not yet human-verified — so each is shown with its positions traceable to the quotes; the quotes, extracted text, and structured summary are committed under <span class='mono'>sources/comments/</span>. A handful of image-only scans and one filing eLibrary serves inline are not yet summarized.</p>" +
      "<h4>Derived dates</h4>" +
      "<p>The 30-day and 60-day periods are stated by FERC. The specific calendar due-dates are derived from the June 18, 2026 issuance (business-day-adjusted figures attributed to the National Law Review analysis).</p>" +
      "<h4>All sources</h4>" + srcList +
      "<p style='margin-top:10px'><em>Last updated: order record as of " + esc(D.meta.capture) + "; Discourse updated " + esc(D.meta.discourseCapture) + ". Independent analysis; not affiliated with FERC or DOE.</em></p>";
  }

  /* ---- tablist ---- */
  var TABS = ["overview", "timeline", "reforms", "dockets", "comments", "news"];
  var renderers = { overview: renderOverview, timeline: renderTimeline, reforms: renderReforms, dockets: renderDockets, comments: renderComments, news: renderNews };
  var afterRender = { comments: wireComments };
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
        if (!rendered[t]) { panel.innerHTML = renderers[t](); rendered[t] = true; if (afterRender[t]) afterRender[t](); }
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
    // in-page links like the Discourse "Open the Comments tab →" pointer switch tabs via the hash
    window.addEventListener("hashchange", function () {
      var h = (location.hash || "").replace("#", "");
      if (TABS.indexOf(h) >= 0) { activate(h, false); scrollToTabsTop(); }
    });
    var initial = (location.hash || "").replace("#", "");
    activate(TABS.indexOf(initial) >= 0 ? initial : "overview", false);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
