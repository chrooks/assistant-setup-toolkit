export const meta = {
  name: 'lean-review',
  description: 'Lean multi-lens review of a git range or file: map, find per lens, dedup, verify. No fixes.',
  whenToUse: 'Review a diff, a branch, or a document from several angles with adversarial verification, at Haiku/Sonnet cost.',
  phases: [
    { title: 'Map', detail: '1 Haiku Explore agent resolves the target into files', model: 'haiku' },
    { title: 'Find', detail: 'one Sonnet finder per lens or persona', model: 'sonnet' },
    { title: 'Verify', detail: 'one Sonnet skeptic per finding (three with audit)', model: 'sonnet' },
  ],
}

// lean-review — read-only multi-lens review. Returns ranked findings; never fixes.
//
// Usage (Workflow tool, by name):
//   args: { target: 'main..HEAD' }                       // git range
//   args: { target: 'docs/contract.md', lenses: ["Employer's counsel attacks this document"] }
//   args: { target: 'HEAD~3..HEAD', lenses: ['code', 'security'], audit: true }
//
// Args:
//   target  (string, required)  a git range (a..b, HEAD~N..HEAD) or a file/dir path
//   lenses  (string[], optional) known names: code, adversarial, architecture, security,
//           accessibility. Any other string is a persona brief. Default: code,
//           adversarial, architecture, security; accessibility joins when UI files are mapped.
//   audit   (boolean, optional) three skeptics per finding instead of one.
//   maxFindings (integer, optional, default 12) verify only the most severe N
//           findings; the rest come back unverified in `dropped`.
//
// Cost shape: Map 1 x Haiku (low) + Find L x Sonnet (medium, L = lens count)
//   + Verify F x Sonnet (low), F = deduped findings, at most maxFindings
//   (3F with audit). Worst case at defaults: 1 + 4 + 12 = 17 agents. No Opus.
//
// Barrier, not pipeline: dedup runs across all lenses before verification, so
// Find is a barrier. Simpler, and it stops two lenses paying to verify one bug.

const EXAMPLE = "{ target: 'main..HEAD', lenses: ['code', 'security'], audit: false }"
const a = args || {}
if (typeof a.target !== 'string' || !a.target.trim()) {
  throw new Error(`lean-review: args.target is required (a git range or a file path). Example args: ${EXAMPLE}`)
}
if (a.lenses !== undefined && (!Array.isArray(a.lenses) || !a.lenses.length || a.lenses.some(l => typeof l !== 'string' || !l.trim()))) {
  throw new Error(`lean-review: args.lenses must be a non-empty array of strings. Example args: ${EXAMPLE}`)
}
if (a.audit !== undefined && typeof a.audit !== 'boolean') {
  throw new Error(`lean-review: args.audit must be a boolean. Example args: ${EXAMPLE}`)
}
if (a.maxFindings !== undefined && (!Number.isInteger(a.maxFindings) || a.maxFindings < 1)) {
  throw new Error(`lean-review: args.maxFindings must be a positive integer. Example args: ${EXAMPLE}`)
}
const MAX_FINDINGS = a.maxFindings || 12

const LENSES = {
  code: 'Correctness: logic errors, edge cases, broken contracts between caller and callee, wrong error handling.',
  adversarial: 'Adversarial: inputs, orderings, and states the author did not imagine. Try to break it.',
  architecture: 'Architecture: misplaced responsibilities, leaky boundaries, duplication of an existing helper, coupling that will hurt the next change.',
  security: 'Security: injection, secrets, auth gaps, unsafe file or network access, trust-boundary validation.',
  accessibility: 'Accessibility: semantics, keyboard reach, focus, labels, contrast, motion.',
}
const DEFAULT_LENSES = ['code', 'adversarial', 'architecture', 'security']
const UI_FILE = /\.(tsx|jsx|vue|svelte|html|css)$/i
const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 }

const MAP_SCHEMA = {
  type: 'object',
  properties: {
    files: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
  },
  required: ['files', 'summary'],
}
const FINDINGS_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          file: { type: 'string' },
          lineStart: { type: 'integer' },
          lineEnd: { type: 'integer' },
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          claim: { type: 'string' },
          failureScenario: { type: 'string' },
        },
        required: ['file', 'lineStart', 'lineEnd', 'severity', 'claim', 'failureScenario'],
      },
    },
  },
  required: ['findings'],
}
const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    refuted: { type: 'boolean' },
    reason: { type: 'string' },
  },
  required: ['refuted', 'reason'],
}

