import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger } from "hono/logger"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const __dirname = import.meta.dirname

import {
  loadModelRoutingConfig,
  saveModelRoutingConfig,
} from "~/lib/model-routing-config"

import { completionRoutes } from "./routes/chat-completions/route"
import { embeddingRoutes } from "./routes/embeddings/route"
import { messageRoutes } from "./routes/messages/route"
import { modelAliasesRoutes } from "./routes/model-aliases/route"
import { modelExtendedRoutes } from "./routes/models-extended/route"
import { modelRoutes } from "./routes/models/route"
import { responsesRoutes } from "./routes/responses/route"
import { tokenRoute } from "./routes/token/route"
import { usageRoute } from "./routes/usage/route"

export const server = new Hono()

server.use(logger())
server.use(cors())

server.get("/__diag/server-ts-version", (c) => {
  return c.text("server-ts-v2")
})

server.get("/", (c) => {
  return c.html(readFileSync(join(__dirname, "../pages/flow.html"), "utf8"))
})

server.get("/flow.html", (c) => {
  return c.html(readFileSync(join(__dirname, "../pages/flow.html"), "utf8"))
})

server.get("/index.html", (c) => {
  return c.html(readFileSync(join(__dirname, "../pages/index.html"), "utf8"))
})

server.get("/settings/model-routing", async (c) => {
  return c.json(await loadModelRoutingConfig())
})
server.post("/settings/model-routing", async (c) => {
  const body = await c.req.json<{ responses_models?: Array<string> }>()
  return c.json(await saveModelRoutingConfig(body.responses_models || []))
})
// Compatibility with tools that expect v1/ prefix
server.get("/v1/settings/model-routing", async (c) => {
  return c.json(await loadModelRoutingConfig())
})
server.post("/v1/settings/model-routing", async (c) => {
  const body = await c.req.json<{ responses_models?: Array<string> }>()
  return c.json(await saveModelRoutingConfig(body.responses_models || []))
})
server.route("/v1/chat/completions", completionRoutes)
server.route("/v1/responses", responsesRoutes)
server.route("/v1/models", modelRoutes)
server.route("/v1/embeddings", embeddingRoutes)
server.route("/token", tokenRoute)
server.route("/usage", usageRoute)

// Anthropic compatible endpoints
server.route("/v1/messages", messageRoutes)

// Extended model routes
server.route("/v1/models:full", modelExtendedRoutes)
server.route("/models:full", modelExtendedRoutes)
server.route("/v1/model-aliases", modelAliasesRoutes)
server.route("/model-aliases", modelAliasesRoutes)
