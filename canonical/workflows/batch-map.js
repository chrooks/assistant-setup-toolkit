export const meta = {
  name: 'batch-map',
  description: 'Apply one instruction to every item in a list, in cheap low-effort chunks, and merge the results.',
  whenToUse: 'Classify, extract, summarize, or transcribe a long list of items where each item is independent.',
  phases: [
    { title: 'List', detail: 'only with args.file: 1 Haiku Explore agent lists the items', model: 'haiku' },
    { title: 'Map', detail: 'one low-effort agent per chunk (Haiku default, Sonnet on request)' },
  ],
}

// batch-map — map one instruction over many items. Read-only; returns results.
//
// Usage (Workflow tool, by name):
//   args: { items: ['url1', 'url2'], instruction: 'Return the page title.' }
//   args: { file: 'notes/backlog.md', instruction: 'Tag each line bug|feature|chore.', chunkSize: 40 }
//   args: { items: [...], instruction: 'Transcribe the image at this path.', model: 'sonnet' }
//
// Args:
//   items       (array, required unless file) the items; non-strings are JSON-encoded
//   file        (string, required unless items) a path; one item per non-empty line
//   instruction (string, required) what to do with each item
//   chunkSize   (integer 1-200, optional, default 25) items per agent
//   model       ('haiku' | 'sonnet', optional, default 'haiku'). No Opus stage.
//
// Cost shape: List 1 x Haiku (low, only with file) + Map ceil(N / chunkSize) x model (low).
//
// A script has no filesystem access, so `file` costs one Haiku agent to read it.

const EXAMPLE = "{ items: ['a', 'b'], instruction: 'Uppercase the item.', chunkSize: 25, model: 'haiku' }"
const a = args || {}
const fail = msg => { throw new Error(`batch-map: ${msg}. Example args: ${EXAMPLE}`) }
if (typeof a.instruction !== 'string' || !a.instruction.trim()) fail('args.instruction is required')
if ((a.items === undefined) === (a.file === undefined)) fail('give exactly one of args.items or args.file')
if (a.items !== undefined && (!Array.isArray(a.items) || !a.items.length)) fail('args.items must be a non-empty array')
if (a.file !== undefined && (typeof a.file !== 'string' || !a.file.trim())) fail('args.file must be a path string')
const chunkSize = a.chunkSize === undefined ? 25 : a.chunkSize
if (!Number.isInteger(chunkSize) || chunkSize < 1 || chunkSize > 200) fail('args.chunkSize must be an integer from 1 to 200')
const model = a.model === undefined ? 'haiku' : a.model
if (model !== 'haiku' && model !== 'sonnet') fail(`args.model must be 'haiku' or 'sonnet', got ${JSON.stringify(a.model)}`)

const LIST_SCHEMA = {
  type: 'object',
  properties: { items: { type: 'array', items: { type: 'string' } } },
  required: ['items'],
}
const RESULTS_SCHEMA = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: { index: { type: 'integer' }, result: { type: 'string' } },
        required: ['index', 'result'],
      },
    },
  },
  required: ['results'],
}

let items = a.items
if (a.file) {
  phase('List')
  const listed = await agent(
    `Read the file ${a.file} and return its non-empty lines, in order, one item per line, unchanged. Do not interpret them.`,
    { phase: 'List', model: 'haiku', effort: 'low', agentType: 'Explore', schema: LIST_SCHEMA },
  )
  if (!listed || !listed.items.length) return { error: `No items listed from ${a.file}.`, results: [] }
  items = listed.items
}
const asText = item => (typeof item === 'string' ? item : JSON.stringify(item))

const chunks = []
for (let start = 0; start < items.length; start += chunkSize) chunks.push(start)
log(`${items.length} items in ${chunks.length} chunk(s) of up to ${chunkSize} on ${model}`)

phase('Map')
const answers = await parallel(chunks.map((start, c) => () => agent(
  `Apply this instruction to each item below, independently.\nInstruction: ${a.instruction}\n\n` +
  `Return one result per item, keyed by the item's index number. Do not change any files.\n\n` +
  items.slice(start, start + chunkSize).map((item, j) => `[${start + j}] ${asText(item)}`).join('\n'),
  { phase: 'Map', label: `chunk:${c}`, model, effort: 'low', agentType: 'Explore', schema: RESULTS_SCHEMA },
)))

const byIndex = new Map()
const failedChunks = []
answers.forEach((ans, c) => {
  const start = chunks[c]
  if (!ans) { failedChunks.push(c); return }
  for (const r of ans.results) {
    // Accept only indices inside this chunk; the first answer wins.
    if (r.index >= start && r.index < start + chunkSize && r.index < items.length && !byIndex.has(r.index)) {
      byIndex.set(r.index, r.result)
    }
  }
})
const results = items.map((item, i) => ({ index: i, item, result: byIndex.has(i) ? byIndex.get(i) : null }))
const missing = results.filter(r => r.result === null).map(r => r.index)
if (missing.length) log(`${missing.length} item(s) have no result; failed chunks: ${failedChunks.join(', ') || 'none'}`)

return { instruction: a.instruction, model, results, missing, failedChunks }
