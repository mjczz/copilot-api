import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger } from "hono/logger"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { completionRoutes } from "./routes/chat-completions/route"
import { embeddingRoutes } from "./routes/embeddings/route"
import { messageRoutes } from "./routes/messages/route"
import { modelAliasesRoutes } from "./routes/model-aliases/route"
import { modelExtendedRoutes } from "./routes/models-extended/route"
import { modelRoutes } from "./routes/models/route"
import { tokenRoute } from "./routes/token/route"
import { usageRoute } from "./routes/usage/route"

const __filename = import.meta.filename
const __dirname = import.meta.dirname

export const server = new Hono()

server.use(logger())
server.use(cors())

server.get("/", (c) => {
  return c.html(readFileSync(join(__dirname, "../pages/flow.html"), "utf8"))
})

server.get("/flow.html", (c) => {
  return c.html(readFileSync(join(__dirname, "../pages/flow.html"), "utf8"))
})

server.get("/index.html", (c) => {
  return c.html(readFileSync(join(__dirname, "../pages/index.html"), "utf8"))
})

server.route("/chat/completions", completionRoutes)
server.route("/models", modelRoutes)
server.route("/embeddings", embeddingRoutes)
server.route("/usage", usageRoute)
server.route("/token", tokenRoute)

// Compatibility with tools that expect v1/ prefix
server.route("/v1/chat/completions", completionRoutes)
server.route("/v1/models", modelRoutes)
server.route("/v1/embeddings", embeddingRoutes)

// Anthropic compatible endpoints
server.route("/v1/messages", messageRoutes)

// Extended model routes
server.route("/v1/models:full", modelExtendedRoutes)
server.route("/models:full", modelExtendedRoutes)
server.route("/v1/model-aliases", modelAliasesRoutes)
server.route("/model-aliases", modelAliasesRoutes)
