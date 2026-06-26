export const meta = {
  name: 'summarize-comments',
  description: 'Quote-centric auditable LLM summaries for RM26-4 comments (PNNL CommentNEPA): extract+self-critique, selective independent audit',
  phases: [
    { title: 'Extract', detail: 'one agent per comment: verbatim quotes → bins → summary, self-critiqued, self-validated' },
    { title: 'Audit', detail: 'independent skeptic — only on deterministically flagged comments' },
  ],
}

// args: { accs: [accession, ...], date: "YYYY-MM-DD" }  (tolerate args arriving as a JSON string)
const A = typeof args === 'string' ? JSON.parse(args) : (args || {})
const accs = A.accs || []
const DATE = A.date || '2026-06-25'
if (!accs.length) { log(`no accessions in args (typeof args = ${typeof args})`); return { error: 'no accs', argsType: typeof args } }

// Lean default workflow subagent (probed: has Bash/Write/Read/Edit). general-purpose's heavy system
// prompt was re-fed every turn in the pilot; omitting agentType cuts that fixed overhead.
// Budget: extract on the cheapest model that holds up (Haiku); reserve Sonnet for the rare flagged audit.
const EXTRACT_MODEL = A.extractModel || 'haiku'
const AUDIT_MODEL = A.auditModel || 'sonnet'
log(`summarizing ${accs.length} comments (extract ${EXTRACT_MODEL} + self-critique → selective audit ${AUDIT_MODEL}), generated_at ${DATE}`)

const VOCAB = `  aq:<key> — DOE ANOPR comment-period questions: jurisdiction, threshold, jointstudy, deposits, hybridrights, protection, expedited, upgradecost
  pr:<key> — June show-cause-order reform principles: study, cost, colo, flex, proximate
  rg:<key> — show-cause-order regions: pjm, miso, spp, caiso, isone, nyiso
  topic:<slug> — an emergent theme the three lenses miss (kebab-case), e.g. topic:tariff-transparency`
const STYLE = `Plain, direct prose in name/description/concern/overall_summary: no AI-register words (delve, leverage, robust, seamless, "it's worth noting"), no em-dashes, write ranges as "to". Quotes are exempt — copy them as written.`

const EXTRACT_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    acc: { type: 'string' },
    status: { type: 'string', enum: ['written', 'failed'] },
    quotes: { type: 'number' }, bins: { type: 'number' },
    validator: { type: 'string', enum: ['ok', 'warn', 'fail'] },
    flagged: { type: 'boolean' },
    notes: { type: 'string' },
  },
  required: ['acc', 'status', 'validator', 'flagged'],
}
const AUDIT_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    acc: { type: 'string' },
    verdict: { type: 'string', enum: ['good', 'revised', 'problems'] },
    changed: { type: 'boolean' },
    validator: { type: 'string', enum: ['ok', 'warn', 'fail'] },
    issues: { type: 'array', items: { type: 'string' } },
  },
  required: ['acc', 'verdict', 'changed'],
}

