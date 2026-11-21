#!/usr/bin/env node
// Which filed responses still need a position read for this site.
//
// A response is a comment, protest, answer, brief or rehearing request from anyone but FERC. Requests for
// more time, errata, abeyance motions and FERC notices are procedure and are not counted. A response is
// curated when sources/filings/perspectives.json has an entry whose URL carries its eLibrary accession, or
// when it has a full reading of its own (sources/filings/documents/<slug>.json).
//
//   node tools/curation-queue.mjs                 replies to the Nov 13–19 filings and LARS, then a tally of the rest
//   node tools/curation-queue.mjs --all           every proceeding, listed in full
//   node tools/curation-queue.mjs --check a,b     exit 1 if proceeding a or b has an uncurated response
//
// REFRESH.md runs this after each ingest: new replies to the Nov 13–19 filings get a position (stance,
// plain summary, one verbatim quote with its PDF page) before the refresh ships.
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p) => JSON.parse(readFileSync(join(ROOT, ...p), "utf8"));

// The proceedings whose replies are curated as they arrive.
export const WATCH = ["miso-lars", "isone-large-load", "pjm-large-load", "pjm-tos-large-load", "miso-large-load",
  "caiso-large-load", "nyiso-large-load", "spp-large-load", "sc-pjm", "sc-miso", "sc-spp", "sc-caiso", "sc-isone", "sc-nyiso"];

const FERC = /^(?:secretary of the commission|ferc\b|federal energy regulatory commission|office of energy market regulation)/i;
const PROCEDURE = /\bextension\b|\berrata\b|\babeyance\b|^notice\b|^(?:motion to intervene|notice of intervention|doc-less motion)(?!.*\b(?:comments?|protest|answer)\b)/i;
const RESPONSE = /protest|comments|answer|rehearing|brief|statement of position|clarification/i;
const INDIVIDUAL = /^individual\b/i;

export function queue() {
  const catalog = read("docs", "reading", "catalog.json");
  const groups = read("sources", "filings", "proceedings.json").groups;
  const curated = new Set(read("sources", "filings", "perspectives.json").map((v) => /accession_number=([\d-]+)/.exec(v.url || "")?.[1]).filter(Boolean));
  const groupOf = (r) => groups.find((g) => (g.match || []).some((m) => String(r.docket || "").startsWith(m)));
  const out = new Map(groups.map((g) => [g.id, { id: g.id, title: g.short || g.title, total: 0, individual: 0, open: [] }]));
  for (const r of catalog) {
    if (r.parent || !r.accession || !RESPONSE.test(r.kind || "") || FERC.test(r.filer || "") || PROCEDURE.test(r.title || "")) continue;
    const g = groupOf(r);
    if (!g) continue;
    const q = out.get(g.id);
    if (INDIVIDUAL.test(r.filer || "")) { q.individual++; continue; }
    q.total++;
    if (!curated.has(r.accession) && !existsSync(join(ROOT, "sources", "filings", "documents", r.slug + ".json"))) q.open.push(r);
  }
  for (const q of out.values()) q.open.sort((a, b) => (a.issued < b.issued ? 1 : a.issued > b.issued ? -1 : 0));
  return [...out.values()];
}

function line(r) { return `  ${r.issued}  ${r.accession}  ${(r.filer || "").slice(0, 44).padEnd(44)}  ${(r.title || "").slice(0, 70)}`; }

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2), all = args.includes("--all"), ci = args.indexOf("--check");
  const q = queue();
  if (ci >= 0) {
    const ids = (args[ci + 1] || "").split(",").filter(Boolean);
    if (!ids.length) { console.error("✗ --check needs proceeding ids, e.g. --check miso-lars"); process.exit(2); }
    const unknown = ids.filter((id) => !q.some((x) => x.id === id));
    if (unknown.length) { console.error("✗ unknown proceeding " + unknown.join(", ") + " (ids are in sources/filings/proceedings.json)"); process.exit(2); }
    const open = q.filter((x) => ids.includes(x.id) && x.open.length);
    for (const x of open) { console.error(`✗ ${x.id}: ${x.open.length} of ${x.total} responses not yet read`); x.open.forEach((r) => console.error(line(r))); }
    if (open.length) process.exit(1);
    console.log(`✓ ${ids.length} proceeding(s) checked, ${q.filter((x) => ids.includes(x.id)).reduce((a, x) => a + x.total, 0)} responses, all read`);
    process.exit(0);
  }
  const shown = q.filter((x) => x.total || x.individual), watched = shown.filter((x) => WATCH.includes(x.id)), rest = shown.filter((x) => !WATCH.includes(x.id));
  for (const x of all ? shown : watched) {
    console.log(`${x.id}  ${x.total - x.open.length}/${x.total} read${x.individual ? ` · ${x.individual} from individuals, not queued` : ""}`);
    x.open.forEach((r) => console.log(line(r)));
  }
  if (!all) {
    console.log("\nOther proceedings (--all lists them):");
    for (const x of rest) if (x.total) console.log(`  ${x.id.padEnd(28)} ${x.total - x.open.length}/${x.total} read`);
  }
  const open = q.reduce((a, x) => a + x.open.length, 0), total = q.reduce((a, x) => a + x.total, 0);
  console.log(`\n${total - open} of ${total} responses read · ${watched.reduce((a, x) => a + x.open.length, 0)} open in watched proceedings`);
}
