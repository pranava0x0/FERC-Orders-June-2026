# design-notes.md — FERC Large Load Show Cause Orders microsite

Project-specific identity. Extends the base [DESIGN.md](DESIGN.md); project wins on conflict.
(Named `design-notes.md` rather than `design.md` because macOS's case-insensitive filesystem would
collide the latter with `DESIGN.md`.)

## Identity (one line)

A **federal regulatory public record** — the calm authority of a FERC issuance crossed with the
editorial discipline of the *Financial Times*. Reads like a docket, not a marketing page.

## Palette (subject-anchored, not the default-AI gradient)

Anchored in FERC's own house navy and the cream of a paper filing. One accent (federal blue),
one alert hue reserved **only** for compliance deadlines.

| Token | Light | Meaning |
| --- | --- | --- |
| `--bg` | `#f4f1ea` (warm paper) | page |
| `--surface` | `#ffffff` | panels |
| `--masthead` | `#0b2545` (FERC navy) | top band, footer |
| `--ink` | `#15212e` | body text |
| `--accent` | `#1a4480` (USWDS-adjacent federal blue) | links, focus ring, primary |
| `--deadline` | `#9a3412` (burnt amber) | **30/60-day clocks only** |
| `--rule` | `#d9d2c4` | hairlines |

Status (justify vs. reform), region, and category each get their **own** token family — never reuse
the deadline amber to color a category (base §3.1).

## Type

- **Serif display** (Charter/Georgia stack) — masthead title, section heads, KPI numerals, verbatim quotes.
- **Sans** (system) — body and UI.
- **Mono** (system) — docket numbers (`EL26-67-000`), CFR/FPA cites, dates. Everything copy/pasteable.

## One memorable move

A **monospace "docket spine"** down the left of every order card — the item number (E-7…E-12) and
docket stacked like a case caption against a navy rule. Plus a *Federal Register*-style masthead band.

## Structural device

Hairline rule lines + one hard navy masthead band. Flat surfaces, no glassmorphism, no per-card
drop shadows. Radii 4–6px (authoritative, document-like).

## Provenance is a first-class citizen

- Every claim carries an inline source chip → the primary/secondary document.
- **Three visibly distinct tiers** (base §11): `FERC primary` (quoted issuance text), `DOE primary`
  (the §403 letter), and `Analysis` (synthesis — 3px accent left-border + model-credit line).
- A standing **Methodology & provenance** note explains the Cloudflare retrieval gap (the six order
  PDFs are not machine-retrievable) so the reader never mistakes synthesis for quoted order text.

## Tabs

Five document tabs (base §9 tablist a11y): **Overview · Timeline · Reforms · Dockets (E-7 to E-12) ·
Discourse.** Overview carries the six stats, an at-a-glance block, and a short background; Reforms holds
the five reform categories plus the jurisdictional and regional reads; Dockets holds the six order
cards and how to participate. Keyboard arrow navigation, `aria-selected`, deep-linkable via `#hash`.
The tablist is sticky and horizontally scrollable on narrow screens; switching a tab scrolls back up to
it so a short panel starts at the top, not stranded mid-page.

## Voice

Plain, specific, declarative. Lead with the number/date/docket. No "delve/robust/seamless," no
rule-of-three padding. Labels uppercase-tracked; prose sentence case.

**No AI-isms in any displayed prose.** No em-dashes (reach for a comma, colon, period, or
parentheses), no "it's not X, it's Y" parallelism, no marketing register. Ranges read "X to Y," not
"X–Y." Leave verbatim FERC/DOE quotes, reporter cites, and source titles exactly as quoted; the dash
rule is for our editorial prose, not for quoted text. A regression-style habit: after editing copy,
grep the rendered tabs for em-dashes and expect zero.
