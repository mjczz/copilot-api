export const meta = {
  name: 'inspect-copilot-routing',
  description: 'Inspect current flow.html and routing implementation, then summarize changes needed for Claude model forwarding',
  phases: [
    { title: 'Scan', detail: 'Locate flow UI and model routing files' },
    { title: 'Analyze', detail: 'Summarize current routing behavior and change points' }
  ]
}

const FILES_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    uiFiles: { type: 'array', items: { type: 'string' } },
    backendFiles: { type: 'array', items: { type: 'string' } },
    notes: { type: 'array', items: { type: 'string' } }
  },
  required: ['uiFiles', 'backendFiles', 'notes']
}

const ANALYSIS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    modelDefinitionLocations: { type: 'array', items: { type: 'string' } },
    routingLocations: { type: 'array', items: { type: 'string' } },
    recommendedChanges: { type: 'array', items: { type: 'string' } }
  },
  required: ['summary', 'modelDefinitionLocations', 'routingLocations', 'recommendedChanges']
}

phase('Scan')
const files = await agent(
  'In the current repository, locate the files that implement flow.html, model selectors, provider/model routing, and any GPT/OpenAI-compatible forwarding logic. Return only the most relevant files and concise notes.',
  { schema: FILES_SCHEMA, label: 'locate-files', agentType: 'Explore' }
)

phase('Analyze')
const analysis = await agent(
  `Based on these candidate files:\nUI files: ${files.uiFiles.join(', ')}\nBackend files: ${files.backendFiles.join(', ')}\nNotes: ${files.notes.join(' | ')}\n\nSummarize how flow.html currently defines/selects models, how requests are routed upstream, whether Claude models already exist, and what concrete code changes are needed to support defining Claude models that forward similarly to GPT-series models. Reference likely files/areas only; do not modify code.`,
  { schema: ANALYSIS_SCHEMA, label: 'analyze-routing' }
)

return { files, analysis }