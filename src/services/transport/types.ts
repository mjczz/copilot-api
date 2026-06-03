import type { ChatCompletionResponse } from "./copilot-types"

export type ModelTransport =
  | "copilot"
  | "openai_native"
  | "openai_compatible_proxy"

export interface DispatchContext {
  model: { id: string; transport: ModelTransport; vendor: string }
  isAgentCall: boolean
  vision: boolean
}

// All transports yield Server-Sent-Event messages whose `.data` is a JSON
// string (the chat-completion chunk payload, or the sentinel `[DONE]`).
// Using this loose item shape preserves byte-for-byte behavior across the
// three backends and keeps the existing translation paths (`for await` then
// `JSON.parse(rawEvent.data)`) working without changes. Callers treat each
// item as `unknown` at the type level and parse as needed.
export type DispatchResult =
  | AsyncIterable<{ data?: string }>
  | ChatCompletionResponse

// Re-export the canonical types from copilot-types so the transport layer is
// the single source of truth. Do not duplicate definitions here.
export type {
  ChatCompletionChunk,
  ChatCompletionResponse,
  ChatCompletionsPayload,
  ContentPart,
  ImagePart,
  Message,
  TextPart,
  Tool,
  ToolCall,
} from "./copilot-types"
