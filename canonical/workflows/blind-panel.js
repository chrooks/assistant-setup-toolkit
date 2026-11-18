export const meta = {
  name: 'blind-panel',
  description: 'N blind Sonnet designers attack one brief from distinct angles; one Opus judge scores, picks, and grafts.',
  whenToUse: 'A design or approach question with a wide solution space, where one attempt iterated would anchor too early.',
  phases: [
    { title: 'Design', detail: 'N Sonnet designers, each blind to the others', model: 'sonnet' },
    { title: 'Judge', detail: '1 Opus judge scores every design and grafts the best ideas into the winner', model: 'opus' },
  ],
}

// blind-panel — judge panel over independent designs. Returns options; builds nothing.
//
// Usage (Workflow tool, by name):
//   args: { brief: 'Design the settings page for X. Constraints: ...' }
//   args: { brief: '...', n: 4, angles: ['cheapest to build', 'best for a first-time user'] }
//
// Args:
//   brief  (string, required) the problem, constraints, and paths worth reading
//   n      (integer 2-6, optional, default 3) designer count
//   angles (string[], optional) replaces the default angle list; cycled when n exceeds it
//
// Cost shape: Design n x Sonnet (medium) + Judge 1 x Opus (high).
// The judge reads every design, so its context grows with n.

const EXAMPLE = "{ brief: 'Design the settings page. Constraints: ...', n: 3 }"
const a = args || {}
const fail = msg => { throw new Error(`blind-panel: ${msg}. Example args: ${EXAMPLE}`) }
if (typeof a.brief !== 'string' || !a.brief.trim()) fail('args.brief is required')
const n = a.n === undefined ? 3 : a.n
if (!Number.isInteger(n) || n < 2 || n > 6) fail('args.n must be an integer from 2 to 6')
if (a.angles !== undefined && (!Array.isArray(a.angles) || !a.angles.length || a.angles.some(s => typeof s !== 'string' || !s.trim()))) {
  fail('args.angles must be a non-empty array of strings')
}

const DEFAULT_ANGLES = [
  'MVP-first: the smallest thing that delivers the core outcome this week',
  'Risk-first: design around the failure modes, edge cases, and what breaks at scale',
  'User-first: design from the person using it, their mental model, and their first five minutes',
  'Reuse-first: lean on what already exists in the codebase and platform; write the least new code',
  'Long-horizon: the shape that stays right after the next three changes',
  'Contrarian: question the brief itself and propose the approach nobody asked for',
]
const pool = a.angles || DEFAULT_ANGLES
const angles = Array.from({ length: n }, (_, i) =>
  pool[i % pool.length] + (i >= pool.length ? ` (variant ${Math.floor(i / pool.length) + 1}: diverge from the obvious take)` : ''))

const DESIGN_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    approach: { type: 'string' },
    keyDecisions: { type: 'array', items: { type: 'string' } },
    risks: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'approach', 'keyDecisions', 'risks'],
}
const JUDGE_SCHEMA = {
  type: 'object',
  properties: {
    scores: {
      type: 'array',
      items: {
        type: 'object',
        properties: { design: { type: 'integer' }, score: { type: 'integer' }, rationale: { type: 'string' } },
        required: ['design', 'score', 'rationale'],
      },
    },
    winner: { type: 'integer' },
    grafted: { type: 'array', items: { type: 'string' } },
    finalDesign: { type: 'string' },
    runnerUp: { type: 'integer' },
  },
  required: ['scores', 'winner', 'grafted', 'finalDesign', 'runnerUp'],
}

phase('Design')
const designs = await parallel(angles.map((angle, i) => () => agent(
  `You are one of several designers working blind on the same brief. Work only from your angle.\n` +
  `Angle: ${angle}\n\nBrief:\n${a.brief}\n\n` +
  `Read only what the brief points at. Do not write or change any files. ` +
  `Return a titled design: the approach, the key decisions, and the risks.`,
  { phase: 'Design', label: `design:${i}`, model: 'sonnet', effort: 'medium', agentType: 'Explore', schema: DESIGN_SCHEMA },
)))
const entries = designs.map((d, i) => d && { index: i, angle: angles[i], ...d }).filter(Boolean)
if (entries.length < designs.length) log(`${designs.length - entries.length} designer(s) returned nothing`)
if (!entries.length) return { brief: a.brief, error: 'No designer returned a design.', designs: [] }

phase('Judge')
const verdict = await agent(
  `Judge these independent designs against the brief. Score each from 1 to 10 with a short rationale, ` +
  `pick the winner, name the runner-up, and write the final design: the winner with the best ideas ` +
  `from the runners-up grafted in. List each grafted idea and its source design number. Do not change any files.\n\n` +
  `Brief:\n${a.brief}\n\n` +
  entries.map(d =>
    `## Design ${d.index}: ${d.title}\nAngle: ${d.angle}\nApproach: ${d.approach}\n` +
    `Key decisions:\n${d.keyDecisions.map(k => `- ${k}`).join('\n')}\nRisks:\n${d.risks.map(r => `- ${r}`).join('\n')}`,
  ).join('\n\n'),
  { phase: 'Judge', model: 'opus', effort: 'high', agentType: 'Explore', schema: JUDGE_SCHEMA },
)

return { brief: a.brief, designs: entries, verdict }
