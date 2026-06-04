import { state } from "~/lib/state"

export type ModelAliasRule = {
  match: RegExp
  resolve: (id: string) => string
  notes: string
}

export const MODEL_ALIASES: Array<ModelAliasRule> = [
  {
    match: /^claude-sonnet-4-/,
    resolve: () => "claude-sonnet-4",
    notes: "Claude Code subagent ids",
  },
  {
    match: /^claude-opus-4-/,
    resolve: () => "claude-opus-4",
    notes: "Claude Code subagent ids",
  },
]

export function resolveModelAlias(id: string): string {
  return MODEL_ALIASES.find((r) => r.match.test(id))?.resolve(id) ?? id
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
  return isResponsesModel(id) ? "responses" : "chat_completions"
}
