import consola from "consola"
import { events } from "fetch-event-stream"

import { copilotBaseUrl, copilotHeaders } from "~/lib/api-config"
import { HTTPError } from "~/lib/error"
import { state } from "~/lib/state"

import type {
  AnthropicMessagesPayload,
  AnthropicResponse,
  AnthropicStreamEventData,
} from "./anthropic-types"

// Posts the Anthropic-format payload verbatim to Copilot's /v1/messages
// endpoint. Both the request and the response are already Anthropic-shaped,
// so no translation is involved — the proxy just bridges the auth token
// and forwards the body / SSE stream.
export async function copilotCreateMessages(
  payload: AnthropicMessagesPayload,
  isAgentCall: boolean,
): Promise<
  AsyncIterable<{ data?: string; event?: string }> | AnthropicResponse
> {
  if (!state.copilotToken) {
    throw new Error("Copilot token not found")
  }

  const enableVision = payload.messages.some(
    (m) =>
      Array.isArray(m.content) && m.content.some((b) => b.type === "image"),
  )

  const headers: Record<string, string> = {
    ...copilotHeaders(state, enableVision),
    "X-Initiator": isAgentCall ? "agent" : "user",
    accept: "application/json",
  }

  const response = await fetch(`${copilotBaseUrl(state)}/v1/messages`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errText = await response.text()
    consola.error(
      `Copilot /v1/messages error: ${response.status} ${errText.slice(0, 400)}`,
    )
    throw new HTTPError(
      `Copilot /v1/messages returned ${response.status}: ${errText.slice(0, 200)}`,
      response,
      errText,
    )
  }

  if (payload.stream) {
    return events(response)
  }

  return (await response.json()) as AnthropicResponse
}

// Re-export the stream event type so handlers can type-annotate passthrough
// streams when forwarding to Copilot's /v1/messages.
export type CopilotMessagesStream = AsyncIterable<{
  data?: string
  event?: string
  parsed?: AnthropicStreamEventData
}>
