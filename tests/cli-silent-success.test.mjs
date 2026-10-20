/* Regression guards for the silent-success class in the CLI tools (CLAUDE.md, 2026-08-23): a run that
 * finds nothing to check, or is missing an operand, must exit non-zero instead of printing a clean
 * tally. Each case copies the tool into a throwaway tree under the OS temp dir (the tools resolve their
 * inputs relative to their own location), so nothing in the repo is read or written.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, existsSync, rmSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const TOOLS = join(dirname(fileURLToPath(import.meta.url)), "..", "tools");

// A temp tree with the named tools copied in and `files` ({relPath: contents}) written.
function tree(tools, files = {}) {
  // realpath: on macOS tmpdir() is /var/..., a symlink to /private/var/.... Node resolves the entry
  // script's import.meta.url to the real path while argv[1] keeps the symlinked one, so a tool's
  // "am I the main module" check fails, its CLI block never runs, and it exits 0 having done nothing.
  const root = mkdtempSync(join(realpathSync(tmpdir()), "ferc-cli-"));
  mkdirSync(join(root, "tools"));
  for (const t of tools) copyFileSync(join(TOOLS, t), join(root, "tools", t));
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    if (body !== null) writeFileSync(join(root, rel), body);
  }
  return root;
}
const run = (root, tool, ...args) => spawnSync(process.execPath, [join(root, "tools", tool), ...args], { cwd: root, encoding: "utf8" });
const withTree = (tools, files, fn) => { const root = tree(tools, files); try { fn(root); } finally { rmSync(root, { recursive: true, force: true }); } };

const V2 = "sources/comments/summaries-v2";
const SUMMARY = JSON.stringify({ accession: "20990101-0001", quotes: [{ id: 1, bins: ["pr:cost"] }], bins: [{ key: "pr:cost", stance: "support", quote_ids: [1] }] });

test("fix-lenses: an empty summaries dir and a missing named file both exit non-zero", () => {
  withTree(["fix-lenses.mjs"], { [`${V2}/.keep`]: "" }, (root) => {
    const r = run(root, "fix-lenses.mjs");
    assert.equal(r.status, 1, "empty dir: " + r.stdout + r.stderr);
    assert.match(r.stderr, /nothing was checked/);
    assert.equal(run(root, "fix-lenses.mjs", "20990101-0009").status, 1, "a skipped file is not success");
  });
  withTree(["fix-lenses.mjs"], { [`${V2}/20990101-0001.json`]: SUMMARY }, (root) => {
    const r = run(root, "fix-lenses.mjs");
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /1 of 1 checked/);
  });
});

test("reconcile-summary-bins: an empty summaries dir exits non-zero; a real one reports what it scanned", () => {
  withTree(["reconcile-summary-bins.mjs"], { [`${V2}/.keep`]: "" }, (root) => {
    assert.equal(run(root, "reconcile-summary-bins.mjs", "--dry-run").status, 1);
  });
  withTree(["reconcile-summary-bins.mjs"], { [`${V2}/20990101-0001.json`]: SUMMARY }, (root) => {
    const r = run(root, "reconcile-summary-bins.mjs", "--dry-run");
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /scanned 1, reconciled 0/);
  });
});

test("flag-summary: no accession is a usage error, and no worklist row routes to the audit", () => {
  withTree(["flag-summary.mjs"], { [`${V2}/20990101-0001.json`]: SUMMARY }, (root) => {
    assert.equal(run(root, "flag-summary.mjs").status, 1, "a missing operand used to print flagged:false");
    const r = run(root, "flag-summary.mjs", "20990101-0001");
    assert.equal(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    assert.equal(out.flagged, true, "without a prior or body size the gate cannot clear it");
    assert.match(out.reasons[0], /no \.worklist\.json row/);
  });
});

test("build-comment-worklist: a bare --next and a missing body dir exit non-zero", () => {
  const acc = "20990101-0001";
  const base = {
    "sources/comments/rm26-4-comments.json": JSON.stringify({ comments: [{ acc, org: "Example Co", bucket: "other", filed: "01/01/2099" }] }),
    "docs/js/comments-data.js": `window.FERC_COMMENTS = { list: [{ acc: "${acc}", aq: [], pr: ["cost"], rg: [] }] };`,
  };
  const tools = ["build-comment-worklist.mjs", "validate-summaries.mjs"];
  withTree(tools, { ...base, [`sources/comments/files/${acc}__Example-Co/body.txt`]: "x".repeat(500) }, (root) => {
    assert.equal(run(root, "build-comment-worklist.mjs", "--next").status, 1, "bare --next used to default to 40");
    assert.equal(run(root, "build-comment-worklist.mjs", "--next", "0").status, 1);
    const r = run(root, "build-comment-worklist.mjs", "--next", "1");
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(JSON.parse(r.stdout), [acc]);
  });
  withTree(tools, base, (root) => {
    const r = run(root, "build-comment-worklist.mjs");
    assert.equal(r.status, 1, "no files/ dir used to report 0 to summarize, which the loop reads as done");
    assert.match(r.stderr, /no comment body directory/);
  });
  // A page build that lists SOME comments but not this one used to hand the row an empty keyword prior,
  // which the workflow then ran without its deterministic cross-check. Now it is a stale-build error.
  const stale = { ...base, "docs/js/comments-data.js": `window.FERC_COMMENTS = { list: [{ acc: "20990101-0002", aq: [], pr: ["cost"], rg: [] }] };` };
  withTree(tools, { ...stale, [`sources/comments/files/${acc}__Example-Co/body.txt`]: "x".repeat(500) }, (root) => {
    for (const args of [[], ["--next", "1"]]) {
      const r = run(root, "build-comment-worklist.mjs", ...args);
      assert.equal(r.status, 1, `missing prior must fail (${args.join(" ") || "default mode"}): ${r.stdout}`);
      assert.match(r.stderr, /no keyword prior/);
    }
  });
});

test("analyze-comments and build-comment-audit refuse to overwrite committed outputs from empty inputs", () => {
  withTree(["analyze-comments.mjs"], { "sources/comments/rm26-4-manifest.raw.json": "[]" }, (root) => {
    assert.equal(run(root, "analyze-comments.mjs").status, 1);
    assert.ok(!existsSync(join(root, "sources/comments/rm26-4-comments.json")), "no output written");
  });
  withTree(["build-comment-audit.mjs"], { "sources/comments/rm26-4-comments.json": JSON.stringify({ comments: [] }) }, (root) => {
    assert.equal(run(root, "build-comment-audit.mjs").status, 1);
    assert.ok(!existsSync(join(root, "sources/comments/rm26-4-audit-index.json")), "no output written");
  });
});

test("check-staleness: a data.js with an empty section fails instead of printing Nothing flagged", () => {
  const data = (tracks) => `window.FERC_DATA = { timeline: [{ kind: "ferc", iso: "2026-06-18" }], tracks: ${tracks}, ` +
    `dockets: [{ docket: "EL26-67-000", rto: "PJM" }], meta: { newsCapture: "2099-01-01" }, ` +
    `procedural: { steps: [{ id: "report", date: "2099-01-01", label: "Report" }], filings: { asOf: "2099-01-01", steps: ["report"], rows: [] } } };`;
  withTree(["check-staleness.mjs"], { "docs/js/data.js": data("{}") }, (root) => {
    const r = run(root, "check-staleness.mjs");
    assert.equal(r.status, 1, r.stdout);
    assert.match(r.stderr, /no tracks/);
  });
  withTree(["check-staleness.mjs"], { "docs/js/data.js": data(`{ t: { next: { date: "2099-01-01", label: "x" }, status: { asOf: "Nov 2099" } } }`) }, (root) => {
    const r = run(root, "check-staleness.mjs");
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /status\.asOf "Nov 2099" is not YYYY-MM-DD/, "a non-ISO date is flagged, not skipped");
    assert.match(r.stdout, /Checked 0 deadline event\(s\), 1 track\(s\)/);
  });
});

test("stamp-assets: zero asset references is not 'in sync'", () => {
  withTree(["stamp-assets.mjs"], { "docs/index.html": "<!doctype html><title>x</title>" }, (root) => {
    const r = run(root, "stamp-assets.mjs", "--check");
    assert.equal(r.status, 1, r.stdout);
    assert.match(r.stderr, /nothing was checked/);
  });
});
