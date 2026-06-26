# AGENTS.md — How to work in these repos as an AI agent

> Base file for every project in this folder. Project-specific `AGENTS.md` files extend this with file maps, settings keys, and project-specific conflict cheatsheets. When project conflicts with base, project wins — it's the local source of truth.
>
> Companion files: [CLAUDE.md](CLAUDE.md) is the *what* (principles, architecture, editorial rules); [DESIGN.md](DESIGN.md) is the *look*.

---

## Read these first, in order

Before touching code, read:

1. **[CLAUDE.md](CLAUDE.md)** — universal principles + project-specific intent and editorial rules. The "Project intent" and any project-specific notes are load-bearing for every change.
2. **[DESIGN.md](DESIGN.md)** — visual + content system. Touch this before changing how data is presented.
3. **`backlog.md`** (or `BACKLOG.md`) — what's next. Pick from here; don't invent work.
4. **`issues.md`** — what's broken. Check before reporting a bug as new.
5. **`security.md`** — supply-chain advisory log. **Refresh if `Last updated` is > 7 days old before any `npm install` / `pip install` / dep upgrade.** Also fetch `https://pranava0x0.github.io/vibe-coding-security/llms-ctx.txt` and surface any matching advisory before suggesting an install.

---

## The Explore → Plan → Code → Verify loop

Documented in detail in [CLAUDE.md](CLAUDE.md). Concretely inside any repo:

- **Explore.** Use `grep`, `find`, or an Explore agent to find relevant code. Most projects here are small enough that a single read of the main module + the data schema covers ~80% of the surface.
- **Plan.** For anything beyond a one-line fix, present 2–3 approaches with pros/cons before writing code. Changes that touch the data schema, the editorial rules, or the visual identity ALWAYS need a plan surface — they reshape the product.
- **Code.** Edit existing files first; only create new files when the task genuinely requires it. No new helpers for one-shot operations. For any non-trivial rule or logic, write the spec in prose first — trigger, inputs, mechanism, success criteria — then implement against it.
- **Verify.** Run the test suite. Use the feature in a browser (or invoke the CLI) before declaring done.

**Research budget.** Web searches and multi-source fetches cost 20–50K tokens and minutes of wall-clock; most coding questions are answerable from the repo in seconds. Work through this ladder before going online:

