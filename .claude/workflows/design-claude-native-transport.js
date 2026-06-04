export const meta = {
  name: 'design-claude-native-transport',
  description: 'Explore transports, design anthropic_native transport, and return concrete file-level change list for Claude-native passthrough',
  phases: [
    { title: 'Explore', detail: 'Map current transports, env config, and Copilot models' },
    { title: 'Design', detail: 'Design anthropic_native transport, env vars, and routing rules' },
    { title: 'Synthesize', detail: 'List concrete file edits needed' }
  ]
}

const FILES_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    transportFiles: { type: 'array', items: { type: 'string' } },
    handlerFiles: { type: 'array', items: { type: 'string' } },
    envConfigFiles: { type: 'array', items: { type: 'string' } },
    copilotModelFiles: { type: 'array', items: { type: 'string' } },
    modelRoutingFiles: { type: 'array', items: { type: 'string' } },
    uiFiles: { type: 'array', items: { type: 'string' } },
    notes: { type: 'array', items: { type: 'string' } }
  },
  required: [
    'transportFiles', 'handlerFiles', 'envConfigFiles', 'copilotModelFiles',
    'modelRoutingFiles', 'uiFiles', 'notes'
  ]
}

const DESIGN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    target: { type: 'string' },
    envVars: { type: 'array', items: { type: 'string' } },
    transportId: { type: 'string' },
    transportFiles: { type: 'array', items: { type: 'string' } },
    pathDecisions: { type: 'array', items: { type: 'string' } },
    streamingNotes: { type: 'array', items: { type: 'string' } },
    risks: { type: 'array', items: { type: 'string' } }
  },
  required: ['target', 'envVars', 'transportId', 'transportFiles', 'pathDecisions', 'streamingNotes', 'risks']
}

const CHANGES_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    edits: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          file: { type: 'string' },
          purpose: { type: 'string' },
          hint: { type: 'string' }
        },
        required: ['file', 'purpose', 'hint']
      }
    }
  },
  required: ['edits']
}

phase('Explore')
const files = await agent(
  'Map the files needed to add a new "anthropic_native" transport to this project (so users can pick real Claude models, not GPT-forwards). Return only the most relevant paths and short notes. Required groups:\n- transportFiles: services/transport/* (types, index dispatcher, openai-native, openai-compatible, any copilot responses/copilot dispatcher)\n- handlerFiles: routes/messages/handler.ts and anthropic-types.ts\n- envConfigFiles: lib/api-config.ts, lib/state.ts, lib/env.ts, lib/paths.ts, main.ts, anything that reads ANTHROPIC_* env vars\n- copilotModelFiles: services/copilot/get-models.ts and the catalog exposed by /v1/models\n- modelRoutingFiles: lib/model-routing.ts, lib/model-routing-config.ts\n- uiFiles: pages/flow.html, pages/index.html\nFor each, give a one-line note about what role it plays.',
  { schema: FILES_SCHEMA, label: 'map-files', agentType: 'Explore' }
)

phase('Design')
const design = await agent(
  `You are designing a new "anthropic_native" transport for this Copilot-API proxy. The user wants flow.html to expose real Claude model ids (e.g. claude-sonnet-4-5, claude-opus-4-1, claude-haiku-4-5) and have the proxy actually call Anthropic's /v1/messages (no translation, no GPT forward). Copilot and OpenAI transports already exist; mirror their structure.

Reference files to consider: ${files.transportFiles.concat(files.handlerFiles).concat(files.envConfigFiles).concat(files.copilotModelFiles).concat(files.modelRoutingFiles).join(', ')}

Notes from the explorer: ${files.notes.join(' | ')}

Required output:
- target: which upstream (api.anthropic.com by default, override via env)
- envVars: list names like ANTHROPIC_API_KEY, ANTHROPIC_BASE_URL, ANTHROPIC_API_VERSION, ANTHROPIC_CUSTOM_HEADERS, with a one-line role
- transportId: the literal string to add to ModelTransport
- transportFiles: list of file paths to create/modify
- pathDecisions: how the handler decides "use anthropic_native" (e.g. new field on RoutedModel called upstream, plus mapping for Claude model ids)
- streamingNotes: how SSE / non-stream differs from the OpenAI transports; what header to add (x-api-key, anthropic-version)
- risks: anything that could break (e.g. Claude Code's system prompt field, max_tokens, tools format already matches Anthropic, no translation needed; or whether to pass through verbatim).`,
  { schema: DESIGN_SCHEMA, label: 'design-transport' }
)

phase('Synthesize')
const changes = await agent(
  `Produce a concrete file-edit list for implementing an anthropic_native transport.

Design inputs:
- target: ${design.target}
- envVars: ${design.envVars.join(', ')}
- transportId: ${design.transportId}
- transportFiles: ${design.transportFiles.join(', ')}
- pathDecisions: ${design.pathDecisions.join(' | ')}
- streamingNotes: ${design.streamingNotes.join(' | ')}
- risks: ${design.risks.join(' | ')}

For each file, give {file, purpose, hint}. Order them in implementation order. Do not modify any files — this is the plan.`,
  { schema: CHANGES_SCHEMA, label: 'list-edits' }
)

return { files, design, changes }