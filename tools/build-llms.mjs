// Generates docs/llms.txt from docs/js/data.js (the single source of truth), following the
// llmstxt.org convention. The committed llms.txt must match this output; a test in
// tests/source-accuracy.test.mjs asserts it, so the two never drift.
//
//   node tools/build-llms.mjs          # write docs/llms.txt
//   node tools/build-llms.mjs --check  # exit non-zero if docs/llms.txt is stale
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SITE = "https://pranava0x0.github.io/FERC-Orders-June-2026/";
const LEAN = { right: "right of center", left: "left of center", nonpartisan: "nonpartisan" };

export function loadData() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(readFileSync(join(ROOT, "docs", "js", "data.js"), "utf8"), context, {
    filename: "docs/js/data.js",
  });
  return context.window.FERC_DATA;
}

export function buildLlmsTxt(D) {
  const m = D.meta;
  const out = [];
  out.push(`# ${m.title}`, "");
  out.push(`> ${m.subtitle}`, "");
  for (const p of m.summary) out.push(p);
  out.push("");
  out.push(
    "A static, independent analysis microsite (not affiliated with FERC or DOE). Source of truth: " +
      "docs/js/data.js. Evidence is kept in three visibly distinct tiers: FERC primary, DOE primary, " +
      "and secondary analysis.",
    "",
  );

  out.push("## Key facts", "");
  out.push(`- Authority: ${m.authority}`);
  out.push(`- Items and dockets: ${m.items}`);
  out.push(`- Reporter cites: ${m.citeRange}`);
  out.push(`- Commission: ${m.commissioners}`);
  out.push(`- Order record as of ${m.capture}; Discourse commentary gathered ${m.discourseCapture}`);
  for (const k of D.kpis) out.push(`- ${k.label}: ${k.value}, ${k.sub}`);
  out.push("");

  out.push("## The six show cause orders (E-7 to E-12)", "");
  out.push(
    "Each order PDF is committed and served at the page-precise link below; the official FERC source " +
      "(Cloudflare-gated) is noted after it.",
    "",
  );
  for (const d of D.dockets) {
    const so = D.SOURCES[d.url];
    out.push(
      `- [${d.item} ${d.rto}, ${d.docket}, ${d.cite}, ${d.pages} pp](${SITE}${d.pdf}): ` +
        `${d.status}. Region: ${d.region}. Official: ${so.url}`,
    );
  }
  out.push("");

  if (D.colocation) {
    const c = D.colocation;
    const so = D.SOURCES[c.url];
    out.push("## The PJM co-location rehearing order the six extend (Item E-2)", "");
    out.push(
      `- [${c.item} ${c.rtoFull}, ${c.docket}, ${c.cite}, ${c.pages} pp](${SITE}${c.pdf}): ` +
        `${c.kind} on the December 18, 2025 PJM Co-Location Order (193 FERC ¶ 61,217), issued June 18, 2026. ` +
        `${c.status} (Interim NITS, FCD, NFCD) — the services the six §206 orders extend. Official: ${so.url}`,
      "",
    );
  }

  out.push("## The five reform categories", "");
  for (const c of D.categories) out.push(`- ${c.n}. ${c.title}: ${c.ferc}`);
  out.push("");

  out.push("## Primary sources", "");
  for (const id of ["doe403", "fercPR", "fercFS", "fercSum", "fercRM264"]) {
    const s = D.SOURCES[id];
    out.push(`- [${s.label}](${s.archiveUrl || s.url}): ${s.org}, captured ${s.captured}`);
  }
  out.push("");

  out.push(`## Commentary themes (secondary, gathered ${m.discourseCapture})`, "");
  for (const theme of D.voiceThemes || []) {
    out.push(`- ${theme.title}: ${theme.body}`);
    for (const q of theme.quotes || []) {
      const s = D.SOURCES[q.src];
      out.push(`  - "${q.q}" Source: ${s.url}`);
    }
  }
  out.push("");

  out.push("## The RM26-4 public comments (corpus)", "");
  out.push(`- ${D.comments.total} public comments (of ${D.comments.filings} total eLibrary filings) on the DOE ANOPR (Docket RM26-4-000) were scraped from FERC eLibrary. Each text-extracted comment carries a quote-centric, auditable summary built the PNNL "CommentNEPA" way: verbatim quotes pulled from the filing, binned to the five reform principles / eight ANOPR questions / six regions (plus emergent topics), each bin with the filer's stance. AI-generated and provisional (not yet human-verified).`);
  out.push("- Per-comment summaries: `sources/comments/summaries-v2/<accession>.json`. Compiled for the site: `docs/js/comments-data.js` (`window.FERC_COMMENTS`). Method + schema: `sources/comments/summarization-spec.md`. Explore on the Comments tab (a stance map + per-comment audited analysis).");
  out.push("");

  out.push("## Read the site", "");
  out.push(`- [${m.title}](${SITE}): six tabs (Overview, Timeline, Reforms, Dockets, Comments, Discourse).`);

  return out.join("\n") + "\n";
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const target = join(ROOT, "docs", "llms.txt");
  const generated = buildLlmsTxt(loadData());
  if (process.argv.includes("--check")) {
    const current = readFileSync(target, "utf8");
    if (current !== generated) {
      console.error("docs/llms.txt is stale. Run: node tools/build-llms.mjs");
      process.exit(1);
    }
    console.log("docs/llms.txt is up to date.");
  } else {
    writeFileSync(target, generated);
    console.log(`Wrote ${target} (${generated.length} bytes).`);
  }
}
