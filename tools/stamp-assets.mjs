// Stamps docs/index.html's asset cache-busting tokens from the CONTENT of each asset.
//
//   node tools/stamp-assets.mjs          # rewrite the ?v= tokens
//   node tools/stamp-assets.mjs --check  # exit non-zero if any token is stale
//
// Why this exists: the tokens used to be one hand-typed date (`?v=20260715a`) shared by every asset.
// Shipping a change meant remembering to bump it, and forgetting is silent and nasty — returning
// visitors keep the cached files, so a release can land as an OLD app.js driving a NEW data.js. That
// mismatch renders as a data-shape bug that reproduces for users and not for you. It was missed once
// in this repo (PR #14) and the failure mode is invisible in every local check, so it is now derived
// rather than remembered.
//
// A token is the first 10 chars of the sha256 of that file's bytes, so each asset busts only when it
// actually changes (a 491KB comments-data.js is not re-downloaded because styles.css moved).
// Same contract as build-llms.mjs: a test asserts the committed HTML matches this output.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const HTML = join(ROOT, "docs", "index.html");

// href="css/styles.css?v=xxx" / src="js/app.js?v=xxx" — local assets only, so a CDN URL is untouched.
const ASSET_REF = /((?:href|src)=")((?!https?:)[^"?]+\.(?:css|js))(\?v=[^"]*)?"/g;

export function stampAssets(html, root = ROOT) {
  const missing = [];
  const out = html.replace(ASSET_REF, (match, attr, path) => {
    const file = join(root, "docs", path);
    if (!existsSync(file)) {
      missing.push(path);
      return match; // leave it alone and fail loud below rather than stamping a path that isn't there
    }
    const hash = createHash("sha256").update(readFileSync(file)).digest("hex").slice(0, 10);
    return `${attr}${path}?v=${hash}"`;
  });
  if (missing.length) {
    throw new Error(`docs/index.html references assets that do not exist: ${missing.join(", ")}`);
  }
  return out;
}

if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  const current = readFileSync(HTML, "utf8");
  const stamped = stampAssets(current);
  if (process.argv.includes("--check")) {
    if (current !== stamped) {
      console.error("docs/index.html asset tokens are stale. Regenerate with: node tools/stamp-assets.mjs");
      process.exit(1);
    }
    console.log("Asset tokens are in sync.");
  } else {
    writeFileSync(HTML, stamped);
    const tokens = [...stamped.matchAll(ASSET_REF)].map((m) => `${m[2]} -> ${(m[3] || "").slice(3)}`);
    console.log(`Stamped ${tokens.length} asset references in docs/index.html:`);
    for (const t of tokens) console.log(`  ${t}`);
  }
}
