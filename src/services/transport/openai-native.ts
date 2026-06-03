import consola from "consola"
import { events } from "fetch-event-stream"

import { HTTPError } from "~/lib/error"

import type {
  ChatCompletionResponse,
  ChatCompletionsPayload,
  DispatchResult,
} from "./types"

export async function openaiNativeCreateChatCompletions(
  payload: ChatCompletionsPayload,
): Promise<DispatchResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set")

  const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1"

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    consola.error("Failed to create chat completions", response)
    throw new HTTPError("Failed to create chat completions", response)
  }

  if (payload.stream) {
    return events(response)
  }

  return (await response.json()) as ChatCompletionResponse
}
