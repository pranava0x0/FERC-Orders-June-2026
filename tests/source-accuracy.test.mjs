import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { buildLlmsTxt } from "../tools/build-llms.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function rootPath(...parts) {
  return join(ROOT, ...parts);
}

function textFile(...parts) {
  return readFileSync(rootPath(...parts), "utf8");
}

function jsonFile(...parts) {
  return JSON.parse(textFile(...parts));
}

function pathParts(path) {
  return Array.isArray(path) ? path : String(path).split("/");
}

function loadWebsiteData() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(textFile("docs", "js", "data.js"), context, {
    filename: "docs/js/data.js",
  });
  return context.window.FERC_DATA;
}

const D = loadWebsiteData();
const MANIFEST = jsonFile("sources", "manifest.json");
const ORDER_EXTRACT = jsonFile("sources", "orders-extract.json");
const MANIFEST_BY_ID = new Map(MANIFEST.sources.map((source) => [source.id, source]));
const EXTRACT_BY_ITEM = new Map(ORDER_EXTRACT.orders.map((order) => [order.item, order]));

// The six order PDFs are committed under docs/orders/ so GitHub Pages serves them and the
// page-citation links open inline (same-origin); each docket's `pdf` field is that served path.
const ORDER_PDF_BY_ITEM = {
  "E-7": ["docs", "orders", "e-7-pjm-el26-67-000.pdf"],
  "E-8": ["docs", "orders", "e-8-miso-el26-70-000.pdf"],
  "E-9": ["docs", "orders", "e-9-spp-el26-68-000.pdf"],
  "E-10": ["docs", "orders", "e-10-caiso-el26-71-000.pdf"],
  "E-11": ["docs", "orders", "e-11-isone-el26-72-000.pdf"],
  "E-12": ["docs", "orders", "e-12-nyiso-el26-69-000.pdf"],
};

const ORDER_TXT_BY_ITEM = {
  "E-7": ["sources", "text", "orders", "e-7-pjm-el26-67-000.txt"],
  "E-8": ["sources", "text", "orders", "e-8-miso-el26-70-000.txt"],
  "E-9": ["sources", "text", "orders", "e-9-spp-el26-68-000.txt"],
  "E-10": ["sources", "text", "orders", "e-10-caiso-el26-71-000.txt"],
  "E-11": ["sources", "text", "orders", "e-11-isone-el26-72-000.txt"],
  "E-12": ["sources", "text", "orders", "e-12-nyiso-el26-69-000.txt"],
};

// Split an extracted order into a Map of physical page number -> page text, using the
// `--- PAGE N ---` markers the PyMuPDF extraction writes. The physical page number is what
// a `#page=N` PDF link jumps to.
function loadOrderPages(item) {
  const raw = textFile(...ORDER_TXT_BY_ITEM[item]);
  const pages = new Map();
  const parts = raw.split(/--- PAGE (\d+) ---/);
  for (let i = 1; i < parts.length; i += 2) {
    pages.set(Number(parts[i]), parts[i + 1] ?? "");
  }
  return pages;
}

// The cited page "carries" the directive when the longest segment of the displayed quote
// appears there (verbatim, or with OCR-level slack measured by longest common substring).
function pageCarriesQuote(quote, pageText) {
  const longest = quoteSegments(quote).sort((a, b) => b.length - a.length)[0] ?? looseText(quote);
  const normalizedPage = looseText(pageText);
  if (normalizedPage.includes(longest)) return true;
  // Cap the bar at 60 contiguous chars: inline footnote markers (e.g. "technologies154 as")
  // break a long verbatim run, and 60 specific legal-text chars already prove the page carries it.
  const threshold = Math.min(longest.length, 60, Math.max(24, Math.floor(longest.length * 0.6)));
  return longestCommonSubstringLength(longest, normalizedPage) >= threshold;
}