const extractPrompt = (acc) => `You are extracting an auditable, quote-centric summary of ONE public comment in FERC Docket RM26-4-000. Method (PNNL CommentNEPA): the unit of evidence is the verbatim quote; bins are built on quotes; each bin is a short name + stance + description synthesized from its quotes.

Comment accession: ${acc}

1. Load routing — run:
   node -e "const w=require('./sources/comments/.worklist.json'); console.log(JSON.stringify(w.rows.find(x=>x.acc==='${acc}')))"
   It gives: filer, org_type (the stakeholder bucket — copy verbatim into org_type), filed, primary (main body .txt path), txts (all body .txt paths), prior (keyword-detected aq/pr/rg — a cross-check, not ground truth), large, flagship.

2. Read the body — read the \`primary\` .txt. If \`large\` is true, read the first ~2000 lines and use grep (via Bash) for the argument/recommendation/answers sections; you need not read every exhibit page. Quote only text you have read. Ignore "--- PAGE N ---" markers and interleaved footnotes when reading meaning.

3. Extract verbatim quotes — the spans that carry a position, ask, or argument. Copy each EXACTLY. Keep each TIGHT: one sentence or a clause (short spans validate cleanly; the checker tolerates page markers and footnote splices but never paraphrase). Skip boilerplate (the caption, docket number, signature block, certificate of service, throat-clearing). One-line plain \`concern\` each. A short filing → 1 to 3 quotes; a substantive one → 6 to 15. Do not pad.

4. Bin each quote into one or more vocab bins plus emergent topics:
${VOCAB}

5. Name + describe each distinct bin: short \`name\` (3 to 6 words), \`stance\` (support | oppose | mixed | neutral — the FILER's, never yours; neutral when the bin only describes), \`description\` (1 to 3 plain sentences synthesized from THAT bin's quotes), \`quote_ids\`.

6. overall_summary — 1 to 3 plain sentences on the filing's overall position.

7. Self-critique before writing — you have the body loaded, so use it: re-read each quote against the body and confirm it is verbatim and load-bearing (not boilerplate); confirm each bin's stance is the filer's; confirm no major position is left without a quote; confirm every bin key is in the vocab (+ topic:). Fix anything off.

8. Write sources/comments/summaries-v2/${acc}.json (strict JSON, no trailing commas):
{
  "accession": "${acc}", "filer": "...", "org_type": "...", "filed": "...",
  "source_text": "<the primary path>",
  "overall_summary": "...",
  "quotes": [ { "id": 1, "text": "verbatim span", "concern": "one-line paraphrase", "bins": ["pr:cost"] } ],
  "bins": [ { "key": "pr:cost", "name": "...", "stance": "support", "description": "...", "quote_ids": [1] } ],
  "lenses": { "aq": [...], "pr": [...], "rg": [...] },
  "provenance": { "model": "<your own model id>", "generated_at": "${DATE}", "method": "agentic-subagent", "verified": false }
}
Set provenance.model to YOUR actual model id (e.g. "claude-sonnet-4-6" or "claude-haiku-4-5"), not a placeholder, so the audit trail records what produced this summary. Set lenses to {"aq":[],"pr":[],"rg":[]} — it is derived in the next step, do NOT hand-author it. Every quote.bins key must exist in bins; every bin.quote_ids id must exist in quotes.

9. Derive lenses — run \`node tools/fix-lenses.mjs ${acc}\`. It sets lenses = the union of your bins' aq/pr/rg keys deterministically, so you never compute or fix lenses by hand (that mismatch was the most common validation failure).

10. Validate — run:
   node tools/validate-summaries.mjs ${acc}
   Fix every FAIL and low-coverage WARN, then re-run until it prints "0 with errors, 0 with low-coverage quotes". The validator also rejects AI-register words and em-dashes in your prose and caption/signature quotes — fix those too. Most remaining failures are a quote that is not verbatim (re-copy exactly, or shorten to the verbatim part).
   IMPORTANT: the validator reads the file from disk. If it prints "not found" or "no body text", your Write did NOT persist — write the file again and re-run. Report status "written" ONLY after the validator actually printed a "N summaries checked, 0 with errors" line for ${acc}. Do not claim success you have not seen on screen.

11. Flag — run \`node tools/flag-summary.mjs ${acc}\` and report its "flagged" value in your status.

${STYLE}

Return your status (the schema fields).`

const auditPrompt = (acc, reasons) => `You are auditing ONE comment summary for FERC Docket RM26-4-000 as a skeptic. It was flagged by a deterministic check for: ${reasons || 'review'}. File: sources/comments/summaries-v2/${acc}.json.

Read that JSON, then read its source body (the source_text .txt, and other .txt in the same dir if needed). Check:
1. The flag — is the flagged divergence a real miss (a lens/position the summary should carry but doesn't) or defensible (e.g., the body name-drops an RTO without engaging it)? Resolve it.
2. Faithfulness — does overall_summary match what the filer actually argues? No invented positions.
3. Stance — is each bin.stance the FILER's (support/oppose/mixed/neutral), not the curator's?
4. Quote quality — substantive, not boilerplate (caption, docket no., signature, certificate of service)?
5. Coverage — any major position in the body with no quote?

If you find MATERIAL problems, fix them directly in the JSON (edit quotes/bins/stances/summary; keep quotes verbatim), then re-run \`node tools/validate-summaries.mjs ${acc}\` until clean. Do not churn minor wording. ${STYLE}

Return your verdict (the schema fields). Set changed=true only if you edited the file.`

const results = await pipeline(
  accs,
  (acc) => agent(extractPrompt(acc), { label: `extract:${acc}`, phase: 'Extract', schema: EXTRACT_SCHEMA, model: EXTRACT_MODEL, effort: 'medium' }),
  async (ext, acc) => {
    if (!ext || ext.status !== 'written') return { acc, ext, aud: null, audited: false }
    if (!ext.flagged) return { acc, ext, aud: { verdict: 'good', changed: false, skipped: true }, audited: false }
    const aud = await agent(auditPrompt(acc, ext.notes), { label: `audit:${acc}`, phase: 'Audit', schema: AUDIT_SCHEMA, model: AUDIT_MODEL, effort: 'low' })
    return { acc, ext, aud, audited: true }
  },
)

const ok = results.filter(Boolean)
const written = ok.filter((r) => r.ext && r.ext.status === 'written').length
const flagged = ok.filter((r) => r.ext && r.ext.flagged).length
const audited = ok.filter((r) => r.audited).length
const revised = ok.filter((r) => r.aud && r.aud.changed).length
const failedExtract = ok.filter((r) => !r.ext || r.ext.status !== 'written').map((r) => r.acc)
log(`done: ${written}/${accs.length} written, ${flagged} flagged, ${audited} audited, ${revised} revised. failed: ${failedExtract.join(', ') || 'none'}`)
return {
  total: accs.length, written, flagged, audited, revised, failedExtract,
  rows: ok.map((r) => ({ acc: r.acc, ext: r.ext, aud: r.aud })),
}
