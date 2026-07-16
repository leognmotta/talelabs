/** OpenRouter HTTP bounds, errors, requests, responses, and client contracts. */

import type { z } from 'zod'
import type { OpenRouterRuntimeCredential } from '../types.js'

/** OpenRouter origin used by the production HTTP transport. */
export const OPENROUTER_API_BASE_URL = 'https://openrouter.ai'
/** Default transport timeout in milliseconds. */
export const OPENROUTER_HTTP_TIMEOUT_MS = 60_000
/** Maximum serialized request body size in bytes. */
export const OPENROUTER_MAX_REQUEST_BYTES = 2 * 1024 * 1024
/** Maximum JSON response size in bytes. */
export const OPENROUTER_MAX_JSON_RESPONSE_BYTES = 24 * 1024 * 1024
/** Maximum media response size in bytes. */
export const OPENROUTER_MAX_MEDIA_RESPONSE_BYTES = 512 * 1024 * 1024

/** Stable transport error categories exposed to provider error normalization. */
export type OpenRouterHttpErrorCode
  = | 'authentication'
    | 'insufficient_balance'
    | 'malformed_response'
    | 'outage'
    | 'rate_limited'
    | 'rejected'
    | 'response_too_large'
    | 'timeout'

/** Typed bounded-transport failure with safe provider metadata. */
export class OpenRouterHttpError extends Error {
  /** Stable transport error category. */
  readonly code: OpenRouterHttpErrorCode
  /** Safe provider error code when one was returned. */
  readonly providerCode: null | string
  /** Safe provider message used only for private diagnosis. */
  readonly providerMessage: null | string
  /** Provider-suggested retry delay in milliseconds. */
  readonly retryAfterMs: null | number
  /** Whether durable orchestration may retry the request. */
  readonly retryable: boolean
  /** HTTP status when a response reached the transport. */
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

/** Bounded normalized response returned by each transport operation. */
export interface OpenRouterHttpResponse<T> {
  /** Parsed response content type, excluding parameters. */
  contentType: null | string
  /** OpenRouter generation ID returned in response headers. */
  generationId: null | string
  /** Provider-suggested retry delay in milliseconds. */
  retryAfterMs: null | number
  /** Schema-validated, byte-bounded, or stream-bounded response value. */
  value: T
}

/** Authenticated OpenRouter operations available to protocol adapters. */
export interface OpenRouterHttpClient {
  /** Executes a request and reads a byte-bounded binary response. */
  requestBytes: (input: OpenRouterHttpRequest) => Promise<OpenRouterHttpResponse<Uint8Array>>
  /** Executes a request and parses a schema-validated JSON response. */
  requestJson: <T>(input: OpenRouterHttpRequest & {
    /** Runtime schema used to reject malformed provider JSON. */
    schema: z.ZodType<T>
  }) => Promise<OpenRouterHttpResponse<T>>
  /** Executes a request and exposes a byte-limited response stream. */
  requestStream: (
    input: OpenRouterHttpRequest,
  ) => Promise<OpenRouterHttpResponse<ReadableStream<Uint8Array>>>
}

/** One authenticated OpenRouter HTTP request before transport execution. */
export interface OpenRouterHttpRequest {
  /** JSON-serializable request body for provider submissions. */
  body?: unknown
  /** Per-operation response byte bound. */
  maxResponseBytes?: number
  /** HTTP method supported by the current provider protocols. */
  method: 'GET' | 'POST'
  /** Absolute OpenRouter API path, never a full external URL. */
  path: string
  /** Optional caller cancellation signal. */
  signal?: AbortSignal
  /** Optional request timeout override in milliseconds. */
  timeoutMs?: number
}

/** Runtime-only inputs used to construct an OpenRouter HTTP client. */
export interface OpenRouterHttpClientOptions {
  /** Optional fake or alternate OpenRouter origin used by verification. */
  baseUrl?: string
  /** Non-serializable API-key resolver supplied by server composition. */
  credential: OpenRouterRuntimeCredential
  /** Optional fake fetch implementation used by offline verification. */
  fetch?: typeof globalThis.fetch
}
