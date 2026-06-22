# security.md — supply-chain advisory sweep

## Sweep 2026-06-22 (project scaffold)

Source: `https://pranava0x0.github.io/vibe-coding-security/llms-ctx.txt` (advisory index, generated 2026-06-22).

**Verdict for this project: negligible exposure.**

This site is **pure HTML / CSS / vanilla JavaScript** with:

- **No npm dependencies** — no `package.json` runtime deps, no `node_modules` shipped. The only Node usage is a dev-time test runner (`node:test`, `node:assert` — built-ins, no install).
- **No CDN / third-party assets** — system font stacks only, no Google Fonts, no external `<script>`/`<link>`. Nothing to pin SRI on because nothing is fetched cross-origin.
- **No MCP integrations or AI tooling in the shipped artifact.**

The 2026-06 advisories in the index (IDEsaster, Mastra/Gluestack/TanStack npm worms, Hades PyPI, Cline RCE, TrapDoor `CLAUDE.md` rewrites, etc.) all target npm/PyPI/crates supply chains, IDE plugins, or self-hosted AI backends — none of which this static site touches.

**Monitoring only:** browser-vendor updates. Re-run the sweep if we ever add a dependency, a CDN asset, or a GitHub Action.

## Hardening already applied

- `.gitignore` blocks `.env*`, `credentials.json`, `secrets/`, key material.
- No machine-local absolute paths committed in data (provenance paths are repo-relative / URLs).
- CSV/export formula-injection guard: N/A (no spreadsheet export).
- GitHub Actions: none yet. If a Pages build action is added, pin it to a full commit SHA + minimal `permissions:`.
