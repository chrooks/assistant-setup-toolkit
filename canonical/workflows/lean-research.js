export const meta = {
  name: 'lean-research',
  description: 'Sonnet surveyors sweep a question from distinct angles; one Opus synthesis recommends and names a runner-up.',
  whenToUse: 'A research or technology-choice question that needs several search angles and cited sources.',
  phases: [
    { title: 'Survey', detail: '3-5 low-effort Sonnet surveyors, one search angle each', model: 'sonnet' },
    { title: 'Synthesize', detail: '1 Opus synthesis with a recommendation and a runner-up', model: 'opus' },
  ],
}

// lean-research — multi-angle sweep then one synthesis. Read-only; returns a cited answer.
//
// Usage (Workflow tool, by name):
//   args: { question: 'Which vector store fits a single-box homelab?' }
//   args: { question: '...', sources: ['docs/adr/0004.md', 'https://example.com/post'], surveyors: 5 }
//
// Args:
//   question  (string, required)
//   sources   (string[], optional) paths or URLs every surveyor starts from
//   surveyors (integer, optional, default 3) clamped to 3-5
//
// Cost shape: Survey 3-5 x Sonnet (low) + Synthesize 1 x Opus (high).

const EXAMPLE = "{ question: 'Which vector store fits a homelab?', sources: ['docs/notes.md'], surveyors: 3 }"
const a = args || {}
const fail = msg => { throw new Error(`lean-research: ${msg}. Example args: ${EXAMPLE}`) }
if (typeof a.question !== 'string' || !a.question.trim()) fail('args.question is required')
if (a.sources !== undefined && (!Array.isArray(a.sources) || a.sources.some(s => typeof s !== 'string' || !s.trim()))) {
  fail('args.sources must be an array of path or URL strings')
}
if (a.surveyors !== undefined && !Number.isInteger(a.surveyors)) fail('args.surveyors must be an integer')
const count = Math.min(5, Math.max(3, a.surveyors === undefined ? 3 : a.surveyors))

const ANGLES = [
  'Primary sources: official docs, specs, changelogs, and maintainers\' own statements',
  'Practitioners: real-world reports, benchmarks, issue trackers, and post-mortems',
  'Counter-evidence: known failures, limits, and the strongest case against the obvious answer',
  'Alternatives: prior art and competing options the question did not name',
  'Fit: constraints of the asker\'s context (the given sources first) and the cost to adopt and run',
]

const NOTES_SCHEMA = {
  type: 'object',
  properties: {
    notes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          claim: { type: 'string' },
          source: { type: 'string' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
        required: ['claim', 'source', 'confidence'],
      },
    },
  },
  required: ['notes'],
}
const SYNTHESIS_SCHEMA = {
  type: 'object',
  properties: {
    answer: { type: 'string' },
    recommendation: { type: 'string' },
    runnerUp: { type: 'string' },
    rationale: { type: 'string' },
    openQuestions: { type: 'array', items: { type: 'string' } },
    citations: { type: 'array', items: { type: 'string' } },
  },
  required: ['answer', 'recommendation', 'runnerUp', 'rationale', 'openQuestions', 'citations'],
}

const sourceLine = a.sources && a.sources.length
  ? `Start from these sources:\n${a.sources.map(s => `- ${s}`).join('\n')}\n`
  : ''

phase('Survey')
const surveys = await parallel(ANGLES.slice(0, count).map((angle, i) => () => agent(
  `Survey this question from one search angle only. Collect claims, each with the source it came from ` +
  `(URL or file path) and your confidence. Do not write an answer; do not change any files.\n` +
  `Question: ${a.question}\nAngle: ${angle}\n${sourceLine}`,
  { phase: 'Survey', label: `survey:${i}`, model: 'sonnet', effort: 'low', agentType: 'Explore', schema: NOTES_SCHEMA },
)))
const notes = surveys.flatMap((s, i) => (s ? s.notes.map(n => ({ ...n, angle: ANGLES[i] })) : []))
const failed = surveys.filter(s => !s).length
if (failed) log(`${failed} surveyor(s) returned nothing`)
if (!notes.length) return { question: a.question, error: 'No surveyor returned notes.', notes: [] }

phase('Synthesize')
const synthesis = await agent(
  `Synthesize these survey notes into an answer to the question. Give one recommendation and name a ` +
  `runner-up with when it would win instead. Cite only sources that appear in the notes. ` +
  `Flag where notes conflict. Do not change any files.\n\nQuestion: ${a.question}\n\n` +
  notes.map(n => `- [${n.confidence}] ${n.claim} (source: ${n.source}; angle: ${n.angle.split(':')[0]})`).join('\n'),
  { phase: 'Synthesize', model: 'opus', effort: 'high', agentType: 'Explore', schema: SYNTHESIS_SCHEMA },
)

return { question: a.question, surveyors: count, notes, synthesis }