function looseText(value) {
  return String(value)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u00a0/g, " ")
    .replace(/\u00a7/g, " section ")
    .replace(/[\u2013\u2014]/g, "-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function numberTokens(value) {
  return new Set(String(value).match(/\d+/g) ?? []);
}

function intersects(a, b) {
  for (const value of a) {
    if (b.has(value)) return true;
  }
  return false;
}

function longestCommonSubstringLength(a, b) {
  const left = looseText(a);
  const right = looseText(b);
  let previous = new Array(right.length + 1).fill(0);
  let best = 0;

  for (let i = 1; i <= left.length; i += 1) {
    const current = new Array(right.length + 1).fill(0);
    for (let j = 1; j <= right.length; j += 1) {
      if (left[i - 1] === right[j - 1]) {
        current[j] = previous[j - 1] + 1;
        if (current[j] > best) best = current[j];
      }
    }
    previous = current;
  }

  return best;
}

const STOP_WORDS = new Set([
  "about",
  "after",
  "also",
  "among",
  "between",
  "from",
  "into",
  "must",
  "that",
  "their",
  "then",
  "there",
  "these",
  "this",
  "those",
  "under",
  "when",
  "where",
  "with",
]);

function meaningfulTokens(value) {
  return [
    ...new Set(
      looseText(value)
        .split(" ")
        .filter((token) => token.length >= 4 && !STOP_WORDS.has(token)),
    ),
  ];
}

function tokenCoverageSupportsClaim(claim, sourceText) {
  const claimNumbers = numberTokens(claim);
  const sourceNumbers = numberTokens(sourceText);
  if (claimNumbers.size > 0 && !intersects(claimNumbers, sourceNumbers)) return false;

  const claimTokens = meaningfulTokens(claim);
  if (claimTokens.length < 4) return false;

  const sourceTokens = new Set(meaningfulTokens(sourceText));
  const covered = claimTokens.filter((token) => sourceTokens.has(token)).length;
  return covered >= 4 && covered / claimTokens.length >= 0.6;
}

function sourceTextSupportsClaim(claim, sourceText) {
  const normalizedClaim = looseText(claim);
  const normalizedSource = looseText(sourceText);
  if (!normalizedClaim) return false;
  if (normalizedSource.includes(normalizedClaim)) return true;
  if (tokenCoverageSupportsClaim(claim, sourceText)) return true;

  const threshold = Math.min(44, Math.max(24, Math.floor(normalizedClaim.length * 0.45)));
  return longestCommonSubstringLength(normalizedClaim, normalizedSource) >= threshold;
}

function assertAnySourceSupports(label, claim, sourceTexts) {
  if (sourceTexts.some((sourceText) => sourceTextSupportsClaim(claim, sourceText))) return;

  const unsupportedFragments = claimFragments(claim).filter(
    (fragment) => !sourceTexts.some((sourceText) => sourceTextSupportsClaim(fragment, sourceText)),
  );

  assert.ok(
    unsupportedFragments.length === 0,
    `${label} is not supported by the extracted source text: ${unsupportedFragments.join("; ")}`,
  );
}

function claimFragments(claim) {
  const markedClaim = String(claim).replace(
    /\band (?=(targets|directs|defines|excludes|invites|uses|requires|orders|identifies)\b)/gi,
    "\n$&",
  );
  const fragments = markedClaim
    .split(/;|\.\s+|\n/)
    .map((fragment) => fragment.trim())
    .filter((fragment) => looseText(fragment).length >= 24);
  return fragments.length > 0 ? fragments : [claim];
}

function quoteSegments(value) {
  return String(value)
    .split(/\u2026|\.\.\./)
    .map((segment) => looseText(segment))
    .filter((segment) => segment.length >= 18);
}

