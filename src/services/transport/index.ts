import type {
  ChatCompletionsPayload,
  DispatchContext,
  DispatchResult,
} from "./types"

import { copilotCreateChatCompletions } from "./copilot"
import { openaiCompatibleCreateChatCompletions } from "./openai-compatible"
import { openaiNativeCreateChatCompletions } from "./openai-native"

export async function dispatchChatCompletions(
  payload: ChatCompletionsPayload,
  ctx: DispatchContext,
): Promise<DispatchResult> {
  switch (ctx.model.transport) {
    case "openai_native": {
      return openaiNativeCreateChatCompletions(payload)
    }
    case "openai_compatible_proxy": {
      return openaiCompatibleCreateChatCompletions(payload)
    }
    default: {
      return copilotCreateChatCompletions(payload)
    }
  }
}

export { copilotCreateChatCompletions } from "./copilot"

export { openaiCompatibleCreateChatCompletions } from "./openai-compatible"
export { openaiNativeCreateChatCompletions } from "./openai-native"
export type {
  ChatCompletionChunk,
  ChatCompletionResponse,
  ChatCompletionsPayload,
  DispatchContext,
  DispatchResult,
  ModelTransport,
} from "./types"
