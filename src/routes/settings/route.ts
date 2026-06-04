import { Hono } from "hono"

import {
  loadModelRoutingConfig,
  saveModelRoutingConfig,
} from "~/lib/model-routing-config"

export const settingsRoutes = new Hono()

settingsRoutes.get("/model-routing", async (c) => {
  return c.json(await loadModelRoutingConfig())
})

settingsRoutes.post("/model-routing", async (c) => {
  const body = await c.req.json<{ responses_models?: Array<string> }>()
  return c.json(await saveModelRoutingConfig(body.responses_models || []))
})
