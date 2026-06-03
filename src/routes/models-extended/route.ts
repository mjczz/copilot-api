import { Hono } from "hono"

import type { ModelTransport } from "~/services/transport/types"

import { getAllKnownAliases } from "~/lib/model-routing"
import { state } from "~/lib/state"

export const modelExtendedRoutes = new Hono()

const matchWildcard = (pattern: string, modelId: string): boolean => {
  // Convert a wildcard pattern like "claude-sonnet-4-*" into a RegExp
  // by escaping all regex meta-characters except '*', then translating
  // '*' to '.*' anchored at the start.
  const escaped = pattern.replaceAll(/[.+?^${}()|[\]\\]/g, String.raw`\$&`)
  const regex = new RegExp(`^${escaped.replaceAll("*", ".*")}`)
  return regex.test(modelId)
}

modelExtendedRoutes.get("/", (c) => {
  if (!state.models) {
    return c.json({ object: "list", data: [] })
  }

  return c.json({
    object: "list",
    data: state.models.data.map((m) => ({
      ...m,
      transport: "copilot" as ModelTransport,
      aliases: getAllKnownAliases().filter((a) => matchWildcard(a, m.id)),
      display_endpoint: "POST /v1/chat/completions",
      chat_completions_compatible: true,
    })),
  })
})
