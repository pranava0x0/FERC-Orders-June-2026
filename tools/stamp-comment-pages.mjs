#!/usr/bin/env node
/* Stamp a `page` number onto every quote in summaries-v2/*.json by locating the verbatim span in the
 * page-marked extracted body. Pages come from the `--- PAGE N ---` markers the extraction writes.
 *
 * - Idempotent: recomputes `page` on every run from the body, never from a prior value.
 * - `page` is the page where the quote STARTS (a quote that spans a page break carries its start page).
 * - No marker in the body, or the quote can't be located → `page: null` (never fabricate a page).
 *
 *   node tools/stamp-comment-pages.mjs            # stamp all, write in place
 *   node tools/stamp-comment-pages.mjs --dry      # report only, write nothing
 *   node tools/stamp-comment-pages.mjs <accession># single file (with or without --dry)
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..");
const DIR = join(ROOT, "sources", "comments", "summaries-v2");
const DRY = process.argv.includes("--dry");
const ONLY = process.argv.find((a) => /^\d{8}-\d+$/.test(a));

// Normalize to a comparison form (lowercase alphanumerics + single spaces), matching the spirit of
// validate-summaries.mjs but page-marker-aware: the caller splits on markers, this normalizes a chunk.
const norm = (x) =>
  String(x)
    .replace(/[​‌‍﻿⁠]/g, "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// Build the body's per-page normalized text (in page order). A quote's page is the page whose text
// carries the quote's opening — so the displayed page always actually contains the quote's start,
// never a same-phrase coincidence elsewhere in the filing.
export function buildPageIndex(raw) {
  const parts = raw.split(/---\s*PAGE\s*(\d+)\s*---/);
  const hasMarkers = parts.length > 1;
  const pages = [];
  for (let i = 1; i < parts.length; i += 2) {
    pages.push({ page: Number(parts[i]), norm: norm(parts[i + 1] ?? "") });
  }
  const maxPage = pages.reduce((m, p) => Math.max(m, p.page), 0);
  return { pages, hasMarkers, maxPage };
}

// Start-anchored + self-verifying: only return a page that demonstrably carries the quote's opening.
// Tries the full quote, an 80-char prefix, then the first ~8 words (boundary-spanning quotes whose
// tail rolls onto the next page still anchor on their start page). Anything weaker → null (no guess).
export function pageForQuote(quoteText, idx) {
  if (!idx.hasMarkers) return null;
  const q = norm(quoteText);
  if (!q) return null;
  // Fixed-CHAR prefixes (not word counts): robust to fitz runs-together-spacing, and start-anchored so
  // a boundary-spanning quote pages to where it begins. Require a >=50-char prefix on the page; below
  // that the location isn't trustworthy, so return null rather than guess a coincidental page.
  const probes = [q, q.slice(0, 120), q.slice(0, 80), q.slice(0, 50)].filter((p) => p.length >= 50 || p === q);
  // Exhaust the strongest probe across every page before weakening it. A filing can repeat a quote's
  // opening in an executive summary, then carry the full passage later; page-first matching would cite
  // the summary even though it does not contain the displayed quote.
  for (const probe of probes) {
    for (const page of idx.pages) if (probe.length >= 12 && page.norm.includes(probe)) return page.page;
  }
  return null;
}

function bodyPath(s) {
  const p = join(ROOT, s.source_text || "");
  return existsSync(p) ? p : null;
}

// CLI only — guarded so the test can import buildPageIndex/pageForQuote without writing files.
if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const files = (ONLY ? [ONLY + ".json"] : readdirSync(DIR).filter((f) => f.endsWith(".json"))).sort();
  let stamped = 0, quotesTotal = 0, quotesNull = 0, noBody = 0, noMarkers = 0;

  for (const file of files) {
    const path = join(DIR, file);
    const s = JSON.parse(readFileSync(path, "utf8"));
    const bp = bodyPath(s);
    if (!bp) { noBody++; continue; }
    const idx = buildPageIndex(readFileSync(bp, "utf8"));
    if (!idx.hasMarkers) noMarkers++;
    let changed = false;
    for (const q of s.quotes || []) {
      const page = pageForQuote(q.text, idx);
      quotesTotal++;
      if (page == null) quotesNull++;
      if (q.page !== page) { q.page = page; changed = true; }
    }
    if (changed) {
      stamped++;
      if (!DRY) writeFileSync(path, JSON.stringify(s, null, 2) + "\n");
    }
  }

  console.log(
    `${DRY ? "[dry] " : ""}${files.length} files · ${stamped} ${DRY ? "would change" : "updated"} · ` +
    `${quotesTotal} quotes (${quotesNull} unlocated/null) · ${noBody} no-body · ${noMarkers} no-page-markers`,
  );
}
