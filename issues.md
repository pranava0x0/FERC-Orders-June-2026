# issues.md — audit trail

Format: date · area · description · root cause (code/test/data/source) · status.

## Open

- **2026-06-22 · source retrieval · The six individual order PDFs (`ferc.gov/media/e-7…e-12`,
  EL26-67…72) could not be machine-retrieved.** Root cause: **source-side** — ferc.gov and
  cms.ferc.gov sit behind a Cloudflare "Just a moment" JS challenge that returns HTTP 403 to curl,
  WebFetch, and the PDF-fetch tool; the Wayback Save-Page-Now crawler hit the same gate (HTTP 520);
  no browser extension was connected to pass the challenge. **Status: Open (structural gap).**
  Mitigation: per-order specifics are sourced from FERC's cross-order press release + fact sheet
  (which enumerate the regional distinctions verbatim), the DOE ANOPR principles, and named legal
  analyses; each is tagged `Analysis` and links to the order PDF. Closeable later by loading the six
  PDFs through a connected browser and replacing `Analysis` tiers with quoted order text.

## Fixed

- **2026-06-22 · build · `design.md` write collided with existing `DESIGN.md`** on the
  case-insensitive macOS filesystem. Root cause: **environment**. Fix: named the project identity
  file `design-notes.md`.