phase('Map')
const map = await agent(
  `Resolve this review target into the list of files it covers. Do not review anything.\n` +
  `Target: ${a.target}\n` +
  `If it looks like a git range, run \`git diff --name-only ${a.target}\` and \`git diff --stat ${a.target}\`. ` +
  `If it is a path, list the file (or the files under the directory). ` +
  `Return the file paths and a 2-3 sentence summary of what changed or what the document is.`,
  { phase: 'Map', model: 'haiku', effort: 'low', agentType: 'Explore', schema: MAP_SCHEMA },
)
if (!map || !map.files.length) {
  return { target: a.target, error: 'Map found no files for the target.', findings: [] }
}

const requested = a.lenses || DEFAULT_LENSES
const lenses = !a.lenses && map.files.some(f => UI_FILE.test(f))
  ? [...requested, 'accessibility']
  : requested

const scope =
  `Target: ${a.target}\nSummary: ${map.summary}\nFiles:\n${map.files.map(f => `- ${f}`).join('\n')}\n` +
  `For a git range, read the diff (\`git diff ${a.target} -- <file>\`) and only the surrounding code you need.`

phase('Find')
const found = await parallel(lenses.map(lens => () => {
  const brief = LENSES[lens]
    ? `Review through this lens. ${LENSES[lens]}`
    : `Adopt this persona and attack the target from its point of view: ${lens}`
  return agent(
    `${brief}\n\n${scope}\n\n` +
    `Report only real problems you can point at, with the file, the line range, a severity, the claim, ` +
    `and a concrete failure scenario. Do not fix anything. An empty list is a valid answer.`,
    { phase: 'Find', label: `find:${lens.slice(0, 30)}`, model: 'sonnet', effort: 'medium', agentType: 'Explore', schema: FINDINGS_SCHEMA },
  ).then(r => r && r.findings.map(f => ({ ...f, lens })))
}))

// ponytail: dedup on same file + overlapping line range; near-duplicates on
// adjacent lines survive. Upgrade to a merge agent if duplicates get noisy.
const overlaps = (x, y) => x.file === y.file && x.lineStart <= y.lineEnd && y.lineStart <= x.lineEnd
const deduped = []
for (const f of found.filter(Boolean).flat()) {
  const twin = deduped.find(d => overlaps(d, f))
  if (!twin) deduped.push({ ...f, lenses: [f.lens] })
  else if (!twin.lenses.includes(f.lens)) twin.lenses.push(f.lens)
}
const failedLenses = lenses.filter((_, i) => !found[i])
if (failedLenses.length) log(`Find returned nothing usable for: ${failedLenses.join(', ')}`)

// The verifier fan-out is the one unbounded stage, so cap it: verify the most
// severe findings and return the rest unverified in `dropped`.
const bySeverity = [...deduped].sort((x, y) => SEVERITY_RANK[x.severity] - SEVERITY_RANK[y.severity])
const toVerify = bySeverity.slice(0, MAX_FINDINGS)
const dropped = bySeverity.slice(MAX_FINDINGS)
if (dropped.length) log(`Verifying ${toVerify.length} of ${deduped.length} findings; ${dropped.length} dropped by maxFindings.`)

phase('Verify')
const votesPer = a.audit ? 3 : 1
const judged = await parallel(toVerify.map((f, i) => () =>
  parallel(Array.from({ length: votesPer }, (_, v) => () => agent(
    `Try to refute this review finding. Read the code at the location and decide if the claim is wrong, ` +
    `already handled, or not reachable. Default to refuted=true if the evidence is unclear.\n\n` +
    `Target: ${a.target}\nFile: ${f.file} lines ${f.lineStart}-${f.lineEnd}\nSeverity: ${f.severity}\n` +
    `Claim: ${f.claim}\nFailure scenario: ${f.failureScenario}`,
    { phase: 'Verify', label: `verify:${i}${votesPer > 1 ? `.${v}` : ''}`, model: 'sonnet', effort: 'low', agentType: 'Explore', schema: VERDICT_SCHEMA },
  ))).then(votes => {
    const cast = votes.filter(Boolean)
    const upheld = cast.filter(x => !x.refuted).length
    return { ...f, votes: cast, status: !cast.length ? 'unverified' : upheld * 2 > cast.length ? 'confirmed' : 'refuted' }
  }),
))

const byStatus = s => judged.filter(f => f && f.status === s)
const confirmed = byStatus('confirmed').sort((x, y) =>
  SEVERITY_RANK[x.severity] - SEVERITY_RANK[y.severity] || y.lenses.length - x.lenses.length)

return {
  target: a.target,
  summary: map.summary,
  lenses,
  findings: confirmed,
  unverified: byStatus('unverified'),
  refuted: byStatus('refuted'),
  dropped,
  stats: { files: map.files.length, found: found.filter(Boolean).flat().length, deduped: deduped.length, verified: toVerify.length, verifierCalls: toVerify.length * votesPer, failedLenses },
}
