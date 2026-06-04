import fs from "node:fs/promises"

import { PATHS } from "~/lib/paths"
import { state } from "~/lib/state"

interface ModelRoutingConfig {
  responses_models: Array<string>
}

const DEFAULT_CONFIG: ModelRoutingConfig = {
  responses_models: [],
}

function normalizeModels(models: Array<string>): Array<string> {
  return [...new Set(models.map((x) => x.trim()).filter(Boolean))]
}

export async function loadModelRoutingConfig(): Promise<ModelRoutingConfig> {
  try {
    const raw = await fs.readFile(PATHS.MODEL_ROUTING_CONFIG_PATH)
    const parsed = JSON.parse(raw) as Partial<ModelRoutingConfig>
    const config = {
      responses_models: normalizeModels(
        parsed.responses_models || DEFAULT_CONFIG.responses_models,
      ),
    }
    state.responsesModels = config.responses_models
    return config
  } catch {
    state.responsesModels = DEFAULT_CONFIG.responses_models
    await saveModelRoutingConfig(DEFAULT_CONFIG.responses_models)
    return DEFAULT_CONFIG
  }
}

export async function saveModelRoutingConfig(
  models: Array<string>,
): Promise<ModelRoutingConfig> {
  const config = {
    responses_models: normalizeModels(models),
  }
  await fs.writeFile(
    PATHS.MODEL_ROUTING_CONFIG_PATH,
    JSON.stringify(config, null, 2),
  )
  state.responsesModels = config.responses_models
  return config
}
