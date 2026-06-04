export interface ResponsesPayload {
  model: string
  input: string | Array<ResponseInputItem>
  stream?: boolean
  max_output_tokens?: number | null
  temperature?: number | null
  top_p?: number | null
  user?: string | null
}

export type ResponseInputItem =
  | ResponseUserItem
  | ResponseSystemItem
  | ResponseAssistantItem

export interface ResponseUserItem {
  role: "user"
  content: Array<ResponseInputContent>
}

export interface ResponseSystemItem {
  role: "system"
  content: Array<ResponseInputContent>
}

export interface ResponseAssistantItem {
  role: "assistant"
  content: Array<ResponseOutputContent>
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

// Assistant content parts must use `output_text` (or `refusal`) per the
// Responses API spec; `input_text` is rejected with HTTP 400.
export type ResponseOutputContent = ResponseOutputTextPart | ResponseRefusalPart

export interface ResponseOutputTextPart {
  type: "output_text"
  text: string
}

export interface ResponseRefusalPart {
  type: "refusal"
  refusal: string
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
