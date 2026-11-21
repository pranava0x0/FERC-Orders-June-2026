/* app.js — renders FERC_DATA into the three tab panels and wires the tablist.
   No dependencies. Data is authored in data.js (single source of truth); the Comments tab
   additionally lazy-loads one small per-letter bin-detail file on demand (docs/data/comments/). */
(function () {
  "use strict";
  // Cache-buster for the lazily fetched bin-detail JSON. Read off our own <script src> rather than
  // hardcoded: index.html's tokens are content hashes now (tools/stamp-assets.mjs), so a literal here
  // could not hold app.js's own hash without being circular, and "keep this in sync by hand" is exactly
  // the instruction that got missed and shipped a stale-asset bug. Falls back to "dev" off-server.
  var ASSET_VER = (function () {
    var s = document.currentScript || document.querySelector('script[src*="js/app.js"]');
    var m = s && s.src && s.src.match(/[?&]v=([A-Za-z0-9_-]+)/);
    return m ? m[1] : "dev";
  })();
  // A Comments route parsed from the URL hash, held until the panel is rendered and wired, then applied.
  var pendingCommentsRoute = null;
  // Set by wireComments once the Comments panel exists; drives sub-tab + row-permalink navigation.
  var applyCommentsRoute = null;
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
    if (s.short) return s.short; // an org name too long for a chip (the PJM TOs' committee is 56 chars)
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
  // Collapsible section: same heading + lede as head(), but the body folds away to cut scrolling on the
  // long flat tabs. Sections start closed; `open` is for a route that opens one on purpose. Item counts are
  // not shown on the summary: the heading says what is inside.
  function accSection(h2, lede, body, open, count, id) {
    // The title carries role="heading" aria-level="2" so screen-reader heading navigation and the
    // document landmarks keep these sections even when collapsed (a bare styled <span> drops them).
    // Kept as a <span> (an inline disclosure label inside <summary>), not a block <h2>, so the summary
    // stays a lightweight toggle row; the ARIA role gives it the same heading semantics either way.
    return '<details class="acc"' + (id ? ' id="' + esc(id) + '"' : "") + (open ? " open" : "") + '><summary class="acc-sum">' +
      '<span class="acc-h2" role="heading" aria-level="2">' + esc(h2) + "</span>" +
      '<span class="acc-chev" aria-hidden="true">›</span></summary>' +
      (lede ? '<p class="acc-lede">' + esc(lede) + "</p>" : "") + body + "</details>";
  }
  function paras(arr) { return arr.map(function (p) { return "<p>" + esc(p) + "</p>"; }).join(""); }

  /* ---- Procedural clock (the §206 timeline; status computed in-browser against today) ---- */
  var PROC_MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function fmtISO(iso) { if (!iso) return ""; var p = String(iso).split("-"); return PROC_MON[+p[1] - 1] + " " + (+p[2]) + ", " + p[0]; }
  // Tag each step past / next / upcoming / pending by comparing its derived date to today. The single
  // soonest future-dated step is "next"; steps with no fixed date (relative windows) stay "pending".
  // A step FERC has formally reset carries `revised`, and the reset date is the one that governs:
  // status, the "next" pick and every derived filing-matrix cell measure against it. Otherwise a
  // deadline that merely MOVED would render as six operators that missed it.
  function stepWhen(s) { return (s.revised && s.revised.date) || s.date; }
  function procStatus() {
    var P = D.procedural; if (!P || !P.steps) return null;
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var steps = P.steps.map(function (s) {
      var iso = stepWhen(s);
      var d = iso ? new Date(iso + "T00:00:00") : null;
      return { s: s, date: d, status: d ? (d < today ? "past" : "upcoming") : "pending" };
    });
    var next = null;
    steps.forEach(function (x) { if (x.date && x.date >= today && (!next || x.date < next.date)) next = x; });
    if (next) next.status = "next";
    return { steps: steps, next: next };
  }
  // The collision callout, derived. Returns "" unless the two dates genuinely coincide.
  function collideNote() {
    var P = D.procedural, e2 = D.tracks && D.tracks.e2;
    var step = (P && P.steps || []).filter(function (x) { return x.id === "showcause"; })[0];
    if (!step || !e2 || !e2.next || !e2.next.date) return "";
    var when = stepWhen(step);
    if (!when || when !== e2.next.date) return "";
    // How many dockets actually land on this date, counted, not asserted: SPP was granted 95 days
    // rather than 90, so "the six" would be wrong by one.
    var on = (D.dockets || []).filter(function (d) { return d.abeyance && d.abeyance.due === when; }).length;
    var total = (D.dockets || []).filter(function (d) { return d.abeyance; }).length;
    var which = !total ? "the six show-cause responses"
      : on === total ? "all " + total + " show-cause responses"
      : on + " of the " + total + " show-cause responses";
    return '<p class="proc-collide"><span class="proc-collide-lbl">Same deadline</span> ' +
      esc(fmtISO(when)) + " carries both " + esc(which) + " and PJM\u2019s co-location " +
      "compliance filing in the separate " + esc(e2.short || "EL25-49") + " docket.</p>";
  }

  function renderProcedural() {
    var P = D.procedural, ps = procStatus();
    if (!ps) return "";
    var STATUS_LBL = { past: "Passed", next: "Next", upcoming: "Upcoming", pending: "Pending" };
    var rows = ps.steps.map(function (x) {
      var s = x.s;
      // `movedFrom` needs BOTH dates: a reset on a step that never had a fixed date has nothing to
      // strike through, and would render a bare "was ". `moved` still gates the explanation, which
      // is meaningful either way.
      var moved = s.revised && s.revised.date;
      var movedFrom = moved && s.date;
      var when = x.date ? fmtISO(stepWhen(s)) : (s.dateNote || "TBD");
      // Policy calendar: how many crosswalk issues land on this step, linking to the policy map.
      var landing = pmIssuesForStep(s.id);
      var landChip = landing.length
        ? '<a class="proc-lands" href="#' + window.CommentsRoute.serialize({ sub: "issue" }) +
          '" title="See these issues on the policy map">' + landing.length + " record " +
          (landing.length === 1 ? "issue lands" : "issues land") + ' here <span aria-hidden="true">→</span></a>'
        : "";
      return '<li class="proc-step ' + x.status + '"' + (x.status === "next" ? ' aria-current="date"' : "") + ">" +
        '<div class="proc-when"><span class="proc-date mono">' + esc(when) + "</span>" +
        (movedFrom ? '<span class="proc-was mono">was ' + esc(fmtISO(s.date)) + "</span>" : "") +
        '<span class="proc-badge ' + x.status + '">' + STATUS_LBL[x.status] + "</span></div>" +
        '<div class="proc-what"><div class="proc-headline"><span class="proc-label">' + esc(s.label) + "</span>" +
        '<span class="proc-period mono">' + esc(s.period) + " · " + esc(s.cite) + "</span></div>" +
        '<p class="proc-desc">' + esc(s.desc) + "</p>" +
        (moved ? '<p class="proc-revised">Moved to <span class="mono">' + esc(fmtISO(s.revised.date)) +
          "</span> by " + esc(s.revised.by) + ". " + esc(s.revised.note) + "</p>" : "") +
        (s.dateNote && x.date ? '<p class="proc-note mono">' + esc(s.dateNote) + "</p>" : "") + landChip + "</div></li>";
    }).join("");
    return '<span id="proc-h" class="jump-anchor"></span><p class="acc-lede">' + esc(P.basis) + "</p>" +
      '<ol class="proc-board">' + rows + "</ol>" +
      // Two clocks, one date: the §206 show-cause step and the separate EL25-49 co-location compliance
      // filing have repeatedly landed on the same day, which is exactly the confusion the tracks model
      // exists to prevent. DERIVED, not written: it reads the operative show-cause date (post-abeyance
      // where FERC reset it) and the E-2 track's own next date, and renders only while they actually
      // match. This paragraph previously hardcoded "August 17" and was still asserting it after both
      // clocks moved to November, which is the failure this derivation removes.
      collideNote() +
      renderFilingMatrix() +
      // The old foot described one evidence base. There are now two, and they are not equally strong.
      '<p class="proc-foot">The clock above is arithmetic: dates derived from the ' + esc(P.issuedLabel) +
      " issuance, business-day-adjusted, and status computed against today. The matrix below it is " +
      "observation, and a much weaker guarantee: it records only what our checks actually found, on " +
      "the evidence noted per cell. Confirm each deadline in the order, and each filing on the docket, " +
      "before relying on either.</p>";
  }

  /* ---- Per-RTO filing matrix (news-tracks-plan.md Feature B) ---- */
  // Stored rows are observations only; every other cell is derived from the clock here, so the grid
  // cannot go stale into a false "nothing was filed". The chips are lossy on their own, so each carries
  // the full sentence in aria-label (the house rule for a glyph standing in for a fact).
  var FILING_STATUS = {
    "filed-verified": { lbl: "Filed", sentence: "Filed, and confirmed against an eLibrary accession." },
    "filed-reported": { lbl: "Filed (reported)", sentence: "Reported filed by press or the operator’s own channel. Not confirmed on the docket." },
    signaled: { lbl: "Signaled", sentence: "The operator has announced it intends to file. Nothing on the docket yet." },
    "none-observed": { lbl: "Not observed", sentence: "The deadline has passed and our checks found nothing. That is not proof nothing was filed." },
    upcoming: { lbl: "Upcoming", sentence: "The deadline has not arrived yet." },
    na: { lbl: "N/A", sentence: "This step does not apply here." },
  };

  // (docket, step) -> stored observation, if any.
  function filingObs(docket, stepId) {
    var F = D.procedural && D.procedural.filings;
    if (!F) return null;
    return (F.rows || []).filter(function (r) { return r.docket === docket && r.step === stepId; })[0] || null;
  }
  // The derived half: no observation means the answer depends only on whether the date has passed.
  // `ps` is one clock snapshot passed in by the caller, so every cell in a render is derived against the
  // same instant (and we don't re-map all seven steps 18 times to say the same thing).
  // A docket can carry its own reset date for a step: FERC granted SPP 95 days rather than 90, so its
  // show-cause response is due Nov 20 while the other five are Nov 16. The procedural board shows one
  // date because it describes the ORDER; the matrix is per-docket, so it measures each docket against
  // its own. Without this, SPP's cell reads "the deadline has passed and our checks found nothing"
  // for the three days between the two dates, contradicting SPP's own card on the same page.
  function docketStepDate(docket, stepId) {
    if (stepId !== "showcause") return null;
    var d = (D.dockets || []).filter(function (x) { return x.docket === docket; })[0];
    return (d && d.abeyance && d.abeyance.due) || null;
  }
  function filingCell(docket, stepId, ps) {
    var obs = filingObs(docket, stepId);
    if (obs) return { status: obs.status, obs: obs };
    var own = docketStepDate(docket, stepId);
    if (own) {
      var today = new Date(); today.setHours(0, 0, 0, 0);
      return { status: new Date(own + "T00:00:00") < today ? "none-observed" : "upcoming", obs: null };
    }
    var clock = ps || procStatus();
    var hit = clock && clock.steps.filter(function (x) { return x.s.id === stepId; })[0];
    var passed = hit && hit.date && hit.status === "past";
    return { status: passed ? "none-observed" : "upcoming", obs: null };
  }
  // Counts for the masthead chip and the matrix caption. Derived, never hand-written.
  function filingTally(stepId) {
    var six = D.dockets || [];
    var ps = procStatus();
    var seen = six.filter(function (d) {
      var c = filingCell(d.docket, stepId, ps);
      return c.status === "filed-verified" || c.status === "filed-reported";
    }).length;
    return { seen: seen, total: six.length };
  }

  function renderFilingMatrix() {
    var F = D.procedural && D.procedural.filings;
    if (!F || !F.steps || !D.dockets) return "";
    var stepById = {};
    (D.procedural.steps || []).forEach(function (s) { stepById[s.id] = s; });
    var cols = F.steps.filter(function (id) { return stepById[id]; });

    var headCells = cols.map(function (id) {
      var s = stepById[id];
      var when = stepWhen(s);
      return '<th scope="col"><span class="fm-col">' + esc(s.label) + "</span>" +
        (when ? '<span class="fm-coldate mono">' + esc(fmtISO(when)) + "</span>" : "") +
        (s.revised && s.revised.date && s.date ? '<span class="fm-colwas mono" title="' + esc(s.revised.note || "") +
          '">moved from ' + esc(fmtISO(s.date)) + "</span>" : "") + "</th>";
    }).join("");

    var ps = procStatus();   // one clock snapshot for the whole grid
    var bodyRows = D.dockets.map(function (d) {
      var cells = cols.map(function (id) {
        var c = filingCell(d.docket, id, ps);
        var m = FILING_STATUS[c.status] || { lbl: c.status, sentence: c.status };
        var when = c.obs && c.obs.date ? '<span class="fm-when mono">' + esc(fmtISO(c.obs.date)) + "</span>" : "";
        var label=d.rto + ", " + stepById[id].label + ": " + m.sentence;
        var chip=c.obs && c.obs.reader ? '<a class="fm-chip fm-' + esc(c.status) + '" href="reading/' + esc(c.obs.reader) + '/" aria-label="' + esc(label+' Read the filing.') + '">' + esc(m.lbl) + '</a>' :
          '<span class="fm-chip fm-' + esc(c.status) + '" role="img" aria-label="' + esc(label) + '">' + esc(m.lbl) + '</span>';
        return '<td>'+chip+when+'</td>';
      }).join("");
      return '<tr><th scope="row"><span class="fm-rto">' + esc(d.rto) +
        '</span><span class="fm-docket mono">' + esc(d.docket) + "</span></th>" + cells + "</tr>";
    }).join("");

    // Every observation in full, beneath the grid. The chips are the at-a-glance layer; this is where
    // the gist, the date and the sources live, so nothing is hidden behind a hover or a popover.
    var obsList = (F.rows || []).map(function (r) {
      var d = (D.dockets || []).filter(function (x) { return x.docket === r.docket; })[0];
      var m = FILING_STATUS[r.status] || { lbl: r.status };
      var acc = r.accession
        ? ' <a class="cite-link" href="' + esc(eli(r.accession)) + '" target="_blank" rel="noopener noreferrer">eLibrary ' +
          esc(r.accession) + ' <span class="ext" aria-hidden="true">↗</span></a>'
        : "";
      return '<li class="fm-obs"><div class="fm-obs-head"><span class="fm-chip fm-' + esc(r.status) + '">' + esc(m.lbl) + "</span>" +
        '<span class="fm-obs-who">' + esc((d ? d.rto : r.docket) + " · " + ((stepById[r.step] || {}).label || r.step)) + "</span>" +
        '<span class="fm-when mono">' + esc(fmtISO(r.date)) + "</span></div>" +
        '<p class="fm-obs-gist">' + esc(r.gist) + "</p>" + srcChips(r.src) + acc + "</li>";
    }).join("");

    var tally = filingTally("report");
    return '<section class="fm" aria-labelledby="fm-h">' +
      '<div class="fm-head"><h4 id="fm-h">What has been filed</h4>' +
      '<span class="fm-asof mono">checked ' + esc(F.asOf) + "</span></div>" +
      '<p class="fm-lede">' + esc(F.note) + "</p>" +
      '<div class="fm-scroll"><table class="fm-table"><caption class="sr-only">Observed filings by grid operator and procedural step. ' +
      esc(tally.seen + " of " + tally.total + " generation-adequacy reports observed.") + '</caption>' +
      "<thead><tr><th scope=\"col\">Grid operator</th>" + headCells + "</tr></thead>" +
      "<tbody>" + bodyRows + "</tbody></table></div>" +
      (obsList ? '<h5 class="fm-obs-h">What we observed</h5><ul class="fm-obs-list">' + obsList + "</ul>" : "") +
      "</section>";
  }

  // ---- Record-to-rule crosswalk (data.js → policyMap; policy-analysis-spec.md Part 4.1) ----------
  // Curator-judgment lane joining four surfaces the site already holds: what DOE's ANOPR asked, what
  // the June 18 orders DID (verbatim, page-cited), and where it goes NEXT on the §206 clock. Rendered as
  // a strip atop each By-issue read and as the reader's landing grid. Every did.q is verified by
  // tests/policy-map.test.mjs, so these quotes carry the same guarantee as the docket directives.
  var ORDER_BY_ITEM = {};
  (D.dockets || []).forEach(function (d) { ORDER_BY_ITEM[d.item] = d; });
  if (D.colocation) ORDER_BY_ITEM[D.colocation.item] = D.colocation;
  var POLICY_BY_ISSUE = {};
  (D.policyMap || []).forEach(function (r) { POLICY_BY_ISSUE[r.issue] = r; });

  var PM_STATUS = {
    directed: { lbl: "Directed", sentence: "Directed: the June 18 orders direct a tariff change on this." },
    briefed: { lbl: "Posed as a question", sentence: "Posed as a Section IV briefing question: asked, not decided." },
    resolved: { lbl: "Resolved in E-2", sentence: "Resolved in the E-2 co-location order." },
    silent: { lbl: "Not addressed", sentence: "Not addressed by the orders; it stays open in the RM26-4 rulemaking." },
  };
  var PM_VEHICLE = {
    "compliance-filing": "Show-cause / tariff filing",
    "e2-paper-hearing": "E-2 compliance & paper hearing",
    "rm26-4-rule": "Open in the RM26-4 rulemaking",
  };

  function pmStatusChip(status) {
    var m = PM_STATUS[status] || { lbl: status, sentence: status };
    return '<span class="cm-pm-chip cm-pm-' + status + '" role="img" aria-label="' + esc(m.sentence) + '">' + esc(m.lbl) + "</span>";
  }

  // Look up a next.step on the live clock so the chip flips Passed/Upcoming automatically (same
  // today-comparison as the procedural board). Returns "" when the step carries no fixed date.
  function pmStepWhen(stepId) {
    if (!stepId) return null;
    var ps = procStatus();
    var hit = ps && ps.steps.filter(function (x) { return x.s.id === stepId; })[0];
    if (!hit || !hit.date) return null;
    // `hit.date`/`hit.status` are computed from the operative date, so `when` must be too, or the chip
    // pairs a superseded date with a status derived from a different one: "Aug 17, 2026 · Upcoming".
    return { when: fmtISO(stepWhen(hit.s)), flag: hit.status === "past" ? "Passed" : "Upcoming" };
  }

  function pmNextChip(next) {
    if (!next) return "";
    var label = PM_VEHICLE[next.vehicle] || next.vehicle;
    var w = pmStepWhen(next.step);
    var dateBit = w ? ' <span class="cm-pm-when mono">' + esc(w.when) + " · " + w.flag + "</span>" : "";
    return '<span class="cm-pm-nextchip"><span class="cm-pm-next-lbl">Next</span> ' + esc(label) + dateBit + "</span>";
  }

  // Crosswalk rows whose forward link lands on a given procedural step — turns the clock into a policy
  // calendar ("N issues land here"). Only rows with a dated next.step count.
  function pmIssuesForStep(stepId) {
    return (D.policyMap || []).filter(function (r) { return r.next && r.next.step === stepId; });
  }

  // Deep-link from a Reforms category card (key = study/cost/…) into the By-issue record on it, with the
  // crosswalk status chip so the Reforms tab reads what the orders did, not just what they proposed.
  function pmReformLink(catKey) {
    var key = "pr:" + catKey;
    var pol = POLICY_BY_ISSUE[key];
    if (!pol) return "";
    var href = "#" + window.CommentsRoute.serialize({ sub: "issue", params: { id: key } });
    return '<p class="cm-xlink">' + pmStatusChip(pol.status) +
      ' <a class="cm-agg-link" href="' + href + '">Read the record on this by issue <span aria-hidden="true">→</span></a></p>';
  }

  // Deep-link from a Section IV briefing question to the issue whose crosswalk row briefs it. The join key
  // is policyMap.next.briefingId; the question is a Section IV ask, so the record is where the answer lives.
  function pmBriefingLink(briefingId) {
    var matches = (D.policyMap || []).filter(function (r) { return r.next && r.next.briefingId === briefingId; });
    // a briefing question maps to its reform principle first; prefer the pr: issue over an aq: cross-ref
    var row = matches.filter(function (r) { return r.issue.indexOf("pr:") === 0; })[0] || matches[0];
    if (!row) return "";
    var href = "#" + window.CommentsRoute.serialize({ sub: "issue", params: { id: row.issue } });
    return '<a class="cm-xlink-inline" href="' + href + '" title="Read the record on this by issue">what the record says <span aria-hidden="true">→</span></a>';
  }

  // Compact next label for the landing grid's last column.
  function pmNextShort(next) {
    if (!next) return "";
    var w = pmStepWhen(next.step);
    if (w) return w.when;
    if (next.vehicle === "rm26-4-rule") return "RM26-4";
    return PM_VEHICLE[next.vehicle] || next.vehicle;
  }

  function pmDidCite(row) {
    var ord = ORDER_BY_ITEM[row.did.order];
    var pg = row.did.pg;
    if (!ord) return '<span class="dir-para mono">' + esc(row.did.order) + " · p. " + pg + "</span>";
    var so = D.SOURCES[ord.url];
    var links = '<a class="cite-link" href="' + esc(ord.pdf) + "#page=" + pg +
      '" target="_blank" rel="noopener noreferrer" aria-label="Open the committed ' + esc(row.did.order) +
      " order PDF at page " + pg + '">PDF <span class="ext" aria-hidden="true">↗</span></a>';
    if (so) links += '<a class="cite-link" href="' + esc(so.url) + "#page=" + pg +
      '" target="_blank" rel="noopener noreferrer" aria-label="Open the official ferc.gov ' + esc(row.did.order) +
      " order at page " + pg + '">gov <span class="ext" aria-hidden="true">↗</span></a>';
    return '<span class="cm-pm-cite"><span class="dir-para mono">' + esc(row.did.order) + " · p. " + pg + "</span>" + links + "</span>";
  }

  // The "from record to rule" strip: rendered above the stance groups when an issue has a crosswalk row.
  function pmStrip(row) {
    if (!row) return "";
    var didLine = row.did
      ? '<div class="cm-pm-didline"><span class="cm-pm-quote">“' + esc(row.did.q) + '”</span>' + pmDidCite(row) + "</div>"
      : "";
    var briefBit = "";
    if (row.next && row.next.briefingId && D.briefing) {
      var q = (D.briefing.questions || []).filter(function (x) { return x.id === row.next.briefingId; })[0];
      if (q) briefBit = '<span class="cm-pm-brief">Briefs the “' + esc(q.t) + '” question (§ IV)</span>';
    }
    return '<section class="cm-pm-strip" aria-label="From record to rule">' +
      '<div class="cm-pm-head"><span class="cm-pm-kicker">From record to rule</span>' + pmStatusChip(row.status) + "</div>" +
      '<div class="cm-pm-anopr"><span class="cm-pm-lbl">DOE ANOPR asked</span> ' + esc(row.anopr) + "</div>" +
      didLine +
      '<div class="cm-pm-forward">' + pmNextChip(row.next) + briefBit + "</div>" +
      '<p class="cm-pm-note"><span class="cm-pm-lbl">Curator’s read</span> ' + esc(row.note) + "</p>" +
      '<p class="cm-pm-foot">Curator judgment. It reports what the June 18 orders did; it does not forecast what comes next.</p>' +
      "</section>";
  }

  /* ---- TAB: Overview (stats + at-a-glance + background) ---- */
  // The June 18 concurring statements: lived on the Overview until the Commissioners tab (2026-11-09).
  function renderJuneStatements() {
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
        return '<article class="commish-rowcard" data-key="' + esc(c.key) + '"><div class="commish"><div class="commish-head"><span class="commish-name">' + esc(c.name) +
          '</span><span class="commish-role">' + esc(c.role) + '</span><span class="commish-tag">' + esc(c.short) + "</span></div>" +
          '<p class="commish-gist">' + esc(c.gist) + "</p>" +
          '<div class="commish-quote">“…' + esc(c.quote) + '…”' + commissionerQuoteCite(c, c.quotePg) + "</div></div>" + themed(c) + "</article>";
      }).join("");
      return '<span id="commish-h" class="jump-anchor"></span>' + head("June 18: what each commissioner emphasized",
        "All five joined every order.") +
        '<div class="commish-list">' + cards + "</div>";
    }
    return "";
  }

  function readingLeads(compact) {
    var rows = D.meta.readingLeads.map(function (s) {
      return '<article><h3><a href="' + esc(s.href) + '">' + esc(s.title) + '</a></h3>' +
        (compact ? '' : '<p>' + esc(s.text) + '</p>' + srcChips([s.cite])) + '</article>';
    }).join('');
    return '<section class="reader-leads' + (compact ? ' compact' : '') + '" aria-label="Questions in the filings">' + rows + '</section>';
  }
  function todayISO() { var t = new Date(); t.setHours(0, 0, 0, 0); return t.getFullYear() + "-" + ("0" + (t.getMonth() + 1)).slice(-2) + "-" + ("0" + t.getDate()).slice(-2); }
  function daysUntil(iso) {
    if (!iso) return NaN;
    var t = new Date(); t.setHours(0, 0, 0, 0);
    return Math.round((new Date(String(iso).slice(0, 10) + "T00:00:00") - t) / 86400000);
  }
  function inDays(n) { return n === 0 ? "today" : n === 1 ? "tomorrow" : n > 1 ? "in " + n + " days" : n === -1 ? "yesterday" : (-n) + " days ago"; }
  function firstSentence(t) { var m = String(t || "").match(/^.+?[.!?](?=\s+[A-Z“(]|$)/); return m ? m[0] : String(t || ""); }
  function isoOf(e) { return String(e.iso || "").slice(0, 10); }

  // Swimlane graphic: one lane per track, a mark per dated timeline entry, a line for today. The months
  // before the June 18 orders are compressed to the first fifth of the width so the post-order record,
  // where nearly every event sits, gets the room. Marks link into the Timeline filtered to their track.
  function timelineGraphic() {
    var ids = Object.keys(D.tracks || {});
    var ev = (D.timeline || []).filter(function (e) { return /^\d{4}-\d{2}-\d{2}/.test(e.iso || "") && D.tracks[e.track]; });
    if (!ids.length || !ev.length) return "";
    var t0 = Date.parse("2025-10-01"), tJ = Date.parse("2026-06-01"), t1 = Date.parse("2027-02-01");
    var W = 1000, L = 150, R = 16, lane = 30, top = 26, H = top + ids.length * lane + 8, usable = W - L - R;
    var x = function (iso) {
      var t = Date.parse(String(iso).slice(0, 10));
      var f = t < tJ ? 0.2 * (t - t0) / (tJ - t0) : 0.2 + 0.8 * (t - tJ) / (t1 - tJ);
      return L + Math.max(0, Math.min(1, f)) * usable;
    };
    var ticks = ["2025-10-01", "2026-01-01", "2026-06-01", "2026-07-01", "2026-08-01", "2026-09-01", "2026-10-01", "2026-11-01", "2026-12-01", "2027-01-01"];
    var MONS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var axis = ticks.map(function (d) {
      var X = x(d).toFixed(1), m = +d.slice(5, 7);
      return '<line x1="' + X + '" x2="' + X + '" y1="' + (top - 6) + '" y2="' + (H - 6) + '" class="tg-grid"/>' +
        '<text x="' + X + '" y="' + (top - 10) + '" class="tg-month">' + MONS[m - 1] + (m === 1 || d === ticks[0] ? " ’" + d.slice(2, 4) : "") + "</text>";
    }).join("");
    var lanes = ids.map(function (id, i) {
      var y = top + i * lane + lane / 2;
      return '<a href="#timeline/track/' + esc(id) + '"><text x="0" y="' + (y + 4) + '" class="tg-lane">' + esc(D.tracks[id].short || D.tracks[id].label) + "</text></a>" +
        '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '" class="tg-rail"/>';
    }).join("");
    var marks = ev.map(function (e) {
      var y = top + ids.indexOf(e.track) * lane + lane / 2, X = x(e.iso).toFixed(1);
      var shape = e.kind === "deadline"
        ? '<rect x="' + (X - 5) + '" y="' + (y - 5) + '" width="10" height="10" transform="rotate(45 ' + X + " " + y + ')" class="tg-m tg-' + esc(e.kind) + '"/>'
        : '<circle cx="' + X + '" cy="' + y + '" r="4.5" class="tg-m tg-' + esc(e.kind) + '"/>';
      return '<a href="#timeline/track/' + esc(e.track) + '" aria-label="' + esc(e.date + ": " + e.title) + '"><title>' + esc(e.date + ": " + e.title) + "</title>" + shape + "</a>";
    }).join("");
    var tx = x(todayISO()).toFixed(1);
    var today = '<line x1="' + tx + '" x2="' + tx + '" y1="' + (top - 4) + '" y2="' + (H - 4) + '" class="tg-today"/><text x="' + tx + '" y="' + (H) + '" class="tg-today-l">today</text>';
    return '<figure class="tg"><div class="tg-scroll"><svg viewBox="0 0 ' + W + " " + (H + 6) + '" role="img" aria-labelledby="tg-cap">' + axis + lanes + marks + today + "</svg></div>" +
      '<figcaption id="tg-cap">Circles are actions; diamonds are deadlines. Months before June 2026 are compressed.</figcaption></figure>';
  }

  // One row per order: the operator, its reset deadline, what it has said it will file, and the two
  // places to go next. The plan text is the filing matrix's own observation, so the two never disagree.
  function operatorTable() {
    var ps = procStatus();
    var STATUS = { "signaled": "Said it will file", "filed-verified": "Filed", "filed-reported": "Reported filed", "upcoming": "Not yet due", "none-observed": "Nothing observed" };
    var rows = (D.dockets || []).map(function (d) {
      var c = filingCell(d.docket, "showcause", ps), nx = d.next;
      var gist = c.obs ? c.obs.gist : "";
      var n = nx && nx.iso ? daysUntil(nx.iso) : -1;
      return '<tr><th scope="row"><a href="#dockets/' + esc(docketKey(d.docket)) + '">' + esc(d.rto) + '</a> <span class="ot-item">' + esc(d.item) + " · " + esc(d.docket.replace(/-000$/, "")) + "</span></th>" +
        '<td><span class="ot-status st-' + esc(c.status) + '">' + esc(STATUS[c.status] || c.status) + '</span> <span class="ot-gist">' + esc(firstSentence(gist)) + "</span></td>" +
        '<td class="ot-due">' + (nx ? (nx.iso ? '<span class="mono">' + esc(fmtISO(nx.iso).replace(/, \d{4}$/, "")) + "</span>" + (n >= 0 ? ' <span class="ot-days">' + inDays(n) + "</span>" : "") + "<br>" : "") + esc(nx.what) : '<span class="na">—</span>') + "</td>" +
        // A filed row opens the filing itself (routeFiling finds a document in whichever group holds it).
        '<td class="ot-go"><a href="#filings/sc-' + esc(d.rto.toLowerCase().replace(/[^a-z]/g, "")) + (c.obs && c.obs.reader ? "/" + esc(c.obs.reader) + '">Read the filing' : '">Filings') + "</a></td></tr>";
    }).join("");
    return '<div class="table-wrap"><table class="ot"><thead><tr><th>Operator and order</th><th>Status</th><th>Next</th><th></th></tr></thead><tbody>' + rows + "</tbody></table></div>";
  }

  /* ---- Asked and answered: DOE's ANOPR principle -> the June order's words -> what each operator filed ---- */
  // data/answers.json is written by tools/build-record-data.mjs from the reform key a reading puts on
  // each point. A blank cell means none of the points read from that filing names the reform. It is
  // not a finding that the filing is silent on it, and the copy says so.
  var xwAnswers = null, xwPending = null;
  // Reform names are the June orders' own Section III headings (D.categories[].title), not paraphrases.
  function xwOrders() {
    return (D.dockets || []).slice().sort(function (a, b) { return +a.item.slice(2) - +b.item.slice(2); });
  }
  function xwShort(rto) { return rto === "ISO-NE" ? "ISO-NE" : rto; }
  function xwFor(item, key) { return (xwAnswers || []).filter(function (a) { return a.item === item && a.reform === key; }); }
  function xwSummaryDots(key) {
    return '<span class="xw-dots">' + xwOrders().map(function (o) {
      var n = xwFor(o.item, key).length;
      return '<span class="xw-dot' + (n ? " on" : "") + '" title="' + esc(o.rto + (n ? ": " + n + (n === 1 ? " point" : " points") + " quoted" : ": none quoted")) + '"><span class="xw-dot-l">' + esc(xwShort(o.rto)) + '</span><span class="sr-only">' + (n ? ", answered" : ", not quoted") + "</span></span>";
    }).join("") + "</span>";
  }
  function xwBody(c) {
    var ps = procStatus();
    var doe = '<div class="xw-doe"><p class="xw-step"><span class="xw-n">1</span> DOE proposed, Oct 2025 <span class="xw-cite">ANOPR, RM26-4</span></p><ul>' +
      c.doe.map(function (d) { return "<li>" + esc(d) + "</li>"; }).join("") + "</ul></div>";
    var rows = xwOrders().map(function (o) {
      var dir = (o.dir || []).filter(function (x) { return x.reform === c.key; })[0];
      var asked = dir ? '<blockquote class="xw-q">“' + esc(dir.q) + '” <a class="mono" href="' + esc(o.pdf) + "#page=" + dir.pg + '" target="_blank" rel="noopener noreferrer">' + esc(o.item + " " + dir.p) + "</a></blockquote>"
        : '<p class="xw-none">No directive on this reform is quoted from ' + esc(o.item) + ".</p>";
      var got = xwFor(o.item, c.key);
      var cell = filingCell(o.docket, "showcause", ps);
      // Two quotes per operator keep a reform readable on a phone; the rest are one tap away in the filing.
      var more = got.length - 2;
      var answered = got.length ? got.slice(0, 2).map(function (a) {
        return '<div class="xw-a"><p class="xw-pt">' + esc(a.point) + '</p><blockquote class="xw-q">“' + esc(a.quote) + '” <a class="mono" href="reading/' + esc(a.slug) + "/text.html#p-" + (a.pg || 1) + '">' + esc(a.docket.replace(/-000$/, "")) + (a.pg ? " p. " + a.pg : "") + "</a></blockquote>" +
          '<a class="xw-open" href="#filings/' + esc(a.group) + "/" + esc(a.slug) + '">Open ' + esc(a.filer) + "’s filing</a></div>";
      }).join("") + (more > 0 ? '<p class="xw-more"><a href="#filings/' + esc(got[2].group) + "/" + esc(got[2].slug) + '">' + more + (more === 1 ? " more point" : " more points") +
        (got.slice(2).every(function (a) { return a.slug === got[2].slug; }) ? " on this in " + esc(got[2].filer) + "’s filing" : " on this in its filings") + "</a></p>" : "")
        : '<p class="xw-none">' + (cell.status === "filed-verified" ? "None of the points read from its filing names this reform." : "No filing yet" + (o.abeyance && o.abeyance.due ? "; due " + esc(fmtISO(o.abeyance.due).replace(/, \d{4}$/, "")) : "") + ".") + "</p>";
      return '<div class="xw-row"><h3 class="xw-rto"><a href="#dockets/' + esc(docketKey(o.docket)) + '">' + esc(o.rto) + '</a> <span class="mono">' + esc(o.item) + "</span></h3>" +
        '<div class="xw-asked"><p class="xw-step"><span class="xw-n">2</span> June order</p>' + asked + "</div>" +
        '<div class="xw-ans"><p class="xw-step"><span class="xw-n">3</span> Filed</p>' + answered + "</div></div>";
    }).join("");
    return doe + '<div class="xw-rows">' + rows + "</div>";
  }
  // Five reforms down, six markets across: each cell lists what the operator (or, where named, its
  // transmission owners) proposed, one bullet per point, each linked to the page it quotes.
  // An empty cell means the filings do not take the reform up (or, for SPP, have not been filed).
  var xwMatrix = null, XW_MARKETS = ["PJM", "MISO", "SPP", "CAISO", "ISO-NE", "NYISO"];
  function xwTable() {
    if (!xwMatrix) return "";
    var docketOf = {}; (xwAnswers || []).forEach(function (a) { docketOf[a.slug] = a.docket; });
    var rows = D.categories.map(function (c) {
      return '<tr><th scope="row">' + esc(c.title) + "</th>" + XW_MARKETS.map(function (m) {
        var xs = xwMatrix[m] && xwMatrix[m][c.key];
        return xs && xs.length ? '<td><ul class="xw-ul">' + xs.map(function (x) {
          var dk = (docketOf[x.slug] || "").replace(/-000$/, "");
          return "<li>" + (x.by ? '<span class="xw-by">' + esc(x.by) + ":</span> " : "") + esc(x.t) +
            ' <a class="mono" href="reading/' + esc(x.slug) + "/text.html#p-" + x.pg + '" title="' + esc((dk ? dk + ": " : "") + "“" + x.quote + "”") + '">p.&nbsp;' + x.pg + "</a></li>";
        }).join("") + "</ul></td>"
          : '<td class="xw-t-none">' + (m === "SPP" ? "Not filed yet; due Nov 20" : "Not addressed") + "</td>";
      }).join("") + "</tr>";
    }).join("");
    return '<div class="table-wrap xw-t-wrap"><table class="xw-t"><caption class="sr-only">Responses to the June orders, by reform and market</caption><thead><tr><th scope="col">Reform</th>' +
      XW_MARKETS.map(function (m) { return '<th scope="col">' + esc(m) + "</th>"; }).join("") + "</tr></thead><tbody>" + rows + "</tbody></table></div>";
  }
  function renderCrosswalk() {
    var host = document.getElementById("xwalk");
    if (!xwAnswers) return;
    // The comparison table appears in Now > By reform and in Filings > Compare.
    document.querySelectorAll(".xw-compare").forEach(function (el) { el.innerHTML = xwTable(); });
    if (!host) return;
    host.innerHTML = D.categories.map(function (c) {
      return '<details class="xw-cat" id="xw-' + esc(c.key) + '"><summary><span class="xw-no">' + c.n + '</span><span class="xw-title">' + esc(c.title) +
        '<span class="xw-sub">' + esc(c.ferc) + "</span></span>" + xwSummaryDots(c.key) + '<span class="acc-chev" aria-hidden="true">›</span></summary>' +
        '<div class="xw-body">' + xwBody(c) + "</div></details>";
    }).join("");
    if (xwPending) { var k = xwPending; xwPending = null; openAt("xw-" + k); }
  }
  document.addEventListener("click", function (ev) {
    var b = ev.target.closest && ev.target.closest(".xw-retry");
    if (!b) return;
    document.querySelectorAll(".xw-compare, #xwalk").forEach(function (el) { el.innerHTML = '<p class="cm-loading" role="status">Loading the comparison…</p>'; });
    loadCrosswalk();
  });
  function loadCrosswalk() {
    if (xwAnswers) { renderCrosswalk(); return; }
    fetch("data/answers.json?v=" + ASSET_VER).then(function (r) { if (!r.ok) throw Error(r.status); return r.json(); }).then(function (j) {
      xwAnswers = j.answers || []; xwMatrix = j.matrix || null; renderCrosswalk();
    }).catch(function (err) {
      console.error("answers.json failed to load", err);
      // Every place that waits on this file hears about the failure and can try again.
      var msg = '<p class="xw-none" role="status">The comparison did not load. <button type="button" class="xw-retry">Try again</button></p>';
      var host = document.getElementById("xwalk");
      if (host) host.innerHTML = msg;
      document.querySelectorAll(".xw-compare").forEach(function (el) { el.innerHTML = msg; });
    });
  }

  function renderOverview() {
    var today = todayISO();
    var dated = (D.timeline || []).filter(function (e) { return /^\d{4}-\d{2}-\d{2}/.test(e.iso || ""); });
    var next = dated.filter(function (e) { return e.kind === "deadline" && isoOf(e) >= today; })
      .sort(function (a, b) { return a.iso < b.iso ? -1 : 1; }).slice(0, 4);
    var pill = function (e) { var t = D.tracks[e.track]; return t ? '<a class="trackpill" href="#timeline/track/' + esc(e.track) + '">' + esc(t.short) + "</a>" : ""; };
    var nextList = '<ol class="now-next">' + next.map(function (e) {
      var n = daysUntil(e.iso);
      return '<li><span class="nn-date"><span class="mono">' + esc(fmtISO(isoOf(e)).replace(/, \d{4}$/, "")) + '</span><span class="nn-days">' + inDays(n) + "</span></span>" +
        '<span class="nn-t">' + esc(e.title) + " " + pill(e) + "</span></li>";
    }).join("") + "</ol>";
    var f = D.meta.spotlight;
    var links = f.links.map(function (link) {
      return '<a href="#filings/' + esc(link.group) + (link.doc ? "/" + esc(link.doc) : "") + '">' + esc(link.label) + "</a>";
    }).join("");
    var m = D.meta;
    var glance = '<dl class="glance">' +
      "<div><dt>Authority</dt><dd>" + esc(m.authority) + "</dd></div>" +
      '<div><dt>Items and dockets</dt><dd class="mono">' + esc(m.items) + "</dd></div>" +
      '<div><dt>Reporter cite</dt><dd class="mono">' + esc(m.citeRange) + "</dd></div>" +
      "<div><dt>Commission</dt><dd>" + esc(m.commissioners) + "</dd></div>" +
      '<div><dt>Order record as of</dt><dd class="mono">' + esc(m.capture) + "</dd></div>" +
      "</dl>";
    // One row of jumps, so every Overview section is one tap from the top on a phone (UAT 2026-11-18:
    // the reform crosswalk sat 5 to 6 screens down at 375 px).
    var jumps = '<nav class="jump-row" aria-label="On this page">' + [["#ops-h", "Each operator"], ["#xw-h", "By reform"], ["#tg-h", "Record so far"], ["#acc-clock", "60-day clock"]].map(function (j) {
      return '<button type="button" class="jump-btn" data-jump="' + j[0] + '">' + j[1] + "</button>";
    }).join("") + "</nav>";
    // Subtab order follows page order: the Nov 16 brief (the default), then Status by operator.
    return jumps + '<section class="filing-brief" aria-labelledby="latest-filing"><h2 id="latest-filing">' + esc(f.title) + "</h2><p>" + esc(f.answer) + "</p><div>" + links + "</div></section>" +
      '<section aria-labelledby="ops-h"><span id="stand-h" class="jump-anchor"></span><h2 class="now-h" id="ops-h">Status by operator</h2>' + operatorTable() + "</section>" +
      '<section class="now-card now-next-card" aria-labelledby="now-next-h"><h2 id="now-next-h">Deadlines</h2>' + nextList + "</section>" +
      '<section class="xw" aria-labelledby="xw-h"><h2 class="now-h" id="xw-h">Filings by reform</h2>' +
      '<div class="xw-compare"></div><p class="xw-lede">Filled marker: the filing addresses the reform.</p>' +
      '<div id="xwalk"><p class="cm-loading" role="status">Loading the comparison…</p></div></section>' +
      accSection("Status by proceeding", "", renderStandStrip(), false, Object.keys(D.tracks || {}).length) +
      accSection("The 60-day clock and who has filed", "The procedural steps every order set, and what each operator filed against them.", renderProcedural(), false, null, "acc-clock") +
      accSection("Background: from the DOE directive to the June orders", "", paras(m.summary) + glance, false, null);
  }

  // "Where things stand": one line per track, generated from the registry so there is no second copy of
  // the status prose to keep in sync (news-tracks-plan.md Feature E1). Each line links into the Timeline
  // filtered to that track. The strip carries its own as-of stamp because it is the one part of the
  // Overview that goes stale on a calendar, not on a docket.
  function renderStandStrip() {
    var ids = Object.keys(D.tracks || {});
    if (!ids.length) return "";
    var rows = ids.map(function (id) {
      var t = D.tracks[id];
      var next = t.next && t.next.date
        ? '<span class="stand-next"><span class="mono">' + esc(fmtISO(t.next.date)) + "</span> " + esc(t.next.label) + "</span>"
        : '<span class="stand-next none">' + esc((t.next && t.next.label) || "No dated step") + "</span>";
      return '<li class="stand-row"><a class="stand-link" href="#timeline/track/' + esc(id) + '">' +
        '<span class="stand-label">' + esc(t.label) + '</span><span class="stand-go" aria-hidden="true">→</span></a>' +
        '<p class="stand-line">' + esc(t.status.line) + "</p>" + next + "</li>";
    }).join("");
    var asOf = (D.meta && D.meta.newsCapture) || "";
    return '<section class="stand" aria-labelledby="stand-h">' +
      '<div class="stand-head"><h3 id="stand-h">Where things stand</h3>' +
      (asOf ? '<span class="stand-asof mono">news swept ' + esc(asOf) + "</span>" : "") + "</div>" +
      '<p class="stand-lede">Four proceedings and one context lane run beside each other, each on its own clock.</p>' +
      '<ol class="stand-list">' + rows + "</ol></section>";
  }

  /* ---- TAB 1: the track-aware rail (news-tracks-plan.md Feature A) ---- */
  // Four proceedings and one context lane run beside each other. The rail stays ONE merged chronology
  // on purpose: the capacity auction clearing at its cap nine days before the governance conference is
  // the story, and swimlanes would destroy it (also unreadable at 375px across five lanes of very
  // uneven density). Separation comes on demand instead, from the track cards, a single-select chip
  // row, and a per-event pill. Filtering hides rows rather than rebuilding the DOM: ~16 events.
  var TRACK_IDS = Object.keys(D.tracks || {});
  var timelineTrack = "all";                 // module state; mirrored in the hash as #timeline/track/<id>
  var applyTimelineTrack = null;             // set by wireTimeline once the panel exists
  var pendingTimelineTrack = null;           // a deep link parsed before first render

  function trackCount(id) {
    return (D.timeline || []).filter(function (e) { return e.track === id; }).length;
  }
  // Guard that stops a hand-typed "#timeline/track/whatever" from filtering the rail to nothing.
  // Parenthesised deliberately: `||` binds tighter than `?:`, so the intent is easy to misread here.
  function validTrack(id) { return (id === "all" || !!(D.tracks || {})[id]) ? id : "all"; }

  // The pill sits beside the kindpill on every row. kindpill stays color-coded text (doe/ferc/deadline);
  // the trackpill gets a hairline border and muted fill so the rail doesn't turn into confetti.
  function trackPill(id) {
    var t = (D.tracks || {})[id];
    if (!t) return "";
    return '<button type="button" class="trackpill" data-track="' + esc(id) +
      '" title="' + esc(t.label) + '" aria-label="Filter the timeline to ' + esc(t.label) + '">' +
      esc(t.short) + "</button>";
  }

  function trackCards() {
    var cards = TRACK_IDS.map(function (id) {
      var t = D.tracks[id], n = trackCount(id);
      var next = t.next && t.next.date
        ? '<span class="trk-next"><span class="trk-next-lbl">Next</span> <span class="mono">' +
          esc(fmtISO(t.next.date)) + "</span> " + esc(t.next.label) +
          (t.next.dateNote ? '<span class="trk-next-note">' + esc(t.next.dateNote) + "</span>" : "") + "</span>"
        : '<span class="trk-next none">' + esc((t.next && t.next.label) || "No dated step") + "</span>";
      return '<button type="button" class="trk-card" data-track="' + esc(id) + '" aria-pressed="false">' +
        '<span class="trk-head"><span class="trk-label">' + esc(t.label) +
        "</span></span>" +
        '<span class="trk-venue mono">' + esc(t.venue || "Not a docket") + "</span>" +
        '<span class="trk-what">' + esc(t.what) + "</span>" +
        '<span class="trk-why"><span class="trk-why-lbl">Why it is separate</span> ' + esc(t.whySeparate) + "</span>" +
        (t.aka ? '<span class="trk-aka">' + esc(t.aka) + "</span>" : "") +
        '<span class="trk-status">' + esc(t.status.line) +
        ' <span class="trk-asof mono">as of ' + esc(t.status.asOf) + "</span></span>" +
        next + "</button>";
    }).join("");
    return '<div class="trk-grid">' + cards + "</div>";
  }

  function trackChips() {
    var chips = [{ id: "all", short: "All", label: "All tracks", n: (D.timeline || []).length }]
      .concat(TRACK_IDS.map(function (id) {
        return { id: id, short: D.tracks[id].short, label: D.tracks[id].label, n: trackCount(id) };
      }));
    return '<div class="trk-chips" role="group" aria-label="Filter the timeline by track">' +
      chips.map(function (c) {
        return '<button type="button" class="trk-chip" data-track="' + esc(c.id) +
          '" aria-pressed="' + (c.id === "all" ? "true" : "false") + '" title="' + esc(c.label) + '">' +
          esc(c.short) + "</button>";
      }).join("") + "</div>";
  }

  // Newest first: what is ahead, then what happened, most recent at the top. A row is the date, the
  // title and its lane; the body and sources open on demand. Nothing starts open.
  function renderTimeline() {
    var today = todayISO();
    var dated = D.timeline.map(function (e, i) { return { e: e, i: i, iso: isoOf(e) }; });
    var ahead = dated.filter(function (x) { return x.iso && x.iso > today; }).sort(function (a, b) { return a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : a.i - b.i; });
    var past = dated.filter(function (x) { return !x.iso || x.iso <= today; }).sort(function (a, b) { return a.iso > b.iso ? -1 : a.iso < b.iso ? 1 : b.i - a.i; });
    var row = function (x, open) {
      var e = x.e;
      return '<details class="tl-item ' + e.kind + '" id="tl-' + esc(e.iso || "") + '" data-iso="' + esc(e.iso || "") + '" data-track="' + esc(e.track || "") + '"><summary><span class="tl-date mono">' + esc(e.date) +
        '</span><span class="tl-title">' + esc(e.title) + '</span><span class="tl-pills"><span class="kindpill ' + e.kind + '">' + esc(e.kind) + "</span>" + trackPill(e.track) + "</span></summary>" +
        '<div class="tl-body">' + esc(e.body) + "</div>" + (e.doc ? '<p class="tl-doc"><a href="#filings/' + esc(e.doc) + '">Read the filing</a></p>' : "") + srcChips(e.src) + "</details>";
    };
    var top = '<div class="cards cols-3">' + D.toplines.map(function (c) {
      return '<div class="card analysis"><h3>' + esc(c.h) + "</h3>" + paras(c.body) + srcChips(c.src) + "</div>";
    }).join("") + "</div>";
    return head("Timeline", "") + timelineGraphic() +
      trackChips() +
      '<span class="sr-only" role="status" aria-live="polite" id="tl-filterstatus"></span>' +
      (ahead.length ? '<h3 class="tl-sec">Ahead</h3><div class="timeline">' + ahead.map(function (x) { return row(x, true); }).join("") + "</div>" : "") +
      '<h3 class="tl-sec" id="tl-latest">So far</h3><div class="timeline">' + past.map(function (x, i) { return row(x, i < 6); }).join("") + "</div>" +
      accSection("The five proceedings", "Each runs on its own clock.", trackCards(), false, TRACK_IDS.length) +
      accSection("Why six tailored orders instead of one rule", "Our reading of the strategic shift, with sources.", top, false, (D.toplines || []).length);
  }

  // Filter wiring. The cards and the chips drive one piece of state, so both carry aria-pressed and both
  // toggle back to "all" when the active track is clicked again. The intro grid never hides: a shared
  // #timeline/track/<id> link must land on something that explains the lane it just filtered to.
  function wireTimeline() {
    var panel = panelFor("timeline");
    if (!panel) return;
    applyTimelineTrack = function (id) {
      timelineTrack = validTrack(id);
      panel.querySelectorAll(".tl-item").forEach(function (el) {
        el.hidden = timelineTrack !== "all" && el.getAttribute("data-track") !== timelineTrack;
      });
      panel.querySelectorAll(".trk-chip, .trk-card").forEach(function (b) {
        var on = b.getAttribute("data-track") === timelineTrack;
        b.setAttribute("aria-pressed", on ? "true" : "false");
        b.classList.toggle("is-active", on);
      });
      // A track with nothing ahead (or nothing past) must not leave the open subtab empty.
      var shown = function (k) { var pn = document.getElementById("stp-timeline-" + k); return pn ? pn.querySelectorAll(".tl-item:not([hidden])").length : 0; };
      var cur = subtabPick.timeline || "ahead";
      if ((cur === "ahead" || cur === "sofar") && !shown(cur)) { var other = cur === "ahead" ? "sofar" : "ahead"; if (shown(other)) pickSubtab("timeline", other); }
      var live = panel.querySelector("#tl-filterstatus");
      if (live) {
        var n = panel.querySelectorAll(".tl-item:not([hidden])").length;
        live.textContent = timelineTrack === "all"
          ? "Showing all " + n + " events."
          : "Filtered to " + D.tracks[timelineTrack].label + ": " + n + (n === 1 ? " event." : " events.");
      }
    };
    panel.addEventListener("click", function (ev) {
      var b = ev.target.closest("button[data-track]");
      if (!b || !panel.contains(b)) return;
      var id = b.getAttribute("data-track");
      applyTimelineTrack(id === timelineTrack && id !== "all" ? "all" : id);
      writeTimelineHash(timelineTrack);
    });
    applyTimelineTrack(pendingTimelineTrack || "all");
    pendingTimelineTrack = null;
  }

  /* ---- TAB: Reforms (the five categories + jurisdiction + regional) ---- */
  // Reform rows × orders: every directive in data.js carries its reform key, so this grid is the
  // through line the Filings tab cites (tools/build-order-anchors.mjs reads the same entries).
  var REFORM_EXTRA = { registry: "Defining a large load", procedure: "Procedure", adequacy: "Resource adequacy" };
  function orderMatrix() {
    var orders = D.dockets.concat(D.colocation ? [D.colocation] : []);
    var keys = D.categories.map(function (c) { return c.key; });
    orders.forEach(function (o) { (o.dir || []).forEach(function (x) { if (keys.indexOf(x.reform) < 0) keys.push(x.reform); }); });
    var title = function (k) { var c = D.categories.filter(function (x) { return x.key === k; })[0]; return c ? c.title : (REFORM_EXTRA[k] || k); };
    var rows = keys.map(function (k) {
      var chips = [];
      orders.forEach(function (o) {
        (o.dir || []).forEach(function (x) {
          if (x.reform !== k) return;
          chips.push('<li><a href="' + esc(o.pdf) + '#page=' + x.pg + '" target="_blank" rel="noopener noreferrer" title="' + esc("“" + x.q + "”") + '">' +
            '<span class="om-rto">' + esc(o.rto + (o.item === "E-2" ? " co-location" : "")) + '</span> ' + esc(x.t) + ' <span class="om-pg mono">' + esc(x.p) + ', p. ' + x.pg + '</span></a></li>');
        });
      });
      return '<div class="om-row"><h3 class="om-h">' + esc(title(k)) + '</h3><ul class="om-chips">' + chips.join("") + '</ul></div>';
    }).join("");
    return '<div class="om">' + rows + '</div>';
  }
  function renderReforms() {
    var cats = D.categories.map(function (c, i) {
      return '<details class="cat"><summary>' +
        '<span class="cat-no">' + c.n + "</span>" +
        '<span class="cat-title">' + esc(c.title) + "</span>" +
        '<span class="cat-chev">›</span></summary>' +
        '<div class="cat-body">' +
        '<div class="cat-ferc"><span class="label">FERC mandate text</span>“' + esc(c.ferc) + "”</div>" +
        '<p class="cat-detail">' + esc(c.detail) + "</p>" +
        '<div class="cat-doe"><span class="label">Underlying DOE ANOPR principles</span><ul>' +
        c.doe.map(function (d) { return "<li>" + esc(d) + "</li>"; }).join("") + "</ul></div>" +
        pmReformLink(c.key) +
        srcChips(c.src) + "</div></details>";
    }).join("");

    var jur = '<div class="blocks two">' + D.jurisdiction.map(function (b) {
      return '<div class="block' + (/30-day/.test(b.h) ? " warn" : "") + '"><h4>' + esc(b.h) + "</h4><p>" + esc(b.body) + "</p>" + srcChips(b.src) + "</div>";
    }).join("") + "</div>";

    var reg = '<div class="blocks two">' + D.regional.map(function (b) {
      return '<div class="block"><h4>' + esc(b.h) + "</h4><p>" + esc(b.body) + "</p>" + srcChips(b.src) + "</div>";
    }).join("") + "</div>";

    return '<span id="reforms-h" class="jump-anchor"></span>' + head("What the June 18 orders require",
      "Each order asks whether the operator’s tariff works for large loads without five reforms.") +
      orderMatrix() +
      accSection("The five reforms: FERC's text and DOE's principles", "FERC's mandate text, quoted, with the DOE ANOPR mechanics behind each.", cats, false, D.categories.length) +
      accSection("Jurisdictional & contractual protections",
        "Where FERC draws the federal/state line, and how it shields existing deals.", jur, false, (D.jurisdiction || []).length) +
      accSection("Regional distinctions at a glance", "The variations FERC says the orders were designed to reflect.", reg, false, (D.regional || []).length);
  }

  // Per-order commissioner block. The displayed quote/gist for each commissioner is verbatim in all six
  // orders even though two of the five FULL statements are not (see tools/verify-commish-tailoring.mjs):
  // Chang's carries one extra CAISO-specific footnote, and LaCerte's names the respondent RTO directly
  // elsewhere in his statement — neither swapped/added passage happens to be among the quotes shown
  // here, so each row's own text is still accurate cited to THIS order's page. E-2 carries a `commish`
  // override (only Chang wrote separately there) with its own order-specific read, REPLACING the
  // five-row list. `commishAside` is different: it ADDS to a normal row (all five still render) rather
  // than replacing the list — used for E-10, where Chang's statement carries that CAISO-specific
  // footnote the other five orders don't have.
  function commishBlock(d, so) {
    if (!D.commissioners) return "";
    var override = d.commish || null;
    var list = D.commissioners.filter(function (c) {
      return override ? override[c.key] : (d.commishPages && d.commishPages[c.key]);
    });
    if (!list.length) return "";
    function pageLinks(pg, name) {
      return pg ? '<span class="commish-cite"><span class="dir-para mono">p. ' + pg + "</span>" +
        '<a class="cite-link" href="' + esc(d.pdf) + "#page=" + pg + '" target="_blank" rel="noopener noreferrer" aria-label="Open ' + esc(name) +
        "’s statement in the committed " + esc(d.item) + " order PDF at page " + pg + '" title="Committed PDF, opens inline to p. ' + pg +
        '">PDF <span class="ext" aria-hidden="true">↗</span></a>' +
        '<a class="cite-link" href="' + esc(so.url) + "#page=" + pg + '" target="_blank" rel="noopener noreferrer" aria-label="Open the official ferc.gov ' + esc(d.item) +
        " order at page " + pg + '" title="Official ferc.gov source, page ' + pg + '">gov <span class="ext" aria-hidden="true">↗</span></a></span>' : "";
    }
    var rows = list.map(function (c) {
      var ov = override && override[c.key];
      var pg = ov ? ov.pg : d.commishPages[c.key];
      var gist = ov ? ov.gist : c.gist;
      var quote = ov ? ov.quote : c.quote;
      var aside = !ov && d.commishAside && d.commishAside[c.key];
      var asideBlock = aside ? '<div class="commish-aside"><p class="commish-aside-label">Specific to ' + esc(d.rto) + "</p>" +
        pageLinks(aside.pg, c.name) + '<div class="commish-quote">“…' + esc(aside.note) + '…”</div></div>' : "";
      return '<div class="commish-row"><div class="commish-row-head"><span class="commish-name">' + esc(c.name) +
        '</span><span class="commish-tag">' + esc(c.short) + "</span>" + pageLinks(pg, c.name) + "</div>" +
        (gist ? '<p class="commish-rgist">' + esc(gist) + "</p>" : "") +
        '<div class="commish-quote">“…' + esc(quote) + '…”</div>' + asideBlock + "</div>";
    }).join("");
    var note = override ? "" :
      '<p class="commish-block-note">The quotes above are verbatim across the six orders; full themes and quotes are on the Overview tab. The page cites here open <em>this</em> order’s PDF.</p>';
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
        '" title="Official source on ferc.gov (Cloudflare-gated; the committed copy mirrors it)">ferc.gov ↗</a>' +
        // The through line, read backwards: from the order to everything filed in answer to it.
        '<a class="order-src" href="#filings/' + (d.item === "E-2" ? "pjm-colocation" : "sc-" + d.rto.toLowerCase().replace(/[^a-z]/g, "")) + '">Filings since</a></span>';
      // E-2 is a final order on rehearing, not a §206 show cause order: its rows are holdings, not
      // directives an RTO must still answer. Label them accordingly so the card doesn't read as an open clock.
      var dirLabel = d.track ? "What this order holds" : "Directs the respondent to address";
      var directives = '<div class="dir"><span class="label">' + dirLabel + "</span>" +
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
      // A final order (E-2) carries a `kind` line up top so its nature reads at a glance vs the open §206 clocks.
      // Each order also has a standalone page (tools/build-docket-pages.mjs) so it has a URL of its own
      // to rank for and to link to. Keep the slug rule identical to the generator's.
      var docketSlug = (d.docket + "-" + d.rto).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      var pageLink = '<a class="docket-page-link" href="dockets/' + esc(docketSlug) + '/">' +
        "Open the " + esc(d.item) + " page for " + esc(d.docket) + ' <span aria-hidden="true">→</span></a>';
      var kindLine = d.kind ? '<div class="docket-kind">' + esc(d.kind) + ' · final order</div>' : "";
      // The Aug 14, 2026 order that paused this docket. It sits directly under the order link because it
      // is the first thing a reader needs to know about the proceeding's present state: the June 18
      // directives below are real but not currently running against anyone.
      var ab = d.abeyance;
      var abeyance = ab ? '<div class="docket-abeyance"><span class="label">Held in abeyance</span>' +
        "<p>Granted " + esc(fmtISO(ab.issued)) + " (" + esc(ab.kind) + " " + esc(ab.accession) + ", " +
        esc(ab.cite) + ") on the motion of " + esc(ab.granted) + ". Responses now due " +
        '<strong>' + esc(fmtISO(ab.due)) + "</strong>, answers " + esc(fmtISO(ab.answers)) + ".</p>" +
        "<p>" + esc(ab.note) + "</p>" +
        (ab.quote ? '<blockquote class="docket-abeyance-q">' + esc(ab.quote) + "</blockquote>" : "") +
        "</div>" : "";
      var unique = d.unique ? '<div class="docket-unique"><span class="label">What’s unique to ' + esc(d.rto) + '</span><p>' + esc(d.unique) + "</p></div>" : "";
      var asksLabel = d.track ? "What the order decides" : "What FERC presses " + esc(d.rto) + " on";
      var asks = (d.asks && d.asks.length) ? '<div class="docket-asks"><span class="label">' + asksLabel + '</span><ul>' +
        d.asks.map(function (a) { return "<li>" + esc(a) + "</li>"; }).join("") + "</ul></div>" : "";
      // Section IV briefing questions: the formal questions a §206 show cause order directs the RTO/ISO to
      // brief. Only the six show cause orders have them — gate on a Section IV page so the E-2 final order
      // (which has no briefing) doesn't render these templated questions as if they were its own.
      var briefing = "";
      if (D.briefing && D.briefing.questions && D.briefing.pages && D.briefing.pages[d.item]) {
        var bOmit = (D.briefing.omit && D.briefing.omit[d.item]) || [];
        var bpg = D.briefing.pages && D.briefing.pages[d.item];
        var bqs = D.briefing.questions.filter(function (q) { return bOmit.indexOf(q.id) < 0; });
        var bCite = bpg ? '<span class="brief-cite"><span class="dir-para mono">§ IV, p. ' + bpg + "</span>" +
          '<a class="cite-link" href="' + esc(d.pdf) + "#page=" + bpg + '" target="_blank" rel="noopener noreferrer" aria-label="Open the committed ' + esc(d.item) + " order PDF at the Section IV page " + bpg + '" title="Committed PDF, opens inline to p. ' + bpg + '">PDF <span class="ext" aria-hidden="true">↗</span></a>' +
          '<a class="cite-link" href="' + esc(so.url) + "#page=" + bpg + '" target="_blank" rel="noopener noreferrer" aria-label="Open the official ferc.gov ' + esc(d.item) + " order at page " + bpg + '" title="Official ferc.gov source, page ' + bpg + '">gov <span class="ext" aria-hidden="true">↗</span></a></span>' : "";
        briefing = '<details class="dreg dbrief"><summary>The Section IV briefing questions (' + bqs.length + ")</summary>" +
          (bCite ? '<div class="brief-head">' + bCite + "</div>" : "") +
          '<ol class="brief-list">' + bqs.map(function (q) {
            var rec = pmBriefingLink(q.id);
            return '<li class="brief-item"><span class="brief-topic">' + esc(q.t) + (rec ? ' <span class="brief-record">' + rec + "</span>" : "") + "</span>" +
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
      return '<details class="docket' + (d.track ? " docket-colo" : "") + '" id="dk-' + esc(docketKey(d.docket)) + '"' + ">" +
        '<summary class="docket-sum"><span class="item">' + esc(d.item) + "</span>" +
        '<span class="docket-sum-id"><span class="rto">' + esc(d.rto) + "</span> " + track + '<span class="rto-full">' + esc(d.rtoFull) + "</span>" +
        '<span class="docket-cite mono">' + esc(d.cite) + " · " + esc(d.pages) + " pp · " + esc(d.respondents) + "</span></span>" +
        '<span class="docket-status">' + esc(d.status) + '</span><span class="region mono">' + esc(d.region) + "</span>" +
        '<span class="chev" aria-hidden="true">›</span></summary>' +
        '<div class="docket-body"><div class="docket-sources">' + orderLink + pageLink + '</div>' + kindLine + abeyance + unique + directives + asks + briefing + commish + region + roster + "</div></details>";
    }
    // Two groups, each under a real heading at the same level: the six §206 orders, then E-2.
    var six = '<h3 class="fg-sec">The six show cause orders</h3>' + D.dockets.map(renderDocketCard).join("");
    var colo = D.colocation
      ? '<h3 class="fg-sec">PJM co-location order (E-2)</h3>' + renderDocketCard(D.colocation, 1)
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
      "") +
      // AD26-7 gets a pointer, not a card. These accordions are backed by committed, page-cited order
      // PDFs; the governance conference has no primary document in the repo to quote. If FERC's
      // post-conference notice becomes one, that is the moment it earns a card here, and not before.
      '<p class="cm-xlink">The PJM governance proceeding (Docket AD26-7-000) runs beside these dockets ' +
      'on its own clock, with no committed order to cite yet. ' +
      '<a class="cm-agg-link" href="#timeline/track/gov">See the governance track on the timeline <span aria-hidden="true">→</span></a></p>' +
      docs +
      head("File or follow the dockets", "") + participate;
  }

  /* ---- TAB 3 ---- */
  // "Who's quoted": the named voices behind the Discourse tab, alphabetical. data.js `voices[].lean` is NOT
  // shown: it is an unreviewed political-orientation label on real people, and subjective framing is
  // curator-only (AGENTS.md). Group or tag by it only after a curator reviews every value.
  function renderVoiceRoster(voices) {
    var na = function (txt) { return '<span class="na">' + esc(txt) + "</span>"; };
    var list = voices.slice().sort(function (a, b) { return String(a.name || "").localeCompare(String(b.name || "")); });
    var row = function (v) {
      var chips = srcChips(v.src);
      return '<li class="voice-row"><div class="voice-head"><span class="voice-name">' +
        (v.name ? esc(v.name) : na("Name not recorded")) + "</span></div>" +
        '<p class="voice-affil">' + (v.affil ? esc(v.affil) : na("Affiliation not stated")) + "</p>" +
        '<p class="voice-take">' + (v.take ? esc(v.take) : na("No summary recorded")) + "</p>" +
        (chips || '<div class="srcs">' + na("No source recorded") + "</div>") + "</li>";
    };
    return '<div class="voice-roster"><ul class="voice-list">' + list.map(row).join("") + "</ul></div>";
  }
  // Discourse: one flat, tagged list (tools/build-discourse-index.mjs) read three ways. Every item keeps its
  // own source chip; proceeding chips jump to the filings it discusses, theme headers to filings on that theme.
  var DX_KIND = { quote: "Quote", voice: "View", consensus: "Consensus", friction: "Friction", reception: "Reception", filed: "Filed position" };
  var discourseView = "theme";
  function dxItem(it) {
    var L = D.discourseLabels || { groups: {}, themes: {} };
    var who = it.who ? '<b>' + esc(it.who) + "</b>" + (it.affil ? ' <span class="dx-affil">' + esc(it.affil) + "</span>" : "") + (it.stance ? ' <span class="stance-pill ' + esc(it.stance) + '">' + esc(it.stance) + "</span>" : "") + " " : "";
    var text = it.kind === "quote" ? "“" + esc(it.text) + "”" : (it.kind === "filed" && it.title ? '<span class="dx-title">' + esc(it.title) + ".</span> " : "") + esc(it.text);
    var src = it.src ? publicSrcChips(it.src) || srcChips(it.src) : it.url ? '<a class="dx-src" href="' + esc(it.url) + '" target="_blank" rel="noopener noreferrer">' + esc(it.locator || "Source") + "</a>" : "";
    var docLinks = (it.docs || []).filter(function (d) { return d.group; }).map(function (d) { return '<a class="dx-go" href="#filings/' + esc(d.group) + "/" + esc(d.slug) + '">Read the filing</a>'; }).slice(0, 2).join("");
    var groups = (it.docs && it.docs.length ? [] : it.groups || []).slice(0, 3).map(function (g) { return '<a class="dx-go" href="#filings/' + esc(g) + '">' + esc(L.groups[g] || g) + "</a>"; }).join("");
    return '<li class="dx dx-' + esc(it.kind) + '"><span class="dx-k">' + esc(DX_KIND[it.kind] || it.kind) + (it.date ? ' <span class="mono">' + esc(fmtISO(it.date).replace(/^(\w+) (\d+), (\d{4})$/, "$1 $3")) + "</span>" : "") + '</span><div class="dx-b">' + who + text +
      '<span class="dx-links">' + src + docLinks + groups + "</span></div></li>";
  }
  function dxList(items, cap) {
    var more = items.length > cap ? '<li class="dx-more-row"><button type="button" class="dx-more" aria-expanded="false">Show ' + (items.length - cap) + " more</button></li>" : "";
    return '<ol class="dx-list' + (items.length > cap ? " dx-capped" : "") + '">' + items.map(function (it, i) { return dxItem(it).replace('<li class="dx ', '<li class="dx' + (i >= cap ? " dx-extra" : "") + " "); }).join("") + more + "</ol>";
  }
  function byDate(a, b) { return (b.date || "") < (a.date || "") ? -1 : (b.date || "") > (a.date || "") ? 1 : 0; }
  function renderDiscourseView(view) {
    var X = D.discourse || [], L = D.discourseLabels || { themes: {} };
    if (view === "date") {
      var dated = X.filter(function (i) { return i.date; }).sort(byDate), months = {}, order = [];
      dated.forEach(function (i) { var m = i.date.slice(0, 7); if (!months[m]) { months[m] = []; order.push(m); } months[m].push(i); });
      return order.map(function (m) {
        return '<section class="dx-sec"><h3>' + esc(MON[+m.slice(5) - 1] + " " + m.slice(0, 4)) + ' <span class="dx-n mono">' + months[m].length + "</span></h3>" + dxList(months[m], 8) + "</section>";
      }).join("") + '<p class="dx-note">' + (X.length - dated.length) + " filed positions carry no publication date; they appear by theme and on each filing.</p>";
    }
    if (view === "who") {
      var named = X.filter(function (i) { return i.who; }).sort(function (a, b) { return a.who.localeCompare(b.who); });
      return '<section class="dx-sec">' + dxList(named, 400) + "</section>";
    }
    var keys = Object.keys(L.themes || {});
    var buckets = keys.map(function (k) { return { k: k, items: X.filter(function (i) { return i.themes.indexOf(k) >= 0; }).sort(byDate) }; })
      .filter(function (b) { return b.items.length; }).sort(function (a, b) { return b.items.length - a.items.length; });
    var other = X.filter(function (i) { return !i.themes.length; });
    return buckets.map(function (b) {
      return '<section class="dx-sec" id="dx-' + esc(b.k) + '"><h3>' + esc(L.themes[b.k]) + ' <a class="dx-th-go" href="#filings/theme/' + esc(b.k) + '">Filings</a></h3>' + dxList(b.items, 6) + "</section>";
    }).join("") + (other.length ? '<section class="dx-sec"><h3>Other commentary <span class="dx-n mono">' + other.length + "</span></h3>" + dxList(other.sort(byDate), 6) + "</section>" : "");
  }
  function renderNews() {
    var X = D.discourse || [];
    var outletIds = D.media.outlets.filter(function (id) { return !isFederalSource(id); });
    var outletChips = outletIds.map(function (id) {
      var s = D.SOURCES[id]; if (!s) return "";
      return '<a class="outlet" href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer" title="' + esc(s.label + ", " + s.org) + '">' + esc(shortName(id)) + "</a>";
    }).join("");
    var toggle = '<div class="who-chips dx-views" role="group" aria-label="Arrange the discourse">' + [["theme", "By theme"], ["date", "By date"], ["who", "By speaker"]].map(function (v) {
      return '<button type="button" class="who-chip" data-view="' + v[0] + '" aria-pressed="' + (v[0] === discourseView) + '">' + v[1] + "</button>";
    }).join("") + "</div>";
    return head("What people are saying", "As of " + fmtISO(D.meta.commentaryCapture || D.meta.newsCapture) + ".") +
      toggle + '<article class="state-lead"><h3><a href="reading/positions.html#state-commissions">' + esc(D.meta.stateLead.title) + "</a></h3><p>" + esc(D.meta.stateLead.text) + "</p>" + publicSrcChips(D.meta.stateLead.sources) + "</article>" +
      '<div class="dx-view" id="dx-view">' + renderDiscourseView(discourseView) + "</div>" +
      accSection("Where it’s being covered", "Each links to the cited source.", '<div class="outlets">' + outletChips + "</div>", false, outletIds.length) +
      '<p class="cm-jump-wrap"><a class="cm-jump" href="#comments">The RM26-4 comment letters are in Comments</a></p>';
  }
  function wireNews() {
    var panel = panelFor("news");
    panel.addEventListener("click", function (ev) {
      var v = ev.target.closest && ev.target.closest(".dx-views .who-chip");
      if (v) {
        discourseView = v.getAttribute("data-view");
        panel.querySelectorAll(".dx-views .who-chip").forEach(function (c) { c.setAttribute("aria-pressed", String(c === v)); });
        document.getElementById("dx-view").innerHTML = renderDiscourseView(discourseView);
        return;
      }
      var m = ev.target.closest && ev.target.closest(".dx-more");
      if (m) {
        var list = m.closest(".dx-list"), open = list.classList.toggle("dx-open");
        m.setAttribute("aria-expanded", String(open));
        m.textContent = open ? "Show fewer" : "Show " + list.querySelectorAll(".dx-extra").length + " more";
      }
    });
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
  // By-issue outline groups (same lens order); the reader groups letters by these stance buckets.
  var ISSUE_GROUP = { aq: "Comment-period questions", pr: "Reform principles", rg: "Order regions", topic: "Emergent topics" };
  var ISSUE_STANCE_GROUPS = [
    { k: "support", label: "Supports" },
    { k: "mixed", label: "Supports with conditions / mixed" },
    { k: "oppose", label: "Opposes" },
    { k: "neutral", label: "No position stated" },
  ];
  // Short lens labels shared by the row chips, the filter vocabulary, and the AND-token chips.
  var CL = { study: "Study", cost: "Cost", colo: "Co-loc", flex: "Flex", proximate: "Prox-gen" };
  var RG = { pjm: "PJM", miso: "MISO", spp: "SPP", caiso: "CAISO", isone: "ISO-NE", nyiso: "NYISO" };
  var AQ = { jurisdiction: "Jurisdiction", threshold: "20 MW", jointstudy: "Joint study", deposits: "Deposits", hybridrights: "Hybrid rights", protection: "Protection", expedited: "Expedited", upgradecost: "Upgrade cost" };
  var ROUND_SHORT = { initial: "Initial", reply: "Reply", supplemental: "Supplemental" };

  function renderComments() {
    var CM = window.FERC_COMMENTS;
    if (!CM) return head("The RM26-4 comment period", "Comment data did not load (js/comments-data.js).");

    var statRow = '<div class="cm-stats">' +
      [[CM.total, "comments filed"], [CM.respondentTypes.length, "respondent types"], [CM.downloaded, "bodies downloaded"], [CM.summarized2, "audited summaries"]]
        .map(function (s) { return '<div class="cm-stat"><span class="v">' + esc(String(s[0])) + '</span><span class="l">' + esc(s[1]) + "</span></div>"; }).join("") + "</div>";

    // compact coverage-honesty line, derived from the data so the numbers stay in sync (never a bare 0)
    var cvScans = CM.list.filter(function (c) { return c.dl && !c.s2; }).length;
    var cvInline = CM.list.filter(function (c) { return !c.dl; }).length;
    var coverageLine = '<p class="cm-coverage">' + CM.summarized2 + " of " + CM.total + " audited · " +
      cvScans + " image-only scan" + (cvScans === 1 ? "" : "s") + " await" + (cvScans === 1 ? "s" : "") + " OCR · " +
      cvInline + " served inline by eLibrary</p>";

    // each round links into All comments filtered to that round (the rounds strip is navigation, not decoration)
    var rounds = '<div class="cm-rounds">' + CM.rounds.map(function (r) {
      return '<a class="cm-round" href="#' + window.CommentsRoute.serialize({ sub: "summaries", params: { f: "round:" + r.key } }) +
        '" title="See the ' + esc(r.label.toLowerCase()) + ' in All comments"><span class="cm-round-n mono">' + r.count + '</span><span class="cm-round-l">' + esc(r.label) +
        '</span><span class="cm-round-d mono">' + esc(fmtD(r.first)) + " to " + esc(fmtD(r.last)) + "</span></a>";
    }).join("") + "</div>";

    // which RTO/ISO each comment specifically name-checks (the rg: bin lens) — computed in
    // comments-data.js but unread until now; each chip opens the By-issue reader on that region.
    var regions = (CM.regions && CM.regions.length) ? '<div class="cm-regions">' + CM.regions.map(function (r) {
      return '<a class="cm-region" href="#' + window.CommentsRoute.serialize({ sub: "issue", params: { id: "rg:" + r.key } }) +
        '" title="Read every comment engaging ' + esc(r.label) + '"><span class="cm-region-n mono">' + r.count +
        '</span><span class="cm-region-l">' + esc(r.label) + "</span></a>";
    }).join("") + "</div>" : "";

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

    // stance map: where commenters land on each reform principle, read from the audited summaries
    var ST_LBL = { sup: "Support", opp: "Oppose", mix: "Mixed", neu: "No position" };
    var stanceBars = "";
    if (CM.principleStances && CM.principleStances.length) {
      var stLegend = '<div class="cm-stancelegend">' +
        '<span class="key sup">Support</span><span class="key opp">Oppose</span><span class="key mix">Mixed</span><span class="key neu">No position</span></div>';
      var stRows = CM.principleStances.map(function (p) {
        var seg = function (k, cls) { var n = p[k]; return n ? '<span class="seg ' + cls + '" style="flex:' + n + '" title="' + n + " " + ST_LBL[cls] + '">' + (n >= 10 ? n : "") + "</span>" : ""; };
        // the label deep-links into By-issue for this principle (the aggregate becomes a way in)
        var href = "#" + window.CommentsRoute.serialize({ sub: "issue", params: { id: "pr:" + p.key } });
        // the crosswalk status chip reads next to the tally: "187 support" beside "posed as a question"
        var pol = POLICY_BY_ISSUE["pr:" + p.key];
        var polChip = pol ? " " + pmStatusChip(pol.status) : "";
        return '<div class="cm-stancerow"><div class="cm-bhead"><a class="cm-label cm-agg-link" href="' + href + '" title="Read the record on ' + esc(p.label) + ' by issue">' + esc(p.label) + ' <span class="cm-agg-arrow" aria-hidden="true">→</span></a><span class="cm-n mono">' + p.total + "</span>" + polChip + "</div>" +
          '<div class="cm-stancebar" role="img" aria-label="' + esc(p.label) + ": " + p.support + " support, " + p.oppose + " oppose, " + p.mixed + " mixed, " + p.neutral + ' no position">' +
          seg("support", "sup") + seg("oppose", "opp") + seg("mixed", "mix") + seg("neutral", "neu") + "</div></div>";
      }).join("");
      stanceBars = stLegend + '<div class="cm-stancebars">' + stRows + "</div>";
    }

    // consensus map: stakeholder type x reform principle, each cell colored by that camp's dominant
    // audited stance and labeled with how many of its letters engage that reform. Reads the 2D field
    // built into comments-data.js; the top dozen camps by engagement keep it scannable.
    var PR_SHORT = { study: "Study", cost: "Cost", colo: "Co-loc", flex: "Flex", proximate: "Prox. gen" };
    var consensusMap = "";
    if (CM.bucketStances && CM.bucketStances.length) {
      var cmRows = CM.bucketStances.slice(0, 12);
      var cmCols = cmRows[0].cells.map(function (c) { return PR_SHORT[c.key] || c.key; });
      // One band() so the cell colour and the legend can't drift. Colour by NET sentiment, not the
      // plurality: a cell that is 10 support / 6 oppose is contested, not "support".
      var BAND_CLS = { strong: "support strong", support: "support", mixed: "mixed", oppose: "oppose", neutral: "neutral" };
      var BAND_LABEL = { strong: "strong support", support: "support", mixed: "contested", oppose: "net oppose", neutral: "no position" };
      // A cell with engagement but no support/oppose/mixed is all-neutral — that's "no position", not
      // "contested". Only call it contested when there's real disagreement to band by net sentiment.
      function band(c) {
        if (c.support + c.oppose + c.mixed === 0) return "neutral";
        var nr = c.net / c.total;
        return nr < 0 ? "oppose" : nr < 0.3 ? "mixed" : nr < 0.6 ? "support" : "strong";
      }
      var present = {};
      var grid = '<div class="cm-hm-corner"></div>' +
        cmCols.map(function (c) { return '<div class="cm-hm-col">' + esc(c) + "</div>"; }).join("");
      grid += cmRows.map(function (r) {
        var label = '<div class="cm-hm-rowlabel">' + esc(r.label) + ' <span class="cm-hm-letters mono" title="audited letters from this camp">' + r.letters + "</span></div>";
        var cells = r.cells.map(function (c) {
          if (!c.total) return '<div class="cm-hm-cell empty"><span class="sr-only">no audited position</span></div>';
          var b = band(c); present[b] = true;
          var full = r.label + " — " + (PR_SHORT[c.key] || c.key) + ": " + c.support + " support, " + c.oppose + " oppose, " + c.mixed + " mixed, " + c.neutral + " no position (n=" + c.total + ")";
          // the cell links into By-issue for this reform (a labeled link is the accessible clickable form)
          var href = "#" + window.CommentsRoute.serialize({ sub: "issue", params: { id: "pr:" + c.key } });
          return '<a class="cm-hm-cell ' + BAND_CLS[b] + '" href="' + href + '" aria-label="' + esc(full) + '. Read this issue" title="' + esc(full) + '"><span class="cm-hm-n">' + c.total + "</span></a>";
        }).join("");
        return label + cells;
      }).join("");
      // Only key the bands that actually occur — don't advertise a "net oppose" swatch when no cell is.
      var cmLegend = '<div class="cm-hm-legend">' +
        ["strong", "support", "mixed", "oppose", "neutral"].filter(function (b) { return present[b]; }).map(function (b) {
          return '<span class="cm-hm-key"><span class="cm-hm-sw ' + BAND_CLS[b] + '"></span>' + BAND_LABEL[b] + "</span>";
        }).join("") +
        '<span class="cm-hm-note">cell = net of support minus oppose · number = audited letters engaging that reform</span></div>';
      consensusMap = cmLegend + '<div class="cm-heatmap">' + grid + "</div>";
    }

    var rowsByRound = {};
    CM.list.forEach(function (c) { var k = roundOf(c.filed); (rowsByRound[k] = rowsByRound[k] || []).push(c); });
    var listHtml = CM.rounds.map(function (r) {
      var items = (rowsByRound[r.key] || []).map(function (c) {
        var badge = c.s2 ? '<span class="cm-badge dl" title="Audited summary available"><span aria-hidden="true">✓</span><span class="sr-only">audited summary</span></span>'
          : c.dl ? '<span class="cm-badge sum" title="Downloaded but image-only (no text layer) — not summarized"><span aria-hidden="true">○</span><span class="sr-only">scanned, not summarized</span></span>'
          : '<span class="cm-badge no" title="Body not downloaded — eLibrary serves it inline"><span aria-hidden="true">–</span><span class="sr-only">not downloaded</span></span>';
        var type = CM.bucketLabels[c.bucket] || c.bucket;
        // lens chips add an AND filter token when clicked (data-tk = "<ns>:<key>")
        var lensChip = function (cls, ns, k, label) { return '<button type="button" class="cm-tag ' + cls + (cls === "pr" ? " " + k : "") + '" data-tk="' + ns + ":" + k + '" title="Add filter: ' + esc(label) + '">' + esc(label) + "</button>"; };
        var aqChips = (c.aq || []).map(function (k) { return lensChip("aq", "aq", k, AQ[k]); }).join("");
        var prChips = (c.pr || []).map(function (k) { return lensChip("pr", "pr", k, CL[k]); }).join("");
        var rgChips = (c.rg || []).map(function (k) { return lensChip("rg", "rg", k, RG[k]); }).join("");
        var grp = function (label, chips) { return chips ? '<span class="sr-only">' + label + ": </span>" + chips : ""; };
        var groups = [grp("Comment-period questions", aqChips), grp("Reform principles", prChips), grp("Regions", rgChips)].filter(Boolean);
        var tags = groups.length ? '<div class="cm-row-tags">' + groups.join('<span class="cm-tagsep" aria-hidden="true"></span>') + "</div>" : "";
        // search index: org/type/lens labels + the overall summary + each position's name. (The bin
        // descriptions and verbatim quotes are deliberately left out — they're lazy-loaded per letter,
        // too heavy to fold into every row's up-front index.)
        var q = (c.org + " " + c.desc + " " + type + " " + (c.aq || []).map(function (k) { return AQ[k]; }).join(" ") + " " + (c.pr || []).map(function (k) { return CL[k]; }).join(" ") + " " + (c.rg || []).map(function (k) { return RG[k]; }).join(" ") + " " + (c.summary || "") + " " + (c.bins || []).map(function (b) { return b.n; }).join(" ")).toLowerCase();
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
        var roundKey = roundOf(c.filed);
        // structured fields the AND-token filters match against (never the free-text search string)
        var stEnc = (c.bins || []).filter(function (b) { return String(b.k).indexOf("pr:") === 0; }).map(function (b) { return b.k.slice(3) + ":" + stanceClass(b.s); }).join(" ");
        return '<li class="cm-row" id="c-' + esc(c.acc) + '" data-q="' + esc(q) + '" data-round="' + roundKey +
          '" data-aq="' + esc((c.aq || []).join(" ")) + '" data-pr="' + esc((c.pr || []).join(" ")) +
          '" data-rg="' + esc((c.rg || []).join(" ")) + '" data-st="' + esc(stEnc) + '">' +
          '<div class="cm-row-top"><span class="cm-row-date mono">' + esc(fmtD(c.filed)) + "</span>" + badge +
          '<span class="cm-row-org">' + esc(c.org) + "</span>" +
          '<span class="cm-row-type">' + esc(type) + "</span>" +
          '<a class="cm-row-link" href="' + esc(eli(c.acc)) + '" target="_blank" rel="noopener noreferrer" title="Open eLibrary filing ' + esc(c.acc) + '">eLibrary <span class="ext" aria-hidden="true">↗</span></a>' +
          '<button type="button" class="cm-row-permalink" data-acc="' + esc(c.acc) + '" title="Copy a link to this comment" aria-label="Copy a permalink to this comment from ' + esc(c.org) + '">Link</button></div>' +
          '<p class="cm-row-desc">' + esc(c.desc) + "</p>" + tags + analysis + "</li>";
      }).join("");
      return '<section class="cm-listgroup"><h3 class="cm-listgroup-h">' + esc(r.label) + ' <span class="mono">' + r.count + "</span></h3><ul class=\"cm-list\">" + items + "</ul></section>";
    }).join("");
    // Sticky workbench: the search box, a Tags toggle, the result count, and the active-filter tokens.
    // Clicking a lens/round/stance chip adds a removable AND token (structured match); free text ANDs with them.
    var workbench = '<div class="cm-workbench">' +
      '<div class="cm-wb-controls">' +
      '<input type="search" id="cm-search" placeholder="Filter by org, type, or any word…" aria-label="Filter the comment list" autocomplete="off" />' +
      '<button type="button" class="cm-tags-toggle" id="cm-tags-toggle" aria-expanded="false" aria-controls="cm-tagbar">Tags</button>' +
      '<span class="cm-filter-count mono" id="cm-count">' + CM.total + " of " + CM.total + "</span></div>" +
      '<div class="cm-tokens" id="cm-tokens" aria-label="Active filters" hidden></div></div>';
    var src = '<div class="srcs"><span class="label">Source</span><a class="src-chip" data-tier="ferc" href="' + esc(CM.source_url) + '" target="_blank" rel="noopener noreferrer" title="FERC eLibrary docket sheet for RM26-4-000">eLibrary · RM26-4 docket sheet</a></div>';

    // filter vocabulary: every lens tag + comment round + stance-on-a-reform, each with the count of rows
    // it matches. Counts are over the structured fields the tokens match, so a chip's count equals its result.
    var countIn = function (field, key) { return CM.list.reduce(function (n, c) { return n + ((c[field] || []).indexOf(key) >= 0 ? 1 : 0); }, 0); };
    var countRound = function (key) { return CM.list.reduce(function (n, c) { return n + (roundOf(c.filed) === key ? 1 : 0); }, 0); };
    var countStance = function (pk, stance) { return CM.list.reduce(function (n, c) { return n + ((c.bins || []).some(function (b) { return b.k === "pr:" + pk && stanceClass(b.s) === stance; }) ? 1 : 0); }, 0); };
    var tagChip = function (cls, tk, label, n) { return '<button type="button" class="cm-tag ' + cls + '" data-tk="' + esc(tk) + '" title="Add filter: ' + esc(label) + '">' + esc(label) + ' <span class="cm-tag-n">' + n + "</span></button>"; };
    var lensGroup = function (heading, cls, map, field) { return '<div class="cm-tagbar-group"><span class="cm-tagbar-label">' + esc(heading) + "</span>" + Object.keys(map).map(function (k) { return tagChip(cls, cls + ":" + k, map[k], countIn(field, k)); }).join("") + "</div>"; };
    var ROUND_KEYS = { initial: "Initial", reply: "Reply", supplemental: "Supplemental" };
    var roundGroup = '<div class="cm-tagbar-group"><span class="cm-tagbar-label">Comment round</span>' +
      Object.keys(ROUND_KEYS).map(function (k) { return tagChip("round", "round:" + k, ROUND_KEYS[k], countRound(k)); }).join("") + "</div>";
    var stanceGroup = '<div class="cm-tagbar-group"><span class="cm-tagbar-label">Stance on a reform</span>' +
      Object.keys(CL).map(function (k) {
        return [["support", "Supports"], ["oppose", "Opposes"]].map(function (s) {
          var n = countStance(k, s[0]); return n ? tagChip("st", "st:" + k + ":" + s[0], s[1] + " " + CL[k], n) : "";
        }).join("");
      }).join("") + "</div>";
    var tagBar = '<div class="cm-tagbar" id="cm-tagbar" hidden><div class="cm-tagbar-body">' +
      lensGroup("Comment-period questions", "aq", AQ, "aq") + lensGroup("Reform principles", "pr", CL, "pr") +
      lensGroup("Regions", "rg", RG, "rg") + roundGroup + stanceGroup + "</div></div>";

    // three sub-tabs cut the scroll: the overall picture, the respondent mix, and the comment list itself
    var subtab = function (id, label, sel) {
      return '<button class="cm-subtab" role="tab" id="cmsub-' + id + '" aria-controls="cmsec-' + id + '" aria-selected="' + (sel ? "true" : "false") + '"' + (sel ? "" : ' tabindex="-1"') + ' data-sub="' + id + '">' + esc(label) + "</button>";
    };
    var subnav = '<div class="cm-subtabs" role="tablist" aria-label="Comment-period views">' +
      subtab("overview", "Themes & categories", true) + subtab("issue", "By issue", false) +
      subtab("types", "Respondent types", false) + subtab("summaries", "All comments", false) + "</div>";

    // By-issue outline: the landing state of the reader. Rendered synchronously from the small baked
    // outline (CM.issues); picking an issue lazy-loads its per-issue file and fills the reader pane.
    var microStance = function (st) {
      var seg = function (k, cls) { return st[k] ? '<span class="seg ' + cls + '" style="flex:' + st[k] + '"></span>' : ""; };
      return '<span class="cm-issue-micro" aria-hidden="true">' + seg("support", "sup") + seg("mixed", "mix") + seg("oppose", "opp") + seg("neutral", "neu") + "</span>";
    };
    var issueOutlineHtml = LENS_ORDER.map(function (ns) {
      var items = (CM.issues || []).filter(function (i) { return i.ns === ns; });
      if (!items.length) return "";
      var lis = items.map(function (i) {
        var s = i.stances;
        return '<li><button type="button" class="cm-issue-link" data-issue="' + esc(i.key) + '" data-slug="' + esc(i.slug) +
          '" title="' + esc(i.name + " — " + s.support + " support, " + s.oppose + " oppose, " + s.mixed + " mixed, " + s.neutral + " no position") + '">' +
          '<span class="cm-issue-name">' + esc(i.name) + "</span>" +
          '<span class="cm-issue-count mono">' + i.count + "</span>" + microStance(s) + "</button></li>";
      }).join("");
      return '<section class="cm-issue-group"><h3 class="cm-issue-group-h">' + esc(ISSUE_GROUP[ns]) +
        '</h3><ul class="cm-issue-outline-list">' + lis + "</ul></section>";
    }).join("");

    // Reader landing = the policy map. One row per crosswalk issue: what the orders did with it and where
    // it goes next. This is the strategic read (what is decided, directed, asked, ignored) an SME otherwise
    // assembles by hand across four tabs. Rows deep-link into the reader (reusing the .cm-issue-link handler).
    var issuesByKey = {};
    (CM.issues || []).forEach(function (i) { issuesByKey[i.key] = i; });
    var pmGridRows = (D.policyMap || []).map(function (r) {
      var it = issuesByKey[r.issue];
      if (!it) return "";
      return '<button type="button" class="cm-issue-link cm-pm-gridrow" data-issue="' + esc(it.key) + '" data-slug="' + esc(it.slug) +
        '" title="' + esc(it.name + " — " + PM_STATUS[r.status].lbl) + '">' +
        '<span class="cm-pm-gname">' + esc(it.name) + "</span>" +
        '<span class="cm-pm-gcount mono">' + it.count + "</span>" +
        microStance(it.stances) +
        pmStatusChip(r.status) +
        '<span class="cm-pm-gnext mono">' + esc(pmNextShort(r.next)) + "</span></button>";
    }).join("");
    var policyMapLanding = D.policyMap && D.policyMap.length
      ? '<div class="cm-pm-landing"><h3 class="cm-pm-landing-h">The policy map: from the record to the rule</h3>' +
        '<p class="cm-pm-landing-lede">Each comment-period issue, what the June 18 orders did with it, and where it goes next on the §206 clock. Pick a row to read the record behind it. <span class="cm-pm-lane">Curator’s read, cite-checked; issues the curator has not yet mapped are absent.</span></p>' +
        '<div class="cm-pm-grid">' + pmGridRows + "</div></div>"
      : '<p class="cm-issue-hint">Pick an issue on the left to read the whole record on it: every filer’s position, grouped by stance, with the quotes behind each.</p>';
    var issuePicker = '<label class="cm-issue-picker">Browse issues<select id="cm-issue-picker"><option value="">Policy map</option>' +
      LENS_ORDER.map(function (ns) {
        var items = (CM.issues || []).filter(function (i) { return i.ns === ns; });
        return items.length ? '<optgroup label="' + esc(ISSUE_GROUP[ns]) + '">' + items.map(function (i) {
          return '<option value="' + esc(i.key) + '">' + esc(i.name) + ' (' + i.count + ')</option>';
        }).join("") + '</optgroup>' : "";
      }).join("") + '</select></label>';
    var secIssue = '<section class="cm-sec" id="cmsec-issue" role="tabpanel" aria-labelledby="cmsub-issue" hidden>' +
      head("Read the record by issue",
        "Positions are AI-audited and provisional. Each traces to its quotes.") +
      '<div class="cm-issues">' + issuePicker + '<nav class="cm-issue-outline" aria-label="Issue outline">' + issueOutlineHtml + "</nav>" +
      '<div class="cm-issue-reader" id="cm-issue-reader" aria-live="polite">' + policyMapLanding + "</div></div></section>";

    var secOverview = '<section class="cm-sec" id="cmsec-overview" role="tabpanel" aria-labelledby="cmsub-overview">' +
      head("The RM26-4 comment period",
        CM.total + " comments on DOE’s ANOPR (RM26-4), " + fmtD(CM.dateRange.first) + " to " + fmtD(CM.dateRange.last) + ".") +
      (D.policyMap && D.policyMap.length
        ? '<a class="cm-pm-promo" href="#' + window.CommentsRoute.serialize({ sub: "issue" }) + '">' +
          '<span class="cm-pm-promo-k">The policy map</span>' +
          '<span class="cm-pm-promo-t">See what the June 18 orders did with each issue, and where it goes next on the §206 clock <span aria-hidden="true">→</span></span></a>'
        : "") +
      // Finding one commenter is the most common errand here; the box hands off to the full list.
      '<div class="fg-find"><label for="cm-find">Find a commenter</label><input type="search" id="cm-find" placeholder="Organization or any word" autocomplete="off" /></div>' +
      statRow + coverageLine + rounds +
      (regions ? head("Which RTO/ISO each comment engages", "Only comments that name a region. About 60% name none.") + regions : "") +
      head("Where commenters land on each reform", "Share of audited letters that support, oppose or are mixed.") + stanceBars +
      head("Where each stakeholder type stands", "Net position, support minus oppose. Amber is contested.") + consensusMap +
      accSection("Top themes", "How often each issue appears in the comment text, by keyword. It does not code each filer’s position.", themes, false, (CM.themes || []).length) +
      "</section>";

    var secTypes = '<section class="cm-sec" id="cmsec-types" role="tabpanel" aria-labelledby="cmsub-types" hidden>' +
      head("Who commented", "Stakeholder types are assigned by keyword.") + types +
      "</section>";

    var secSummaries = '<section class="cm-sec" id="cmsec-summaries" role="tabpanel" aria-labelledby="cmsub-summaries" hidden>' +
      head("All comments", "") +
      workbench + tagBar + '<div class="cm-listwrap">' + listHtml + '</div><p class="cm-empty" id="cm-empty" role="status" hidden>No comments match your filters. Remove a token or broaden the search.</p>' + src +
      '<span class="sr-only" role="status" aria-live="polite" id="cm-copystatus"></span></section>';

    return subnav + secOverview + secIssue + secTypes + secSummaries;
  }

  function wireComments() {
    var CM = window.FERC_COMMENTS; // same source renderComments used; the By-issue wiring reads CM.issues etc.
    // sub-tab switching within the Comments panel
    var subs = ["overview", "issue", "types", "summaries"];
    var showSub = function (name, updateHash) {
      subs.forEach(function (s) {
        var btn = document.getElementById("cmsub-" + s), sec = document.getElementById("cmsec-" + s);
        if (!btn || !sec) return;
        var on = s === name;
        btn.setAttribute("aria-selected", on ? "true" : "false");
        btn.tabIndex = on ? 0 : -1;
        sec.hidden = !on;
      });
      if (updateHash === false) return;
      if (name === "issue") showIssueLanding();
      // All-comments reflects its active filter in the hash (so switching to it keeps the list shareable);
      // other sub-tabs write a bare #comments/<sub>.
      if (name === "summaries" && typeof syncFilterHash === "function") syncFilterHash();
      else writeCommentsHash({ sub: name });
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

    // list filter (within the summaries sub-tab): free-text search ANDed with structured AND-tokens.
    var input = document.getElementById("cm-search"), count = document.getElementById("cm-count");
    if (!input) return;
    // The overview's box: the first keystroke opens All comments and carries on typing in its filter.
    var jump = document.getElementById("cm-find");
    if (jump) jump.addEventListener("input", function () {
      var v = jump.value; jump.value = "";
      var tab = document.getElementById("cmsub-summaries"); if (tab) tab.click();
      input.value = v; input.focus(); input.setSelectionRange(v.length, v.length);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    var rows = [].slice.call(document.querySelectorAll("#panel-comments .cm-row"));
    var groups = [].slice.call(document.querySelectorAll("#panel-comments .cm-listgroup"));
    var empty = document.getElementById("cm-empty");
    var tokensBox = document.getElementById("cm-tokens");
    var activeTokens = []; // token ids, e.g. "rg:pjm", "round:initial", "st:colo:support"
    var tokenLabel = function (id) {
      var p = id.split(":");
      if (p[0] === "round") return ROUND_SHORT[p[1]] || p[1];
      if (p[0] === "st") return (p[2] === "support" ? "Supports " : "Opposes ") + (CL[p[1]] || p[1]);
      return (p[0] === "aq" ? AQ : p[0] === "pr" ? CL : RG)[p[1]] || p[1];
    };
    var tokenTest = function (id) {
      var p = id.split(":");
      if (p[0] === "round") return function (r) { return r.dataset.round === p[1]; };
      if (p[0] === "st") { var need = " " + p[1] + ":" + p[2] + " "; return function (r) { return (" " + (r.dataset.st || "") + " ").indexOf(need) >= 0; }; }
      var need2 = " " + p[1] + " ";
      return function (r) { return (" " + (r.dataset[p[0]] || "") + " ").indexOf(need2) >= 0; };
    };
    var testers = {};
    var applyFilter = function () {
      var q = input.value.trim().toLowerCase();
      var preds = activeTokens.map(function (id) { return testers[id] || (testers[id] = tokenTest(id)); });
      var shown = 0;
      rows.forEach(function (r) {
        var hit = (!q || r.getAttribute("data-q").indexOf(q) >= 0) && preds.every(function (fn) { return fn(r); });
        r.hidden = !hit; if (hit) shown++;
      });
      groups.forEach(function (g) { g.hidden = !g.querySelector(".cm-row:not([hidden])"); });
      count.textContent = shown + " of " + rows.length;
      // A search that names a filer opens that filer's first letter, so it lands on the positions without
      // another tap. Only one opens, and only when nothing in the list is already open.
      if (q.length >= 3 && !document.querySelector("#panel-comments .cm-row:not([hidden]) details.cm-analysis[open]")) {
        var hitRow = rows.filter(function (r) { var o = r.querySelector(".cm-row-org"); return !r.hidden && o && o.textContent.toLowerCase().indexOf(q) >= 0; })[0];
        var det = hitRow && hitRow.querySelector("details.cm-analysis"); if (det) det.open = true;
      }
      if (empty) empty.hidden = shown !== 0; // explicit empty state — never leave a blank panel
    };
    var renderTokens = function () {
      if (!tokensBox) return;
      tokensBox.hidden = activeTokens.length === 0;
      tokensBox.innerHTML = activeTokens.map(function (id) {
        var lbl = tokenLabel(id);
        return '<span class="cm-token">' + esc(lbl) + '<button type="button" class="cm-token-x" data-rm="' + esc(id) + '" aria-label="Remove filter ' + esc(lbl) + '">×</button></span>';
      }).join("");
    };
    var addToken = function (id) { if (activeTokens.indexOf(id) < 0) { activeTokens.push(id); renderTokens(); applyFilter(); } };
    var removeToken = function (id) { var i = activeTokens.indexOf(id); if (i >= 0) { activeTokens.splice(i, 1); renderTokens(); applyFilter(); } };
    // keep the URL in step with the filter so a filtered view is shareable (#comments/summaries?f=…&q=…)
    var syncFilterHash = function () {
      var params = {};
      if (activeTokens.length) params.f = activeTokens.join(",");
      var q = input.value.trim(); if (q) params.q = q;
      writeCommentsHash({ sub: "summaries", params: params });
    };
    // set the whole filter state from a route (used when a link deep-links a filtered list)
    var setFilterState = function (fStr, qStr) {
      activeTokens = fStr ? fStr.split(",").filter(Boolean) : [];
      input.value = qStr || "";
      renderTokens(); applyFilter();
    };
    input.addEventListener("input", function () { applyFilter(); syncFilterHash(); });
    // one delegated handler: a chip's data-tk adds a token; a token's × (data-rm) removes it.
    var summariesSec = document.getElementById("cmsec-summaries");
    if (summariesSec) summariesSec.addEventListener("click", function (e) {
      var rm = e.target.closest("[data-rm]");
      if (rm) { removeToken(rm.getAttribute("data-rm")); syncFilterHash(); return; }
      var chip = e.target.closest(".cm-tag[data-tk]");
      if (chip) { addToken(chip.getAttribute("data-tk")); syncFilterHash(); }
    });
    // the sticky Tags button discloses the filter vocabulary panel
    var tagsToggle = document.getElementById("cm-tags-toggle"), tagbar = document.getElementById("cm-tagbar");
    if (tagsToggle && tagbar) tagsToggle.addEventListener("click", function () {
      var opening = tagbar.hasAttribute("hidden");
      if (opening) tagbar.removeAttribute("hidden"); else tagbar.setAttribute("hidden", "");
      tagsToggle.setAttribute("aria-expanded", opening ? "true" : "false");
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

    // row permalink: copy a shareable link (…#comments/c=<acc>) and reflect it in the address bar,
    // so a drafter can cite one comment to a colleague. Delegated so it covers every row.
    var status = document.getElementById("cm-copystatus");
    if (summariesSec) summariesSec.addEventListener("click", function (e) {
      var lb = e.target.closest(".cm-row-permalink");
      if (!lb || !lb.dataset.acc) return;
      writeCommentsHash({ acc: lb.dataset.acc });
      var url = location.href.split("#")[0] + "#" + window.CommentsRoute.serialize({ acc: lb.dataset.acc });
      var done = function (ok) {
        lb.classList.add("copied");
        lb.textContent = ok ? "Copied" : "Link ready";
        if (status) status.textContent = ok ? "Link copied to clipboard" : "Link is now in the address bar";
        setTimeout(function () { lb.classList.remove("copied"); lb.textContent = "Link"; }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () { done(true); }, function () { done(false); });
      } else { done(false); }
    });

    // ---- By-issue reader: pick an issue in the outline, lazy-load its record, render stance groups ----
    var issueCache = {}, issueSelection = 0;
    var issueByKey = {};
    (CM.issues || []).forEach(function (i) { issueByKey[i.key] = i; });
    // The reader's initial content is the policy-map landing; cache the node so a route back to a bare
    // #comments/issue (no id) restores it instead of leaving the last-read issue in place. Clone-based
    // (not innerHTML) so it stays a trusted DOM copy, and the delegated .cm-issue-link handler still fires.
    var readerBox0 = document.getElementById("cm-issue-reader");
    var issueLandingNode = readerBox0 && readerBox0.firstElementChild ? readerBox0.firstElementChild.cloneNode(true) : null;
    var showIssueLanding = function () {
      var box = document.getElementById("cm-issue-reader");
      if (box && issueLandingNode) { box.replaceChildren(issueLandingNode.cloneNode(true)); box.setAttribute("aria-busy", "false"); }
      markActiveIssue(null);
    };
    var issueLetterRow = function (l) {
      var st = stanceClass(l.stance);
      var quotes = (l.quotes || []).map(function (q, i) {
        var pg = (l.pages || [])[i];
        var cite = pg != null
          ? ' <a class="cm-bq-cite" href="' + esc(eli(l.acc)) + '" target="_blank" rel="noopener noreferrer" title="Open the eLibrary filing (p. ' + pg + ' of the source document)">p. ' + pg + '<span class="ext" aria-hidden="true"> ↗</span></a>'
          : "";
        return '<li class="cm-bq">“' + esc(q) + "”" + cite + "</li>";
      }).join("");
      var quotesBlock = quotes
        ? '<details class="cm-issue-quotes"><summary><span class="cm-issue-quotes-lbl">Verbatim quotes</span><span class="cm-issue-quotes-n mono">' + (l.quotes || []).length + "</span></summary><ul class=\"cm-bqs\">" + quotes + "</ul></details>"
        : '<p class="cm-bq-none mono">No verbatim quote is binned to this position.</p>';
      var org = '<a class="cm-issue-org" href="#' + window.CommentsRoute.serialize({ acc: l.acc }) + '" title="See this filer’s row in All comments">' + esc(l.org) + "</a>";
      var bucket = l.bucket ? '<span class="cm-issue-bucket">' + esc(CM.bucketLabels[l.bucket] || l.bucket) + "</span>" : "";
      return '<div class="cm-issue-letter ' + st + '"><div class="cm-issue-letter-head">' + org + bucket + "</div>" +
        (l.desc ? '<p class="cm-issue-letter-desc">' + esc(l.desc) + "</p>" : "") + quotesBlock + "</div>";
    };
    var renderIssueReader = function (box, d) {
      var by = { support: [], mixed: [], oppose: [], neutral: [] };
      (d.letters || []).forEach(function (l) { by[stanceClass(l.stance)].push(l); });
      var s = d.stances || { support: 0, oppose: 0, mixed: 0, neutral: 0, total: 0 };
      var seg = function (k, cls) { return s[k] ? '<span class="seg ' + cls + '" style="flex:' + s[k] + '" title="' + s[k] + " " + esc(cls) + '">' + (s[k] >= 8 ? s[k] : "") + "</span>" : ""; };
      var splitBar = '<div class="cm-stancebar cm-issue-splitbar" role="img" aria-label="' + esc(d.name) + ": " + s.support + " support, " + s.oppose + " oppose, " + s.mixed + " mixed, " + s.neutral + ' no position">' +
        seg("support", "sup") + seg("mixed", "mix") + seg("oppose", "opp") + seg("neutral", "neu") + "</div>";
      var groups = ISSUE_STANCE_GROUPS.map(function (g) {
        var ls = by[g.k]; if (!ls.length) return "";
        return '<section class="cm-issue-stancegroup ' + g.k + '"><h4 class="cm-issue-stancegroup-h">' + esc(g.label) +
          ' <span class="mono">' + ls.length + "</span></h4>" + ls.map(issueLetterRow).join("") + "</section>";
      }).join("");
      // back to the policy-map landing — the reader is a drill-down, so give it an explicit way out
      var backLink = (D.policyMap && D.policyMap.length)
        ? '<a class="cm-issue-back" href="#' + window.CommentsRoute.serialize({ sub: "issue" }) + '"><span aria-hidden="true">←</span> Policy map</a>'
        : "";
      var html = '<div class="cm-issue-readhead">' + backLink + '<h3 class="cm-issue-readtitle">' + esc(d.name) + "</h3>" +
        (d.desc ? '<p class="cm-issue-readdesc">' + esc(d.desc) + "</p>" : "") +
        '<p class="cm-issue-readmeta mono">' + s.total + " audited " + (s.total === 1 ? "letter" : "letters") + " engage this issue</p>" +
        splitBar + "</div>" + pmStrip(POLICY_BY_ISSUE[d.key]) + groups;
      box.innerHTML = html;
      box.setAttribute("aria-busy", "false");
    };
    var picker = document.getElementById("cm-issue-picker");
    var markActiveIssue = function (key) {
      issueSelection++;
      if (picker) picker.value = key || "";
      [].slice.call(document.querySelectorAll("#cmsec-issue .cm-issue-link")).forEach(function (b) {
        var on = b.dataset.issue === key;
        b.classList.toggle("active", on);
        if (on) b.setAttribute("aria-current", "true"); else b.removeAttribute("aria-current");
      });
    };
    var selectIssue = function (key, slug, updateHash) {
      var meta = issueByKey[key];
      if (!slug) slug = meta && meta.slug;
      if (!slug) { showIssueLanding(); writeCommentsHash({ sub: "issue" }); return; }
      markActiveIssue(key);
      var selection = issueSelection;
      if (updateHash !== false) writeCommentsHash({ sub: "issue", params: { id: key } });
      var box = document.getElementById("cm-issue-reader");
      if (!box) return;
      if (issueCache[slug]) { renderIssueReader(box, issueCache[slug]); return; }
      box.setAttribute("aria-busy", "true");
      box.innerHTML = '<p class="cm-bin-loading mono" role="status">Loading the record on this issue…</p>';
      fetch("data/comments/issues/" + slug + ".json?v=" + ASSET_VER)
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (d) { issueCache[slug] = d; if (selection === issueSelection) renderIssueReader(box, d); })
        .catch(function () {
          if (selection !== issueSelection) return;
          box.setAttribute("aria-busy", "false");
          box.innerHTML = '<p class="cm-bin-error" role="status">Couldn’t load this issue here. The positions are committed under <span class="mono">sources/comments/summaries-v2/</span>.</p>';
        });
    };
    if (picker) picker.addEventListener("change", function () {
      if (picker.value) selectIssue(picker.value, null, true);
      else { showIssueLanding(); writeCommentsHash({ sub: "issue" }); }
    });
    var issueSec = document.getElementById("cmsec-issue");
    if (issueSec) issueSec.addEventListener("click", function (e) {
      var b = e.target.closest(".cm-issue-link");
      if (!b) return;
      selectIssue(b.dataset.issue, b.dataset.slug, true);
      var reader = document.getElementById("cm-issue-reader");
      if (reader) show(reader, { block: "nearest" }); // bring the reader into view on stacked/mobile
    });

    // apply a route requested from the URL: select a sub-tab, deep-link an issue, or open a permalinked row.
    applyCommentsRoute = function (state) {
      if (!state) return;
      if (state.acc) {
        showSub("summaries", false);
        setFilterState("", ""); // a permalink shows its row in the full list — never leave it hidden behind a filter
        var row = document.getElementById("c-" + state.acc);
        if (row) {
          var det = row.querySelector(".cm-analysis");
          if (det && !det.open) det.open = true; // fires 'toggle' -> lazy-loads the quotes
          show(row, { block: "start" });
          row.classList.add("cm-row-flash");
          setTimeout(function () { row.classList.remove("cm-row-flash"); }, 1800);
        }
        writeCommentsHash({ acc: state.acc });
      } else {
        var sub = subs.indexOf(state.sub) >= 0 ? state.sub : "overview";
        showSub(sub, false);
        var pr = state.params || {};
        if (sub === "issue" && pr.id) selectIssue(pr.id, null, false);
        // a bare #comments/issue is the policy-map landing: restore it if a prior read replaced it
        else if (sub === "issue") { showIssueLanding(); writeCommentsHash({ sub: "issue" }); }
        // the URL is authoritative for the All-comments filter: apply f/q, or clear it when absent
        else if (sub === "summaries") { setFilterState(pr.f, pr.q); syncFilterHash(); }
        else writeCommentsHash({ sub: sub });
      }
    };
    // consume any route parsed from the hash before this panel finished wiring
    if (pendingCommentsRoute) { applyCommentsRoute(pendingCommentsRoute); pendingCommentsRoute = null; }
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
      "<p>Colors mark the source of each quote:</p>" + legend +
      "<h4>Orders</h4>" +
      "<p>The six June 18, 2026 orders (195 FERC ¶ 61,211 to 61,216) were downloaded from ferc.gov on 2026-06-22 and checked against their page-1 captions. Copies are under <span class='mono'>docs/orders/</span>. Cites link to the page, not the paragraph, because FERC’s PDFs drop paragraph numbers from their text. A test checks that each linked page carries its quote.</p>" +
      "<h4>Filings</h4>" +
      "<p>Filings are read from eLibrary. Quotes are checked word for word against the page they cite. A few scanned filings have no text layer; their text comes from OCR and the page says so.</p>" +
      "<h4>DOE letter and FERC releases</h4>" +
      "<p>The DOE §403 letter is from energy.gov. FERC’s news release, fact sheet and meeting summaries are quoted from Internet Archive captures of June 18 to 20, 2026.</p>" +
      "<h4>ANOPR comments</h4>" +
      "<p>Each comment’s summary is written by an AI model from verbatim quotes and is provisional. A validator checks every quote against the filing. A few image-only scans are not summarized.</p>" +
      "<h4>Dates</h4>" +
      "<p>FERC states the 30- and 60-day periods. Calendar due dates are derived from the issuance date, following the National Law Review’s business-day count.</p>" +
      "<h4>All sources</h4>" + srcList +
      "<p style='margin-top:10px'><em>Last updated: order record as of " + esc(D.meta.capture) + "; Discourse updated " + esc(D.meta.commentaryCapture || D.meta.discourseCapture) +
      (D.meta.newsCapture ? "; news and filings swept " + esc(D.meta.newsCapture) : "") +
      ". Independent analysis; not affiliated with FERC or DOE.</em></p>";
  }

  /* ---- TAB: Filings (orders and filings since June, one line per position, quoted with its page) ---- */
  // Data: window.FERC_RECORD.groups, baked by tools/build-record-data.mjs from sources/filings/tenets.json,
  // every quote proven on its page by tools/verify-record.mjs. Loaded on first open (loadLazy).
  // A side is relative to the proposal the proceeding is about, so the words say that; a bare
  // "Supports" pill left readers asking "supports what?". Neutral says nothing and is left off.
  var SIDE_LABEL = { "for": "supports the proposal", against: "opposes the proposal", mixed: "supports it with conditions", neutral: "" };
  // A side has a target. In a show cause docket, in a rehearing request or rehearing docket, or where the title
  // names an order, the target is FERC's order, not a proposal. The proposal's own author, and a
  // complainant, are not taking a side on someone else's filing, so they get none.
  var SIDE_ORDER = { "for": "supports FERC’s order", against: "challenges FERC’s order", mixed: "challenges FERC’s order in part", neutral: "" };
  var SIDE_SC = { "for": "agrees with the order", against: "disputes the order’s finding", mixed: "agrees in part", neutral: "" };
  function sideText(d, role, g) {
    if (d.stance) return d.stance;
    if (!d.side || d.kind === "complaint" || OPERATOR_FILER.test(d.filer || "")) return "";
    var aboutOrder = /reconsider|Court appeal/.test(role) || /rehearing/.test(g ? g.id : "") || /\b(?:supporting|opposing|challenging)\b[^.]*\border\b/i.test(d.title || "");
    var t = (g && g.kind === "show-cause" ? SIDE_SC : aboutOrder ? SIDE_ORDER : SIDE_LABEL)[d.side];
    if (!t || (d.side === "against" && /^Opposes/.test(role))) return "";   // "Opposes · opposes the proposal" says it twice
    return t;
  }
  function fmtSecs(s) {
    var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
    return (h ? h + ":" + (m < 10 ? "0" : "") : "") + m + ":" + (x < 10 ? "0" : "") + x;
  }
  function atSecs(at) {
    var p = String(at || "").split(":").map(Number);
    return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : 0;
  }
  function slugify(x) { return String(x).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  function anchorChip(R, id) {
    var a = R.anchors[id];
    if (!a) return "";
    return '<a class="oa" href="' + esc(a.pdf) + "#page=" + a.pg + '" target="_blank" rel="noopener noreferrer" title="' + esc("“" + a.quote + "”") + '"><span class="oa-item">' + esc(a.item + " " + a.rto) + "</span> " + esc(a.label) +
      ' <span class="oa-pg mono">' + (a.para ? esc(a.para) + ", " : "") + "p. " + a.pg + "</span></a>";
  }
  function linkLine(R, link, cls) {
    if (!link) return "";
    return '<div class="' + cls + '"><p>' + esc(link.text) + "</p>" +
      (link.anchors && link.anchors.length ? '<div class="oa-list"><span class="oa-l">June order paragraphs it addresses:</span> ' + link.anchors.map(function (id) { return anchorChip(R, id); }).join("") + "</div>" : "") + "</div>";
  }
  function themeLabel(R, k) { var t = (R.themes || []).filter(function (x) { return x.key === k; })[0]; return t ? t.label : k; }
  // FERC's document type says what form a filing takes, not what it does. Readers see what it does.
  var KIND_ROLE = {
    "answer": "Answer", "answer supporting extension": "Supports a delay", "reply letter": "Replies to another filing",
    "motion": "Procedural motion", "motion for abeyance": "Asks FERC to pause the case", "conditional motion for abeyance": "Asks FERC to pause the case, conditionally",
    "motion to rescind": "Asks FERC to withdraw the order", "motion for extension of time": "Asks for more time",
"rehearing request": "Asks FERC to reconsider", "request for rehearing": "Asks FERC to reconsider",
    "request for clarification": "Asks FERC to clarify", "protest": "Opposes", "limited protest": "Opposes in part",
    "tariff filing": "Proposed tariff change", "tariff amendment": "Amends a proposed tariff", "§205 refiling": "Refiled proposal",
    "compliance filing": "Complies with an order", "order": "FERC order", "errata": "Correction", "informational report": "Report to FERC",
    "congressional letter": "Letter from Congress"
  };
  // An answer can respond to FERC's order or to another party; the type alone does not say which, so read
  // the document's own title and summary, and fall back to the neutral "Answer".
  var TITLE_ROLE = [[/petition for review/i, "Court appeal"], [/rehearing/i, "Asks FERC to reconsider"], [/clarification/i, "Asks FERC to clarify"],
    [/^(?:(?:joint |expedited |emergency )*motion|request)\b[^.]*\bextension\b/i, "Asks for more time"], [/\babeyance\b/i, "Asks FERC to pause the case"], [/deficien/i, "FERC asks for more information"],
    [/\blimited protest\b/i, "Opposes in part"], [/\bprotest\b/i, "Opposes"], [/informational report/i, "Report to FERC"]];
  var FERC_FILER = /^(?:secretary of the commission|ferc\b|federal energy regulatory commission|(?:commissioners|chair(?:man)?) and immediate staff|office of energy market regulation)/i;
  // The grid operators and their transmission owners: a bare "filing" from one of them is its own proposal.
  var OPERATOR_FILER = /^(?:PJM|MISO\b|Midcontinent Independent|Southwest Power Pool|SPP\b|California Independent|CAISO\b|ISO New England|New York Independent|NYISO\b|American Transmission Company)/i;
  function kindRole(k, d) {
    // FERC's own notices are not requests to FERC, whatever eLibrary's type says.
    if (d && FERC_FILER.test(d.filer || "") && k !== "order") {
      var ft = d.title || "";
      if (/denial of rehearing by operation of law/i.test(ft)) return "FERC: rehearing denied by operation of law";
      if (/errata/i.test(ft)) return "FERC correction";
      if (/deficien/i.test(ft)) return "FERC asks for more information";
      if (/^chair/i.test(d.filer || "")) return "Letter from FERC’s chair";
      return "FERC notice";
    }
    // The title is the surer signal for what a document does: "filing" and "request" cover protests, appeals and letters.
    var tt = d && d.title || "";
    if (k !== "answer" && k !== "order") for (var r = 0; r < TITLE_ROLE.length; r++) if (TITLE_ROLE[r][0].test(tt)) return TITLE_ROLE[r][1];
    if (k === "answer" && d) {
      // Read the title first: it names what the answer responds to. "Motion for Leave to Answer and" is procedure.
      var title = (d.title || "").replace(/^motion for leave to answer and (?:second )?/i, "");
      var reply = /\b(?:to|on|in response to|responding to|in support of|answers?)\b.{0,140}?\b(?:answers?|motions?|protests?|comments|requests?|complaint|responses?|filings?)\b/i;
      var order = /(?:order to show cause|show cause order|order instituting (?:the )?proceeding|in response to the order)/i;
      if (reply.test(title)) return "Replies to another filing";
      if (order.test(title)) return "Answers FERC’s order";
      if (order.test(d.summary || "")) return "Answers FERC’s order";
    }
    // eLibrary's catch-all "filing": an operator's own is its proposal; anyone else's is a response.
    if (k === "filing" && d) {
      if (/^response (?:of|to)\b/i.test(tt)) return "Answers FERC’s order";
      // Judge the title by what it says the document is, not by parentheticals such as "(comments requested by Nov 30)".
      var purpose = tt.replace(/\([^)]*\)/g, " ");
      if (OPERATOR_FILER.test(d.filer || "") && !d.stance && !/\bremarks\b|\bcomments? (?:of|on|in)\b|\bin support\b|\banswer/i.test(purpose)) return "Operator’s filing";
      return "Comments";
    }
    return KIND_ROLE[k] || (k ? k.charAt(0).toUpperCase() + k.slice(1) : "");
  }
  function docCard(R, g, d) {
    var body = d.summary
      ? '<p class="fd-sum">' + esc(d.summary) + "</p>" +
        (d.ask ? '<p class="fd-ask"><span>Asks FERC to</span> ' + esc(d.ask.replace(/^\w/, function (c) { return c.toLowerCase(); })) + "</p>" : "") +
        linkLine(R, d.link, "fd-link") +
        '<ol class="pts" data-slug="' + esc(d.slug) + '"><li class="pts-wait">' + d.npoints + " key points, loading…</li></ol>"
      : d.position
      // A position read for this site: what the filer argues, in our words, then one sentence in theirs.
      ? '<p class="fd-sum">' + esc(d.position.text) + "</p>" +
        (d.position.quote ? '<blockquote class="fd-pq">“' + esc(d.position.quote) + '” <a href="reading/' + esc(d.slug) + "/text.html#p-" + esc(d.position.pg) + '">PDF p. ' + esc(d.position.pg) + "</a></blockquote>" : "")
      : '<p class="fd-sum na">Not yet read for this site. ' + esc(d.title) + "</p>";
    // Topics link to the theme filter, so the label does something. Themes matched by keyword in an
    // unread document say so, and their link includes the keyword matches.
    var kw = d.themesFrom === "text", role = kindRole(d.kind, d), side = sideText(d, role, g);
    // For a read position, the stance replaces a bare "Opposes" or "Comments" type; a reply keeps its type.
    if (d.position && /^(?:Opposes|Comments$)/.test(role) && side) { role = side.charAt(0).toUpperCase() + side.slice(1); side = ""; }
    var tags = (d.themes || []).length ? '<span class="fd-topics">' + (kw ? "Topics (keyword match): " : "Topics: ") + d.themes.map(function (t) {
      return '<a href="#filings/theme/' + esc(t) + (kw ? "/all" : "") + '">' + esc(themeLabel(R, t)) + "</a>";
    }).join(", ") + "</span>" : "";
    var hay = [d.filer, (d.filers || []).join(" "), d.kind, d.title, d.docket, d.accession, g.title, g.short, d.summary].join(" ").toLowerCase();
    return '<details class="fdoc" id="fd-' + esc(d.slug) + '" data-themes="' + esc((d.themes || []).join(" ")) + '"' + (kw ? " data-kw" : "") + ' data-q="' + esc(hay) + '"><summary>' +
      '<span class="fd-date mono">' + esc(fmtISO(d.date)) + '</span><span class="fd-who">' + esc(d.filer) + '</span><span class="fd-kind">' + esc(role) +
      (side ? ' · <span class="fd-side side-' + esc(d.side || "stance") + '">' + esc(side) + "</span>" : "") + "</span>" +
      (d.summary || d.position ? '<span class="fd-tease">' + esc(d.summary || d.position.title) + "</span>" : '<span class="fd-unread">' + (d.themesFrom === "text" ? "not yet read · themes matched by keyword" : "not yet read") + "</span>") + "</summary>" +
      '<div class="fd-body">' + body + '<p class="fd-tools">' + tags +
      '<a href="reading/' + esc(d.slug) + '/">Read the document</a>' +
      (d.accession ? '<a href="' + esc(eli(d.accession)) + '" target="_blank" rel="noopener noreferrer">eLibrary ' + esc(d.accession) + "</a>" : d.url ? '<a href="' + esc(d.url) + '" target="_blank" rel="noopener noreferrer">Source</a>' : "") +
      '<span class="mono">' + esc(d.docket || "") + (d.pages ? " · " + d.pages + " pp" : "") + "</span>" +
      (d.filers ? '<span class="fd-all">Filed by ' + esc(d.filers.join(", ")) + "</span>" : "") + "</p></div></details>";
  }
  // A proceeding's documents, split by what they are, in this order: what FERC did, what was proposed,
  // how others responded, then procedure (folded, since it rarely holds the substance). Newest first within each.
  var DOC_SECTIONS = [["ferc", "FERC orders and notices"], ["proposal", "Proposals and reports"], ["response", "Responses"], ["proc", "Procedural filings"]];
  var PROPOSAL_ROLE = /^(?:Proposed tariff change|Amends a proposed tariff|Refiled proposal|Complies with an order|Report to FERC|Operator’s filing)$/;
  var PROC_ROLE = /pause the case|more time|Procedural motion|Supports a delay|^Notice$|^Meeting agenda$|^Errata$|^Correction$/;
  function docSection(d) {
    var role = kindRole(d.kind, d);
    if (d.kind === "order" || /^FERC/.test(role)) return "ferc";
    if (PROPOSAL_ROLE.test(role)) return "proposal";
    if (PROC_ROLE.test(role)) return "proc";
    return "response";
  }
  function docSections(R, g) {
    // Procedure folds only beneath substantive responses; when it is all the response there is, it shows.
    var hasResponses = g.docs.some(function (d) { return docSection(d) === "response"; });
    return DOC_SECTIONS.map(function (sec) {
      var ds = g.docs.filter(function (d) { return docSection(d) === sec[0]; });
      if (!ds.length) return "";
      var cards = ds.map(function (d) { return docCard(R, g, d); }).join("");
      return sec[0] === "proc" && hasResponses
        ? '<details class="fd-secw fd-proc" data-sec="proc"><summary class="fd-sec">' + esc(sec[1]) + ' <span class="fd-sec-n">' + ds.length + "</span></summary>" + cards + "</details>"
        : '<div class="fd-secw" data-sec="' + sec[0] + '"><h5 class="fd-sec">' + esc(sec[1]) + ' <span class="fd-sec-n">' + ds.length + "</span></h5>" + cards + "</div>";
    }).join("");
  }
  // Capacity quantities the readings extracted (each verified on its page), normalized to MW. Filings
  // that cite the same quantity (within 1%, sharing a word in the label) merge into one bar, so the chart
  // shows how often a number recurs across the record: PJM's backstop target appears in a dozen filings.
  // Region names and generic words do not make two figures the same quantity; the named thing must match.
  var FIG_STOP = { the: 1, of: 1, and: 1, in: 1, by: 1, to: 1, for: 1, a: 1, mw: 1, gw: 1, ucap: 1, from: 1, as: 1, at: 1, its: 1, or: 1, pjm: 1, miso: 1, spp: 1, caiso: 1, nyiso: 1, iso: 1, load: 1, large: 1, data: 1, center: 1, centers: 1, generation: 1, initial: 1, total: 1, mws: 1 };
  function figWords(l) { return String(l).toLowerCase().split(/[^a-z0-9]+/).filter(function (w) { return w.length > 2 && !FIG_STOP[w]; }); }
  function figureChart(R) {
    var rows = [];
    R.groups.forEach(function (g) { g.docs.forEach(function (d) { (d.figures || []).forEach(function (f) {
      var mw = /^GW/i.test(f.unit) ? f.value * 1000 : /^MW( UCAP)?$/i.test(f.unit) ? f.value : null;
      if (mw && mw >= 1000) rows.push({ mw: mw, f: f, d: d, g: g });
    }); }); });
    var clusters = [];
    rows.forEach(function (r) {
      var w = figWords(r.f.label);
      var hit = clusters.filter(function (c) {
        return Math.abs(c.mw - r.mw) / c.mw <= 0.01 && c.items.some(function (it) { return figWords(it.f.label).filter(function (x) { return w.indexOf(x) >= 0; }).length >= 2; });
      })[0];
      if (hit) hit.items.push(r); else clusters.push({ mw: r.mw, items: [r] });
    });
    if (!clusters.length) return "";
    clusters.sort(function (a, b) { return b.mw - a.mw; });
    var max = clusters[0].mw;
    var bars = clusters.map(function (c) {
      var score = function (it) { var w = figWords(it.f.label); return c.items.reduce(function (n, o) { return n + figWords(o.f.label).filter(function (x) { return w.indexOf(x) >= 0; }).length; }, 0); };
      var r = c.items.slice().sort(function (a, b) { return score(b) - score(a); })[0], n = {}, docs = c.items.filter(function (x) { if (n[x.d.slug]) return false; n[x.d.slug] = 1; return true; });
      var v = c.mw >= 10000 ? (Math.round(c.mw / 100) / 10).toLocaleString("en-US") + " GW" : Math.round(c.mw).toLocaleString("en-US") + " MW";
      return '<li><a href="#filings/' + esc(r.g.id) + "/" + esc(r.d.slug) + '" title="' + esc("“" + r.f.quote + "” " + r.d.filer + ", p. " + (r.f.pg || 1)) + '">' +
        '<span class="fc-l">' + esc(r.f.label) + '</span><span class="fc-bar"><span style="width:' + Math.max(1.5, 100 * c.mw / max).toFixed(1) + '%"></span></span>' +
        '<span class="fc-v mono">' + v + '</span><span class="fc-n">' + docs.length + (docs.length === 1 ? " filing" : " filings") + "</span></a></li>";
    }).join("");
    // A subtab of its own, so no disclosure: the list shows as soon as the tab opens.
    return '<section class="fc-sec" aria-labelledby="fc-h"><h2 class="now-h" id="fc-h">Megawatts in the filings</h2>' +
      '<p class="lede">Figures of 1,000 MW or more, each checked on its page.</p><ol class="fc">' + bars + "</ol></section>";
  }
  function pointItems(d, points) {
    return points.map(function (p) {
      var pg = p.pg || 1;
      return '<li><p class="pt">' + esc(p.point) + '</p><blockquote>“' + esc(p.quote) + '” <a class="pq-pg mono" href="reading/' + esc(d.slug) + "/text.html#p-" + pg + '">p. ' + pg + "</a>" +
        (d.pdfUrl ? ' <a class="pq-pg" href="' + esc(d.pdfUrl) + "#page=" + pg + '" target="_blank" rel="noopener noreferrer">PDF</a>' : "") + "</blockquote></li>";
    }).join("");
  }
  // A proceeding's quoted points live in data/filings/<id>.json (tools/build-record-data.mjs) and arrive the
  // first time it opens. A failed fetch says so in place and retries on the next open.
  var pointsState = {};
  function loadPoints(gEl, done) {
    var id = gEl.id.slice(3), R = window.FERC_RECORD;
    if (pointsState[id] === "ok") { if (done) done(); return; }
    if (pointsState[id] === "loading") { (pointsState[id + ":q"] = pointsState[id + ":q"] || []).push(done); return; }
    pointsState[id] = "loading";
    var g = R.groups.filter(function (x) { return x.id === id; })[0];
    fetch("data/filings/" + id + ".json?v=" + ASSET_VER).then(function (r) { if (!r.ok) throw Error(r.status); return r.json(); }).then(function (P) {
      g.docs.forEach(function (d) {
        var ol = gEl.querySelector('.pts[data-slug="' + d.slug + '"]');
        if (ol && P[d.slug]) ol.innerHTML = pointItems(d, P[d.slug]);
      });
      pointsState[id] = "ok";
    }).catch(function () {
      pointsState[id] = null;
      gEl.querySelectorAll(".pts-wait").forEach(function (li) { li.textContent = "The key points did not load. Close and reopen this proceeding to try again."; });
    }).then(function () {
      var q = (pointsState[id + ":q"] || []).concat(done ? [done] : []); pointsState[id + ":q"] = null;
      q.forEach(function (f) { if (f) f(); });
    });
  }
  function renderFilings() {
    var R = window.FERC_RECORD;
    if (!R || !R.groups) return head("Filings", "The filings record did not load (js/record-data.js).");
    var counts = {};
    R.groups.forEach(function (g) { g.docs.forEach(function (d) { if (d.themesFrom !== "text") (d.themes || []).forEach(function (t) { counts[t] = (counts[t] || 0) + 1; }); }); });
    // Each chip shows only documents read for this site whose readings take up the theme, across every
    // market; the count is how many. Keyword matches in unread documents are one tap further, on request.
    var chips = '<div class="fg-themes"><p class="fg-themes-l" id="fg-themes-l">Show documents about</p><div class="who-chips th-chips" role="group" aria-labelledby="fg-themes-l"><button type="button" class="who-chip" data-theme="" aria-pressed="true">Everything</button>' +
      R.themes.filter(function (t) { return counts[t.key]; }).map(function (t) {
        return '<button type="button" class="who-chip" data-theme="' + esc(t.key) + '" aria-pressed="false" title="' + esc(t.gloss) + '">' + esc(t.label) + ' <span class="mono">' + counts[t.key] + "</span></button>";
      }).join("") + '</div></div><div class="fg-live-row"><p class="fg-live" role="status" aria-live="polite"></p><button type="button" class="fg-kw" hidden></button><button type="button" class="fg-clear" hidden>Clear filter</button></div>';
    var find = '<div class="fg-find"><label for="fg-q">Find a document</label><input type="search" id="fg-q" placeholder="Filer, docket or any word" autocomplete="off" /></div>';
    var group = function (g) {
      return '<details class="fgroup" id="fg-' + esc(g.id) + '"><summary class="fg-sum"><span class="fg-h" role="heading" aria-level="3">' + esc(g.title) +
        ' <span class="fg-docket mono">' + esc(g.docket) + '</span></span><span class="fg-n">Latest' +
        ' <span class="mono">' + esc(fmtISO(g.newest).replace(/, \d{4}$/, "")) + "</span></span></summary>" +
        '<div class="fg-body">' + linkLine(R, g.link, "fg-link") +
        (g.about ? '<p class="fg-about">' + esc(g.about) + "</p>" : "") + (g.status ? '<p class="fg-status">' + esc(g.status) + "</p>" : "") +
        // A heading says what the rows are: the documents on this proceeding's docket sheet.
        '<h4 class="fg-docs-h">Filings in ' + esc(g.docket) + "</h4>" +
        '<div class="fdocs">' + docSections(R, g) + "</div></div></details>";
    };
    var sc = R.groups.filter(function (g) { return g.kind === "show-cause"; }), rel = R.groups.filter(function (g) { return g.kind !== "show-cause"; });
    return head("Filings since the June 18 orders",
      "") +
      // Filings land in batches, so a "newest" list says little; the full list is one link away.
      '<p class="reader-entry"><a href="reading/">Full document list</a></p>' + find + chips +
      '<section class="cmp-sec" aria-labelledby="cmp-h"><h2 class="now-h" id="cmp-h">Responses to the June orders, by reform</h2><div class="xw-compare"><p class="cm-loading" role="status">Loading the comparison…</p></div></section>' +
      FG_MARKETS.map(function (m) {
        var gs = sc.concat(rel).filter(function (g) { return marketOf(g) === m[0]; });
        return gs.length ? '<h3 class="fg-sec fg-mkt" data-mkt="' + m[0] + '" hidden>' + esc(m[1]) + "</h3>" + gs.map(group).join("") : "";
      }).join("") +
      '<p class="fg-none" hidden>No document matches. Clear the filter to see every proceeding.</p>' +
      figureChart(R);
  }
  var FQ_MIN = 2;          // a one-letter query matches nearly every document
  var filingTheme = "", filingQuery = "", filingKw = false;
  // The theme chip and the typed query are one filter: a document shows when it passes both. Matching
  // proceedings open so the documents are on the page; clearing the filter folds back the ones it opened
  // (marked data-auto), except one the reader has a document open in. Quoted points load when a document opens, or for a theme, where
  // the match set is small enough to fetch at once.
  // Filings is browsed by market: one subtab per grid operator, show cause docket first, then the
  // proceedings around it. ATC plans inside MISO; Exelon's complaint concerns PJM's auction.
  var FG_MARKETS = [["pjm", "PJM"], ["miso", "MISO"], ["spp", "SPP"], ["caiso", "CAISO"], ["isone", "ISO-NE"], ["nyiso", "NYISO"], ["other", "Other"]];
  function marketOf(g) {
    var id = g.id.replace(/^sc-/, ""), m = id.split("-")[0];
    if (m === "atc") return "miso";
    if (m === "exelon") return "pjm";
    return FG_MARKETS.some(function (x) { return x[0] === m; }) ? m : "other";
  }
  function applyTheme(panel, key) {
    var R0 = window.FERC_RECORD;
    filingTheme = key && R0 && R0.themes.some(function (t) { return t.key === key; }) ? key : "";
    panel.querySelectorAll(".th-chips .who-chip").forEach(function (c) { c.setAttribute("aria-pressed", String(c.getAttribute("data-theme") === filingTheme)); });
    if (!filingTheme) filingKw = false;
    var q = filingQuery.length >= FQ_MIN ? filingQuery : "", active = !!(filingTheme || q), shown = 0, groupsShown = 0;
    // Filtering shows the matches per proceeding, without each proceeding's intro text.
    panel.classList.toggle("fg-filtering", active);
    var box = panel.querySelector("#fg-q");
    if (box && box.value.trim().toLowerCase() !== filingQuery) box.value = filingQuery;
    // Every typed word must appear: "google lars" finds Google's filing in the LARS proceeding.
    var words = q ? q.split(/\s+/).filter(Boolean) : [];
    panel.querySelectorAll(".fgroup").forEach(function (g) {
      var n = 0;
      g.querySelectorAll(".fdoc").forEach(function (d) {
        var on = (!filingTheme || (" " + d.getAttribute("data-themes") + " ").indexOf(" " + filingTheme + " ") >= 0 && (filingKw || !d.hasAttribute("data-kw"))) &&
          (!q || words.every(function (w) { return d.getAttribute("data-q").indexOf(w) >= 0; }));
        d.hidden = !on; if (on) n++;
      });
      g.hidden = n === 0; shown += n; if (n) groupsShown++;
      // Sections with no match step aside; folded procedure opens while it holds a match.
      g.querySelectorAll(".fd-secw").forEach(function (w) {
        var any = !!w.querySelector(".fdoc:not([hidden])"); w.hidden = !any;
        if (w.classList.contains("fd-proc")) {
          if (active && any) { if (!w.open) { w.setAttribute("data-auto", ""); w.open = true; } }
          else if (w.hasAttribute("data-auto")) { w.removeAttribute("data-auto"); if (!w.querySelector(".fdoc[open]")) w.open = false; }
        }
      });
      if (active && n) { if (!g.open) { g.setAttribute("data-auto", ""); g.open = true; } if (filingTheme) loadPoints(g); }
      else if (!active && g.hasAttribute("data-auto")) { g.removeAttribute("data-auto"); if (!g.querySelector(".fdoc[open]")) g.open = false; }
    });
    panel.querySelectorAll(".fg-mkt").forEach(function (el) { el.hidden = !active; });
    // A search that leaves one document opens it: the answer, not a list of one.
    if (q && shown === 1) { var only1 = panel.querySelector(".fdoc:not([hidden])"); if (only1 && !only1.open) only1.open = true; }
    // A search or theme filter looks across every pane, not only the open one.
    // While filtering, every pane shows and the bar steps aside; clearing the filter restores the picked pane.
    var bar = panel.querySelector(".st-bar");
    if (bar) {
      bar.hidden = !!active;
      // Search results are documents: the Compare and Megawatts panes are not, so they stay out of the way.
      panel.querySelectorAll(".st-pane").forEach(function (x) {
        var docs = x.id !== "stp-filings-compare" && x.id !== "stp-filings-mw";
        if (active) { x.hidden = !docs; x.removeAttribute("role"); } else x.setAttribute("role", "tabpanel");
      });
      if (!active) pickSubtab("filings", subtabPick.filings || SUBTABS.filings[0][0]);
    }
    // A chip's number is what tapping it would show, so it counts against the typed query.
    // Same word-by-word test as the filter above, so a count never disagrees with what the chip shows.
    var docs = [].slice.call(panel.querySelectorAll(".fdoc")).filter(function (d) { return words.every(function (w) { return d.getAttribute("data-q").indexOf(w) >= 0; }); });
    var hasTheme = function (d, k) { return (" " + d.getAttribute("data-themes") + " ").indexOf(" " + k + " ") >= 0; };
    panel.querySelectorAll(".th-chips .who-chip").forEach(function (c) {
      var k = c.getAttribute("data-theme"), num = c.querySelector(".mono");
      if (num) num.textContent = docs.filter(function (d) { return hasTheme(d, k) && !d.hasAttribute("data-kw"); }).length;
    });
    var kwN = filingTheme ? docs.filter(function (d) { return hasTheme(d, filingTheme) && d.hasAttribute("data-kw"); }).length : 0;
    var kwBtn = panel.querySelector(".fg-kw");
    if (kwBtn) {
      kwBtn.hidden = !kwN;
      kwBtn.textContent = filingKw ? "Hide the " + kwN + " unread documents matched by keyword" : "Add " + kwN + " unread " + (kwN === 1 ? "document" : "documents") + " that mention it (keyword match)";
    }
    var clr = panel.querySelector(".fg-clear"); if (clr) clr.hidden = !active;
    var none = panel.querySelector(".fg-none");
    if (none) none.hidden = !(active && shown === 0);
    var live = panel.querySelector(".fg-live");
    var tl = filingTheme ? themeLabel(window.FERC_RECORD, filingTheme) : "";
    if (live) live.textContent = !active ? "" : shown + (shown === 1 ? " document" : " documents") + (filingTheme ? " about " + tl : "") + (q ? " matching “" + q + "”" : "") +
      " in " + groupsShown + (groupsShown === 1 ? " proceeding" : " proceedings");
  }
  var pendingFiling = null, filingHash = "";
  function routeFiling(rest) {
    var panel = panelFor("filings");
    var bits = String(rest || "").split("/");
    if (bits[0] === "theme") {
      filingQuery = "";                      // a theme address shows that theme alone, whatever was typed before
      filingKw = bits[2] === "all";
      applyTheme(panel, bits[1] || "");
      // An unknown theme shows everything, so the address says so too.
      filingHash = filingTheme ? "theme/" + filingTheme + (filingKw ? "/all" : "") : "";
      var top = panel.querySelector(".fg-themes"); if (top) show(top, { block: "start" });
      if (history.replaceState) history.replaceState(null, "", "#filings" + (filingHash ? "/" + filingHash : ""));
      return;
    }
    var grp = document.getElementById("fg-" + bits[0]);
    // Retired group ids from earlier links: the June-orders group became one group per operator.
    if (!grp && bits[0] === "show-cause-since-june") {
      var legacy = bits[1] && [].slice.call(panel.querySelectorAll(".fdoc")).filter(function (d) { return slugify(d.querySelector(".fd-who").textContent) === bits[1]; })[0];
      grp = legacy ? legacy.closest(".fgroup") : document.getElementById("fg-sc-multi");
      if (legacy) bits[1] = legacy.id.slice(3);
    }
    if (!grp) return;
    if (filingTheme || filingQuery) { filingQuery = ""; applyTheme(panel, ""); }
    filingHash = rest;
    grp.open = true;
    var doc = bits[1] && document.getElementById("fd-" + bits[1]);
    // Older links named a filer, not a document: open that filer's newest document instead.
    if (!doc && bits[1]) doc = [].slice.call(grp.querySelectorAll(".fdoc")).filter(function (d) { return slugify(d.querySelector(".fd-who").textContent) === bits[1]; })[0] || null;
    // A proceeding with one document: the link opens it, whether or not the proceeding was already open.
    var solo = !doc && grp.querySelectorAll(".fdoc");
    if (solo && solo.length === 1) doc = solo[0];
    // A document can move between proceedings (sc-miso to miso-irr): open the group that holds it.
    if (doc) { grp = doc.closest(".fgroup") || grp; grp.open = true; var pr = doc.closest(".fd-proc"); if (pr) pr.open = true; doc.open = true; filingHash = grp.id.slice(3) + "/" + doc.id.slice(3); }
    show((doc || grp), { block: "start" });
    focusSummary(doc || grp);
    loadPoints(grp, function () { if (doc) show(doc, { block: "start" }); });
    setCrumbs("filings", filingHash);
  }
  function wireFilings() {
    var panel = panelFor("filings");
    loadCrosswalk();
    panel.addEventListener("click", function (ev) {
      var t = ev.target.closest && ev.target, k;
      if (t && t.closest(".fg-kw")) { filingKw = !filingKw; k = filingTheme; }
      else if (t && t.closest(".fg-clear")) { filingQuery = ""; k = ""; }
      else { var b = t && t.closest(".th-chips .who-chip"); if (!b) return; filingKw = false; k = b.getAttribute("data-theme"); }
      applyTheme(panel, k);
      filingHash = filingTheme ? "theme/" + filingTheme + (filingKw ? "/all" : "") : "";
      if (history.replaceState) history.replaceState(null, "", "#filings" + (filingHash ? "/" + filingHash : ""));
    });
    var box = panel.querySelector("#fg-q"), qTimer = null;
    if (box) box.addEventListener("input", function () {
      clearTimeout(qTimer);
      qTimer = setTimeout(function () { filingQuery = box.value.trim().toLowerCase(); applyTheme(panel, filingTheme); }, 120);
    });
    // Opening a proceeding or document writes its address, so the URL and the trail always match the page.
    panel.addEventListener("toggle", function (ev) {
      var el = ev.target;
      if (!el.classList) return;
      var g = el.classList.contains("fgroup") ? el : el.classList.contains("fdoc") ? el.closest(".fgroup") : null;
      if (!g) return;
      // Closing what the address points at steps the address back up: a document to its proceeding, a
      // proceeding to the bare tab. Otherwise the URL and the trail keep naming something no longer open.
      if (!el.open) {
        var gid = g.id.slice(3), here = el === g ? gid : gid + "/" + el.id.slice(3);
        if (filingHash === here || (el === g && filingHash.indexOf(gid + "/") === 0)) {
          filingHash = el === g ? "" : gid;
          if (history.replaceState) history.replaceState(null, "", "#filings" + (filingHash ? "/" + filingHash : ""));
          setCrumbs("filings", filingHash);
        }
        return;
      }
      var isGroup = el === g, filtering = !!(filingTheme || filingQuery.length >= FQ_MIN);
      // A typed query can open every proceeding at once; its points wait for a document to open.
      if (!(isGroup && filtering && !filingTheme)) loadPoints(g);
      // While a filter is on, proceedings are opened by applyTheme and the address stays the theme (or the
      // bare tab). Toggle events arrive after applyTheme returns, so a flag set around those opens would
      // already be cleared here. A document is only ever opened by the reader, so it always gets its address.
      if (filtering && isGroup) return;
      // A proceeding with one document has nothing to choose between: open the document too.
      var only = isGroup ? g.querySelectorAll(".fdoc") : [];
      if (only.length === 1 && !only[0].open) { only[0].open = true; return; }
      filingHash = g.id.slice(3) + (el.classList.contains("fdoc") ? "/" + el.id.slice(3) : "");
      if (history.replaceState) history.replaceState(null, "", "#filings/" + filingHash);
      setCrumbs("filings", filingHash);
    }, true);
    if (pendingFiling) { routeFiling(pendingFiling); pendingFiling = null; }
  }

  /* ---- TAB: Commissioners (spoken record since June, then the June 18 concurrences) ---- */
  function commishName(key) {
    var c = (D.commissioners || []).filter(function (x) { return x.key === key; })[0];
    return c ? c.name : key;
  }
  // Machine captions mangle the proper nouns that matter most here. Fixed for display only, in brackets so the
  // reader sees the edit; the verified text in chapters.json keeps the caption's own words.
  var CAPTION_FIX = [[/\bPGM\b/g, "[PJM]"], [/\bFK\b/g, "[FERC]"], [/\bFurk\b/g, "[FERC]"], [/\bNERK\b|\bNerk\b/g, "[NERC]"],
    [/\btaker pay\b/g, "[take-or-pay]"], [/\bADTTs\b/g, "[ATTs]"], [/\bnew trench of\b/g, "new [tranche] of"]];
  function captionText(t) { CAPTION_FIX.forEach(function (f) { t = t.replace(f[0], f[1]); }); return t; }
  var commishWho = "all";
  var SQ_CAP = 3; // quotes shown per video before "All N quotes"; a commissioner filter shows all of theirs
  function renderCommissioners() {
    var R = window.FERC_RECORD;
    var keys = (D.commissioners || []).map(function (c) { return c.key; });
    var chips = '<div class="who-chips" role="group" aria-label="Show one commissioner">' +
      [["all", "All five"]].concat(keys.map(function (k) { return [k, commishName(k).split(" ").pop()]; })).map(function (p) {
        return '<button type="button" class="who-chip" data-who="' + p[0] + '" aria-pressed="' + (p[0] === commishWho) + '">' + esc(p[1]) + "</button>";
      }).join("") + "</div>";
    var vids = (R && R.videos) || [];
    var appear = vids.map(function (v) {
      var url = "https://www.youtube.com/watch?v=" + v.id;
      var qs = v.quotes.slice().sort(function (a, b) { return atSecs(a.at) - atSecs(b.at); }).map(function (q) {
        var s = atSecs(q.at);
        return '<li class="sq" data-who="' + esc(q.who) + '">' + (q.tenet ? '<p class="sq-t">' + esc(q.tenet) + "</p>" : "") +
          "<blockquote>“" + esc(captionText(q.q)) + '”</blockquote><span class="sq-cite">' + esc(q.whoName || commishName(q.who)) +
          ' · <a href="' + esc(url + "&t=" + s + "s") + '" target="_blank" rel="noopener noreferrer" aria-label="Play ' + esc(v.event || v.title) + " at " + fmtSecs(s) + '">▶ <span class="mono">' + fmtSecs(s) +
          "</span></a></span></li>";
      }).join("");
      var toc = v.chapters.length ? '<details class="vtoc"><summary>Contents <span class="mono">' + v.chapters.length + "</span></summary><ol>" +
        v.chapters.map(function (c) {
          var s = atSecs(c.at);
          return '<li><a class="mono" href="' + esc(url + "&t=" + s + "s") + '" target="_blank" rel="noopener noreferrer">' + fmtSecs(s) + "</a> " + esc(c.title) +
            (c.who ? ' <span class="vtoc-who">' + esc(commishName(c.who).split(" ").pop()) + "</span>" : "") + "</li>";
        }).join("") + "</ol></details>" : "";
      var dur = v.duration_s ? ' · <span class="mono">' + fmtSecs(v.duration_s) + "</span>" : "";
      return '<article class="appear" data-speakers="' + esc((v.speakers || []).join(" ")) + '"><h3><span class="mono appear-d">' + esc(fmtISO(v.date)) + "</span> " +
        '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(v.event || v.title) + ' <span class="ext" aria-hidden="true">↗</span></a></h3>' +
        '<p class="appear-meta">' + esc(v.channel) + dur + (v.captionSource === "publisher" ? " · publisher captions" : " · automatic captions") + "</p>" +
        (v.transcriptSlug ? '<a href="reading/' + esc(v.transcriptSlug) + '/">Read the official transcript</a>' : '<a href="https://github.com/pranava0x0/ferc-large-load-proceedings/blob/main/sources/videos/text/' + encodeURIComponent(v.id) + '.txt">Read the timestamped captions</a>') +
        (qs ? '<ul class="sqs">' + qs + "</ul>" : "") +
        (v.quotes.length > SQ_CAP ? '<button type="button" class="sq-more" aria-expanded="false">All ' + v.quotes.length + " quotes</button>" : "") +
        toc + "</article>";
    }).join("");
    var spoken = vids.length ? '<section class="appears" id="appears">' + appear + '<p class="appears-none" hidden>Nothing from this commissioner in the videos read so far.</p></section>'
      : '<p class="cm-loading">The video record did not load (js/record-data.js).</p>';
    return head("Commissioners", "Video quotes use the captions, which can contain errors.") +
      chips + '<p><a href="reading/senate-ferc-oversight-20260722/">July 22 Senate hearing: all five commissioners’ testimony and written answers</a></p>' + '<p class="sq-jump"><button type="button" class="jump-btn-plain" data-jump="#commish-h">Jump to the June 18 written statements ↓</button></p>' +
      spoken + renderJuneStatements();
  }
  function wireCommissioners() {
    var panel = panelFor("commissioners");
    var apply = applyWho = function (who) {
      commishWho = who;
      panel.querySelectorAll(".who-chip").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-who") === who)); });
      var shown = 0;
      panel.querySelectorAll(".appear").forEach(function (a) {
        var any = 0;
        a.querySelectorAll(".sq").forEach(function (li) {
          var on = who === "all" || li.getAttribute("data-who") === who;
          li.hidden = !on; if (on) any++;
        });
        var on = who === "all" || any > 0;
        a.hidden = !on; if (on) shown++;
      });
      panel.classList.toggle("who-one", who !== "all");
      var none = panel.querySelector(".appears-none");
      if (none) none.hidden = shown > 0;
      panel.querySelectorAll(".commish-rowcard").forEach(function (c) {
        c.hidden = who !== "all" && c.getAttribute("data-key") !== who;
      });
      var body = "#commissioners" + (who === "all" ? "" : "/" + who);
      if (history.replaceState) history.replaceState(null, "", body);
      setCrumbs("commissioners", who);
    };
    panel.addEventListener("click", function (ev) {
      var b = ev.target.closest && ev.target.closest(".who-chip");
      if (b) apply(b.getAttribute("data-who"));
      var m = ev.target.closest && ev.target.closest(".sq-more");
      if (m) {
        var open = m.getAttribute("aria-expanded") !== "true";
        m.setAttribute("aria-expanded", String(open));
        m.closest(".appear").classList.toggle("sq-all", open);
        m.textContent = open ? "Fewer quotes" : "All " + m.closest(".appear").querySelectorAll(".sq").length + " quotes";
      }
    });
    apply(pendingWho || commishWho);
    pendingWho = null;
  }
  var pendingWho = null, applyWho = null;

  /* ---- tablist ---- */
  // Reforms has no tab of its own: the five reform categories open the Orders (dockets) tab. "#reforms" still routes there.
  var TABS = ["overview", "comments", "dockets", "filings", "timeline", "news", "commissioners"];
  var renderers = { overview: renderOverview, timeline: renderTimeline, dockets: function () { return renderReforms() + renderDockets(); }, filings: renderFilings, commissioners: renderCommissioners, comments: renderComments, news: renderNews };
  var afterRender = { overview: loadCrosswalk, news: wireNews, comments: wireComments, timeline: wireTimeline, filings: wireFilings, commissioners: wireCommissioners };
  // Overview jump row: delegated once, so it works whichever render pass drew the buttons. Buttons, not
  // hash links, because the router owns location.hash and would read "#fm-h" as a tab name.
  document.addEventListener("click", function (ev) {
    var b = ev.target && ev.target.closest ? ev.target.closest(".jump-btn, .jump-btn-plain") : null;
    if (!b) return;
    var t = document.querySelector(b.getAttribute("data-jump"));
    if (!t) return;
    if (t.tagName === "DETAILS") t.open = true;
    show(t, { block: "start" });
    if (!t.hasAttribute("tabindex")) t.setAttribute("tabindex", "-1");
    t.focus({ preventScroll: true });
  });
  var rendered = {};

  function panelFor(name) { return document.getElementById("panel-" + name); }
  function tabFor(name) { return document.getElementById("tab-" + name); }

  // Comments-tab URL state (grammar in comments-route.js). The Comments panel owns its own hash so
  // sub-tab and row-permalink state survive a shared link; other tabs stay bare "#<tab>".
  function writeCommentsHash(state) {
    var body = "#" + window.CommentsRoute.serialize(state);
    if (history.replaceState) history.replaceState(null, "", body);
    else location.hash = body.slice(1);
  }
  function currentSub() {
    var subs = window.CommentsRoute.SUBS;
    for (var i = 0; i < subs.length; i++) {
      var b = document.getElementById("cmsub-" + subs[i]);
      if (b && b.getAttribute("aria-selected") === "true") return subs[i];
    }
    return window.CommentsRoute.DEFAULT_SUB;
  }
  // Timeline URL state: "#timeline/track/gov". Same shape as the Comments hash, minus the query grammar,
  // because a filtered rail is worth sharing but has exactly one parameter. "all" writes the bare "#timeline".
  function writeTimelineHash(track) {
    var body = "#timeline" + (track && track !== "all" ? "/track/" + track : "");
    if (history.replaceState) history.replaceState(null, "", body);
    else location.hash = body.slice(1);
    setCrumbs("timeline", body.slice(10));
  }
  function parseTimelineRest(rest) {
    var m = String(rest || "").match(/^track\/([A-Za-z0-9_-]+)$/);
    return validTrack(m ? m[1] : "all");   // an unknown track id degrades to the unfiltered rail
  }
  // Order cards are addressed by docket without the sub-docket: "#dockets/EL26-67".
  // "EL26-67-000" -> "EL26-67". Only a sub-docket suffix is dropped: "EL26-108" keeps its number.
  function docketKey(docket) { return String(docket || "").replace(/^([A-Za-z]+\d+-\d+)-\d{3}$/, "$1"); }
  // Open one <details> and bring it under the tablist. Returns false when the id names nothing.
  function openAt(id) {
    var el = id && document.getElementById(id);
    if (!el) return false;
    if (el.tagName === "DETAILS") el.open = true;
    show(el, { block: "start" });
    focusSummary(el);
    return true;
  }
  // A link that opens a card can sit in a panel the router has just hidden. Put focus on the opened card's
  // summary so a keyboard or screen-reader user lands on what opened.
  function focusSummary(el) {
    var s = el && el.tagName === "DETAILS" && el.querySelector("summary");
    if (s && s.focus) s.focus({ preventScroll: true });
  }

  // "#comments/summaries?q=x" -> { tab: "comments", rest: "summaries?q=x" }; "#news" -> { tab:"news", rest:"" }
  function parseHash() {
    var h = (location.hash || "").replace(/^#/, "");
    var slash = h.indexOf("/");
    return slash < 0 ? { tab: h, rest: "" } : { tab: h.slice(0, slash), rest: h.slice(slash + 1) };
  }
  // Switch tabs from the hash/router, routing the Comments sub-state through the comments module.
  function goTab(tab, rest, focus) {
    if (tab === "reforms") { activate("dockets", focus); pickSubtab("dockets", "reforms"); var rh = document.querySelector("#stp-dockets-reforms > *"); if (rh) show(rh, { block: "start" }); setCrumbs("dockets", ""); return; }
    if (TABS.indexOf(tab) < 0) tab = "overview";
    if (tab === "comments") {
      var state = window.CommentsRoute.parse(rest);
      var firstRender = !rendered.comments;
      pendingCommentsRoute = state;        // consumed by wireComments on first render
      activate("comments", focus);
      if (!firstRender && applyCommentsRoute) applyCommentsRoute(state); // already wired: apply now
      if (!state.acc) scrollToTabsTop();   // a permalink scrolls to its row instead
    } else if (tab === "timeline") {
      // `timelineTrack` is the single source of truth; `pendingTimelineTrack` is ONLY the handoff for a
      // deep link that arrives before the panel exists. Apply before activate() either way, so the hash
      // activate() writes reflects the track we just routed to.
      // "#timeline/at/<iso>" opens one event on the unfiltered rail; the address then settles to "#timeline".
      var at = /^at\/([A-Za-z0-9-]+)$/.exec(rest || "");
      var track = parseTimelineRest(rest);
      if (!rendered.timeline) pendingTimelineTrack = track;   // wireTimeline consumes and clears it
      else if (applyTimelineTrack) applyTimelineTrack(track); // already wired: set live state now
      activate("timeline", focus);
      if (!(at && openAt("tl-" + at[1]))) scrollToTabsTop();
    } else if (tab === "filings" && rest) {
      if (!rendered.filings) pendingFiling = rest;               // wireFilings consumes and clears it
      // Already rendered: settle the route before activate() writes the hash, or the URL keeps the old one.
      else if (document.getElementById("fg-" + String(rest).split("/")[0]) || /^theme\//.test(rest)) filingHash = rest;
      activate("filings", focus);
      if (rendered.filings) routeFiling(rest);
    } else if (tab === "commissioners") {
      var who = /^(swett|rosner|see|chang|lacerte)$/.test(rest) ? rest : "all";
      if (!rendered.commissioners) pendingWho = who;            // wireCommissioners consumes and clears it
      else if (applyWho) applyWho(who);
      else commishWho = who;
      activate("commissioners", focus);
      scrollToTabsTop();
    } else {
      // A bare "#filings" (the trail's root link) is the whole list: drop the last proceeding, theme or filter.
      if (tab === "filings") { filingHash = ""; pendingFiling = null; if (rendered.filings && (filingTheme || filingQuery)) { filingQuery = ""; applyTheme(panelFor("filings"), ""); } }
      activate(tab, focus);
      // "#dockets/EL26-67" opens that order card; "#overview/clock" opens the procedural board.
      var landed = tab === "dockets" && rest ? openAt("dk-" + docketKey(rest))
        : tab === "overview" && rest === "clock" ? openAt("acc-clock")
        : tab === "overview" && /^reform\/[a-z]+$/.test(rest) ? (xwAnswers ? openAt("xw-" + rest.slice(7)) : (xwPending = rest.slice(7), true)) : false;
      if (!landed) scrollToTabsTop();
    }
  }

  // Tabs are sticky; on a user-initiated switch, scroll back up to the tablist so the new
  // (often shorter) panel starts at the top instead of leaving the viewport stranded mid-page.
  function scrollToTabsTop() {
    var main = document.getElementById("main");
    if (main && window.pageYOffset > main.offsetTop) window.scrollTo(0, main.offsetTop);
  }

  // comments-data.js is ~40% of the page's bytes and only the Comments tab reads it, so index.html
  // holds its stamped URL without downloading it. The script is fetched and executed here on first
  // open. record-data.js (Filings and Commissioners) works the same way. The render waits for the script;
  // if the tab was left before it arrived, the next activation renders synchronously instead, so
  // wireComments never writes a Comments hash over another tab's.
  var LAZY = {
    news: { link: "news-data", ready: function () { return !!D.media; }, what: "the news record" },
    comments: { link: "cm-data", ready: function () { return !!window.FERC_COMMENTS; }, what: "the comment record" },
    filings: { link: "rec-data", ready: function () { return !!window.FERC_RECORD; }, what: "the filings record" },
    commissioners: { link: "rec-data", ready: function () { return !!window.FERC_RECORD; }, what: "the commissioners' record" },
  };
  var lazyLoading = {};
  function renderInto(name, panel) {
    panel.innerHTML = renderers[name](); rendered[name] = true;
    subtabify(name, panel);
    if (afterRender[name]) afterRender[name]();
  }

  // Subtabs: each tab's long page splits into panes, one shown at a time. A pane runs from its start
  // element (a direct child of the panel, [selector, index among matches]) to the next pane's start;
  // anything before the first pane stays visible above the bar. Comments has its own bar already.
  var SUBTABS = {
    // Overview runs from the Nov 16 highlights through each operator's status to the deadlines.
    overview: [["overview", "Overview", ".filing-brief"],
      ["reforms", "By reform", ".xw"], ["background", "Background", "details.acc"]],
    dockets: [["june", "June 18 orders", "#reforms-h"], ["reforms", "Five reforms", "details.acc"], ["dockets", "Dockets", ".section-head", 1], ["follow", "File or follow", ".section-head", 2]],
    filings: [["compare", "Compare", ".cmp-sec"], ["pjm", "PJM", ".fg-mkt[data-mkt=pjm]"], ["miso", "MISO", ".fg-mkt[data-mkt=miso]"], ["spp", "SPP", ".fg-mkt[data-mkt=spp]"], ["caiso", "CAISO", ".fg-mkt[data-mkt=caiso]"],
      ["isone", "ISO-NE", ".fg-mkt[data-mkt=isone]"], ["nyiso", "NYISO", ".fg-mkt[data-mkt=nyiso]"], ["other", "Other", ".fg-mkt[data-mkt=other]"], ["mw", "Megawatts", ".fc-sec"]],
    timeline: [["ahead", "Ahead", ".tl-sec", 0], ["sofar", "So far", "#tl-latest"], ["background", "Background", "details.acc"]],
    commissioners: [["appearances", "Appearances", "section#appears"], ["june", "June 18 statements", "#commish-h"]]
  };
  var subtabPick = {};
  function subtabify(name, panel) {
    var defs = SUBTABS[name];
    if (!defs) return;
    var root = panel.children.length === 1 && !panel.firstElementChild.matches("section, details") ? panel.firstElementChild : panel;
    var kids = [].slice.call(root.children);
    var starts = defs.map(function (d) {
      var hits = kids.filter(function (k) { return k.matches(d[2]); });
      return hits[d[3] || 0];
    });
    if (starts.some(function (x) { return !x; })) { console.error("subtabs: a pane start is missing in " + name); return; }
    if (starts.some(function (x, i) { return i && kids.indexOf(x) < kids.indexOf(starts[i - 1]); })) { console.error("subtabs: panes out of page order in " + name); return; }
    // In-page jump links duplicate the bar.
    kids.forEach(function (k) { if (k.matches(".jump-row, .sq-jump")) k.remove(); });
    var wrap = document.createElement("div"); wrap.className = "st-wrap";
    var bar = document.createElement("div"); bar.className = "cm-subtabs st-bar"; bar.setAttribute("role", "tablist"); bar.setAttribute("aria-label", "Sections");
    starts[0].parentNode.insertBefore(bar, starts[0]);
    bar.parentNode.insertBefore(wrap, bar.nextSibling);
    var pick = subtabPick[name] || defs[0][0];
    defs.forEach(function (d, i) {
      var pane = document.createElement("div"); pane.className = "st-pane"; pane.id = "stp-" + name + "-" + d[0]; pane.setAttribute("role", "tabpanel"); pane.tabIndex = 0; pane.setAttribute("aria-labelledby", "st-" + name + "-" + d[0]);
      // Collect from this pane's start up to the next pane's start (or the end of the panel).
      for (var el = starts[i], stop = starts[i + 1] || null; el && el !== stop; ) { var nx = el.nextElementSibling; pane.appendChild(el); el = nx; }
      pane.hidden = d[0] !== pick;
      wrap.appendChild(pane);
      var b = document.createElement("button"); b.type = "button"; b.className = "cm-subtab st-tab"; b.id = "st-" + name + "-" + d[0]; b.setAttribute("role", "tab"); b.setAttribute("aria-controls", pane.id);
      b.setAttribute("aria-selected", d[0] === pick ? "true" : "false"); b.tabIndex = d[0] === pick ? 0 : -1; b.textContent = d[1];
      b.addEventListener("click", function () { pickSubtab(name, d[0]); });
      b.addEventListener("keydown", function (e) {
        var j = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? defs.length - 1 : null;
        if (j === null) return;
        e.preventDefault(); j = (j + defs.length) % defs.length; pickSubtab(name, defs[j][0]); document.getElementById("st-" + name + "-" + defs[j][0]).focus();
      });
      bar.appendChild(b);
    });
  }
  function pickSubtab(name, key) {
    subtabPick[name] = key;
    var panel = panelFor(name);
    // Leaving the pane that holds the addressed proceeding drops it from the URL and the trail.
    if (name === "filings" && filingHash && !/^theme\//.test(filingHash)) {
      var held = document.getElementById("fg-" + filingHash.split("/")[0]);
      if (!held || !held.closest("#stp-filings-" + key)) {
        filingHash = "";
        if (history.replaceState) history.replaceState(null, "", "#filings");
        setCrumbs("filings", "");
      }
    }
    panel.querySelectorAll(".st-tab").forEach(function (b) { var on = b.id === "st-" + name + "-" + key; b.setAttribute("aria-selected", on ? "true" : "false"); b.tabIndex = on ? 0 : -1; });
    panel.querySelectorAll(".st-pane").forEach(function (p) { p.hidden = p.id !== "stp-" + name + "-" + key; });
  }
  // Anything that scrolls to or opens an element first shows the pane holding it.
  function show(el, opts) {
    var pane = el && el.closest && el.closest(".st-pane");
    if (pane && pane.hidden) { var m = pane.id.match(/^stp-([a-z]+)-(.+)$/); if (m) pickSubtab(m[1], m[2]); }
    if (el) el.scrollIntoView(opts);
  }
  function loadLazy(name, panel) {
    var spec = LAZY[name];
    panel.innerHTML = '<p class="cm-loading" role="status">Loading ' + spec.what + "…</p>";
    var link = document.getElementById(spec.link);
    if (!link) { renderInto(name, panel); return; }
    if (lazyLoading[spec.link]) { lazyLoading[spec.link].push(name); return; }
    lazyLoading[spec.link] = [name];
    var s = document.createElement("script");
    s.src = link.getAttribute("data-src");
    s.onload = function () {
      var waiting = lazyLoading[spec.link]; lazyLoading[spec.link] = null;
      waiting.forEach(function (n) {
        var p = panelFor(n);
        if (!rendered[n] && !p.hidden) renderInto(n, p);
      });
    };
    // A dropped fetch must not leave the tab dead for the rest of the session: offer a retry and leave
    // `rendered[name]` false so the next activation tries again too.
    s.onerror = function () {
      var waiting = lazyLoading[spec.link] || [name]; lazyLoading[spec.link] = null;
      s.remove();
      // Every tab that queued on this script hears about the failure, not just the one that started it.
      waiting.forEach(function (n) {
        var p = panelFor(n), what = LAZY[n].what;
        p.innerHTML = '<p class="cm-loading" role="status">' + what.charAt(0).toUpperCase() + what.slice(1) +
          ' did not load. <button type="button" class="cm-retry">Try again</button></p>';
        p.querySelector(".cm-retry").addEventListener("click", function () { loadLazy(n, p); });
      });
    };
    document.head.appendChild(s);
  }

  // "You are here": tab › proceeding › document (Filings) or tab › track (Timeline). Each step links back
  // up one level, so a reader deep in a filing is one tap from the proceeding and two from the list.
  var TAB_LABEL = { overview: "Now", dockets: "Show Cause Orders", filings: "Filings", news: "Discourse", timeline: "Timeline", commissioners: "Commissioners", comments: "ANOPR" };
  function setCrumbs(name, rest) {
    var el = document.getElementById("crumbs");
    if (!el) return;
    var parts = [['#' + name, TAB_LABEL[name] || name]];
    var R = window.FERC_RECORD;
    if (name === "filings" && rest && R && R.groups) {
      var bits = String(rest).split("/"), g = R.groups.filter(function (x) { return x.id === bits[0]; })[0];
      if (g) {
        parts.push(["#filings/" + g.id, g.short || g.title]);
        var doc = bits[1] && g.docs.filter(function (d) { return d.slug === bits[1]; })[0];
        if (doc) parts.push(["#filings/" + g.id + "/" + doc.slug, doc.filer + ", " + fmtISO(doc.date).replace(/, \d{4}$/, "")]);
      }
    } else if (name === "timeline" && rest) {
      var tk = parseTimelineRest(rest);
      if (tk !== "all") parts.push(["#timeline/track/" + tk, D.tracks[tk].label]);
    } else if (name === "commissioners" && rest && rest !== "all") parts.push(["#commissioners/" + rest, commishName(rest)]);
    // The tab bar already says which tab is open, so a trail is shown only below tab level.
    el.hidden = parts.length < 2;
    el.innerHTML = el.hidden ? "" : "<ol>" + parts.map(function (p, i) {
      return "<li>" + (i === parts.length - 1 ? '<span aria-current="page">' + esc(p[1]) + "</span>" : '<a href="' + esc(p[0]) + '">' + esc(p[1]) + "</a>") + "</li>";
    }).join("") + "</ol>";
  }

  function activate(name, focus) {
    TABS.forEach(function (t) {
      var sel = t === name;
      var tab = tabFor(t), panel = panelFor(t);
      tab.setAttribute("aria-selected", sel ? "true" : "false");
      tab.tabIndex = sel ? 0 : -1;
      panel.hidden = !sel;
      // Leaving Comments before its data arrived: drop the deep link it was opened with, so a later plain
      // click on the tab does not replay a stale route.
      if (!sel && t === "comments" && !rendered.comments) pendingCommentsRoute = null;
      if (sel) {
        if (!rendered[t] && LAZY[t] && !LAZY[t].ready()) loadLazy(t, panel);
        else if (!rendered[t]) renderInto(t, panel);
        if (focus) tab.focus();
      }
    });
    // Comments and Timeline manage their own richer hashes (sub-tab + permalinks; track filter).
    // Writing a bare "#timeline" here would clobber a #timeline/track/<id> deep link on arrival.
    // By here wireTimeline (first render) or goTab (already rendered) has already settled timelineTrack,
    // so it is the only thing to read. Preferring the pending handoff instead let a consumed-but-uncleared
    // value outvote the live filter, and the URL then disagreed with the rail.
    if (name === "timeline") writeTimelineHash(timelineTrack);
    else if (name === "filings") {
      var fb = "#filings" + ((pendingFiling || filingHash) ? "/" + (pendingFiling || filingHash) : "");
      if (history.replaceState) history.replaceState(null, "", fb); else location.hash = fb.slice(1);
    }
    else if (name === "commissioners") {
      var body = "#commissioners" + ((pendingWho || commishWho) === "all" ? "" : "/" + (pendingWho || commishWho));
      if (history.replaceState) history.replaceState(null, "", body); else location.hash = body.slice(1);
    }
    else if (name !== "comments") {
      if (history.replaceState) history.replaceState(null, "", "#" + name);
      else location.hash = name;
    }
    setCrumbs(name, parseHash().rest);
  }

  function onKey(e) {
    var i = TABS.indexOf(e.target.getAttribute("data-tab"));
    if (i < 0) return;
    var next = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % TABS.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    if (next !== null) {
      e.preventDefault();
      var nm = TABS[next];
      activate(nm, true);
      scrollToTabsTop();
      if (nm === "comments") writeCommentsHash({ sub: currentSub() });
    }
  }

  // Masthead chip: the soonest dated deadline on the timeline, the same list the Overview's "Coming up"
  // card draws, so the two never disagree. The §206 board alone used to feed it, and once Nov 16 passed it
  // skipped SPP's Nov 20 date and the Dec 7 comment deadlines to announce Dec 16.
  function setMastheadDeadline() {
    var el = document.getElementById("masthead-fresh");
    if (!el) return;
    var today = todayISO();
    var n = (D.timeline || []).filter(function (e) { return e.kind === "deadline" && /^\d{4}-\d{2}-\d{2}/.test(e.iso || "") && isoOf(e) >= today; })
      .sort(function (a, b) { return a.iso < b.iso ? -1 : 1; })[0];
    if (!n) return;
    var days = daysUntil(isoOf(n));
    el.innerHTML = '<a class="mh-next" href="#timeline/at/' + esc(n.iso) + '"><span class="mh-lbl">Next</span> <span class="mono">' + esc(fmtISO(isoOf(n)).replace(/, \d{4}$/, "")) + "</span> " + esc(n.title) +
      (days >= 0 ? ' <span class="mh-days">' + (days === 0 ? "today" : days === 1 ? "tomorrow" : "in " + days + " days") + "</span>" : "") + "</a>";
    el.hidden = false;
  }

  function init() {
    renderProvenance();
    setMastheadDeadline();
    TABS.forEach(function (t) {
      var tab = tabFor(t);
      tab.addEventListener("click", function () {
        activate(t, false);
        scrollToTabsTop();
        if (t === "comments") writeCommentsHash({ sub: currentSub() });
      });
      tab.addEventListener("keydown", onKey);
    });
    // in-page links and shared permalinks switch tabs (and Comments sub-state) via the hash
    window.addEventListener("hashchange", function () {
      var p = parseHash();
      if (TABS.indexOf(p.tab) >= 0 || p.tab === "reforms") goTab(p.tab, p.rest, false);
    });
    var p = parseHash();
    goTab(TABS.indexOf(p.tab) >= 0 || p.tab === "reforms" ? p.tab : "overview", p.rest, false);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
