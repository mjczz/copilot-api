import type { ModelTransport } from "~/services/transport/types"

import { state } from "~/lib/state"

export type ModelAliasRule = {
  match: RegExp
  resolve: (id: string) => string
  notes: string
}

export type RoutedModel = {
  requestedModel: string
  aliasedModel: string
  upstreamModel: string
  upstream: ModelTransport
  endpoint: "responses" | "chat_completions" | "messages"
}

export const MODEL_ALIASES: Array<ModelAliasRule> = [
  // Claude Code subagent ids append a YYYYMMDD date. Real Claude model
  // versions use a short version suffix (e.g. `-4-5`, `-4-1`), so we only
  // collapse dated ids to the bare model name.
  {
    match: /^claude-sonnet-4-\d{8}$/,
    resolve: () => "claude-sonnet-4",
    notes: "Claude Code subagent ids",
  },
  {
    match: /^claude-opus-4-\d{8}$/,
    resolve: () => "claude-opus-4",
    notes: "Claude Code subagent ids",
  },
]

// Claude-family model ids are routed to Copilot's /v1/messages endpoint
// (Anthropic-format passthrough). The user explicitly chose this third
// endpoint for Claude traffic — the body and SSE wire format match what
// Claude Code already speaks, so no translation is involved.
const CLAUDE_MODEL_PATTERN = /^claude-/

export function isClaudeModelId(id: string): boolean {
  return CLAUDE_MODEL_PATTERN.test(id)
}

export function resolveModelAlias(id: string): string {
  return MODEL_ALIASES.find((r) => r.match.test(id))?.resolve(id) ?? id
}

// Route a requested model to an upstream. The proxy always speaks
// https://api.githubcopilot.com — the only decision is which Copilot
// endpoint to hit:
// - /v1/messages  : Claude-family ids (Anthropic passthrough)
// - /v1/responses : models in the responses_models allowlist
// - /v1/chat/completions : everything else
export function resolveRoutedModel(id: string): RoutedModel {
  const aliasedModel = resolveModelAlias(id)
  const upstreamModel = aliasedModel

  if (isClaudeModelId(upstreamModel)) {
    return {
      requestedModel: id,
      aliasedModel,
      upstreamModel,
      upstream: "copilot_messages",
      endpoint: "messages",
    }
  }

  const useResponses = getConfiguredResponsesModels().includes(upstreamModel)
  return {
    requestedModel: id,
    aliasedModel,
    upstreamModel,
    upstream: useResponses ? "copilot_responses" : "copilot",
    endpoint: useResponses ? "responses" : "chat_completions",
  }
}

export function getAllKnownAliases(): Array<string> {
  return ["claude-sonnet-4-*", "claude-opus-4-*"]
}

export function getConfiguredResponsesModels(): Array<string> {
  return state.responsesModels || ["gpt-5.5"]
}

export function isResponsesModel(id: string): boolean {
  return getConfiguredResponsesModels().includes(id)
}

export function getModelEndpointPreference(
  id: string,
): "responses" | "chat_completions" {
  return getConfiguredResponsesModels().includes(id) ?
      "responses"
    : "chat_completions"
}
