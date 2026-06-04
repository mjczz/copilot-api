import type { Context } from "hono"

import consola from "consola"
import { streamSSE } from "hono/streaming"

import type {
  ResponsesPayload,
  ResponsesResponse,
} from "~/services/transport/responses-types"

import { awaitApproval } from "~/lib/approval"
import { resolveRoutedModel } from "~/lib/model-routing"
import { checkRateLimit } from "~/lib/rate-limit"
import { state } from "~/lib/state"
import {
  type ChatCompletionChunk,
  type ChatCompletionResponse,
  type DispatchContext,
  dispatchChatCompletions,
} from "~/services/copilot/create-chat-completions"
import { copilotCreateMessages } from "~/services/transport/copilot-messages"
import { copilotCreateResponses } from "~/services/transport/responses"

import {
  type AnthropicMessagesPayload,
  type AnthropicStreamState,
} from "./anthropic-types"
import {
  translateToAnthropic,
  translateToOpenAI,
} from "./non-stream-translation"
import {
  translateResponsesEventToAnthropic,
  translateResponsesToAnthropic,
  translateToResponses,
} from "./responses-translation"
import { translateChunkToAnthropicEvents } from "./stream-translation"

export async function handleCompletion(c: Context) {
  await checkRateLimit(state)

  const anthropicPayload = await c.req.json<AnthropicMessagesPayload>()
  consola.debug("Anthropic request payload:", JSON.stringify(anthropicPayload))

  // Resolve routing: alias the requested model, then pick the Copilot
  // endpoint. Three possible endpoints, all on api.githubcopilot.com:
  // - /v1/messages  : Claude-family ids (Anthropic-format passthrough)
  // - /v1/responses : models in the responses_models allowlist
  // - /v1/chat/completions : everything else
  const routed = resolveRoutedModel(anthropicPayload.model)
  consola.debug(
    `Routed ${routed.requestedModel} -> alias ${routed.aliasedModel} -> upstream ${routed.upstreamModel} (${routed.upstream}, endpoint=${routed.endpoint})`,
  )

  if (state.manualApprove) {
    await awaitApproval()
  }

  if (routed.endpoint === "messages") {
    return handleMessagesPath(anthropicPayload, c)
  }

  const useResponses = routed.endpoint === "responses"
  const openAIPayload =
    useResponses ? null : translateToOpenAI(anthropicPayload)
  const responsesPayload =
    useResponses ? translateToResponses(anthropicPayload) : null
  consola.debug(
    useResponses ?
      "Translated Responses request payload:"
    : "Translated OpenAI request payload:",
    JSON.stringify(useResponses ? responsesPayload : openAIPayload),
  )

  const isAgentCall = (
    openAIPayload?.messages || anthropicPayload.messages
  ).some((m) => m.role === "assistant" || m.role === "tool")
  const ctx: DispatchContext = {
    // Pass the resolved upstream id so the dispatcher can decide transport
    // selection. The translated payload's `model` is the id used for the
    // actual upstream call.
    model: {
      id: routed.upstreamModel,
      transport: useResponses ? ("copilot_responses" as const) : "copilot",
      vendor: useResponses ? "OpenAI Responses" : "OpenAI",
    },
    isAgentCall,
    vision: true,
  }

  if (useResponses) {
    return handleResponsesPath(
      responsesPayload as ResponsesPayload,
      isAgentCall,
      c,
    )
  }

  return handleChatCompletionsPath(
    openAIPayload as ReturnType<typeof translateToOpenAI>,
    ctx,
    c,
  )
}

