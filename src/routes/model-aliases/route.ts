import { Hono } from "hono"

import { MODEL_ALIASES } from "~/lib/model-routing"

export const modelAliasesRoutes = new Hono()

modelAliasesRoutes.get("/", (c) => {
  return c.json({
    rules: MODEL_ALIASES.map((r) => ({
      pattern: r.match.source,
      resolvesTo: r.resolve("placeholder"),
      notes: r.notes,
    })),
  })
})
