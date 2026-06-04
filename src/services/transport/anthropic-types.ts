// Anthropic-native transport types. The upstream IS Anthropic, so the
// request/response shapes are the same as the /v1/messages protocol Claude
// Code already speaks. We re-export the canonical Anthropic types so the
// transport layer is the single source of truth.

export type {
  AnthropicAssistantMessage,
  AnthropicImageBlock,
  AnthropicMessage,
  AnthropicMessagesPayload,
  AnthropicResponse,
  AnthropicStreamEventData,
  AnthropicTextBlock,
  AnthropicUserMessage,
} from "~/routes/messages/anthropic-types"