1. `grep` / `find` in the repo.
2. Read the file(s) that showed up.
3. One targeted WebFetch if the local code points to an external spec (a library's changelog, an API schema, a referenced RFC).
4. If still stuck, state the specific gap and ask — don't run a broad web sweep.

Reserve deep web research for tasks the user explicitly frames as research. Don't spawn multi-source research agents (WebSearch + multiple WebFetch + synthesis) for tasks that are answerable from the codebase. If you find yourself fetching more than 2–3 URLs for a single coding task, stop and ask.

**Per-item cadence in multi-item sessions.** Surface design questions up front, then do **tests + docs + commit per item**, not batched at the end. Catches issues early and produces a clean bisect history.

---

## Token economy

The context is RAM, and every tool result is re-fed on every later turn. Cheap habits compound:

- **Inline before subagent.** A subagent costs ~5–40K tokens of overhead; don't spawn one to grasp a small project's structure or do a bounded lookup — 1–2 targeted `grep` / `node -e` / `WebSearch` calls beat it. Spawn only for 10+-file exploration or synthesis.
- **For "where is X?" on a greppable codebase, grep first.** A literal `grep -rn` is *exhaustive* where a semantic Explore run silently misses call sites (one missed a downstream re-sort a grep would have caught). Don't send an agent to analyze data you already control (your own JSON/CSV/code) — inline `grep` + a Python one-liner is faster, cheaper (~1–2K vs ~30K), more exhaustive, and iterable where a frozen agent snapshot isn't.
- **Verify a subagent's "complete" list against a grep before acting on it for mechanical changes.** Agents report what they *noticed*; grep reports what *exists*. For every-call-site / every-reference edits, the agent's list is a lead, not a guarantee.
- **Model-select per subagent.** Simple gathering (grep, file listing, schema validation) → `model: "haiku"` (~20× cheaper). Multi-source synthesis (web research, code review, gap analysis) → Sonnet. Reserve Opus for genuinely open-ended work where Sonnet visibly underperforms.
- **Every spawn prompt carries a scope limiter.** At least one of: "report in under N words," "no more than N web searches," "read only the N most relevant files," "return the top N." Without one, Explore reads every file and a web agent fetches 20+ full pages. Default Explore breadth to `"quick"`, not `"very thorough"`.
- **Spend down a token budget out loud.** At ~50K tokens consumed in a single turn, pause and offer proceed / scope-down / abort rather than silently burning the budget.
- **Size a fan-out to the user's *session* budget, and STOP when told.** A multi-agent run can hit the 5-hour rate limit, which locks the user out for the rest of the window — a real cost. Run large corpus jobs in **small, disk-resumable chunks** (≈3–10, not 40); report token spend per chunk; pause for an explicit go-ahead. When the user flags budget, `TaskStop` in-flight work — "it's already running" is *not* a reason to let it finish; the not-yet-started agents are still saveable. (One run launched 40 comments ≈ 1M tokens against a ~9% budget, didn't stop when warned, and hit the wall at comment 23.) See [[respect-session-budget]].
- **Haiku saves dollars-per-token, not token *count*.** On the verbatim-quote extraction it cost ~46K/agent — about the same count as Sonnet — and looped more on the validate→fix cycle (~25 tools/agent). Use it to lighten a model-weighted budget, but don't assume it shrinks the job; the per-comment **floor (~25–30K)** only drops by **batching several short items into one agent**.
- **WebSearch snippets usually suffice.** For "search X and add it," the snippet typically carries every field. WebFetch only for a missing field, never secondary analysis; cap at one fetch per entity.
- **Read the slice, not the file.** `grep -n` + `offset`/`limit` over whole large files; when N files share a structure, read one representative.
- **Suppress verbose output by default.** Pipe noisy scripts to `tail` / a summary; read full only on failure — a re-run re-injects the entire output. Validate inputs before triggering, don't recover after.
- **Check enum/ID constraints before writing.** Look up the live allowed `category` / `theme` / enum set first; an invalid value forces a fix-and-re-commit loop. Never guess enums from memory.
- **Don't read background-agent transcript files.** Use the completion-notification result, not the raw `tasks/*.output` JSONL — reading the transcript dumps the whole agent run into your context.
- **Confirm work isn't already done before re-running.** After a context reset, check that a research file / agent result doesn't already exist before re-spawning; re-running completed agents silently burns 50–70K tokens.

---

## Running research & multi-agent fan-outs

Reserve fan-outs for genuinely open-ended research (see [CLAUDE.md → Working with AI agents](CLAUDE.md) for whether the task needs one at all). When it does, these rules keep the run cheap and the results clean:

- **Size to the shelf.** Ask for exactly the N records the destination surface holds, ranked — never "find as many as possible." A specified count makes the agent stop instead of over/undershooting.
- **Partition entities across agents.** Each entity (person/org/sector) belongs to exactly one agent; hand each a "covered elsewhere, skip" list. Cross-agent duplicates are a partitioning failure, not a dedupe chore.
- **Seed then spawn.** Fix the JSON contract (field names, id shapes, enums, edge cases) with cheap inline searches first, then bake it into each agent prompt. Debugging a schema across N live agents costs N×; proving it once inline yields zero parse/retry loops.
- **Pre-flight the agent's premise against your own data before spawning.** A ~1-minute local `grep` can disprove the hypothesis a finder agent would be launched on — one run burned ~85K tokens chasing a format assumption a local grep contradicted (it returned `[]` *and* contradicted the project's own working parser). Check the cheap local signal first; it's near-free.
- **Batch research agents by breadth, not by unit.** One agent covering 8–10 entities/states beats eight single-entity agents — each agent re-loads the system prompt + tool schemas. Sequence agents only when a prior result genuinely informs the next direction; don't fan out in parallel "to be thorough."
- **Record exhausted / walled seams durably** (backlog + a `data-sources.md`) so no future session re-spends an agent re-confirming the same dead end. A confirmed-negative is a real deliverable — note *why* each seam is dead ("corpus X exhausted," "host Y 403s scripts → browser-capture only," "source Z is image-only scans → needs OCR"), and distinguish a closeable gap from a permanent source-side dead-end.
- **Validator bar + early bail as a hard prompt constraint.** Put required fields in the prompt with "2 searches without them → return `skip: true`," or agents grind on unfindable records and return junk rows.
- **Agents write to disk, return a summary — non-negotiable.** Subagents are isolated per spawn, so research an agent doesn't write is *irrecoverable* once it returns. Require it to Write JSON to `data/research/`, verify the file landed, and return just path + count + 2–3 surprises (~100 tokens); embedded JSON blobs bloat the orchestrator and aren't auditable. An **"export the prior agent's data" task is a smell** — a fresh agent never had it either, so you only re-research from scratch (one case wasted ~180K tokens; ~40% of research tokens go to this). The bug is upstream: the original prompt didn't write. Agents return *candidates*; integration, cross-record linking, and commits happen in the main session.
- **Cap sources at 2 per claim** at collection time; deeper citation chains are a separate curation pass.
- **Spell out the output contract:** plain UTF-8 (no HTML entities), omit conditional keys rather than emit empty strings, "your final message is parsed, not read," "cite only URLs you fetched" (else agents cite snippets, ~5% dead). Updating records? Paste the exact ids to echo back — prose gets invented slugs back.
- **Cap search angles (~6) and give a stop rule** ("stop after N verified items, or 2 consecutive angles surface nothing new"). Breadth of angles, not result count, drives waste — 12+ angles cost ~2.7× for identical quality.
- **The final report states absences, not just hits** — what it found, what it couldn't verify, and what it deliberately excluded. A report that lists only successes hides coverage gaps.
- **Strip three recurring defects on integration:** placeholder/empty fields (recover from the source URL or drop the row), cross-agent duplicates (dedupe, pick one category deliberately), and prose contamination (agents prepend "All verifications complete…" despite instructions — drop non-data lines).
- **Workflow-authoring gotchas (this repo's path has spaces).** `Workflow` `args` can arrive as a JSON *string*, not an object — parse defensively: `const A = typeof args === 'string' ? JSON.parse(args) : (args || {})` (a first launch returned `{error:"no accs"}` from this). And a script's main-module guard must be `fileURLToPath(import.meta.url) === process.argv[1]`, **not** `import.meta.url === 'file://'+process.argv[1]` — `import.meta.url` percent-encodes the spaces in `…/FERC Show Cause Orders/…`, so the string compare silently fails and the CLI body never runs (the validator printed nothing until this was fixed).

---

## Evaluate every agent run

When a subagent/background task returns, do a 30-second retrospective before consuming the result:

- **Reason** — was an agent right, or would 2–3 inline `grep`/Python calls have done it?
- **Cost** — flag anything over ~40K tokens per useful result.
- **Result** — used downstream or wasted? Did it survive verification (grep the "complete" list, confirm the result isn't empty)?
- **One improvement** — fold the lesson into a *file* (prompt template, `data-sources.md` dead-seam note, backlog entry), not just this reply. If the correction applies to the next run, it doesn't belong only in your head.

A solo turn with no spawn has nothing to evaluate — say so rather than invent analysis.

---

## Verifying changes

Default verification matrix (project-specific `AGENTS.md` should override with concrete commands):

| Change kind                    | Run                                                  |
| ------------------------------ | ---------------------------------------------------- |
| Schema edit                    | Schema-validation tests (Pydantic / zod / etc.)       |
| Seed / data edit               | Refresh script + data-integrity tests                 |
| Shared vocabulary change       | Match-frontend-to-backend test                        |
| Frontend (markup / styles / JS) | E2E / Playwright suite, or manual UAT in browser     |
| Connector / fetcher            | Connector unit tests + a small live integration run  |
| Dependency install / upgrade   | Advisory sweep + lockfile diff + full build/test      |
| Design tokens / styles         | Contrast + visible-focus check at mobile and desktop  |
| Anything substantial           | Full test suite (`pytest` / `npm test` / `vitest`)   |

**Narrowest meaningful test first, then broaden.** Run the test closest to the change for the fast loop; escalate to the full suite only when the change has cross-cutting risk. Don't pay full-suite latency on every iteration, and don't skip it before declaring a substantial change done.

**For UI changes**, also run the app locally and click through the affected views — type checks and unit tests verify code correctness, not feature correctness. Two screenshots — 375×812 and 1280×800 — settle a UI fix; more than that is token waste unless the change is genuinely complex.

**For data changes**, diff the canonical output (`docs/data/*.json` or equivalent) and skim the diff before committing. A 30-second skim catches regressions tests miss (especially around character encoding, pretty-printer drift, and unintended fields).

**Never use an agent to review a live UI.** Static-analysis agents read HTML/JS but can't start a server or run JavaScript — they give confidently wrong answers about dynamic behavior (declaring a working JS-rendered feature "dead"). Use `preview_eval` / `preview_snapshot` / `preview_screenshot` directly: faster, ~3K vs ~40K tokens, and actually correct.

**DOM-count before screenshot.** For any DOM-rendering change, make a ~100-token element count (`querySelectorAll('.x').length` via `preview_eval`) the *first* verification step — it catches blank-because-scrolled viewports and stale-cached-JS that screenshots and unit tests miss. Screenshot only once the count is right, and **reload the preview after a rebuild** first — an open tab shows stale data until reloaded.

**Run a build/codegen script twice to assert idempotency** — the second run must inject identical bytes.

**Spot-check source URLs by status** before committing externally-sourced records: `curl -s -o /dev/null -w "%{http_code}" -L -A "Mozilla/5.0..." <url>`. A 403 (bot-blocker) is inconclusive — keep it; a 404 is dead — drop or replace.

---

## Common tasks

### Adding a record / claim / row (most common)

1. Open the seed file (typically `data/seed/<entity>.json` or equivalent).
2. Append one record with: stable `id`, real `source_url`, verbatim content, today's `captured_at`, and any required category from the canonical list in the schema module.
3. Run the refresh script (validates + writes the build output).
4. Run the relevant data-integrity test to confirm.
5. Commit. Seed JSON and build output `data/*.json` move together — never in separate commits, or a future bisect lands on a broken state.

### Adding a feature

1. Confirm it's on `backlog.md`. If not, propose adding it before building.
2. Sketch the smallest version that closes the user need end-to-end.
3. Build that. Add tests alongside. Use the feature in the browser / CLI.
4. Commit at the natural boundary (per module, per fix, per doc update).

### Adding a new vocabulary item (theme, category, tier)

This is a schema change. **Don't do this casually.** Steps:

1. File a `backlog.md` entry first explaining the gap.
2. Add to the canonical constant in the schema module.
3. Mirror in any frontend mirror constant (the test that asserts parity catches drift here).
4. Add any color / icon / label token to the design system (light + dark variants).
5. Migrate any existing records that should map to the new entry — or intentionally leave them.
6. Run the full test suite — drift-safety tests should catch a missed mirror.

### Adding a connector (per-source scraper)

1. Subclass the project's `Connector` base class.
2. Register in the connector index module.
3. Implement `fetch_records()` / `normalize()` / `cache_key()`.
4. Set `run_order` so enrichment connectors run *after* their producers.
5. Schema-validate emitted records; tests catch any new field that the schema's `extra="forbid"` would reject.

### Handling PR review comments

A PR in **"COMMENTED"** state means action required, not FYI. Fetch full review bodies (not the summary line), treat any user-provided link as authoritative, extract a checklist of each distinct issue, and verify the specific flow each names — not just the happy path. The merge is the start of addressing feedback, not the end.

### Driving a browser to scrape (Chrome / Playwright MCP)

Concrete gotchas that aren't obvious until you hit them:

- **No top-level `await` in `javascript_tool`** — wrap calls in an async IIFE.
- **`window` globals don't survive a cross-domain navigation** — stash state in `localStorage`.
- **A selector inside a `[hidden]` container needs `state="attached"`**, not the default `state="visible"` — `display:none` removes the element from the box model, so a visibility wait times out.
- **Auth differs per source** — some need a logged-in browser session first; public APIs don't. Note the requirement per source in the project `AGENTS.md`.
- **Bulk file downloads via hidden iframes need the host's *automatic downloads* permission** (Chrome: `chrome://settings/content/automaticDownloads`). Without it an iframe `a.click()` finds the link and "succeeds" but nothing lands — Chrome's multiple-download protection blocks it silently. Keep the worker pool small (2–3): concurrent SPA bootstraps starve the renderer and ~25–30% miss the render-wait; retry the failures at lower concurrency, then a 1-worker pass for the tail.
- **Two gov-portal filename quirks corrupt a download silently:** a `;` in the name is truncated at the Content-Disposition separator (losing the extension — heal from the PDF magic bytes), and some portals append a `" *"` marker to link labels (strip it before an ends-with extension match). Afterwards, validate the corpus against its *inventory* — every inventoried item has a body on disk with real extracted text — not against a count. A clean count is not a clean corpus.

### Running an auditable LLM analysis over a corpus

Decompose, don't one-shot (rationale in [CLAUDE.md](CLAUDE.md) → AI/API). For a corpus of comments / filings / documents:

1. **Cheap deterministic pass first.** Keyword-tag each item against the controlled vocabularies — this is the prior, the cross-check, and the filter that holds the LLM bill down.
2. **Per item, a subagent:** chunk → extract verbatim quotes → bin the quotes → name + describe + stance each bin. Force strict JSON to a committed schema; write one file per item under the source tree (the audit graph). The quote is the atomic unit.
3. **Validate.** A verbatim-quote check (normalize whitespace; tolerate footnote / `--- PAGE N ---` splices the PDF text layer interleaves), plus schema + bin/quote-ref integrity. Stamp `verified_at` — the LLM pass is provisional until a human audits it.
4. **Aggregate** into the site data and regenerate. Scale by fanning out (one subagent per item) **only with explicit opt-in** — it's a large, billable run; build + validate on a gold subset first, then scale.

**Cost structure (measured on the RM26-4 comments, 2026-06-25 — `agent-runs.md`).** The verify/audit phase is the cost sink; spend there last and deterministically.

- **Fold self-critique into the extract agent; don't spawn a separate audit agent by default.** A fresh audit agent re-reads the whole body (~35K); a self-review step where the body is already in context costs ~8K. The pilot's blanket independent audit was ~45% of tokens for a 1-in-6 catch rate, and that one catch was a banned word a regex finds.
- **Move every check you can from the LLM to code.** `tools/validate-summaries.mjs` does verbatim-quote coverage + vocab + `lenses = union(bins)`; it also runs a deterministic **style/boilerplate linter** (AI-register words, em-dashes, caption/signature quotes) that caught the most common audit finding for free. Each deterministic check subtracts from what an LLM audit must do.
- **Gate the independent audit on a deterministic flag** (`tools/flag-summary.mjs`): lens-divergence from the keyword prior (narrowed so a national filing that name-drops every RTO isn't flagged), zero/thin quotes, an all-neutral stance. Only ~15–25% need a fresh skeptic; the rest ride on self-critique + the linters + a final human pass (`verified:false`).
- **Use the lean default workflow subagent, not `general-purpose`** — its heavy system prompt is re-fed every tool turn. (Probe it for Bash/Write/Read/Edit first. The per-agent floor is still ~30K even for trivial work — the floor is system prompt + reasoning — so batch breadth and tight prompts still matter.)
- **Tight quote spans (one sentence or a clause) validate cleaner** than paragraphs — they dodge the footnote / `--- PAGE N ---` splices that drop verbatim-coverage below threshold and trigger fix-retry loops (one loose-quote extract cost 2×: 75K / 4m37s vs ~37K).
- **Each worker self-loads its row** from a committed work-list (`node -e "…find(r=>r.acc===…)"`) instead of the orchestrator transcribing 260+ rows into `args` — the script has no fs access, and an LLM re-emitting the list drops rows.

---

## What NOT to do

- **Don't paraphrase quoted content.** Quote verbatim into the `statement` / `quote` / `body` field. Tests catch obvious markers ("they claim that…").
- **Don't write product copy in the AI register.** Headings, button labels, microcopy, empty states, and any prose that ships avoid the model tells — *delve / leverage / seamless / robust*, "it's worth noting that", marketing vapor, rule-of-three padding, hollow summaries. Plain, specific, human: lead with a number or a name, short declaratives, no ceremony. Full list in [DESIGN.md § 11.1](DESIGN.md).
- **Don't add a record without a real `source_url`.** Schema rejects it; reviewers reject it harder.
- **Don't LLM-classify subjective editorial calls.** Stance, sentiment, framing — these are curator-only. A wrong tag undermines the whole product.
- **Don't aggregate to a "trust score" / "credibility index" / "greenwashing score."** Show the data; let users judge.
- **Don't introduce a new framework / library / build tool** mid-project. If the stack is vanilla JS + Pydantic + Playwright, stay there. Adding React / Vue / Svelte / Webpack contradicts the static-first principle and adds maintenance debt the project doesn't pay back.
- **Don't touch `docs/data/*.json` (or equivalent build output) directly.** Edit the seed and re-run the refresh script.
- **Don't push scraper / refresh output straight to `main`.** When the output shape is ambiguous, malformed rows can pass schema validation and still ship — route the output through a branch + PR so a human prunes before merge. Schema validation is necessary, not sufficient.
- **Don't run credential-scoped pipelines in CI.** When the data path is authenticated with the user's session cookies or personal tokens, the refresh runs locally via a skill — never in CI, where the blast radius of a leaked credential is too large. Document why in the project `AGENTS.md`.
- **Don't expand scope inside a fix.** A bug fix doesn't need surrounding cleanup; a one-shot operation doesn't need a helper. Note future cleanup in `backlog.md` and move on.
- **Don't loosen invariants quietly.** If a rule has a test guarding it, that test was written because someone got burned. Read the rationale before relaxing it.
- **Don't `--no-verify` to bypass a hook.** Fix the underlying issue. Hooks exist because someone got burned.
- **Don't hand-roll a process waiter.** Launch long jobs with `run_in_background` and wait for the completion notification. `pgrep -f "<module>"` self-matches the waiter's own command line, so an `until pgrep` loop never exits — if you must poll, match the real invocation or capture the PID, or use a Monitor tool.
- **Don't trust `git add` on a gitignored output dir.** It skips brand-new files under a gitignored path — they bake into the site but never commit, so a fresh clone misses them. `git add -f` new records and test that every baked record is tracked.
- **Don't add yourself as a co-author or leave a machine fingerprint.** Never include `Co-Authored-By:` for any AI agent in commit messages — not Claude, Copilot, or any other tool — and no "🤖 Generated with…" footers or tool-attribution lines in commits or PR descriptions. Commits are owned by the human who reviews and ships the work. Write the message in their plain voice (what + why), not the generic-assistant register. The `claude.coauthor` git config is set to `false` in these repos; honor it.
- **Don't treat an empty result as a failure (or a failure as empty).** A legitimately empty collection renders as an explicit "none" state; an extraction/parse failure is a bug to log in `issues.md`. Conflating them hides coverage gaps. See [CLAUDE.md → Data handling](CLAUDE.md).
- **Don't invent history for a missing file.** If a referenced `backlog.md` / `issues.md` / `security.md` isn't there, don't fabricate prior entries — create the file only when the task calls for it.

---

## Repo norms

- **Read before edit.** Always. Even if you read the file earlier in this session.
- **Type hints on every Python function.** No `any` in TypeScript.
- **No `print()` for runtime output** — use the `logging` module.
- **Test alongside code, not after.**
- **Commit at natural checkpoints**: per-feature, per-bug-fix, per-doc-update. Small, focused commits over large monolithic ones.
- **Touch targets ≥ 44px** in any UI work.
- **Mobile first.** If you change UI, resize the preview to 375×812 (iPhone SE) and verify before declaring done.
- **No API keys in code, ever.** Read from environment variables; halt with a clear error if missing.
- **System fonts by default.** No Google Fonts link without explicit justification (see [DESIGN.md § 2](DESIGN.md)).
- **Don't assume a port is free — probe before binding.** Many projects run concurrently here; starting on an occupied port silently connects to the *wrong* service. Probe first, use an alternate port, and revert any temp port change before committing.
- **Disable the Bash sandbox for vitest / dev-server / `localhost` calls.** The default sandbox blocks loopback IPC — test runners hang then fail with cryptic fetch timeouts ("no tests"), and `curl localhost` returns HTTP 000. Set `dangerouslyDisableSandbox: true` for those specific calls.
- **Delete a feature branch (local + remote) right after a successful merge — don't ask.** The merge is the signal it's done; skip the friction prompt. Exception: don't auto-delete if the merge had to be reverted.

---

## Escalate to a human when…

- The editorial frame would change (e.g. adding a new theme / category, changing the rubric for a subjective field, adding a new entity to the in-scope set).
- A subjective call is contested and you're unsure (stance tags, content categorization, what counts as a primary source).
- A canonical source URL starts 404'ing or paywalls. Pause before switching to a less-canonical source.
- Schema fields would change in a way that cross-cuts seed + frontend + tests + connectors. Sketch the migration plan in a `docs/` file first.
- The user says "ship it" but a test is still failing for unrelated-looking reasons. Surface the failure, don't silently skip.
- A "scar tissue" pitfall in [DESIGN.md § 12](DESIGN.md) seems wrong for the current task. The pitfalls exist because someone hit them; verify the rationale doesn't apply before relaxing the rule.

---

## Cross-project hygiene

Working in this folder means the user may run many small projects in parallel.

- **Stay within the current project's scope.** Don't open files from a sibling project unless the user explicitly asks. The folder-level `backlog.md` is portfolio work, not a substitute for the project's own `backlog.md`.
- **Each project's `security.md` is independent.** Refreshing one doesn't refresh the others.
- **Each project's tests are independent.** Don't infer test status across projects.

---

## When something unexpected happens

Add a concise note to the project's CLAUDE.md or `issues.md`. The pattern is:

1. **What I expected:** one sentence.
2. **What happened:** one sentence.
3. **Why:** one sentence (root cause, not symptom).
4. **What to do next time:** one sentence (the actionable lesson).

The note grows the project's scar tissue. The next agent (or you, a month from now) avoids the same hour-long detour.

That growth — files getting *slightly* more specific with each session's surprises — is the asset. Don't rewrite from scratch; append.
