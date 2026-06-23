# agent-runs.md — subagent / workflow run history + evaluation

Append-only log of the AI subagent and workflow runs used to build this project, with an
accuracy and token-efficiency assessment. Stats are taken verbatim from each run's completion
notification (`usage` block). Tokens = subagent output tokens (the figure the runtime reports);
they do not include the main-loop orchestration tokens.

## Runs

| # | Date | Kind | Purpose | Agents | Tool uses | Subagent tokens | Wall-clock | Model | Outcome |
|---|------|------|---------|-------:|----------:|----------------:|-----------:|-------|---------|
| 1 | 2026-06-22 | Workflow `extract-ferc-orders` (`wf_2ce3be2c-824`) | Pull citations, quoted directives + paragraph cites, and region-specific findings from the six order PDFs | 6 | 123 | 437,134 | 107.2 s | opus-4.8 (inherited) | ✅ 6/6 caption-verified; 8 directives + 5 region findings each |
| 2 | 2026-06-22 | Agent `general-purpose` (`add4b7d7…`) | Extract full 16-page DOE §403 letter text to `sources/text/doe-403-full.txt` | 1 | 12 | 59,319 | 137.2 s | opus-4.8 (inherited) | ✅ 27,128 chars; opening matches the real letter |
| 3 | 2026-06-22 | Workflow `save-order-fulltext` (`wf_a3dbdf88-b59`) | Save complete text of all six order PDFs via LLM agents reading page-by-page | 6 | 412 | 974,122 | 906.5 s | general-purpose (opus-4.8) | ❌ **FAILED** — all six hit the session token limit; **0 files written** |
| 4 | 2026-06-23 | Local script (PyMuPDF / `fitz`) — **no LLM** | Re-do Run 3 the right way: extract full text of all six PDFs to `sources/text/orders/*.txt` | 0 | 1 | **0** | ~2 s | n/a | ✅ 6/6 files, 1,734,062 chars; 53/53 directive quotes verified verbatim |

_Totals: 13 agent-runs · 547 tool uses · **1,470,575** subagent tokens · ~1,153 s of agent wall-clock — of which Run 3 (974K tokens) produced nothing. Run 4 did the same job in ~2 s for 0 tokens._

## Evaluation

### Results / accuracy — strong, with one honest caveat

- **Run 1 (extraction).** Every order self-proved: each agent confirmed the page-1 caption (FERC
  reporter cite, respondent RTO, docket number, the title "Order Instituting Proceeding Under
  Section 206," issued date) before extracting. The six cites came back **sequential and distinct**
  (195 FERC ¶ 61,211 → 61,216), which is a strong internal-consistency signal — a hallucinating run
  would not produce six consecutive reporter cites that also match the docket→RTO mapping. Quotes are
  verbatim with paragraph cites; region findings carry concrete, checkable specifics (PJM's
  "two substations" proximity rule and 50 MW co-located threshold; SPP HILLGA accepted Jan 14 2026 /
  CHILLS June 5 2026; CAISO "no Order No. 888 service"). I **independently** read E-7 page 1 inline and
  it matched the agent's output exactly. A regression test (`tests/data.test.mjs`) now asserts every
  rendered quote shares a ≥25-char verbatim run with the extract, so UI text can't drift from it.
- **Run 2 (DOE full text).** Verified the opening matches the real letter (Oct 23 2025, Sec. Chris
  Wright, addressed to Chairman Rosner + Commissioners). The agent flagged that the source PDF is
  itself OCR'd and preserved its artifacts rather than "cleaning" them — the honest choice.
- **Caveat — now closed.** The earlier residual risk (only E-7's caption was independently checked;
  the rest rested on the agents' own caption checks + UI↔extract self-consistency) is resolved by
  Run 4. The locally extracted full text is an independent oracle, and **all 53 directive-quote
  segments in `orders-extract.json` were confirmed verbatim** against it (`tests/data.test.mjs`
  now enforces this on every run). The five initial near-misses were benign — straight-vs-curly
  apostrophes and one inline OCR footnote marker (`technologies154 as`) the agent correctly dropped —
  and the surrounding source text matched exactly. So the Run 1 extraction is independently validated,
  not just self-consistent.

### Token efficiency — reasonable for the payload; one clear lever

- Run 1 spent **~73K tokens/agent** to read and mine a ~100-page dense legal PDF (≈20 tool calls each:
  `get_pdf_info` + several `read_pdf_pages` ranges + targeted `search_pdf_text`). That is proportional
  to ~600 pages of source material, not wasteful — and the **6-way fan-out held wall-clock to 107 s**
  instead of ~10 min serial. Forcing structured output via schema avoided any re-parsing round-trips.
- Run 2's 12 tool calls for 16 pages is slightly high because pages 9–16 were truncated on the bulk
  read and re-read individually — correct for fidelity, but it shows the truncation tax.
- **Run 3 is the cautionary tale — and the headline efficiency lesson.** Dumping the *full* text of
  six ~100-page PDFs through LLM agents reading page-by-page (with truncation re-reads) burned
  **974,122 tokens across 412 tool calls, hit the session limit, and wrote nothing.** Run 4 did the
  identical job with a 30-line PyMuPDF script in ~2 seconds for **0 tokens**. The rule: **never use an
  LLM to transcribe a PDF that already has a text layer** — extract it deterministically (`fitz` /
  `pdfplumber` / `pdftotext`) and, if needed, point the LLM at the resulting text. LLM agents are for
  *judgement* (which passages matter, what they mean), not for mechanical OCR-dump work a library does
  for free and more reliably.
- **The earlier lever still stands** for the genuinely-LLM step (Run 1's structured extraction): it is
  mostly mechanical (verbatim copy + caption check), so a cheaper tier (Sonnet) would likely cut
  30–60% of tokens with little accuracy loss — reserve Opus for synthesis/judgement. Scoping the read
  (caption + Discussion + ordering paragraphs) over broad `search_pdf_text` sweeps is a second lever.

### Verdict

Accuracy: **high and independently validated** (53/53 quotes verbatim; enforced by test) — fit for
citation with the saved full text as the check.
Efficiency: **mixed.** The Run 1 fan-out was well-parallelized and proportional, but **Run 3 was a
~1M-token mistake** — using LLM agents for a deterministic full-text extraction. Lesson recorded:
extract text layers with a library, spend tokens only on judgement.
