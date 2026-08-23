/* eLibrary docket-sheet sweep — a browser snippet, not a Node script.
 *
 * eLibrary is Cloudflare-gated to automated fetch, so a docket sheet can only be read inside an
 * authenticated browser session (see REFRESH.md). This file holds the extractor that works there, so a
 * refresh does not have to re-derive it. Paste the whole thing into the page via the Chrome bridge's
 * execute_javascript after navigating to:
 *
 *     https://elibrary.ferc.gov/eLibrary/docketsheet?docket_number=<DOCKET>
 *
 * then read the result back in a SECOND call with:  JSON.stringify(window.__sweep, null, 1)
 *
 * Two things this encodes that cost a sweep to learn:
 *
 * 1. ACCUMULATE ACROSS PAGES. eLibrary sorts ascending by filed date, so the newest rows are on the
 *    last page and the tempting shortcut is to click to the end and read only that page. That drops
 *    rows whenever recent activity exceeds the final page's size: AD26-7 with 135 rows has a 35-row
 *    last page, and on 2026-08-23 there were 67 filings since the cutoff, so 32 of them sat on page 1.
 *    Same bug hid two filings on EL26-69. Rows are collected on every page into a Map keyed by
 *    accession (which also de-dupes if a click re-renders the same page).
 *
 * 2. THE BRIDGE DOES NOT AWAIT PROMISES. execute_javascript returns "JavaScript executed" and discards
 *    the value of an async IIFE, so the result is stashed on window.__sweep instead of returned.
 *
 * Date filtering is client-side on purpose: the docket-sheet URL ignores date_from / date_to params.
 */
(() => {
  const CUTOFF = "2026-08-09"; // ISO date; rows filed on or after this are kept. Set per sweep.

  window.__sweep = { status: "running" };

  (async (cutoff) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    // The results grid is the biggest <table> on the page; eLibrary gives it no stable id.
    const rowsOnPage = () => {
      let best = null, most = 0;
      for (const t of document.querySelectorAll("table")) {
        const n = t.querySelectorAll("tr").length;
        if (n > most) { most = n; best = t; }
      }
      if (!best) return [];
      return Array.from(best.querySelectorAll("tr"))
        .map((tr) => Array.from(tr.querySelectorAll("td,th")).map((td) => td.innerText.replace(/\s+/g, " ").trim()))
        .filter((r) => r.length >= 5); // header + data rows; drops layout rows
    };
    const toISO = (d) => { const m = d.match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[1]}-${m[2]}` : null; };

    const header = document.body.innerText || "";
    const counts = header.match(/(\d+)\s*[–-]\s*(\d+)\s*of\s*(\d+)/); // "1 – 100 of 168"
    const total = counts ? +counts[3] : 0;
    const pages = Math.max(1, Math.ceil(total / 100));

    const seen = new Map(); // accession -> row, so a re-render cannot double-count
    const grab = () => {
      for (const r of rowsOnPage().slice(1)) {
        const filed = toISO(r[2]);
        if (filed && r[4]) seen.set(r[4], { filed, acc: r[4], org: r[1], desc: r[5] });
      }
    };

    grab();
    for (let i = 1; i < pages; i++) {
      const next = document.querySelector('button[aria-label="Next page"]');
      if (!next) break;
      next.click();
      await sleep(2200); // the grid re-renders async; shorter waits re-read the previous page
      grab();
    }

    const all = [...seen.values()];
    const hits = all
      .filter((r) => r.filed >= cutoff)
      .sort((a, b) => a.filed.localeCompare(b.filed) || a.acc.localeCompare(b.acc));

    window.__sweep = {
      status: "done",
      docket: (header.match(/Docket:\s*(\S+)/) || [])[1] || null,
      total,                      // Records Found, per eLibrary's own header
      pages,
      rowsSeen: all.length,       // must equal `total`; if it does not, a page failed to load
      count: hits.length,
      rows: hits,
    };
  })(CUTOFF);

  return "started";
})();

/* Reading a filing once the sweep names it:
 *
 *   navigate to  https://elibrary.ferc.gov/eLibrary/filelist?accession_Number=<ACCESSION>
 *   then:        document.querySelectorAll('a.filedownloadlink').forEach(a => a.click())
 *
 * Those anchors are Angular handlers with href="#", so there is no URL to fetch; clicking them saves to
 * ~/Downloads as "<accession>_<filename>". Notational orders arrive as DOCX (read with
 * `textutil -convert txt -stdout`), filings as PDF (read with fitz). Always read the document rather
 * than trusting the docket-sheet description: on 2026-08-23 accession 20260813-3026's description named
 * the wrong docket (EL26-72) and the wrong parent order for what is in fact the EL26-70 erratum.
 */

/* ---------------------------------------------------------------------------------------------
 * THE GENERAL SEARCH — the other half, and the half that finds what a docket sweep structurally
 * cannot.
 *
 * A docket sheet only lists filings docketed under THAT docket. A compliance filing gets its own new
 * ER docket, so PJM's Aug 17, 2026 partial co-location compliance filing and the PJM Transmission
 * Owners' Interim NITS rate filing appear NOWHERE on the EL25-49 sheets. They were found by searching
 * eLibrary by applicant and date instead, and they were the whole "Aug 17 did not pass empty" finding.
 * Running this alongside the per-docket sweep is also what caught the last-page-only pagination bug,
 * by surfacing an AD26-7 filing the docket sweep of AD26-7 had not returned.
 *
 * Navigate to https://elibrary.ferc.gov/eLibrary/search FIRST (a fresh search form, not a results
 * page — the results page has a filter panel with DIFFERENT field names, e.g. `ftextsearch` instead of
 * `textsearch`, and filling that silently filters instead of searching).
 *
 * Then paste this, adjusting the three values at the top.
 */
(() => {
  const FROM = "08/15/2026";               // mm/dd/yyyy
  const TO = "08/23/2026";
  const ORG = "PJM Interconnection";       // Organization / applicant. Leave "" to search all.
  const KEYWORD = "";                      // optional; searches the Description field

  // Angular Material inputs ignore a plain `.value =`. Set through the native setter, then dispatch
  // input + change + blur, or the form submits with the field still empty.
  const setNg = (el, val) => {
    if (!el) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(el, val);
    for (const ev of ["input", "change", "blur"]) el.dispatchEvent(new Event(ev, { bubbles: true }));
    return true;
  };
  const byName = (n) => document.querySelector(`[name="${n}"]`);

  const ok = [
    setNg(byName("dFROM"), FROM),
    setNg(byName("dTO"), TO),
    ORG ? setNg(byName("Affiliation"), ORG) : true,
    KEYWORD ? setNg(byName("textsearch"), KEYWORD) : true,
  ];
  if (ok.includes(false)) return "a field was missing — are you on /eLibrary/search, not a results page?";

  const desc = document.querySelector("#mat-checkbox-1-input");   // "Description"
  if (desc && !desc.checked) desc.click();

  document.querySelector("#submit").click();
  return "submitted — read the results with the row extractor above (the results grid is the same shape)";
})();
