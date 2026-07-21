/** Authenticated fal request execution, timeout, and status handling. */

import type { FalHttpClientOptions } from './contracts.js'

import {
  FAL_HTTP_TIMEOUT_MS,
  FAL_MAX_REQUEST_BYTES,
  FalHttpError,
} from './contracts.js'
import { falErrorForStatus, falRetryAfterMs, falTransportError } from './errors.js'
import { assertFalMediaUrl, assertFalQueueUrl } from './hosts.js'

const FAL_OUTPUT_RETENTION_SECONDS = 9 * 60 * 60
const FAL_INFERENCE_HEADERS = {
  'X-Fal-Object-Lifecycle-Preference': JSON.stringify({
    expiration_duration_seconds: FAL_OUTPUT_RETENTION_SECONDS,
  }),
  'X-Fal-Store-IO': '0',
  'x-app-fal-disable-fallback': 'true',
} as const

/** One resolved fal HTTP request before transport execution. */
export interface FalExecuteRequest {
  /** Whether the fal API key is attached; media downloads are unauthenticated. */
  authenticated: boolean
  /** JSON-serializable body for queue submissions. */
  body?: unknown
  /** HTTP method used by the queue protocol. */
  method: 'GET' | 'POST' | 'PUT'
  /** Optional request timeout override in milliseconds. */
  timeoutMs?: number
  /** Absolute fal URL validated against the allowed host set. */
  url: string
}

/** Authenticated low-level request operation shared by response readers. */
export type FalRequestExecutor = (input: FalExecuteRequest) => Promise<Response>

function falRequestHeaders(input: FalExecuteRequest, apiKey: string) {
  if (!input.authenticated)
    return {}
  return {
    'Authorization': `Key ${apiKey}`,
    'Content-Type': 'application/json',
    ...(input.method === 'POST' ? FAL_INFERENCE_HEADERS : {}),
  }
}

/** Creates authenticated request execution with size and timeout enforcement. */
export function createFalRequestExecutor(
  options: FalHttpClientOptions,
): FalRequestExecutor {
  let apiKey: string
  try {
    apiKey = (options.credential?.resolveApiKey() ?? '').trim()
    if (!apiKey)
      throw new TypeError('fal_api_key_missing')
  }
  catch {
    throw new FalHttpError({ code: 'authentication', retryable: false })
  }
  const queueOrigin = options.baseUrl
  const fetchImplementation = options.fetch ?? globalThis.fetch

  return async (input) => {
    const target = input.authenticated
      ? assertFalQueueUrl(input.url, queueOrigin)
      : assertFalMediaUrl(input.url, queueOrigin)
    let body: string | undefined
    if (input.body !== undefined) {
      body = JSON.stringify(input.body)
      if (new TextEncoder().encode(body).byteLength > FAL_MAX_REQUEST_BYTES)
        throw new TypeError('fal_request_too_large')
    }
    const timeoutSignal = AbortSignal.timeout(input.timeoutMs ?? FAL_HTTP_TIMEOUT_MS)
    const signals = [options.signal, timeoutSignal]
      .filter((signal): signal is AbortSignal => signal !== undefined)
    const signal = signals.length === 1 ? signals[0]! : AbortSignal.any(signals)
    try {
      const response = await fetchImplementation(target.toString(), {
        body,
        headers: falRequestHeaders(input, apiKey),
        method: input.method,
        signal,
      })
      if (!response.ok) {
        const detail = (await response.text().catch(() => '')).slice(0, 4096)
        throw falErrorForStatus(
          response.status,
          falRetryAfterMs(response.headers.get('retry-after')),
          detail || null,
        )
      }
      return response
    }
    catch (error) {
      throw falTransportError(error, signal)
    }
  }
}