// /v1/messages: pass the Anthropic-format body to Copilot's /v1/messages
// endpoint and stream/return the Anthropic-shaped response verbatim. Both
// ends speak the same protocol, so no translation is involved.
async function handleMessagesPath(
  anthropicPayload: AnthropicMessagesPayload,
  c: Context,
) {
  const isAgentCall = anthropicPayload.messages.some(
    (m) => m.role === "assistant",
  )
  const response = await copilotCreateMessages(anthropicPayload, isAgentCall)

  // Non-streaming: response is an Anthropic JSON object — return as-is.
  if (!anthropicPayload.stream || isAnthropicJsonResponse(response)) {
    consola.debug(
      "Non-streaming response from Copilot /v1/messages:",
      JSON.stringify(response).slice(-400),
    )
    return c.json(response)
  }

  // Streaming: pipe each SSE event through. The wire format matches what
  // Claude Code already expects.
  consola.debug("Streaming response from Copilot /v1/messages")
  return streamSSE(c, async (stream) => {
    for await (const rawEvent of response as AsyncIterable<{
      data?: string
      event?: string
    }>) {
      if (!rawEvent.data) continue
      await stream.writeSSE({
        event: rawEvent.event || "message",
        data: rawEvent.data,
      })
      if (rawEvent.data === "[DONE]") break
    }
  })
}

const isAnthropicJsonResponse = (
  r: Awaited<ReturnType<typeof copilotCreateMessages>>,
): r is Awaited<ReturnType<typeof copilotCreateMessages>> & object =>
  typeof r === "object"
  && !("data" in (r as object))
  && !(Symbol.asyncIterator in (r as object))

async function handleResponsesPath(
  responsesPayload: ResponsesPayload,
  isAgentCall: boolean,
  c: Context,
) {
  const response = await copilotCreateResponses(
    responsesPayload,
    isAgentCall,
    true,
  )

  if (isNonStreamingResponses(response)) {
    consola.debug(
      "Non-streaming response from Copilot responses:",
      JSON.stringify(response).slice(-400),
    )
    return c.json(translateResponsesToAnthropic(response))
  }

  consola.debug("Streaming response from Copilot responses")
  return streamSSE(c, async (stream) => {
    for await (const rawEvent of response) {
      consola.debug("Copilot raw responses event:", JSON.stringify(rawEvent))
      if (rawEvent.data === "[DONE]") {
        break
      }
      if (!rawEvent.data) {
        continue
      }

      const payload = JSON.parse(rawEvent.data) as ResponsesResponse
      const events = translateResponsesEventToAnthropic(
        rawEvent.event || "message",
        payload,
      )
      for (const event of events) {
        await stream.writeSSE({
          event: event.type,
          data: JSON.stringify(event),
        })
      }
    }
  })
}

async function handleChatCompletionsPath(
  openAIPayload: ReturnType<typeof translateToOpenAI>,
  ctx: DispatchContext,
  c: Context,
) {
  const response = await dispatchChatCompletions(openAIPayload, ctx)

  if (isNonStreaming(response)) {
    consola.debug(
      "Non-streaming response from Copilot:",
      JSON.stringify(response).slice(-400),
    )
    const anthropicResponse = translateToAnthropic(response)
    consola.debug(
      "Translated Anthropic response:",
      JSON.stringify(anthropicResponse),
    )
    return c.json(anthropicResponse)
  }

  const streamingResponse = response
  consola.debug("Streaming response from Copilot")
  return streamSSE(c, async (stream) => {
    const streamState: AnthropicStreamState = {
      messageStartSent: false,
      contentBlockIndex: 0,
      contentBlockOpen: false,
      toolCalls: {},
    }

    for await (const rawEvent of streamingResponse as AsyncIterable<{
      data?: string
      event?: string
    }>) {
      consola.debug("Copilot raw stream event:", JSON.stringify(rawEvent))
      if (rawEvent.data === "[DONE]") {
        break
      }

      if (!rawEvent.data) {
        continue
      }

      const chunk = JSON.parse(rawEvent.data) as ChatCompletionChunk
      const events = translateChunkToAnthropicEvents(chunk, streamState)

      for (const event of events) {
        consola.debug("Translated Anthropic event:", JSON.stringify(event))
        await stream.writeSSE({
          event: event.type,
          data: JSON.stringify(event),
        })
      }
    }
  })
}

const isNonStreaming = (
  response: Awaited<ReturnType<typeof dispatchChatCompletions>>,
): response is ChatCompletionResponse => Object.hasOwn(response, "choices")

const isNonStreamingResponses = (
  response: Awaited<ReturnType<typeof copilotCreateResponses>>,
): response is ResponsesResponse => Object.hasOwn(response, "object")
