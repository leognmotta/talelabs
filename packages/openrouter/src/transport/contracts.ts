import type { z } from 'zod'
import type { OpenRouterEnv } from '../sdk/environment.js'

export const OPENROUTER_API_BASE_URL = 'https://openrouter.ai'
export const OPENROUTER_HTTP_TIMEOUT_MS = 60_000
export const OPENROUTER_MAX_REQUEST_BYTES = 2 * 1024 * 1024
export const OPENROUTER_MAX_JSON_RESPONSE_BYTES = 24 * 1024 * 1024
export const OPENROUTER_MAX_MEDIA_RESPONSE_BYTES = 512 * 1024 * 1024

export type OpenRouterHttpErrorCode
  = | 'authentication'
    | 'insufficient_balance'
    | 'malformed_response'
    | 'outage'
    | 'rate_limited'
    | 'rejected'
    | 'response_too_large'
    | 'timeout'

export class OpenRouterHttpError extends Error {
  readonly code: OpenRouterHttpErrorCode
  readonly providerCode: null | string
  readonly providerMessage: null | string
  readonly retryAfterMs: null | number
  readonly retryable: boolean
  readonly status: null | number

  constructor(input: {
    code: OpenRouterHttpErrorCode
    providerCode?: null | string
    providerMessage?: null | string
    retryAfterMs?: null | number
    retryable: boolean
    status?: null | number
  }) {
    super(`openrouter_http_${input.code}`)
    this.code = input.code
    this.name = 'OpenRouterHttpError'
    this.providerCode = input.providerCode ?? null
    this.providerMessage = input.providerMessage ?? null
    this.retryAfterMs = input.retryAfterMs ?? null
    this.retryable = input.retryable
    this.status = input.status ?? null
  }
}

export interface OpenRouterHttpResponse<T> {
  contentType: null | string
  generationId: null | string
  retryAfterMs: null | number
  value: T
}

export interface OpenRouterHttpClient {
  requestBytes: (input: OpenRouterHttpRequest) => Promise<OpenRouterHttpResponse<Uint8Array>>
  requestJson: <T>(input: OpenRouterHttpRequest & {
    schema: z.ZodType<T>
  }) => Promise<OpenRouterHttpResponse<T>>
  requestStream: (
    input: OpenRouterHttpRequest,
  ) => Promise<OpenRouterHttpResponse<ReadableStream<Uint8Array>>>
}

export interface OpenRouterHttpRequest {
  body?: unknown
  maxResponseBytes?: number
  method: 'GET' | 'POST'
  path: string
  signal?: AbortSignal
  timeoutMs?: number
}

export interface OpenRouterHttpClientOptions {
  apiKey?: string
  baseUrl?: string
  env?: OpenRouterEnv
  fetch?: typeof globalThis.fetch
}
