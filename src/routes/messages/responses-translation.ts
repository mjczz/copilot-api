import type {
  ResponseInputContent,
  ResponseInputItem,
  ResponseOutputContent,
  ResponsesPayload,
  ResponsesResponse,
} from "~/services/transport/responses-types"

import { resolveModelAlias } from "~/lib/model-routing"

import {
  type AnthropicMessagesPayload,
  type AnthropicResponse,
  type AnthropicStreamEventData,
} from "./anthropic-types"

export function translateToResponses(
  payload: AnthropicMessagesPayload,
): ResponsesPayload {
  const input: Array<ResponseInputItem> = []

  if (payload.system) {
    const systemText =
      typeof payload.system === "string" ?
        payload.system
      : payload.system.map((block) => block.text).join("\n\n")
    if (systemText) {
      input.push({
        role: "system",
        content: [{ type: "input_text", text: systemText }],
      })
    }
  }

  for (const message of payload.messages) {
    if (typeof message.content === "string") {
      if (message.role === "assistant") {
        input.push({
          role: "assistant",
          content: [{ type: "output_text", text: message.content }],
        })
      } else {
        input.push({
          role: "user",
          content: [{ type: "input_text", text: message.content }],
        })
      }
      continue
    }

    if (message.role === "assistant") {
      // Assistant turns: text → output_text. Images aren't valid here, skip them.
      const content: Array<ResponseOutputContent> = []
      for (const block of message.content) {
        if (block.type === "text") {
          content.push({ type: "output_text", text: block.text })
        }
      }
      if (content.length > 0) {
        input.push({ role: "assistant", content })
      }
      continue
    }

    // User turns: text → input_text, images → input_image.
    const content: Array<ResponseInputContent> = []
    for (const block of message.content) {
      if (block.type === "text") {
        content.push({ type: "input_text", text: block.text })
      }

      if (block.type === "image") {
        content.push({
          type: "input_image",
          image_url: `data:${block.source.media_type};base64,${block.source.data}`,
        })
      }
    }

    if (content.length > 0) {
      input.push({ role: "user", content })
    }
  }

  return {
    model: resolveModelAlias(payload.model),
    input,
    stream: payload.stream,
    max_output_tokens: payload.max_completion_tokens,
    temperature: payload.temperature,
    top_p: payload.top_p,
    user: truncateUserId(payload.metadata?.user_id),
  }
}

// Upstream APIs (e.g. OpenAI-compatible) cap the `user` field at 64 chars.
// Claude Code sends a longer hashed user_id, so we truncate to stay within
// the limit while preserving enough entropy for upstream rate-limit buckets.
function truncateUserId(userId: string | undefined): string | undefined {
  if (!userId) return undefined
  return userId.length > 64 ? userId.slice(0, 64) : userId
}

export function translateResponsesToAnthropic(
  response: ResponsesResponse,
): AnthropicResponse {
  const outputItems = (response.output || []).flatMap(
    (item) => item.content || [],
  )
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const textParts = outputItems.filter((part) => part.type === "output_text")
  const text = textParts.map((part) => part.text).join("\n\n")

  const usage = response.usage
  return {
    id: response.id,
    type: "message",
    role: "assistant",
    model: response.model,
    content: text ? [{ type: "text", text }] : [],
    stop_reason: response.status === "completed" ? "end_turn" : null,
    stop_sequence: null,
    usage: {
      input_tokens:
        (usage?.input_tokens ?? 0)
        - (usage?.input_tokens_details?.cached_tokens ?? 0),
      output_tokens: usage?.output_tokens ?? 0,
      ...(usage?.input_tokens_details?.cached_tokens !== undefined && {
        cache_read_input_tokens: usage.input_tokens_details.cached_tokens,
      }),
    },
  }
}

export function translateResponsesEventToAnthropic(
  eventName: string,
  payload: ResponsesResponse,
): Array<AnthropicStreamEventData> {
  if (eventName === "response.output_text.delta") {
    return [
      {
        type: "content_block_delta",
        index: 0,
        delta: {
          type: "text_delta",
          text:
            (
              typeof (payload as unknown as { delta?: string }).delta
              === "string"
            ) ?
              (payload as unknown as { delta: string }).delta
            : "",
        },
      },
    ]
  }

  if (eventName === "response.created") {
    return [
      {
        type: "message_start",
        message: {
          id: payload.id,
          type: "message",
          role: "assistant",
          content: [],
          model: payload.model,
          stop_reason: null,
          stop_sequence: null,
          usage: {
            input_tokens: 0,
            output_tokens: 0,
          },
        },
      },
      {
        type: "content_block_start",
        index: 0,
        content_block: {
          type: "text",
          text: "",
        },
      },
    ]
  }

  if (eventName === "response.completed") {
    return translateResponsesCompleted(payload)
  }

  return []
}

function translateResponsesCompleted(
  payload: ResponsesResponse,
): Array<AnthropicStreamEventData> {
  const usage = payload.response?.usage ?? payload.usage
  return [
    {
      type: "content_block_stop",
      index: 0,
    },
    {
      type: "message_delta",
      delta: {
        stop_reason: "end_turn",
        stop_sequence: null,
      },
      usage: {
        input_tokens:
          (usage?.input_tokens ?? 0)
          - (usage?.input_tokens_details?.cached_tokens ?? 0),
        output_tokens: usage?.output_tokens ?? 0,
        ...(usage?.input_tokens_details?.cached_tokens !== undefined && {
          cache_read_input_tokens: usage.input_tokens_details.cached_tokens,
        }),
      },
    },
    {
      type: "message_stop",
    },
  ]
}
