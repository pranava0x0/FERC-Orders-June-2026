---
name: summarize-comments
description: Run, continue, or resume the auditable quote-centric LLM summaries for the RM26-4 public comments (summaries-v2/). Use when the user wants to summarize more comment letters, process the remaining comments, fill in missing summaries, or resume after a pause or a hit session limit. Runs in budget-sized chunks with explicit pause points.
---

# Summarize RM26-4 comments — quote-centric, auditable, resumable, budget-paced

Per-comment summaries for FERC Docket RM26-4-000, built the PNNL CommentNEPA way: the **verbatim quote is the atomic unit**, quotes are binned to the controlled vocabulary (5 reform principles + 8 ANOPR questions + 6 regions) plus emergent `topic:` bins, and each bin carries the filer's **stance** + a description synthesized from *its* quotes. One JSON file per comment under `sources/comments/summaries-v2/<accession>.json`. Schema in `sources/comments/summarization-spec.md`.

This skill is a **chunk loop**: it processes a budget-sized batch, validates, logs usage, commits, then pauses or repeats. It is **fully resumable from disk** — an interruption (network drop, hit session limit) never loses finished work or re-runs it.

## Tools (all in `tools/`, no external deps; node 22)

| Tool | Job |
|------|-----|
| `build-comment-worklist.mjs` | Builds `sources/comments/.worklist.json` (gitignored scratch) of comments still needing a **valid** v2 summary. `--next N` prints the next N accessions (smallest body first). "Done" = passes the full validator, so a corrupt/partial file re-queues (self-heals). |
| `summarize-comments.workflow.mjs` | The Workflow: per comment, extract verbatim quotes → bins → self-critique → write → `fix-lenses` → validate → flag. Independent **audit only on flagged** comments. `args`: `{accs:[...], date:"YYYY-MM-DD", extractModel, auditModel}`. |
| `validate-summaries.mjs` | Deterministic checks: verbatim-quote coverage (≥92%, tolerates footnote/`--- PAGE N ---` splices), controlled vocab, `lenses = union(bins)`, AI-register/em-dash/boilerplate lint. `node tools/validate-summaries.mjs [<acc>]`. Exit 1 on hard errors; low-coverage is a non-blocking WARN. |
| `fix-lenses.mjs` | Recomputes `lenses` from `bins` deterministically (agents never hand-author it). |
| `flag-summary.mjs` | The audit gate: flags only **intrinsic thinness** (too few quotes for body size, all-neutral stance, no reform-principle bin) — NOT prior-divergence (the keyword prior over-detects; the LLM is correctly selective). |

## The chunk loop

Repeat until `.worklist.json` count is 0:

```bash
# 1. pick the next chunk (size to budget — see pause points)
node tools/build-comment-worklist.mjs --next 10          # prints ["acc1", ...]
```

```
# 2. run the workflow on those accessions (Workflow tool, NOT bash):
Workflow({ scriptPath: "tools/summarize-comments.workflow.mjs",
           args: { accs: [<the chunk>], date: "<today YYYY-MM-DD>", extractModel: "sonnet" } })
```

```bash
# 3. on completion — validate, log usage, commit (one block; commit gated on no hard errors):
node tools/validate-summaries.mjs > /tmp/v.txt 2>&1; VEXIT=$?; tail -1 /tmp/v.txt
COUNT=$(grep -oE '^[0-9]+ summaries checked' /tmp/v.txt | grep -oE '^[0-9]+')
if [ "$VEXIT" -eq 0 ]; then
  # append the run's usage (from the completion notification's `usage` block) for later analysis:
  node -e 'require("fs").appendFileSync("sources/comments/workflow-runs.jsonl", JSON.stringify({
    run_id:"<wf_id>", label:"chunk", date:"<today>", extract_model:"sonnet", audit_model:"sonnet",
    comments_in:10, written:<n>, flagged:<n>, audited:<n>, agents:<n>, tool_uses:<n>,
    subagent_tokens:<n>, duration_s:<n>, note:"" })+"\n")'
  node tools/build-comment-worklist.mjs | head -1
  git add -A && git commit -q -m "Add comment summaries (${COUNT}/268 valid)"
else echo "VALIDATION FAILED — not committing"; tail -5 /tmp/v.txt; fi
node tools/build-comment-worklist.mjs --next 10           # next chunk
```

A re-queued accession (silent write-fail or invalid) reappears at the front of the next chunk — that is the self-heal, not a bug.

## Budget pause points (the point of running it this way)

The user watches their **5-hour session budget** (see memory `respect-session-budget`). A fan-out can exhaust it and rate-limit them for the rest of the window. So:

- **Size the chunk to the *remaining* budget.** Default 10. When the user signals a tight budget ("within my 9%"), drop to 3–5. Each ~10-chunk costs ~430–570K subagent tokens.
- **Commit after every chunk** so no batch is ever lost (per-summary save + this commit = two safety nets).
- **Report cumulative spend after each chunk and PAUSE for an explicit go-ahead** when budget is tight. Do not autonomously run the whole corpus unless told "keep going".
- **`TaskStop` in-flight work the moment the user flags budget** — "it's already running" is not a reason to let it finish; the not-yet-started agents are saveable.
- **On a hit session limit** (agents fail with "You've hit your session limit · resets <time>"): STOP. Nothing is lost (failures re-queue). Tell the user the reset time and resume the loop after it (or they can re-invoke this skill).

## Model choice (measured)

- **Use `extractModel: "sonnet"`.** Haiku is cheaper per token but **over-reports writes on larger filings** (claims "written" with no file on disk), causing ~10–40% re-runs that erase the savings; it also loops more on the validate→fix cycle. Sonnet: ~9 tool calls/agent, ~45–55K tokens/comment, reliable writes. Net cheaper once re-runs are counted. See `agent-runs.md` Runs 8–9 and the `workflow-runs.jsonl` `extract_model` column.
- Audit always runs on Sonnet (`auditModel` default), but only on the ~5–10% flagged comments.

## Resume after any interruption

Just re-run from step 1: `node tools/build-comment-worklist.mjs` rebuilds the queue from on-disk state (only comments without a fully-valid summary), so the loop picks up exactly where it stopped. No journal, no manual bookkeeping.

## When the corpus is complete

5 comments are image-only scans (no text layer) and stay unsummarized until OCR'd (`backlog.md`). Once the rest are done, wire the audited bins/quotes into the Comments tab: feed `summaries-v2/` into `tools/build-comments-page-data.mjs` (lens chips from LLM bins, keyword fallback for un-summarized) and add a count-floor + quote-verbatim regression test. See `backlog.md` (the "agentic LLM comment analysis" item) and `tests/data.test.mjs`.
