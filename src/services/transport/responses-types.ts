export interface ResponsesPayload {
  model: string
  input: string | Array<ResponseInputItem>
  stream?: boolean
  max_output_tokens?: number | null
  temperature?: number | null
  top_p?: number | null
  user?: string | null
}

export interface ResponseInputItem {
  role: "user" | "assistant" | "system"
  content: Array<ResponseInputContent>
}

export type ResponseInputContent = ResponseInputText | ResponseInputImage

export interface ResponseInputText {
  type: "input_text"
  text: string
}

export interface ResponseInputImage {
  type: "input_image"
  image_url: string
}

export interface ResponsesUsage {
  input_tokens: number
  output_tokens: number
  total_tokens: number
  input_tokens_details?: {
    cached_tokens?: number
  }
  output_tokens_details?: {
    reasoning_tokens?: number
  }
}

export interface ResponsesOutputText {
  type: "output_text"
  text: string
}

export interface ResponsesOutputItem {
  type: string
  role?: "assistant"
  status?: string
  content?: Array<ResponsesOutputText>
}

export interface ResponsesResponse {
  id: string
  object: "response"
  model: string
  status: string
  output?: Array<ResponsesOutputItem>
  usage?: ResponsesUsage
  response?: ResponsesResponse
}
