# CLAUDE.md — Universal Development Principles

> Base file for every project in this folder. Project files extend it and win on conflict (they're the local source of truth).
>
> Companion files: [AGENTS.md](AGENTS.md) is the *how* for agents; [DESIGN.md](DESIGN.md) is the *look*.

---

## North star: ship small things that work end-to-end

One rule drives the rest: **build the smallest version that works, then add only what the next real user need demands.** (Karpathy: "make it work, then make it good." levels.io: "ship it ugly, ship it now.") A working ugly thing teaches more in a day than a plan teaches in a month.

- **No half-finished work.** A feature ships end-to-end or stays a branch — never merged 80% done with a TODO.
- **No speculative abstraction.** Three similar lines beat a premature helper. Build the helper the second time you need it.
- **No future-proofing without a present user.** Every config knob, plugin point, and flag is dead weight until someone uses it.

---

## Agent Workflow: Explore → Plan → Code → Verify

Never blindly write code.

1. **Explore.** Find relevant files and understand existing patterns before touching anything.
2. **Plan.** Assess blast radius. For significant changes, present 2–3 approaches with pros/cons and get approval before coding.
3. **Code.** Implement following the rules below.
4. **Verify.** Run tests, use the feature, fix all failures before declaring done.

**Read before edit** — always, even if you read the file earlier this session. **Ask for options first** on non-trivial tasks; the first plausible plan is rarely the best. **Close the loop yourself** — build so the agent can compile, lint, test, and verify its own output. (Karpathy: "agentic coding works when the eval is the loop.")

---

## Communication style

- **Concise.** No filler, apologies, moralizing, or generic advice.
- **Show your work** only when it changes the answer.
- **Fail loud.** No catch-all handlers that swallow errors. Raise or log.
- **State results, not effort.** "Tests pass," not "I worked hard to get tests to pass."

---

## Architecture principles

- **No over-engineering.** Only changes directly requested or clearly necessary.
- **Boring tech wins.** Vanilla JS, SQLite, static HTML, system fonts, plain Python beat the framework-of-the-month. Every dependency is a future bug, migration, and advisory. (levels.io: "boring tech is the secret.")
- **Single source of truth.** Constants, configs, shared types derive from one place. If a value is duplicated, test that the copies match.
- **Modular layers.** Data fetching, processing, storage, presentation — distinct modules.
- **Idempotent operations.** Re-running is safe (`INSERT OR IGNORE`, cache checks, dedup by key) — but that protects re-runs, not concurrent writers. Never run two instances of the same stage on overlapping inputs; both writing one output dir corrupt each other.
- **Precompute derived values at ingest, not per call.** Compute a hot-loop value (e.g. a per-record search string) once at write time and store it. No per-call fallback that re-derives it — that silently defeats the optimization; prefer "no key → no match" so a missed index fails loud.
- **Static when possible.** Baked data over runtime backends. A `docs/` folder on GitHub Pages beats a server to babysit.
- **Cost-optimized.** Free tiers; cheapest resource that meets the requirement.
- **CLI-first.** Build CLI entry points before UI so agents can self-validate output.
- **Minimize page weight and request count.** Content sites stay lightweight — fewest requests, smallest payload.
- **Tree-shake and code-split.** Lazy-load what a page needs; don't bundle every controller everywhere.
- **Benchmark against best-in-class.** If the simplest site in the org is orders of magnitude lighter, review the build.
- **Document subsystems.** A `docs/` folder noting non-obvious subsystems, decisions, and correct CLI invocations. One line prevents repeated mistakes.

---

## Error resilience

- **Never let one item crash the pipeline.** Wrap per-record processing; log and continue.
- **Log aggressively** — every request, parse, API call, cache hit/miss, filter decision.
- **Cache everything fetchable** so re-runs are fast and cheap.
- **Validate everything.** Invalid external responses → log and skip, never crash.
- **Track errors visibly** in `issues.md` or an errors array — failures must surface.
- **Checkpoint long jobs incrementally.** Save per unit, commit per N units / per partition, and log every failure to an append-only `ingest_log.jsonl` with a `retryable` flag. End the run with a one-line status report (`✓ N done · ✗ M failed (reason) · → resume at X`). A job that only reports success hides the items that silently fail every re-run.
- **Resume/backfill merges with on-disk output.** A `--missing-only` run must merge new records with existing *before* writing, or a capped partial run drops everything done earlier. Keep a progress manifest (per partition: `last_run`, `count`, `next_target`) so a new session resumes without re-deriving progress. Distinguish a closeable gap from a permanent source-side dead-end — don't re-run enrichment for data upstream will never give; mark it a known structural gap.
- **Verify files are really on disk before debugging a "code" bug.** Cloud-sync (iCloud / Dropbox / OneDrive) can leave dataless placeholders that read empty / NUL while the inode reports the right size — and `git status` calls them *clean* because it trusts its stat-cache and never reads the bytes. The symptoms masquerade as code bugs (`ERR_INVALID_PACKAGE_CONFIG`, every route 500s, multi-minute boots, `page 2.tsx` conflict-copies). Fix: delete the file *then* `git checkout` (a plain checkout no-ops on a "clean" placeholder); better, move the repo out of the synced folder.
- **Key file-backed caches on a signature, not a TTL.** For a cache fronting a local file, key on `(mtime_ns, size)` instead of a fixed `ttl=`; it busts the instant the file changes and serves indefinitely otherwise. A time-based TTL either serves stale data or churns needlessly.

---

## Security & credential handling

- **Never commit secrets.** Read credentials from env vars only; halt with a clear error if missing; never log them.
- Always `.gitignore`: `.env`, `.env.local`, `credentials.json`, `secrets/`, `node_modules/`, `__pycache__/`, `dist/`, `*.pyc`.
- Before committing: `git diff --cached | grep -iE "apikey|password|token|secret"`.
- **Respect privacy choices.** Don't proxy tracking SDKs through your own domain to dodge blockers.
- **Check the security advisory index before risky supply-chain actions — targeted, not on every command.** Supply-chain attacks hit popular packages within hours of a maintainer phish. Fetch the advisory index at `https://pranava0x0.github.io/vibe-coding-security/llms-ctx.txt` (~12 KB) and surface any match **before** these specific actions: (1) starting / scaffolding a new project, (2) any `npm install` / `pip install` / `uv add` / dependency add or upgrade, (3) adding a third-party CDN asset or a GitHub Action, (4) running a fetched install script (`curl … | sh`). Do **not** re-fetch it for routine edits, reads, or running already-installed code — that's noise that burns tokens. Cache the result in `security.md` with the sweep date; reuse it within a session and refresh only if > 7 days old or one of the trigger actions recurs after the cached window.

### Supply-chain hardening

- **Pin exact versions, never floating ranges.** `==` (Python) + lockfile installs (`npm ci`, not `npm install`) — a `>=`/`^` range auto-pulls whatever the registry serves next, the exact window a bad release lands in. Better still, hash-lock (`pip-compile --generate-hashes` + `--require-hashes`, `uv lock`, lockfile integrity hashes) to reject same-version re-publishes.
- **Subresource Integrity on every CDN asset.** `sha384` `integrity` on each `<link>`/`<script>`/import-map entry so a swapped file fails closed. Regenerate with `curl -sL <url> | openssl dgst -sha384 -binary | openssl base64 -A`; verify twice (a partial download yields a wrong hash that blanks the page). Self-host when feasible.
- **Pin CI actions to a full commit SHA + least privilege.** Every `uses:` pinned to a 40-char SHA (not a moving `@v3` tag) with a `# vX.Y.Z` comment, plus a minimal `permissions:` block per workflow. Re-pin with `gh api repos/<owner>/<repo>/commits/<tag> --jq .sha`.
- **Neutralize formula injection in exports.** Prefix CSV/TSV/spreadsheet cells starting with `= + - @`, tab, or CR with a `'`, or `=HYPERLINK(...)` runs when opened in Excel/Sheets.
- **No machine-local paths in committed data.** Store paths repo-relative; `/Users/<name>/...` leaks identity and layout into public history.
- **Every security fix ships with a regression test** — these regressions are invisible until exploited.

---

## Testing & validation

- **Write tests alongside code.** Every new module or bug fix includes them.
- **Regression-test every bug fix.** The bug is the test case; without one the fix rots.
- **Validate output against schemas before writing to disk** (Pydantic `extra="forbid"`, or zod).
- **Cover edges:** empty `[] / {} / ""`, null for every optional field, boundary values, combined filters.
- **Count-floor regression test.** For append-only datasets, assert total/item counts never drop versus the previous commit. Reintroduced caps and accidental deletions pass schema validation but fail a count floor.
- **Seed one example per enum value.** When the UI renders a legend/chips off an enum, test the dataset ships ≥ 1 record per value — so no legend slot renders empty and deleting the last example fails loudly.
- **Run the full suite before committing.**
- **Never ship test files to production.** CI excludes tests, fixtures, debug artifacts.
- **Tests are the eval suite** — the loop that tells you what works. Invest in it.

---

## Git discipline

- **Commit often** at natural checkpoints — small and focused: per module/feature, per bug fix (with its regression test), per doc update.
- **Messages explain *what* and *why*** — "fix off-by-one in pagination when filter is empty," not "fix bug."
- **Never commit large binaries, downloaded data, or keys.**
- **Don't amend pushed commits**, and don't `--no-verify` — fix the hook's underlying issue.
- **`git fetch` and integrate onto the latest remote before pushing to a shared branch.** Parallel agent / IDE / Codex sessions advance `main` mid-task; a stale base is rejected non-fast-forward. Check `git rev-list --left-right --count origin/main...HEAD`; if diverged with overlapping edits, re-apply onto the new structure rather than force-pushing (a force-push destroys the parallel work). At session start, `git branch -a` + `git log --all --oneline | head` to spot another tool mid-flight before assuming a clean starting point. Only clear a stale `.git/refs/.../*.lock` after confirming no `git` process is running.
- **Don't gate a commit on a piped filter.** `pytest … | grep passed && git commit` silently skips the commit when grep matches nothing (it exits non-zero). Run the tests, read the summary, then commit as a separate step.
- **No agent co-authors and no machine fingerprints.** No `Co-Authored-By:` for any AI tool, no "🤖 Generated with…" footers, no generic-assistant PR prose. Commits are owned by the human who ships them; write messages in their plain voice. Enforce with `git config --local claude.coauthor false` (set globally once to cover all repos).
- **Set commit identity deliberately.** Author with the account's noreply address — `git config --global user.email "<id>+<username>@users.noreply.github.com"` — and set `user.name "<username>"` too, or git falls back to the OS full name and leaks it. The human runs this; agents don't touch git config.

---

## Data handling

- **Append-only.** Append rather than overwrite; dedup by unique key.
- **Source attribution.** Every record carries its origin (source URL, connector, capture date) so any value traces back.
- **Defensive optional fields.** Null-check before rendering or processing.
- **Null renders as an explicit placeholder** ("N/A", "—") — never a blank element.
- **Empty ≠ broken.** A legitimately empty result (clean audit, no matches) is valid — render an explicit "none" state. An *extraction failure* is a bug — log it and track coverage in `issues.md`. A silent `0` conflating the two reads as "covered everything" when it didn't.
- **Generated output commits with its source.** Seed + baked JSON, or rules + derived `llms.txt`, move together (a bisect must never land on an inconsistent state); assert the match with a test.
- **Capture dates over "current" framing.** Record `captured_at` and surface "as of YYYY-MM-DD"; record `archived_via` when a value came from a secondary/archived source.
- **Don't re-stamp `captured_at` on a re-parse.** A run that regenerates output from unchanged cached bytes preserves the original capture date — load prior dates before processing and only re-stamp genuinely reissued (byte-different) sources. Stamping everything to today churns the audit trail and misrepresents provenance.
- **Keep bounded values, don't drop them.** A bare `\d+%` regex silently discards real rows like `>99%` / `<1%`; parse `[<>~]?(\d+)%`, keep the number, and carry the bound as metadata. Dropping unparseable-but-real values is a silent coverage gap, not a clean filter.
- **Preserve raw values when cleaning.** Normalizing a name/date/location/category? Keep the original in a parallel `*_raw` field — cleaning is lossy, and raw is the only way to debug a bad transform or re-derive under new rules.
- **Cap by content, not count.** Trimming an append-only collection to a fixed count silently drops the oldest valid records. Bound by a content predicate (date window), store everything, limit *display* in the UI (top-N + "show all"). Log a threshold warning; never let the data layer enforce the cap.
- **Quality/confidence is its own field.** Keep geocoding confidence, match certainty, modeled-vs-observed separate from the value — a high-severity record with a low-confidence location differs from a clean one, and conflating them hides the gap.
- **Separate facts, estimates, and judgments** into distinct labeled lanes. A tool may have a view but mustn't manufacture certainty — show the data and mechanism behind a recommendation, never a black-box score.
- **Publication date ≠ capture date.** Store the source's own publish date separately from `captured_at`; show publish when present, else capture. Don't fabricate a date for an undated source — leave it null.
- **Absence of a judgment is meaningful.** An empty curator field (status, verdict) means "not yet assessed," not a default. Don't auto-fill or add a catch-all "unknown" — leave it off so the record reads as it did before the field existed.
- **Contested → show both sides.** When a third party documents a shortfall the subject disputes, tag it "contested" and surface both sources — don't pick a winner. Reserve the strongest adverse status for ≥ 2 independent sources or a citable regulator/court finding.
- **Rates need denominators.** Raw counts mislead across groups of different size. Rank by a rate against an exposure measure (volume, population, length); label any raw-count ranking a triage heuristic, not a verdict.
- **Don't re-identify anonymized data.** Combined records can re-identify individuals. Aggregate small counts before surfacing; don't publish a precise individual narrative unless already public and necessary.
- **AI-synthesized values are provisional.** LLM aggregations from secondary round-ups aren't citation-grade. Audit each against a primary source, stamp `verified_at` + a per-row source; don't ship them as fact.
- **A 200 + a real file is not proof the source backs the claim.** A guessed identifier (docket / order / case number) can resolve to a real but *unrelated* document. Verify the *content* matches (page-1 caption: entity, date, identifier) — not just that the URL loads. Prefer self-proving artifacts (a downloaded PDF with `page_count > 0`) over a metadata-only "verified" flag; the un-fetched escape hatch is the fabrication vector.
- **Survey the real distribution before hardcoding an allowlist.** An exact-match allowlist drops the long tail (casing/prefix variants). Check the actual value distribution first, and filter on a stable underlying type, not the human-entered label, when one exists.
- **Enforce a source-host allowlist in code.** When data must come from authoritative origins, make the loader *raise* on any off-origin URL (e.g. non-`.gov`) — don't trust reviewer vigilance. Test it over every committed seed.

---

## Issue tracking (`issues.md`)

A living audit trail in the project root.

- Each bug: date, area, description, root cause (**code bug** vs. **test bug**), status (Open / Fixed).
- On resolution: the fix + the commit. Check whether a regression test is needed.

## Backlog (`backlog.md`)

- Add ideas immediately — don't lose them. Each: description + priority (low / medium / high).
- Reprioritize periodically; demote stale "high" items rather than let them rot.

---

## Python standards *(when the project uses Python)*

- Type hints on all functions. `pathlib.Path` for paths. `logging`, not `print`, for runtime output.
- All constants in one config module. Pydantic for validation. Python 3.9+ unless specified.
- Pin dependencies with `==` (see Supply-chain hardening for hash-locking).

---

## Frontend standards *(when the project has a web frontend; full system in [DESIGN.md](DESIGN.md))*

- Functional components + hooks only. TypeScript strict, no `any`.
- Colors, enums, constants in a dedicated file — never inline.
- Data transforms in hooks/utils, not components.
- Loading, error, and empty states on every view. Visible focus indicators on every interactive element.
- **Mobile-first**; test at 375px before declaring done. **Touch targets ≥ 44px on touch** — apply the 44px floor under `@media (pointer: coarse)`, so a small inline control (a "show more" toggle, a tag) keeps its natural chip scale on desktop instead of bloating into a CTA next to the lightweight elements beside it.
- **Deduplicate image assets;** `<picture>` + `srcset` for AVIF/WebP/PNG. Never serve uncompressed PNGs for content. **Descriptive `alt`** on every content image.
- **Only load libraries used on the page.** No backend-only deps in read-only frontends.
- **Footer carries attribution + source.** Every published site/page footer links the author's site (**[pranavaraparla.com](https://pranavaraparla.com)**) and the **source repository** on GitHub. Open both in a new tab (`target="_blank" rel="noopener noreferrer"`); on a dark footer the link must stay visibly a link (underline / sufficient contrast). Pair with the "not affiliated / independent analysis" disclaimer where the content could be mistaken for an official source.
- **Responsive CSS, not duplicate DOM trees.**
- **Budget the DOM.** Synchronously rendering thousands of nodes freezes the main thread (38k rows → ~265k nodes). Keep working sets in memory, render only a visible window (pagination + IntersectionObserver sentinel), hydrate in chunks across idle ticks, regression-test the node count. A sentinel can fire repeatedly before layout settles — gate the append on a real scroll-distance check, not `isIntersecting` alone.
- **Lossy visuals keep the value in `aria-label`.** A glyph standing in for a number (checkmark for a count) carries the exact figure in `aria-label` so screen readers and tests still get it. Guard with a test.
- **The `[hidden]` trap.** A `display: ...` rule overrides the `hidden` attribute. Always ship a `[hidden] { display: none }` rule alongside it.
- **The ellipsis trap.** `overflow: hidden` + `text-overflow: ellipsis` silently no-op on a `display: inline` element (a bare `<span>`) — set `block`/`inline-block`/`flex`/`grid` on anything you expect to ellipsis, plus `min-width: 0` on a flex/grid parent so the column can shrink below intrinsic width.

---

## Performance, reliability & bandwidth — measure, don't guess

Ship targets, then track them against real users; Google ranks on p75 *field* data, not lab averages.

- **Core Web Vitals at p75, segmented by page/device/percentile.** The `web-vitals` library reports LCP/INP/CLS for free; beacon batched on `visibilitychange`, sample at high traffic. Synthetic (Lighthouse CI) catches regressions pre-merge, RUM catches what real devices see — run both.
- **Budget page weight + request count, fail CI on regression.** A `size-limit`/bundlesize check per route so a heavy dep fails loud, not silent. Benchmark against the lightest site in the portfolio.
- **Track bandwidth over time** — a 3× jump in transfer size / request count is a regression to investigate. (The reducing levers — AVIF/WebP, tree-shake, code-split — live in Frontend standards; this is about *watching the number*.)
- **Track error rate + uptime.** Beacon client errors (`window.onerror` or the analytics tool) — a spike after a deploy is the roll-back signal. Backends also track request error rate + p95 latency.
- **Put before/after weight + CWV in any hot-path PR.** A number beats "feels fast."

### Website analytics — privacy-first, not GA4

For a content/static site, default to a **cookieless, privacy-first** tool (no consent banner, <2 ms script):

- **Skip GA4 by default** — ~2.5 MB + ~17 ms, cookies/fingerprinting, GDPR-non-compliant in parts of the EU, and consent fatigue drops 40–60% of EU traffic from the data. Use it only when you need its ad-attribution/funnels and accept the weight + banner.
- **Decision rule:** on Cloudflare → **Cloudflare Web Analytics** (free, barebones, samples). Want portability/self-host → **Plausible** (~1 KB, EU-hosted; Umami/Fathom equivalent). On Vercel and staying → **Vercel Web Analytics** (zero-config but lock-in — never the reason to stay). Need deep attribution → GA4. Never proxy a tracker through your own domain to dodge blockers (Security → privacy).

---

## Network ethics & rate limiting *(when fetching from external sources)*

- ≥ 1.5–2s between requests to one host. Informative `User-Agent`. 429 → exponential backoff from 10s.
- Cache all fetched content to disk; re-runs never re-download.
- Persistent block after retries → log to `issues.md` and skip, never crash.
- **Start small** — validate against a handful of pages before a full run.

---

## AI / API cost optimization *(when the project uses LLM APIs)*

- Cheapest model that meets quality (Haiku before Opus). Keyword pre-filter before expensive calls. Truncate/excerpt input.
- Cache responses by content hash; never re-classify identical content.
- Log cost per layer; print a run summary. `--dry-run` and `--fetch-only` work without an API key.
- **Decompose document/comment analysis into auditable subtasks; the quote is the atomic unit.** Don't one-shot a summary over a corpus (comments, filings, documents): **chunk → extract verbatim quotes → bin the quotes against a controlled vocabulary (+ emergent topics) → synthesize each bin into a short name + a description + a stance, from *its* quotes.** Store the prompt + input + output per item (an audit graph) so every tag and summary is inspectable and traces to a source span; a verbatim-quote test guards fidelity (normalize whitespace + tolerate footnote / page-marker splices the PDF text layer interleaves). Run a cheap **deterministic keyword pass first** as the prior *and* the cross-check — LLM extraction runs ~80% precision / ~20% recall (it under-selects vs. an expert), so never ship the LLM pass unaudited; stamp `verified_at`, and let a human edit become a few-shot example (feedback alignment). **The verify/audit phase is the cost sink — push every check you can into code and gate the LLM audit.** A separate audit agent re-loads the whole item (~35K); fold the self-critique into the extractor instead (the body is already in its context, ~8K). Add deterministic checks until the LLM audit only judges what code can't: a verbatim-quote test, a controlled-vocab check, a `lenses = union(bins)` check, and a **style/boilerplate linter** (AI-register words, em-dashes, caption/signature quotes) — that linter alone removed the single most common audit finding. Then spawn an independent skeptic **only on deterministically flagged items** (lens-divergence from the keyword prior, zero/thin quotes, an all-neutral stance) — ~15–25%, not all. Measured: a blanket per-item audit was ~45% of tokens for a 1-in-6 catch rate. (Pattern: PNNL "CommentNEPA.")

---

## Working with AI agents (meta-principles)

- **Research is triggered by a specific gap, not by default.** Resolution ladder for any coding question: grep the repo → read the relevant file → one targeted web fetch → ask the user. Don't run multi-source research sweeps for tasks answerable from the codebase. A full web-research pass costs 20–50K tokens; most code tasks cost under 5K. Fetching more than 2–3 URLs for a single coding task is a signal to stop and ask instead.
- **A faster/cheaper agent run usually *failed*.** A deep-research or workflow fan-out that finishes quicker and cheaper than expected has often died mid-way and returned nothing — confirm the result object is non-empty before trusting the metric. And reserve fan-outs for genuinely open-ended questions: one deep-research pass is tens of subagents and millions of tokens. If you can enumerate the sub-questions yourself, do the work inline (grep → read → one fetch).
- **Context is RAM, not memory.** (Karpathy: LLMs are "fuzzy CPUs.") Fill it with what the task needs — no more. Watch for context poisoning (compounding early errors), distraction (noise burying signal), and clash (contradictory instructions).
- **Early expensive operations compound.** Every tool result is re-fed on every later turn, so a costly turn-2 mistake multiplies all session. Keep early turns cheap, defer heavy work, `/clear` rather than carry bloat. Suppress verbose output by default (pipe to `tail`; read full only on failure) — a re-run re-injects the whole thing.
- **Inline before subagent.** A subagent costs ~25–40K tokens of orchestration; an inline `WebSearch` ~5–10K, a `grep` near-free. Spawn only for synthesis, adversarial verification, or 10+-file exploration; do routine "find X" / "understand this module" inline. In a fan-out the verify phase is the cost sink (~80% of subagents, cache tokens dominate) — lower the verify-claim cap, one vote per well-sourced fact.
- **The cost is in the spawn, so spend the care there — and don't kill a running agent.** Most of a subagent's cost is its setup (context-load + orchestration), paid up front the instant it starts; the generation after is comparatively cheap. Two consequences: (1) **scale the *number* of agents to the task's risk** — "review from 3 personas" is a request for three *perspectives*, not a mandate for three *processes*; for a low-risk diff, review the lenses inline and spawn *one* independent agent only for the adversarial code pass; reserve a true 3-agent fan-out for high-stakes/accuracy-critical work and say why. (2) Once an agent is **already running, the setup is sunk** — `TaskStop` then wastes what you paid and throws away a near-finished result; it only saves tokens on agents that *haven't started*. So "stop when the user flags it" applies to **unstarted** work, not to letting in-flight agents finish. (Killing three ~⅓-done review agents mid-generation = pure loss.)
- **Start fresh on topic switches.** `/clear` between unrelated problems; break complex tasks into small committed steps.
- **AI has no taste.** Review output for: excess try/catch, needless abstractions, bloat instead of refactoring, generic naming (`data`, `result`, `utils2`), comments that restate code, gratuitous emoji or marketing tone. The fix is one thing: **match the surrounding code's idiom** so a diff doesn't announce a different author.
- **AI-sounding prose is a tell too.** Scrutinize shipped words — UI copy, empty states, READMEs, generated narrative — as hard as code. Cut the LLM register (*delve, leverage, robust, seamless,* "it's worth noting"), marketing vapor, rule-of-three padding, hollow summaries. Lead with the specific; short declaratives; read it aloud. Full list in [DESIGN.md § 11.1](DESIGN.md). On drafting: if a paragraph fights back, source more — don't draft more; the struggle means you don't understand the topic yet. Confident first draft, light edit, shelve a weak one rather than sand it down.
- **The four agent failure modes** (Karpathy), each already a rule here: (1) unverified assumptions → surface tradeoffs, ask first; (2) abstraction hypertrophy → minimum code; (3) collateral changes → touch only what the task needs, log adjacent cleanup in `backlog.md`; (4) no success criteria → define "done" and loop until verified.
- **AI is a tool, not a substitute for discipline.** Apply the fundamentals — perf audits, bundle analysis, review — to generated code. High LOC means nothing if it's bloated.
- **Vibe coding for throwaway; engineer the rest.** The moment a user depends on it, you owe it *agentic engineering* (vibe coding raises the floor; this raises the ceiling). Litmus test: **can you defend the output** under review? If not, you're still vibe coding.
- **Intent specification is the new coding.** The unit shifts from typing lines to delegating macro-actions; the scarce skill is judgment — what to delegate, how to specify, how to review fast. Write non-trivial logic as a prose spec first (trigger, inputs, mechanism, success criteria). **LLMs automate what you can verify** — build the feedback loop first.
- **Make instructions agent-legible.** Setup/deploy/run steps as copy-pasteable markdown blocks, not brittle scripts. Document the APIs, CLIs, and logs an agent can sense and drive — the more it can sense and drive, the more it closes the loop unattended.
- **Closed-loop validation** is the biggest force multiplier: when the agent can answer "did it work?" itself, every iteration is fast.
- **Keep this file current.** Append concise notes when something surprises you (a failed pattern, a correct invocation, a quirk). This is scar tissue — grow it, don't rewrite it.
- **Log every session's agent + token use.** Keep a running audit trail in the project's `agent-runs.md`: subagent/workflow runs with their `usage` stats, and inline main-loop sessions with tool-call counts + a short efficiency note (exact main-loop token totals aren't self-observable — report what is). One row + a few lines per session, appended not rewritten, so the "where did the tokens go, was the fan-out worth it" question always has a continuous record. Do this as part of wrapping up work, alongside `issues.md`/`backlog.md`.
- **Write big plans to files.** Spec large tasks to a `docs/` markdown file and review before executing.
- **Sweep for orphaned wrapper shells after long-running commands.** A background polling wrapper (`until ps -p $(pgrep -f "...")...; do sleep N; done`) can outlive its process: once the PID exits, `pgrep` returns empty and the `until` loop never resolves, sleeping forever. Run `pgrep -fl "<project-path>"` before declaring done and `kill` stragglers. Fixes: prefer a Monitor tool over inline polling, or invert to `while pgrep -f "..."; do sleep N; done` so the loop exits when the process disappears.

---

## Universal lessons learned here

> Mirrors the canonical `coding-best-practices/CLAUDE.md`. Written here too because this is the file
> that loads into context when working in this directory.

### 2026-07-28 (news refresh: 4-phase plan → self-review → bot review)

- **A section added to a module but not to its explicit export list is silently `undefined`, and tests over it pass vacuously.** The `tracks` registry went into the `data.js` IIFE but not its `return {…}` list. Nothing errored: consumers read `D.tracks || {}` so the UI rendered zero cards with a clean console, and the new tests iterated the same empty object and passed over nothing. Caught only by counting rendered DOM nodes. **Adding a section to `data.js` is two edits, never one** — and **any test that iterates a collection must first assert it is non-empty**, or "nothing violated the rule" is indistinguishable from "there was nothing."
- **Derive cache-busting tokens from content; "keep in sync by hand" is not a mechanism.** One hand-typed `?v=` shared by five assets went unbumped while a PR replaced three of them (found by the bot reviewer, not by the suite). The real risk is not staleness but **skew**: a partial cache hit serves an old `app.js` against a new `data.js`, which renders as a data-shape bug that reproduces for users and never locally. `tools/stamp-assets.mjs` now derives each token from that file's sha256 with a sync test. A literal can never hold its own file's hash, so anything needing its own version reads it at runtime off its `<script src>`.
- **When you work around a caching artifact locally, ask whether the deployed artifact has the same bug.** Browser-cache staleness hit three times in one session and was dismissed as environment noise each time (the fix being to load `127.0.0.1` instead of `localhost`). The identical bug was in the shipped HTML the whole time. A local cache workaround is a signal about the cache strategy, not a quirk to route around.
- **One piece of state, one source of truth, especially for URL state.** `pendingTimelineTrack` was cleared in only one of two consuming paths, went stale on the other, and outvoted the live filter when writing the hash, so the URL disagreed with the rendered rail and a copied permalink pointed at the wrong track. If the URL is authoritative, nothing may quietly outvote it.
- **A site that bot-blocks its HTML often leaves its API and full-text endpoints open.** `federalregister.gov` 302s automated HTML fetches but serves `/api/v1/documents.json` and `/documents/full_text/text/…txt` cleanly. That converted a snippet-only claim into a primary-source-confirmed one. Before recording a source as unreachable, try its API, its full-text endpoint, and its own listing URL.
- **Self-review adversarially, and still expect the independent reviewer to find the class you were blind to.** Self-review found a real correctness bug; the bot then found a P1 in the deploy/caching layer, the one place attention never went after a session spent inside application logic. Weight an independent finding *higher* when it lands outside the area you were working in.

### 2026-07-28 (same session, SEO + deploy half)

- **Audit what is actually SERVED, not what the head tags claim.** Every SEO basic here was already correct while the served HTML carried **113 words**: six empty panels filled by `app.js`. Strip scripts and noscript from the raw HTML and count words before concluding anything about SEO. Baking a summary from the same `data.js` took it to ~1,700, which is progressive enhancement rather than cloaking because the baked text is a strict subset of what the app renders and is never hidden from users.
- **A JS app with hash-routed tabs is ONE indexable URL.** A fragment is not a separate URL, so every docket competed for a single result. Sections with distinct substantial content need real URLs; the thing that makes bulk generation backfire is duplicate content, so assert every page has a distinct title, description and body.
- **A declared capability with no backing asset fails silently.** `twitter:card=summary_large_image` was set with no `og:image` at all, so shares unfurled blank and nothing would ever have surfaced it. When a tag declares something, verify the asset exists and matches the declared dimensions.
- **When two generators write one file, one must own the whole output.** `build-docket-pages` emitted HTML that `stamp-assets` then rewrote, breaking "generated == committed". The page generator now calls the stamper itself. Any regenerate-and-diff contract breaks the moment a second pass touches the artifact.
- **Generate whole, don't patch, anything that enumerates.** The regex-patched sitemap kept stale entries when pages were added. It is now regenerated entirely, with a test that walks every listed URL and asserts it resolves.
- **Third-party verification reads PRODUCTION, so branch work cannot satisfy it.** Search Console verification and sitemap submission both fetch the live site, which on GitHub Pages is the default branch. Check what is deployed *before* starting any external verification flow; discovering it mid-flow means stopping to ask for a merge decision that should have been surfaced first.
- **A freshly submitted sitemap reads "Couldn't fetch".** That is the pre-processing state, not an error. Verify the artifact independently (200, `application/xml`, valid XML, expected URL count, robots not blocking) and re-check in days. On a Pages *project* site `robots.txt` sits under the project path but crawlers read the user-site root, so it documents intent and little else.
- **Never delete an ownership-verification artifact** (`docs/google1a32de6a02a9a6e0.html`, the `google-site-verification` meta tag). Removing what a service verified with un-verifies the property silently. Two methods are live so either alone survives an accident.

### 2026-08-03 (news refresh + commissioner-quote audit + RTO/ISO comment views)

- **eLibrary's Cloudflare gate falls to the same Control_Chrome bridge already proven for RM26-4, and it generalizes cleanly.** Opened `docketsheet?docket_number=<any of the six §206 dockets, E-2, or AD26-7-000>` in the user's authenticated Chrome and read real rows every time — 100+ filings per docket, paginated with `button[aria-label="Next page"]`. A targeted regex filter over the description column (`execute_javascript` scanning for `Abeyance|Rescind|Extension` or `Informational Report`) finds a specific filing type across a 150-row docket in one call instead of dumping everything. This closed REFRESH.md's long-standing open item ("only ISO-NE's 30-day report observed") for all six at once, and found that PJM plus its TOs filed for abeyance five days before the Aug 3 deadline everyone else used — a fact no press source had yet.
- **`commishPages[key]` is the headline pull-quote's page, not the statement's start** — Rosner's PJM statement runs pp. 90–98 but `commishPages.rosner` is 93. An extraction script that used it as a section boundary bled one commissioner's text into the next one's. Locate a statement by its own `"NAME, ROLE, concurring:"` header text, never by a citation field.
- **Three of five commissioners' concurrences are verbatim across all six orders; a fourth (Chang) has one footnote; the fifth (LaCerte) is genuinely, systematically tailored — and my first two attempts at verifying this were each wrong in opposite directions.** *(This entry replaces an earlier draft of itself written mid-session, which claimed "4 of 5 fully identical" — that claim was itself wrong; see below.)* `tools/verify-commish-tailoring.mjs`'s original `carries()`-only check (an LCS-based "does this ~60-char run appear somewhere in the target" test, borrowed from `verify-quotes.mjs`) reported LaCerte "fully verbatim." A PR review caught it: `carries()` proves a sentence is *present*, not *identical* — "I expect PJM to design proposals" and "I expect CAISO and/or the Participating Transmission Owners to design proposals" share long runs on both sides of the swapped phrase and both pass a presence-only check, even though they are not the same sentence. Confirmed directly against the raw order text: LaCerte's statement names the respondent RTO in ~4 sentences per order, every time. The overcorrection: rewriting the check to require exact sentence-for-exact-sentence matches instead. That failed the OTHER direction — different orders have different total page counts, so identical prose gets interrupted by page-break/footnote artifacts at different points per order, and exact-matching flagged dozens of genuinely-identical sentences as "modified." Reverted. **The actual fix was narrower than either extreme: keep the proven fuzzy/bidirectional check as the general safety net (it's good at what it does — whole-sentence additions and omissions), and verify LaCerte's *specific, confirmed* pattern with a targeted, direct check (does his statement in each non-PJM order still contain the literal token "PJM" outside two known, invariant citation references?) rather than trying to build one general-purpose classifier that has to get both directions right at once.**
- **A docket-level override field and an additive aside field are NOT interchangeable, even though both live on a docket entry and both feed `commishBlock()`.** `commish` (built for E-2, where only Chang wrote separately) *replaces* the whole five-commissioner list — reusing it for E-10 (all five wrote; only Chang has extra text) would have silently hidden the other four. The new `commishAside` field layers onto a commissioner's normal row instead. Caught before shipping by reading `commishBlock()`'s actual filter logic, not by assuming the existing pattern would just work.
- **One general-purpose research agent, one Explore agent, same session: the general-purpose one hit the account's session API limit after 59 tool calls / ~239K tokens and returned nothing usable; a small Node script reusing the project's own `carries()`/`loose()` matcher did the same commissioner-quote verification in minutes, for a few thousand tokens.** Exact-verification tasks over a small, known corpus (compare N documents precisely) belong inline as code, not delegated to an open-ended research agent — the Explore agent, by contrast, was the right call for genuinely open-ended "map this unfamiliar subsystem" research (the RTO/ISO comment architecture) and returned a complete, accurate, well-cited report. Match the tool to whether the task has one exact right answer or needs judgment across an unfamiliar space. Caveat added after the same session: inline verification isn't automatically correct just because it's inline — the `carries()`-only check above was also written inline, and was wrong. The lesson is about *delegation*, not a substitute for adversarial review of your own work either way.
- **An independent PR review is worth running even on your own thoroughly-self-checked work — it found the session's single most important bug.** Everything above the "verbatim" claim had already passed a from-scratch rebuild, a bidirectional check, 109 automated tests, and direct manual grep-verification of specific examples — and it was still wrong, because every one of those checks shared the same blind spot (sentence-presence, not sentence-identity). A reviewer with no stake in the existing approach re-derived the claim from the raw text with a different method (word-level LCS) and found what all the same-method re-checks couldn't. Confirming a finding independently (as done here, by grep, before touching any code) is still essential — an adversarial review can itself be wrong — but the review's *method being different from the original work's method* is what let it see past the blind spot.

---

## Influences

- **Andrej Karpathy** — "make it work, then make it good"; LLM-as-fuzzy-CPU; eval-as-the-loop ("LLMs automate what you can verify"); context over prompt engineering; the closed-loop bar for trustworthy agents; the 2026 shift from vibe coding to *agentic engineering* (intent spec + task decomposition) and the four failure modes (unverified assumptions, abstraction hypertrophy, collateral changes, missing success criteria).
- **Pieter Levels (levels.io)** — ship fast and ugly; boring tech beats shiny; solo-friendly defaults (vanilla, SQLite, single-file, cheap hosting); profit before scale; don't add a dependency you can't maintain alone; talk to users daily.

When in doubt: **ship the smallest version that works, then iterate on what real users do, not what you imagine they'll do.**

### 2026-08-23 (refresh: the clock stopped, a comment-analysis audit, two review passes)

- **Silent success is a bug class, not a one-off: any branch that treats "nothing to do" the same as
  "done".** Four instances in a single PR review. `extract-abeyance-docs.py --check` counted every
  document as "unchanged" when the download directory was empty, printing `12 unchanged` and exiting 0
  having compared nothing, which is the command REFRESH.md documents as the proof that committed text
  still matches its source. `news-sweep-plan.mjs --check` with no operand printed a plan and exited 0;
  `--queries` with a bad value emitted an empty plan and exited 0; a malformed `"https://"` passed the
  URL prefix test, threw inside `new URL()`, and was swallowed by a `catch` assuming the error was
  already recorded. **Fix shape, every time: count what was actually verified, make an empty count an
  error, and print the count on success too** so the zero case is obvious the moment it happens.
- **Blast radius is the whole consumer set, not the diff.** `procStatus()` was made reset-aware; the two
  changed lines were right and two untouched functions one call away were wrong, because they read
  `.s.date` back off the object the helper had just reinterpreted. The masthead announced a date six
  days in the past as "Next deadline" on every tab and ten policy-map rows read "Aug 17, 2026 ·
  Upcoming", with 119 tests, the quote sweep and the staleness checker all green. **After changing what
  a shared derivation means, grep every reader of its output.**
- **A superseded date is a new field, not an overwrite.** `procedural.steps` is the order's own
  arithmetic and a test enforces issuance + the stated period, so rewriting `date` to the abeyance date
  was rejected — correctly. The shape that works is `revised: { date, by, note, src }` plus one
  `stepWhen()` helper that every derived surface consumes: status, the "next" pick, filing-matrix cells,
  `check-staleness`. Without it the matrix would have accused six RTOs of missing a deadline FERC itself
  moved. **And the per-docket exception needs its own path** — SPP got 95 days rather than 90, so
  `filingCell` and the staleness checker read `d.abeyance.due` where a docket has one, or SPP reads as
  delinquent for the three days between Nov 16 and its own Nov 20.
- **Keep the tool that FOUND the defect, not only the one that now prevents it.** The 268 comment
  summaries passed every check we had; the four defects were found by a throwaway script printing
  distributions. Three became hard checks in `validate-summaries.mjs` and the script went to `/tmp`.
  It is now `tools/survey-summaries.mjs`: a should-be-zero set at the top, distributions below that are
  deliberately not asserted. The validator is the gate; the survey is how the next unknown defect
  becomes visible.
- **A manual check run more than twice is a missing test.** Timeline chronological order was verified
  with an ad-hoc `node -e` four times in one session and hand-fixed four times. Now two tests, with the
  real exception recorded: span events (`date: "Dec 2025 to Jun 2026"`) carry an iso that is a placement
  hint, not a moment, so they are exempt.
- **A search agent's quotes are accurate; its characterizations are not.** It rendered Utility Dive's
  own sentence (`The PJM Interconnection's "status quo is really untenable,"`) as a whole sentence
  attributed to LaCerte, and called the Maryland delegation's letter a request for "retroactive" relief,
  a word appearing nowhere in it. Verify the frame around a quote, not just the span. It also returned
  two findings that were already on this site, because the sweep plan listed known *hosts* and
  utilitydive.com was one — dedupe by exact URL and by already-captured quote text.
- **The two review passes found disjoint sets.** The prose-reasoning reviewer found the live rendering
  bugs in untouched code; the automated reviewer (Codex) found four silent-success paths in the CLI
  tooling, the class a human skims because the tool works when run normally. Run both when a change
  alters what a shared value means.
