import consola from "consola"
import { events } from "fetch-event-stream"

import { HTTPError } from "~/lib/error"

import type {
  ChatCompletionResponse,
  ChatCompletionsPayload,
  DispatchResult,
} from "./types"

export async function openaiCompatibleCreateChatCompletions(
  payload: ChatCompletionsPayload,
  opts?: { baseUrl?: string; apiKey?: string },
): Promise<DispatchResult> {
  const baseUrl = opts?.baseUrl ?? process.env.OPENAI_COMPATIBLE_BASE_URL
  const apiKey = opts?.apiKey ?? process.env.OPENAI_COMPATIBLE_API_KEY

  if (!baseUrl) throw new Error("OPENAI_COMPATIBLE_BASE_URL is not set")

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers,
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
