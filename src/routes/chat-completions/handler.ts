import type { Context } from "hono"

import consola from "consola"
import { streamSSE, type SSEMessage } from "hono/streaming"

import { awaitApproval } from "~/lib/approval"
import { checkRateLimit } from "~/lib/rate-limit"
import { state } from "~/lib/state"
import { getTokenCount } from "~/lib/tokenizer"
import { isNullish } from "~/lib/utils"
import {
  type ChatCompletionResponse,
  type ChatCompletionsPayload,
  type DispatchContext,
  dispatchChatCompletions,
} from "~/services/copilot/create-chat-completions"

export async function handleCompletion(c: Context) {
  await checkRateLimit(state)

  let payload = await c.req.json<ChatCompletionsPayload>()
  consola.debug("Request payload:", JSON.stringify(payload).slice(-400))

  // Find the selected model
  const selectedModel = state.models?.data.find(
    (model) => model.id === payload.model,
  )

  // Calculate and display token count
  try {
    if (selectedModel) {
      const tokenCount = await getTokenCount(payload, selectedModel)
      consola.info("Current token count:", tokenCount)
    } else {
      consola.warn("No model selected, skipping token count calculation")
    }
  } catch (error) {
    consola.warn("Failed to calculate token count:", error)
  }

  if (state.manualApprove) await awaitApproval()

  if (isNullish(payload.max_completion_tokens)) {
    payload = {
      ...payload,
      max_completion_tokens:
        selectedModel?.capabilities.limits.max_output_tokens,
    }
    consola.debug(
      "Set max_completion_tokens to:",
      JSON.stringify(payload.max_completion_tokens),
    )
  }

  const isAgentCall = payload.messages.some(
    (m) => m.role === "assistant" || m.role === "tool",
  )
  const ctx: DispatchContext = {
    model: { id: payload.model, transport: "copilot", vendor: "OpenAI" },
    isAgentCall,
    vision: true,
  }

  const response = await dispatchChatCompletions(payload, ctx)

  if (isNonStreaming(response)) {
    consola.debug("Non-streaming response:", JSON.stringify(response))
    return c.json(response)
  }

  if (!isStreamingResponse(response)) {
    throw new Error("Unexpected non-stream response shape")
  }

  consola.debug("Streaming response")
  return streamSSE(c, async (stream) => {
    for await (const chunk of response) {
      consola.debug("Streaming chunk:", JSON.stringify(chunk))
      await stream.writeSSE(chunk as SSEMessage)
    }
  })
}

const isNonStreaming = (
  response: Awaited<ReturnType<typeof dispatchChatCompletions>>,
): response is ChatCompletionResponse => Object.hasOwn(response, "choices")

const isStreamingResponse = (
  response: Awaited<ReturnType<typeof dispatchChatCompletions>>,
): response is AsyncIterable<{ data?: string; event?: string }> =>
  !Object.hasOwn(response, "choices")
