// Generates one static, crawlable page per docket under docs/dockets/<slug>/index.html.
//
//   node tools/build-docket-pages.mjs          # regenerate all seven
//   node tools/build-docket-pages.mjs --check  # exit non-zero if any is stale
//
// WHY: the app is a single URL. Its six tabs are hash routes, and a fragment is not a separate URL to
// a search engine, so every docket competed for one result and nothing could rank for its own docket
// number. These pages give each order a real URL with genuinely unique content: its own directives
// (verbatim, page-cited), its own region-specific findings, its own respondent roster. No two pages
// share a paragraph, so this adds indexable surface without adding duplicate content.
//
// Every word is generated from data.js, so the quotes here are the same ones tools/verify-quotes.mjs
// already sweeps; nothing on these pages is authored outside the audited data layer.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { stampAssets } from "./stamp-assets.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://pranava0x0.github.io/FERC-Orders-June-2026/";

export function loadData(root = ROOT) {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(join(root, "docs", "js", "data.js"), "utf8"), ctx, { filename: "data.js" });
  return ctx.window.FERC_DATA;
}

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// Plain text for meta/JSON-LD: fold the typographic quotes data.js uses so attributes stay clean.
const plain = (s) => String(s).replace(/[“”]/g, '"').replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();

export function slugFor(d) {
  return `${d.docket}-${d.rto}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function allDockets(D) {
  return [...D.dockets, D.colocation].filter(Boolean);
}

function metaDescription(d) {
  const kind = d.track ? "order on rehearing" : "§206 show cause order";
  return plain(
    `FERC Docket ${d.docket} (Item ${d.item}), the ${kind} to ${d.rtoFull || d.rto}: ${d.cite}, ` +
      `${d.pages} pages, issued June 18, 2026. ${d.status}. Quoted directives with page cites, ` +
      `region-specific findings, and the full ${d.respondents} respondent list.`,
  ).slice(0, 300);
}

function jsonLd(d, D) {
  const report = {
    "@context": "https://schema.org",
    "@type": "Report",
    headline: plain(`FERC Docket ${d.docket}: ${d.rto} ${d.track ? "co-location order" : "large load show cause order"} (Item ${d.item})`),
    description: metaDescription(d),
    url: `${SITE}dockets/${slugFor(d)}/`,
    datePublished: "2026-06-18",
    dateModified: D.meta.newsCapture || D.meta.capture,
    inLanguage: "en",
    isAccessibleForFree: true,
    author: { "@type": "Organization", name: "Independent regulatory analysis" },
    citation: plain(d.cite),
    about: [
      { "@type": "Thing", name: "Federal Energy Regulatory Commission" },
      { "@type": "Thing", name: plain(d.rtoFull || d.rto) },
      { "@type": "Thing", name: `FERC Docket ${d.docket}` },
      { "@type": "Thing", name: "Large load interconnection" },
    ],
    isPartOf: { "@type": "Report", name: plain(D.meta.title), url: SITE },
  };
  const crumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: plain(D.meta.title), item: SITE },
      { "@type": "ListItem", position: 2, name: "Dockets", item: `${SITE}#dockets` },
      { "@type": "ListItem", position: 3, name: `${d.item} ${d.rto}, ${d.docket}`, item: `${SITE}dockets/${slugFor(d)}/` },
    ],
  };
  return [report, crumbs].map((o) => `  <script type="application/ld+json">\n${JSON.stringify(o, null, 2)}\n  </script>`).join("\n");
}

export function buildDocketPage(d, D) {
  const all = allDockets(D);
  const slug = slugFor(d);
  const url = `${SITE}dockets/${slug}/`;
  const src = D.SOURCES[d.url];
  const isE2 = Boolean(d.track);
  const title = `FERC Docket ${d.docket}: ${d.rto} ${isE2 ? "Co-Location Order" : "Large Load Show Cause Order"} (Item ${d.item})`;

  const dirItems = (d.dir || [])
    .map(
      (x) =>
        `        <li>\n          <p class="dk-topic">${esc(x.t)} <span class="dk-cite mono">${esc(x.p)}</span></p>\n` +
        `          <blockquote>“${esc(x.q)}”</blockquote>\n` +
        (x.pg
          ? `          <p class="dk-links"><a href="../../${esc(d.pdf)}#page=${x.pg}">Committed PDF, p.&nbsp;${x.pg}</a> · <a href="${esc(src.url)}#page=${x.pg}" rel="nofollow noopener" target="_blank">ferc.gov</a></p>\n`
          : "") +
        `        </li>`,
    )
    .join("\n");

  const regItems = (d.reg || [])
    .map((r) => {
      const quote = r.a ? `\n          <blockquote>“${esc(r.a)}”</blockquote>` : "";
      const cite = r.pg ? ` <span class="dk-cite mono">${esc(r.p)}</span>` : "";
      return `        <li><p>${esc(r.t)}${cite}</p>${quote}</li>`;
    })
    .join("\n");

  const askItems = (d.asks || []).map((a) => `        <li>${esc(a)}</li>`).join("\n");
  const roster = (d.respondentList || []).map((r) => esc(r)).join(" · ");

  const siblings = all
    .filter((x) => x.item !== d.item)
    .map((x) => `<a href="../${slugFor(x)}/">${esc(x.item)} ${esc(x.rto)}</a>`)
    .join(" · ");

  const briefPage = D.briefing && D.briefing.pages && D.briefing.pages[d.item];

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(metaDescription(d))}" />
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
  <link rel="canonical" href="${url}" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${url}" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(metaDescription(d))}" />
  <meta property="og:site_name" content="FERC Large Load Orders" />
  <meta property="og:image" content="${SITE}og-card.png" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content="${SITE}og-card.png" />
  <link rel="stylesheet" href="../../css/styles.css" />
