import type { ModelsResponse } from "~/services/copilot/get-models"
import type { ModelTransport } from "~/services/transport/types"

export interface State {
  githubToken?: string
  copilotToken?: string

  accountType: string
  models?: ModelsResponse
  vsCodeVersion?: string

  manualApprove: boolean
  rateLimitWait: boolean
  showToken: boolean

  // Rate limiting configuration
  rateLimitSeconds?: number
  lastRequestTimestamp?: number

  // Transport / routing extension
  modelTransports?: Record<string, ModelTransport>
  openAICompatibleProviders?: Record<
    string,
    { baseUrl: string; apiKeyEnv: string }
  >
  responsesModels?: Array<string>
}

export const state: State = {
  accountType: "individual",
  manualApprove: false,
  rateLimitWait: false,
  showToken: false,
  responsesModels: [],
}