function quoteSupportsUiText(uiQuote, sourceQuote) {
  const normalizedUiQuote = looseText(uiQuote);
  const normalizedSourceQuote = looseText(sourceQuote);
  if (normalizedSourceQuote.includes(normalizedUiQuote)) return true;

  const segments = quoteSegments(uiQuote);
  return (
    segments.length > 0 &&
    segments.every((segment) => {
      if (normalizedSourceQuote.includes(segment)) return true;
      const threshold = Math.min(32, Math.max(18, Math.floor(segment.length * 0.75)));
      return longestCommonSubstringLength(segment, normalizedSourceQuote) >= threshold;
    })
  );
}

function paragraphSupportsUiReference(uiReference, sourceReference) {
  const uiNumbers = numberTokens(uiReference);
  const sourceNumbers = numberTokens(sourceReference);
  if (uiNumbers.size > 0 && sourceNumbers.size > 0 && intersects(uiNumbers, sourceNumbers)) return true;

  const uiText = looseText(uiReference);
  const sourceText = looseText(sourceReference);
  return (
    (uiText.includes("ordering") && sourceText.includes("ordering")) ||
    (uiText.includes("section") && sourceText.includes("section"))
  );
}

test("website source URLs are tied to the committed source manifest", () => {
  for (const [id, source] of Object.entries(D.SOURCES)) {
    const url = new URL(source.url);
    assert.equal(url.protocol, "https:", `${id} must use an HTTPS source URL`);
    assert.ok(source.captured, `${id} must record a capture date`);
  }

  assert.equal(D.SOURCES.doe403.url, MANIFEST_BY_ID.get("doe403").url, "DOE PDF URL must match the manifest");

  for (const id of ["fercPR", "fercFS", "fercSum", "fercRM264"]) {
    const manifestSource = MANIFEST_BY_ID.get(id);
    assert.ok(manifestSource, `${id} must be present in sources/manifest.json`);
    assert.equal(D.SOURCES[id].url, manifestSource.url, `${id} URL must match the manifest`);
    assert.match(manifestSource.archive_url, /^https?:\/\/web\.archive\.org\//, `${id} archive URL must point to web.archive.org`);
    assert.ok(existsSync(rootPath(...pathParts(manifestSource.text))), `${id} extracted text must exist`);
    assert.ok(textFile(...pathParts(manifestSource.text)).trim().length > 500, `${id} extracted text is too short`);
  }

  const orderManifest = MANIFEST_BY_ID.get("orders");
  const manifestOrderUrls = new Set(Object.values(orderManifest.urls));
  for (const docket of D.dockets) {
    const source = D.SOURCES[docket.url];
    assert.ok(source, `${docket.item} must reference a website source entry`);
    assert.ok(manifestOrderUrls.has(source.url), `${docket.item} order URL must be listed in the manifest`);
    assert.match(source.url, /^https:\/\/www\.ferc\.gov\/media\//, `${docket.item} must link to a FERC media URL`);
  }
});

test("source PDFs and extracted order text exist for every displayed order", () => {
  assert.equal(Object.keys(ORDER_PDF_BY_ITEM).length, D.dockets.length);

  const doeSource = MANIFEST_BY_ID.get("doe403");
  const doePdfPath = rootPath("sources", "pdf", "doe-403-large-loads-letter.pdf");
  assert.ok(existsSync(doePdfPath), "DOE PDF must be committed");
  assert.equal(statSync(doePdfPath).size, doeSource.bytes, "DOE PDF byte size must match the manifest");

  for (const docket of D.dockets) {
    const extract = EXTRACT_BY_ITEM.get(docket.item);
    assert.ok(extract, `${docket.item} must have extracted order text`);
    assert.equal(extract.captionVerified, true, `${docket.item} caption must be verified from the PDF`);

    const pdfParts = ORDER_PDF_BY_ITEM[docket.item];
    assert.ok(pdfParts, `${docket.item} must have a mapped local PDF`);
    const pdfPath = rootPath(...pdfParts);
    assert.ok(existsSync(pdfPath), `${docket.item} PDF must be committed`);
    assert.ok(statSync(pdfPath).size > 100_000, `${docket.item} PDF is unexpectedly small`);

    // The docket's `pdf` field is the page-served path; it must match the committed file under docs/.
    assert.equal(docket.pdf, pdfParts.slice(1).join("/"), `${docket.item} pdf path must point at the served copy`);
    assert.ok(existsSync(rootPath("docs", docket.pdf)), `${docket.item} served PDF (docs/${docket.pdf}) must exist`);
  }
});

test("displayed order metadata matches the extracted PDF text", () => {
  for (const docket of D.dockets) {
    const extract = EXTRACT_BY_ITEM.get(docket.item);
    assert.equal(extract.rto, docket.rto, `${docket.item} RTO label must match extracted text`);
    assert.equal(extract.docket, docket.docket, `${docket.item} docket number must match extracted text`);
    assert.equal(extract.fercCite, docket.cite, `${docket.item} FERC cite must match extracted text`);
    assert.equal(extract.pages, docket.pages, `${docket.item} page count must match extracted text`);
    assert.ok(
      sourceTextSupportsClaim(docket.respondents, extract.respondents),
      `${docket.item} respondents claim must be supported by extracted text`,
    );
    assert.equal(D.SOURCES[docket.url].captured, ORDER_EXTRACT.captured_at, `${docket.item} capture date must match extract`);
  }
});

test("displayed order directives are supported by extracted PDF quotations", () => {
  for (const docket of D.dockets) {
    const extract = EXTRACT_BY_ITEM.get(docket.item);
    for (const directive of docket.dir) {
      const match = extract.directives.find(
        (sourceDirective) =>
          paragraphSupportsUiReference(directive.p, sourceDirective.para) &&
          quoteSupportsUiText(directive.q, sourceDirective.quote),
      );
      assert.ok(match, `${docket.item} directive is not backed by the extracted PDF quote: ${directive.q}`);
    }
  }
});

test("displayed region-specific order claims are supported by extracted PDF text", () => {
  for (const docket of D.dockets) {
    const extract = EXTRACT_BY_ITEM.get(docket.item);
    const extractedOrderClaims = [
      ...extract.regionSpecific,
      ...extract.directives.map((directive) => `${directive.para} ${directive.topic} ${directive.quote}`),
      ...extract.deadlines.map((deadline) => `${deadline.para} ${deadline.action} ${deadline.days}`),
    ];
    const pages = loadOrderPages(docket.item);
    for (const finding of docket.reg) {
      // A finding is supported by the curated extract OR by the very page it cites in the full order text.
      const sources = finding.pg != null ? [...extractedOrderClaims, pages.get(finding.pg) ?? ""] : extractedOrderClaims;
      assertAnySourceSupports(`${docket.item} regional finding`, finding.t, sources);
    }
  }
});

test("each directive citation links to a PDF page that carries its quoted text", () => {
  for (const docket of D.dockets) {
    const pages = loadOrderPages(docket.item);
    const maxPage = Math.max(...pages.keys());
    assert.equal(maxPage, docket.pages, `${docket.item} extracted page count must match displayed length`);

    for (const directive of docket.dir) {
      assert.ok(
        Number.isInteger(directive.pg),
        `${docket.item} directive "${directive.p}" is missing an integer pg (PDF page) for its citation link`,
      );
      assert.ok(
        directive.pg >= 1 && directive.pg <= maxPage,
        `${docket.item} directive "${directive.p}" links to page ${directive.pg}, outside 1..${maxPage}`,
      );
      assert.ok(
        pageCarriesQuote(directive.q, pages.get(directive.pg) ?? ""),
        `${docket.item} "${directive.p}" links to page ${directive.pg}, which does not carry the quote: ${directive.q}`,
      );
    }
  }
});

test("docs/llms.txt is generated from data.js and in sync", () => {
  const committed = textFile("docs", "llms.txt");
  const generated = buildLlmsTxt(D);
  assert.equal(committed, generated, "docs/llms.txt is stale; regenerate with: node tools/build-llms.mjs");
});

test("Discourse commentary quotes are backed by captured evidence", () => {
  const evidence = jsonFile("sources", "voices-evidence.json");
  const byName = new Map(Object.entries(evidence.voices));
  const bySource = new Map();
  for (const ev of Object.values(evidence.voices)) {
    bySource.set(ev.src, `${bySource.get(ev.src) || ""}\n${ev.evidence}`);
  }

  for (const voice of D.voices) {
    const ev = byName.get(voice.name);
    assert.ok(ev, `voice "${voice.name}" must have an entry in sources/voices-evidence.json`);
    assert.ok(D.SOURCES[ev.src], `evidence for "${voice.name}" cites unknown source "${ev.src}"`);
    assert.ok(
      voice.src.includes(ev.src),
      `voice "${voice.name}" must cite its evidence source "${ev.src}" (cites ${voice.src.join(", ")})`,
    );

    // Every directly-quoted phrase in the take must appear in the captured evidence. The opening
    // curly quote (U+2018) marks a quote start; the closing (U+2019) is the one not followed by a
    // letter, so inner apostrophes (also U+2019) don't end the match early.
    const evidenceText = looseText(ev.evidence);
    const quotes = [...voice.take.matchAll(/‘(.+?)’(?![A-Za-z])/g)]
      .map((match) => match[1])
      .filter((quote) => looseText(quote).length >= 6);
    for (const quote of quotes) {
      assert.ok(
        evidenceText.includes(looseText(quote)),
        `voice "${voice.name}" quotes text not found in its captured evidence: ${quote}`,
      );
    }
  }

  for (const theme of D.voiceThemes || []) {
    for (const quote of theme.quotes || []) {
      assert.ok(D.SOURCES[quote.src], `theme "${theme.title}" cites unknown source "${quote.src}"`);
      const ev = bySource.get(quote.src);
      assert.ok(ev, `theme "${theme.title}" quote source "${quote.src}" must be captured in voices-evidence.json`);
      assert.ok(
        looseText(ev).includes(looseText(quote.q)),
        `theme "${theme.title}" quote not found in evidence for "${quote.src}": ${quote.q}`,
      );
    }
  }
});

test("website FERC and DOE summary claims are supported by extracted source text", () => {
  const fercTexts = [
    textFile("sources", "text", "press-release.txt"),
    textFile("sources", "text", "fact-sheet.txt"),
    textFile("sources", "text", "summaries.txt"),
    textFile("sources", "text", "rm26-4.txt"),
  ];
  const doeTexts = [
    textFile("sources", "text", "doe-403-key-extract.txt"),
    textFile("sources", "text", "doe-403-full.txt"),
  ];
  const combinedFercText = fercTexts.join("\n");
  const combinedDoeText = doeTexts.join("\n");

  assertAnySourceSupports("RTO/ISO count", "six regional grid operators", fercTexts);
  assertAnySourceSupports("reform category count", "five categories of reform", fercTexts);
  assertAnySourceSupports("show-cause deadline", "within 30 days", fercTexts);
  assertAnySourceSupports("technical conference deadline", "within 60 days", fercTexts);
  assertAnySourceSupports("large-load threshold", "greater than 20 megawatts", fercTexts);
  assertAnySourceSupports("record-review volume", "3,500 pages", fercTexts);
  assertAnySourceSupports("DOE large-load threshold", "large loads greater than 20 MW", doeTexts);

  for (const category of D.categories) {
    assert.ok(
      sourceTextSupportsClaim(category.ferc, combinedFercText),
      `FERC category claim is not supported by extracted FERC text: ${category.ferc}`,
    );
    assert.ok(
      sourceTextSupportsClaim(category.doe, combinedDoeText),
      `DOE principle claim is not supported by extracted DOE text: ${category.doe}`,
    );
  }
});
