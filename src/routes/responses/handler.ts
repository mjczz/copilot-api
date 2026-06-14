import type { Context } from "hono"

import consola from "consola"
import { streamSSE } from "hono/streaming"

import type {
  ResponsesPayload,
  ResponsesResponse,
} from "~/services/transport/responses-types"

import { awaitApproval } from "~/lib/approval"
import { checkRateLimit } from "~/lib/rate-limit"
import { state } from "~/lib/state"
import { copilotCreateResponses } from "~/services/transport/responses"

// The Responses spec's `tools` field isn't modelled on ResponsesPayload, but
// clients (Codex) send it. We type it here so we can sanitise it.
type InboundResponsesPayload = ResponsesPayload & {
  tools?: Array<ResponsesTool>
}

type ResponsesTool = { type?: string; [key: string]: unknown }

// Tool types upstream Copilot `/responses` is known to REJECT. Keep this list
// minimal and specific — only the confirmed-bad ones — so we don't strip
// capability the backend actually supports. `image_generation` returns a 400
// `unsupported_value`; others (web_search, tool_search, ...) are passed
// through and will surface a clear upstream error if Copilot rejects them.
const UNSUPPORTED_TOOL_TYPES = new Set(["image_generation"])

// Native OpenAI Responses API endpoint (`POST /v1/responses`).
//
// Unlike the `/v1/messages` handler — which may route to upstream Copilot
// `/responses` internally and then *translate* the result back to the
// Anthropic shape — this endpoint speaks the Responses protocol on BOTH ends.
// Clients like Codex send a native Responses payload and expect native
// Responses events back, so we forward the request (sanitising tools) and
// relay the upstream SSE stream without any translation.
export async function handleResponses(c: Context) {
  await checkRateLimit(state)

  if (state.manualApprove) {
    await awaitApproval()
  }

  // The TS type is a minimal subset of the Responses spec; the runtime object
  // keeps every field the client sent (instructions, tools, reasoning, ...),
  // and copilotCreateResponses forwards it untouched via JSON.stringify.
  const payload = await c.req.json<InboundResponsesPayload>()
  stripUnsupportedTools(payload)
  consola.debug(
    "Responses request payload:",
    JSON.stringify(payload).slice(-400),
  )

  const isAgentCall = hasAssistantInput(payload.input)
  const response = await copilotCreateResponses(payload, isAgentCall, true)

  // Non-streaming: upstream returns a Responses-shaped JSON object — return as-is.
  if (isNonStreamingResponses(response)) {
    consola.debug(
      "Non-streaming response from Copilot /responses:",
      JSON.stringify(response).slice(-400),
    )
    return c.json(response)
  }

  // Streaming: relay each upstream SSE event verbatim. The wire format is
  // already what Responses-API clients (Codex) expect.
  consola.debug("Streaming response from Copilot /responses")
  return streamSSE(c, async (stream) => {
    for await (const rawEvent of response as AsyncIterable<{
      data?: string
      event?: string
    }>) {
      if (!rawEvent.data) {
        continue
      }
      await stream.writeSSE({
        event: rawEvent.event || "message",
        data: rawEvent.data,
      })
      if (rawEvent.data === "[DONE]") {
        break
      }
    }
  })
}

// Drop tools upstream Copilot `/responses` rejects. Mutates `payload` in
// place (the object is about to be JSON.stringify'd for forwarding).
const stripUnsupportedTools = (payload: InboundResponsesPayload): void => {
  if (!Array.isArray(payload.tools) || payload.tools.length === 0) {
    return
  }
  const kept = payload.tools.filter(
    (tool) => !UNSUPPORTED_TOOL_TYPES.has(tool.type ?? ""),
  )
  const dropped = payload.tools.length - kept.length
  if (dropped > 0) {
    const names = payload.tools
      .filter((tool) => UNSUPPORTED_TOOL_TYPES.has(tool.type ?? ""))
      .map((tool) => tool.type ?? "unknown")
    consola.warn(
      `Stripped ${dropped} unsupported Responses tool(s) Copilot can't run: ${names.join(", ")}`,
    )
  }
  payload.tools = kept
}

// A call is "agentic" (X-Initiator: agent) when the conversation already
// contains assistant turns, mirroring the logic in the /v1/messages handler.
const hasAssistantInput = (input: ResponsesPayload["input"]): boolean => {
  if (typeof input === "string") {
    return false
  }
  return input.some((item) => item.role === "assistant")
}

const isNonStreamingResponses = (
  response: Awaited<ReturnType<typeof copilotCreateResponses>>,
): response is ResponsesResponse => Object.hasOwn(response, "object")
