# issues.md — audit trail

Format: date · area · description · root cause (code/test/data/source) · status.

## Open

(none)

## Fixed

- **2026-06-22 · efficiency · Saving the six orders' full text via LLM subagents failed and wasted
  ~974K tokens.** Root cause: **wrong tool** — a `save-order-fulltext` workflow had 6 Opus agents read
  ~100-page PDFs page-by-page (with truncation re-reads); they hit the session token limit and wrote
  nothing (412 tool calls, 0 output). **Fix:** the PDFs have an embedded text layer, so extraction is
  deterministic — re-did it with a ~30-line PyMuPDF (`fitz`) script in ~2 s for 0 tokens, producing
  `sources/text/orders/*.txt` (1.73M chars). A regression test confirms all 53 extracted directive
  quotes appear verbatim in those files. Lesson in `agent-runs.md`: never LLM-transcribe a text-layer
  PDF — use a library; spend tokens only on judgement.

- **2026-06-22 · source retrieval · The six order PDFs (`ferc.gov/media/e-7…e-12`, EL26-67…72)
  were not machine-retrievable.** Root cause: **source-side** — ferc.gov sits behind a Cloudflare
  "Just a moment" JS challenge that returns HTTP 403 to curl, WebFetch, the PDF-fetch tool, and the
  Wayback Save-Page-Now crawler (HTTP 520). **Fix:** the user opened the six PDFs in a real Chrome
  (which passes Cloudflare) and downloaded them; they were OCR'd 2026-06-22, page-1 captions verified
  (195 FERC ¶ 61,211–61,216, 92–119 pp), and a 6-agent extraction folded quoted directives + paragraph
  cites into Tab 2. Structured extract committed at `sources/orders-extract.json`. Note: the AppleScript
  bridge could not run JS because Chrome's "Allow JavaScript from Apple Events" is off by default — a
  security setting only the user can toggle — so manual browser download was the working path.

- **2026-06-22 · build · `design.md` write collided with existing `DESIGN.md`** on the
  case-insensitive macOS filesystem. Root cause: **environment**. Fix: named the project identity
  file `design-notes.md`.
