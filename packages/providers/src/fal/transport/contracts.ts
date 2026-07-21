/** fal HTTP bounds, errors, and bounded queue-transport client contract. */

import type { z } from 'zod'
import type { FalRuntimeCredential } from '../../contracts.js'

/** Default transport timeout in milliseconds. */
export const FAL_HTTP_TIMEOUT_MS = 60_000
/** Maximum serialized request body size in bytes. */
export const FAL_MAX_REQUEST_BYTES = 2 * 1024 * 1024
/** Maximum JSON response size in bytes. */
export const FAL_MAX_JSON_RESPONSE_BYTES = 8 * 1024 * 1024
/** Maximum media response size in bytes. */
export const FAL_MAX_MEDIA_RESPONSE_BYTES = 512 * 1024 * 1024

/**
 * Host suffixes the media reader is allowed to download from. fal serves job
 * outputs from its own CDN; restricting to these hosts prevents a manipulated
 * result payload from turning the worker into an arbitrary-URL fetcher.
 */
export const FAL_ALLOWED_MEDIA_HOST_SUFFIXES = ['.fal.media', '.fal.run'] as const

/** Exact Google bucket used by fal for some generated outputs. */
export const FAL_GOOGLE_MEDIA_BUCKET = 'falserverless'

/** Exact Google object prefix used by fal for some generated outputs. */
export const FAL_GOOGLE_MEDIA_PATH_PREFIX = `/${FAL_GOOGLE_MEDIA_BUCKET}/`

/** Exact Google object host used by fal for some generated outputs. */
export const FAL_GOOGLE_MEDIA_HOST = 'storage.googleapis.com'

/** Stable transport error categories exposed to provider error normalization. */
export type FalHttpErrorCode
  = | 'authentication'
    | 'insufficient_balance'
    | 'malformed_response'
    | 'outage'
    | 'rate_limited'
    | 'rejected'
    | 'response_too_large'
    | 'timeout'

/** Typed bounded-transport failure with safe provider metadata. */
export class FalHttpError extends Error {
  /** Stable transport error category. */
  readonly code: FalHttpErrorCode
  /** Safe provider message used only for private diagnosis. */
  readonly providerMessage: null | string
  /** Provider-suggested retry delay in milliseconds. */
  readonly retryAfterMs: null | number
  /** Whether durable orchestration may retry the request. */
  readonly retryable: boolean
  /** HTTP status when a response reached the transport. */
  readonly status: null | number

  constructor(input: {
    code: FalHttpErrorCode
    providerMessage?: null | string
    retryAfterMs?: null | number
    retryable: boolean
    status?: null | number
  }) {
    super(`fal_http_${input.code}`)
    this.code = input.code
    this.name = 'FalHttpError'
    this.providerMessage = input.providerMessage ?? null
    this.retryAfterMs = input.retryAfterMs ?? null
    this.retryable = input.retryable
    this.status = input.status ?? null
  }
}

/** Bounded normalized response returned by each transport operation. */
export interface FalHttpResponse<T> {
  /** Parsed response content type, excluding parameters. */
  contentType: null | string
  /** Provider-suggested retry delay in milliseconds. */
  retryAfterMs: null | number
  /** Schema-validated or stream-bounded response value. */
  value: T
}

/** Authenticated fal queue operations available to the queue protocol. */
export interface FalHttpClient {
  /** Executes an authenticated queue request and parses a validated JSON body. */
  requestJson: <T>(input: {
    body?: unknown
    method: 'GET' | 'POST' | 'PUT'
    schema: z.ZodType<T>
    timeoutMs?: number
    url: string
  }) => Promise<FalHttpResponse<T>>
  /** Downloads one fal-hosted output as a byte-limited response stream. */
  requestMediaStream: (input: {
    maxResponseBytes?: number
    timeoutMs?: number
    url: string
  }) => Promise<FalHttpResponse<ReadableStream<Uint8Array>>>
}

/** Runtime-only inputs used to construct a fal HTTP client. */
export interface FalHttpClientOptions {
  /** Exact queue origin authorized by the captured immutable binding. */
  baseUrl: string
  /** Non-serializable API-key resolver supplied by the selected runtime. */
  credential: FalRuntimeCredential
  /** Optional fake fetch implementation used by offline verification. */
  fetch?: typeof globalThis.fetch
  /** Runtime-wide binary/stream response cap in bytes. */
  maxMediaResponseBytes?: number
  /** Runtime-wide cancellation signal, such as browser leadership loss. */
  signal?: AbortSignal
}
