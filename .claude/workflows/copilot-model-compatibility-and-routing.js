export const meta = {
  name: 'copilot-model-compatibility-and-routing',
  description: 'Audit model compatibility, determine gpt-5.5 routing, design endpoint split, and identify frontend changes',
  phases: [
    { title: 'Inspect', detail: 'Read backend and frontend code paths for model selection and request routing' },
    { title: 'Research', detail: 'Determine which models work with chat completions and what endpoint gpt-5.5 requires' },
    { title: 'Design', detail: 'Propose backend routing and frontend display changes' }
  ]
}

const FILES = [
  '/Users/ccc/ai/copilot-api/src/server.ts',
  '/Users/ccc/ai/copilot-api/src/start.ts',
  '/Users/ccc/ai/copilot-api/src/routes/models/route.ts',
  '/Users/ccc/ai/copilot-api/src/routes/messages/route.ts',
  '/Users/ccc/ai/copilot-api/src/routes/messages/non-stream-translation.ts',
  '/Users/ccc/ai/copilot-api/src/routes/chat-completions/handler.ts',
  '/Users/ccc/ai/copilot-api/src/services/copilot/create-chat-completions.ts'
]

phase('Inspect')
const codeMap = await agent(
  `Inspect this repository and summarize: (1) where models are fetched and exposed, (2) where /v1/messages is translated and routed, (3) any existing frontend page or usage viewer related to models, and (4) concrete files likely needing changes for frontend display. Focus on these files: ${FILES.join(', ')}. Also search nearby frontend assets/routes if needed. Return a concise but specific implementation map with file paths.`,
  { label: 'repo-inspection', agentType: 'general-purpose' }
)

phase('Research')
const [chatCompat, gpt55Endpoint] = await parallel([
  () => agent(
    `Research current OpenAI/API compatibility for these models in June 2026: gemini-3.1-pro-preview, gpt-5.2-codex, gpt-5.3-codex, gpt-5.4, gpt-5.5, gpt-4o-mini-2024-07-18, gpt-4o-2024-11-20. Determine which are compatible with the /chat/completions endpoint versus requiring another endpoint. Prefer authoritative docs or explicit error semantics. Return a model-by-model table with confidence and reasoning.`,
    { label: 'chat-compat-research', agentType: 'claude-code-guide' }
  ),
  () => agent(
    `Research what request pattern/endpoint gpt-5.5 should use instead of /chat/completions, including how tool calling and streaming are represented, and what migration considerations apply when translating from Anthropic-style /v1/messages input. Prefer authoritative docs for June 2026.`,
    { label: 'gpt55-endpoint-research', agentType: 'claude-code-guide' }
  )
])

phase('Design')
const design = await agent(
  `Using the repository inspection and API research below, produce a concrete implementation plan for this project that covers all of the following:
1. Show which models are compatible with /chat/completions.
2. For incompatible models, explain what endpoint style they should use instead, especially gpt-5.5.
3. Design a backend endpoint-routing solution that supports gpt-5.5 while preserving current /v1/messages behavior.
4. Design frontend/UI changes to display compatibility and routing info clearly.

Constraints:
- This is a Bun/TypeScript repo.
- Current implementation hardcodes /chat/completions upstream.
- Include proposed new/changed files, data shapes, and translation boundaries.
- Separate MVP from follow-up improvements.
- Be specific enough that implementation can begin immediately.

Repository inspection:
${codeMap}

Compatibility research:
${chatCompat}

GPT-5.5 endpoint research:
${gpt55Endpoint}`,
    { label: 'implementation-design', agentType: 'Plan' }
)

return {
  codeMap,
  chatCompat,
  gpt55Endpoint,
  design,
}
