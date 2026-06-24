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

    var commish = "";
    if (D.commissioners && D.commissioners.length) {
      var cards = D.commissioners.map(function (c) {
        return '<div class="commish"><div class="commish-head"><span class="commish-name">' + esc(c.name) +
          '</span><span class="commish-role">' + esc(c.role) + '</span><span class="commish-tag">' + esc(c.short) + "</span></div>" +
          '<p class="commish-gist">' + esc(c.gist) + "</p>" +
          '<div class="commish-quote">“…' + esc(c.quote) + '…”</div></div>';
      }).join("");
      commish = head("What each commissioner emphasized",
        "All five joined every order unanimously; their concurring statements diverge in emphasis. Each statement is quoted from the orders and cited to the exact page of its own order in the Dockets tab.") +
        '<div class="commish-grid">' + cards + "</div>";
    }

    return head("Overview", m.subtitle) +
      '<div class="overview-bg">' + paras(m.summary) + "</div>" +
      stats + glance + commish;
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
    var docs = '<div class="dockets">' + D.dockets.map(function (d, idx) {
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
      var asks = (d.asks && d.asks.length) ? '<div class="docket-asks"><span class="label">What FERC presses ' + esc(d.rto) + ' on (Section IV)</span><ul>' +
        d.asks.map(function (a) { return "<li>" + esc(a) + "</li>"; }).join("") + "</ul></div>" : "";
      // Per-order commissioner statements: the same five concurrences, cited to THIS order's pages.
      var commish = (d.commishPages && D.commissioners) ?
        '<details class="dreg dcom"><summary>What the commissioners said in this order (' + D.commissioners.length + ")</summary><div class=\"commish-rows\">" +
        D.commissioners.map(function (c) {
          var pg = d.commishPages[c.key];
          var links = pg ? '<span class="commish-cite"><span class="dir-para mono">p. ' + pg + "</span>" +
            '<a class="cite-link" href="' + esc(d.pdf) + "#page=" + pg + '" target="_blank" rel="noopener noreferrer" aria-label="Open ' + esc(c.name) +
            "’s concurring statement in the committed " + esc(d.item) + " order PDF at page " + pg + '" title="Committed PDF, opens inline to p. ' + pg +
            '">PDF <span class="ext" aria-hidden="true">↗</span></a>' +
            '<a class="cite-link" href="' + esc(so.url) + "#page=" + pg + '" target="_blank" rel="noopener noreferrer" aria-label="Open the official ferc.gov ' + esc(d.item) +
            " order at page " + pg + '" title="Official ferc.gov source, page ' + pg + '">gov <span class="ext" aria-hidden="true">↗</span></a></span>' : "";
          return '<div class="commish-row"><div class="commish-row-head"><span class="commish-name">' + esc(c.name) +
            '</span><span class="commish-tag">' + esc(c.short) + "</span>" + links + "</div>" +
            '<div class="commish-quote">“…' + esc(c.quote) + '…”</div></div>';
        }).join("") + "</div></details>" : "";
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
      // Accordion: collapsed by default (first open) so all six fit on one screen; expand for detail.
      return '<details class="docket"' + (idx === 0 ? " open" : "") + ">" +
        '<summary class="docket-sum"><span class="item">' + esc(d.item) + "</span>" +
        '<span class="docket-sum-id"><span class="rto">' + esc(d.rto) + '</span> <span class="rto-full">' + esc(d.rtoFull) + "</span>" +
        '<span class="docket-cite mono">' + esc(d.cite) + " · " + esc(d.pages) + " pp · " + esc(d.respondents) + "</span></span>" +
        '<span class="docket-status">' + esc(d.status) + '</span><span class="region mono">' + esc(d.region) + "</span>" +
        '<span class="chev" aria-hidden="true">›</span></summary>' +
        '<div class="docket-body">' + orderLink + unique + directives + asks + commish + region + roster + "</div></details>";
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
      "Every order runs the same §206 spine — the five categories, the clock, and the jurisdictional line are in the Reforms tab; each card here is the region-specific variation. Open one for what’s unique to that system, the page-cited directives and distinct findings, the Section IV asks, what each commissioner said about that order, and every named respondent.") +
      docs +
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

    var LEAN = { right: "Right of center", left: "Left of center", nonpartisan: "Nonpartisan" };
    var voices = '<div class="voices">' + D.voices.map(function (v) {
      return '<div class="voice ' + v.lean + '"><div class="voice-head"><span class="voice-name">' + esc(v.name) +
        '</span><span class="voice-affil">' + esc(v.affil) + '</span>' +
        '<span class="lean-pill ' + v.lean + '">' + esc(LEAN[v.lean]) + "</span></div>" +
        "<p>" + esc(v.take) + "</p>" + srcChips(v.src) + "</div>";
    }).join("") + "</div>";

    // The RM26-4 comment period (stats, respondent types, themes, the full filing list, and the
    // read-in-full flagships) lives in its own Comments tab now; Discourse keeps a short pointer.
    var commentsBlock = D.comments ? (head("Public comments: the RM26-4 ANOPR docket",
      "All " + D.comments.filings + " filings were scraped from FERC eLibrary; " + (window.FERC_COMMENTS ? window.FERC_COMMENTS.downloaded : "270+") +
      " comment bodies were downloaded and text-analyzed. The full timeline-ordered list, the top themes, the respondent-type breakdown, and the nine read-in-full flagship comments are in the Comments tab.") +
      '<p class="cm-jump-wrap"><a class="cm-jump" href="#comments">Open the Comments tab →</a></p>') : "";

    return head("Industry reception",
      "How the shift from the DOE ANOPR to FERC's show cause orders lands across stakeholder camps. Stance reflects the synthesized read of the cited sources, not a FERC determination.") + rec +
      commentsBlock +
      head("Commentary across the spectrum",
      "Named voices from right of center to left of center, plus the research case for load flexibility. Each is the source's own position, not a FERC determination. Commentary gathered " + D.meta.discourseCapture + " (the order record is as of " + D.meta.capture + ").") + voices +
      head("Media & discourse", "The dominant narratives in energy trade press and policy circles.") + disc + outlets;
  }

  /* ---- TAB: Comments (RM26-4 comment period — list, themes, respondent types) ---- */
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function fmtD(mdy) { if (!mdy) return ""; var p = String(mdy).split("/"); return MON[+p[0] - 1] + " " + (+p[1]) + ", " + p[2]; }
  function eli(acc) { return "https://elibrary.ferc.gov/eLibrary/filelist?accession_Number=" + acc; }
  function roundOf(filed) { var p = String(filed).split("/"); if (p[2] === "2025" && +p[0] <= 11) return "initial"; if (p[2] === "2025" && +p[0] === 12) return "reply"; return "supplemental"; }

  function renderComments() {
    var CM = window.FERC_COMMENTS;
    if (!CM) return head("The RM26-4 comment period", "Comment data did not load (js/comments-data.js).");
    var CL = { study: "Study", cost: "Cost", colo: "Co-loc", flex: "Flex", proximate: "Prox-gen" };
    var RG = { pjm: "PJM", miso: "MISO", spp: "SPP", caiso: "CAISO", isone: "ISO-NE", nyiso: "NYISO" };

    var statRow = '<div class="cm-stats">' +
      [[CM.total, "comments filed"], [CM.respondentTypes.length, "respondent types"], [CM.downloaded, "bodies downloaded"], [CM.analyzed, "text-analyzed"], [CM.summarized, "read in full"]]
        .map(function (s) { return '<div class="cm-stat"><span class="v">' + esc(String(s[0])) + '</span><span class="l">' + esc(s[1]) + "</span></div>"; }).join("") + "</div>";

    var rounds = '<div class="cm-rounds">' + CM.rounds.map(function (r) {
      return '<div class="cm-round"><span class="cm-round-n mono">' + r.count + '</span><span class="cm-round-l">' + esc(r.label) +
        '</span><span class="cm-round-d mono">' + esc(fmtD(r.first)) + " – " + esc(fmtD(r.last)) + "</span></div>";
    }).join("") + "</div>";

    // respondent types: counts across all 273 filings; example orgs from the curated buckets where present
    var bmeta = {};
    if (D.comments && D.comments.buckets) D.comments.buckets.forEach(function (b) { bmeta[b.label] = b; });
    var maxT = CM.respondentTypes.reduce(function (m, t) { return Math.max(m, t.count); }, 1);
    var types = '<div class="cm-types">' + CM.respondentTypes.map(function (t) {
      var egs = ((bmeta[t.label] || {}).egs || []).slice(0, 3).map(function (e) { return '<span class="cm-eg">' + esc(e) + "</span>"; }).join("");
      return '<div class="cm-type"><div class="cm-bhead"><span class="cm-label">' + esc(t.label) + '</span><span class="cm-n mono">' + t.count + "</span></div>" +
        '<div class="cm-bar"><span style="width:' + Math.round((t.count / maxT) * 100) + '%"></span></div>' +
        (egs ? '<p class="cm-note"><span class="cm-egs">' + egs + "</span></p>" : "") + "</div>";
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
        '<p class="cm-note mono">' + t.count + " of " + CM.analyzed + "</p></div>";
    };
    var prReg = '<div class="cm-prreg">' +
      '<div><h3 class="cm-sub">Reform principles engaged</h3><div class="cm-themes one">' + CM.principles.map(prRegBar).join("") + "</div></div>" +
      '<div><h3 class="cm-sub">Order regions referenced</h3><div class="cm-themes one">' + CM.regions.map(prRegBar).join("") + "</div></div></div>";

    var flag = "";
    if (D.comments && D.comments.flagships && D.comments.flagships.length) {
      var cards = D.comments.flagships.map(function (fl) {
        var stances = Object.keys(CL).map(function (k) {
          var v = (fl.stances || {})[k] || "silent";
          var cls = /oppose/.test(v) ? "oppose" : /mixed/.test(v) ? "mixed" : /support/.test(v) ? "support" : "silent";
          return '<span class="cm-stance ' + cls + '" title="' + esc(CL[k] + ": " + v) + '">' + esc(CL[k]) + "</span>";
        }).join("");
        return '<div class="cm-flag"><div class="cm-flag-head"><span class="cm-flag-name">' + esc(fl.filer) +
          '</span><span class="cm-eg">' + esc(fl.bucketLabel || fl.bucket) + "</span>" +
          '<a class="cite-link" href="' + esc(fl.elibrary) + '" target="_blank" rel="noopener noreferrer" title="Open eLibrary filing ' + esc(fl.acc) + '">eLibrary <span class="ext" aria-hidden="true">↗</span></a></div>' +
          '<p class="cm-flag-sum">' + esc(fl.summary) + "</p>" +
          (fl.quote ? '<div class="cm-flag-quote">“' + esc(fl.quote) + '”</div>' : "") +
          '<div class="cm-stances">' + stances + "</div></div>";
      }).join("");
      flag = head("Read in depth: flagship comments",
        "One representative comment per major camp, downloaded and read in full, with its stance on each reform category (Study · Cost · Co-loc · Flex · Prox-gen). Each links to its eLibrary filing; the body, extracted text, and a structured summary are committed under sources/comments/.") +
        '<div class="cm-flagships">' + cards + "</div>";
    }

    var rowsByRound = {};
    CM.list.forEach(function (c) { var k = roundOf(c.filed); (rowsByRound[k] = rowsByRound[k] || []).push(c); });
    var listHtml = CM.rounds.map(function (r) {
      var items = (rowsByRound[r.key] || []).map(function (c) {
        var badge = c.sum ? '<span class="cm-badge sum" title="Read in full (flagship)">★</span>'
          : c.dl ? '<span class="cm-badge dl" title="Body downloaded and text-extracted">✓</span>'
          : '<span class="cm-badge no" title="Body not downloaded">–</span>';
        var type = CM.bucketLabels[c.bucket] || c.bucket;
        var prChips = (c.pr || []).map(function (k) { return '<span class="cm-tag pr ' + k + '" title="Engages the ' + esc(CL[k]) + ' reform principle">' + esc(CL[k]) + "</span>"; }).join("");
        var rgChips = (c.rg || []).map(function (k) { return '<span class="cm-tag rg" title="References the ' + esc(RG[k]) + ' region">' + esc(RG[k]) + "</span>"; }).join("");
        var tags = (prChips || rgChips) ? '<div class="cm-row-tags">' + prChips + (rgChips ? '<span class="cm-tagsep" aria-hidden="true"></span>' + rgChips : "") + "</div>" : "";
        var q = (c.org + " " + c.desc + " " + type + " " + (c.pr || []).map(function (k) { return CL[k]; }).join(" ") + " " + (c.rg || []).map(function (k) { return RG[k]; }).join(" ")).toLowerCase();
        return '<li class="cm-row" data-q="' + esc(q) + '">' +
          '<div class="cm-row-top"><span class="cm-row-date mono">' + esc(fmtD(c.filed)) + "</span>" + badge +
          '<span class="cm-row-org">' + esc(c.org) + "</span>" +
          '<span class="cm-row-type">' + esc(type) + "</span>" +
          '<a class="cm-row-link" href="' + esc(eli(c.acc)) + '" target="_blank" rel="noopener noreferrer" title="Open eLibrary filing ' + esc(c.acc) + '">eLibrary <span class="ext" aria-hidden="true">↗</span></a></div>' +
          '<p class="cm-row-desc">' + esc(c.desc) + "</p>" + tags + "</li>";
      }).join("");
      return '<section class="cm-listgroup"><h3 class="cm-listgroup-h">' + esc(r.label) + ' <span class="mono">' + r.count + "</span></h3><ul class=\"cm-list\">" + items + "</ul></section>";
    }).join("");
    var filter = '<div class="cm-filter"><input type="search" id="cm-search" placeholder="Filter by organization, type, or description…" aria-label="Filter the comment list" autocomplete="off" /><span class="cm-filter-count mono" id="cm-count">' + CM.total + " of " + CM.total + "</span></div>";
    var src = '<div class="srcs"><span class="label">Source</span><a class="src-chip" data-tier="ferc" href="' + esc(CM.source_url) + '" target="_blank" rel="noopener noreferrer" title="FERC eLibrary docket sheet for RM26-4-000">eLibrary · RM26-4 docket sheet</a></div>';

    return head("The RM26-4 comment period",
      CM.total + " comments were filed on DOE's large-load ANOPR (Docket RM26-4-000) between " + fmtD(CM.dateRange.first) + " and " + fmtD(CM.dateRange.last) +
      ", scraped from FERC eLibrary on " + CM.captured + ". " + CM.downloaded + " bodies are downloaded and " + CM.analyzed + " text-analyzed for the themes below.") +
      statRow + rounds +
      head("Who commented", "Each filing's stakeholder type, counted across all " + CM.total + " comments. Types are keyword-derived from the filer and filing text.") + types +
      head("Top themes", "How often each issue surfaces across the " + CM.analyzed + " text-analyzed bodies — a measured keyword prevalence, not a coding of each filer's position.") + themes +
      head("Reform principles &amp; order regions", "Per-comment tags from each body: which of the five reform principles it engages, and which of the six show-cause-order RTO regions it references (keyword-detected; a comment can carry several). Out of " + CM.analyzed + " text-analyzed bodies.") + prReg +
      flag +
      head("All " + CM.total + " comments, in filing order", "Grouped by comment round, oldest first. ★ read in full · ✓ body downloaded. Each links to its eLibrary filing.") +
      filter + '<div class="cm-listwrap">' + listHtml + "</div>" + src;
  }

  function wireCommentsFilter() {
    var input = document.getElementById("cm-search"), count = document.getElementById("cm-count");
    if (!input) return;
    var rows = [].slice.call(document.querySelectorAll("#panel-comments .cm-row"));
    var groups = [].slice.call(document.querySelectorAll("#panel-comments .cm-listgroup"));
    input.addEventListener("input", function () {
      var q = input.value.trim().toLowerCase(), shown = 0;
      rows.forEach(function (r) { var hit = !q || r.getAttribute("data-q").indexOf(q) >= 0; r.hidden = !hit; if (hit) shown++; });
      groups.forEach(function (g) { g.hidden = !g.querySelector(".cm-row:not([hidden])"); });
      count.textContent = shown + " of " + rows.length;
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
      "<h4>Derived dates</h4>" +
      "<p>The 30-day and 60-day periods are stated by FERC. The specific calendar due-dates are derived from the June 18, 2026 issuance (business-day-adjusted figures attributed to the National Law Review analysis).</p>" +
      "<h4>All sources</h4>" + srcList +
      "<p style='margin-top:10px'><em>Primary capture date " + esc(D.meta.capture) + "; the secondary commentary in the Discourse tab was gathered " + esc(D.meta.discourseCapture) + ". Independent analysis; not affiliated with FERC or DOE.</em></p>";
  }

  /* ---- tablist ---- */
  var TABS = ["overview", "timeline", "reforms", "dockets", "comments", "news"];
  var renderers = { overview: renderOverview, timeline: renderTimeline, reforms: renderReforms, dockets: renderDockets, comments: renderComments, news: renderNews };
  var afterRender = { comments: wireCommentsFilter };
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
