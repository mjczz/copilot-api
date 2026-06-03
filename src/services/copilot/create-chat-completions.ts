// Backward-compat re-export shim. The canonical types live in
// src/services/transport/copilot-types and the canonical implementation
// lives in src/services/transport (dispatcher). This shim keeps existing
// imports (`~/services/copilot/create-chat-completions`) working until the
// handlers are migrated to use the dispatcher directly.

import {
  dispatchChatCompletions,
  type ChatCompletionsPayload,
} from "../transport"

/**
 * @deprecated Prefer `dispatchChatCompletions` from `~/services/transport`
 * so callers can supply a `DispatchContext`. This wrapper exists for
 * backward-compat with any external import path that still uses the old
 * `createChatCompletions(payload)` signature.
 */
export const createChatCompletions = (payload: ChatCompletionsPayload) =>
  dispatchChatCompletions(payload, {
    model: { id: payload.model, transport: "copilot", vendor: "OpenAI" },
    isAgentCall: false,
    vision: true,
  })

export type { DispatchContext, ModelTransport } from "../transport"

export { dispatchChatCompletions } from "../transport"
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
} from "../transport/copilot-types"