${jsonLd(d, D)}
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>

  <header class="masthead" role="banner">
    <div class="wrap masthead-inner">
      <div class="masthead-text">
        <p class="eyebrow">Federal Energy Regulatory Commission · Issued June 18, 2026</p>
        <h1>${esc(d.item)} · ${esc(d.rto)} · Docket ${esc(d.docket)}</h1>
        <p class="masthead-sub">${esc(d.rtoFull || d.rto)} — ${esc(d.cite)}, ${d.pages} pages. ${esc(d.status)}.</p>
      </div>
    </div>
  </header>

  <main id="main" role="main" class="wrap dk-page">
    <nav class="dk-nav" aria-label="Breadcrumb">
      <a href="../../">Large Load Interconnection</a> <span aria-hidden="true">›</span>
      <a href="../../#dockets">Dockets</a> <span aria-hidden="true">›</span>
      <span aria-current="page">${esc(d.item)} ${esc(d.rto)}</span>
    </nav>

    <dl class="dk-facts">
      <div><dt>Docket</dt><dd class="mono">${esc(d.docket)}</dd></div>
      <div><dt>Item</dt><dd class="mono">${esc(d.item)}</dd></div>
      <div><dt>Reporter cite</dt><dd class="mono">${esc(d.cite)}</dd></div>
      <div><dt>Region</dt><dd>${esc(d.region)}</dd></div>
      <div><dt>Respondents</dt><dd>${esc(d.respondents)}</dd></div>
      <div><dt>Length</dt><dd>${d.pages} pages</dd></div>
    </dl>

    <p class="dk-actions">
      <a class="dk-cta" href="../../${esc(d.pdf)}">Read the order PDF (committed copy)</a>
      <a href="${esc(src.url)}" rel="nofollow noopener" target="_blank">Official source on ferc.gov ↗</a>
    </p>

    <h2>What is unique to ${esc(d.rto)}</h2>
    <p>${esc(d.unique)}</p>

    <h2>${isE2 ? "What this order holds" : `What FERC presses ${esc(d.rto)} on`}</h2>
    <ul class="dk-list">
${askItems}
    </ul>

    <h2>${isE2 ? "Quoted holdings" : "Quoted directives"}, with page cites</h2>
    <p>Each quotation below is verbatim from the committed order text and links to the page it appears on. A test asserts every one of them against the extracted source.</p>
    <ol class="dk-quotes">
${dirItems}
    </ol>

    <h2>Region-specific findings</h2>
    <ul class="dk-list">
${regItems}
    </ul>
${briefPage ? `\n    <h2>Section IV briefing questions</h2>\n    <p>This order poses its briefing questions at page ${briefPage} of the committed PDF: <a href="../../${esc(d.pdf)}#page=${briefPage}">open at §&nbsp;IV</a>. The questions are templated across the six show cause orders; the full set, and what the public record says on each, is in the <a href="../../#comments">comment record</a>.</p>` : ""}

    <h2>Respondents named in the order</h2>
    <p class="dk-roster">${roster}</p>

    <h2>The other dockets</h2>
    <p class="dk-siblings">${siblings}</p>
    <p><a href="../../">Return to the full briefing</a>: the timeline, the five reform categories, the procedural clock, and the ${esc(String(D.comments.total))}-comment RM26-4 record.</p>
  </main>

  <footer role="contentinfo" class="footer">
    <div class="wrap footer-inner">
      <p><strong>Not affiliated with FERC or DOE.</strong> An independent analysis of public documents by <a href="https://pranavaraparla.com" target="_blank" rel="noopener noreferrer">Pranava Raparla</a> (<a href="https://pranavaraparla.com" target="_blank" rel="noopener noreferrer">pranavaraparla.com</a>). Primary sources are linked inline; consult the official orders in FERC eLibrary for any citation of record.</p>
      <p class="footer-meta mono">Order record as of ${esc(D.meta.capture)}${D.meta.newsCapture ? ` · news and filings swept ${esc(D.meta.newsCapture)}` : ""} · Static site, zero dependencies · <a href="https://github.com/pranava0x0/FERC-Orders-June-2026" target="_blank" rel="noopener noreferrer">Source on GitHub</a></p>
    </div>
  </footer>
</body>
</html>
`;
}

// Stamped here rather than by a later pass, so "what the generator emits" and "what is committed" stay
// byte-identical and the sync test means what it says. stamp-assets.mjs remains idempotent over these.
export function pagesFor(D, root = ROOT) {
  const out = new Map();
  for (const d of allDockets(D)) {
    const slug = slugFor(d);
    const dir = join(root, "docs", "dockets", slug);
    out.set(join("dockets", slug, "index.html"), stampAssets(buildDocketPage(d, D), root, dir));
  }
  return out;
}

if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  const D = loadData();
  const pages = pagesFor(D);
  const check = process.argv.includes("--check");
  const stale = [];
  for (const [rel, html] of pages) {
    const abs = join(ROOT, "docs", rel);
    const current = existsSync(abs) ? readFileSync(abs, "utf8") : null;
    if (current === html) continue;
    if (check) {
      stale.push(rel);
    } else {
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, html);
    }
  }
  if (check) {
    if (stale.length) {
      console.error(`Docket pages are stale (${stale.join(", ")}). Regenerate: node tools/build-docket-pages.mjs`);
      process.exit(1);
    }
    console.log(`Docket pages are in sync (${pages.size}).`);
  } else {
    console.log(`Wrote ${pages.size} docket pages under docs/dockets/.`);
    for (const rel of pages.keys()) console.log(`  ${rel}`);
  }
}
