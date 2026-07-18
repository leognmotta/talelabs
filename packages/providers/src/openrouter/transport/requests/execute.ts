/** Authenticated OpenRouter request execution, timeout, and status handling. */

import type {
  OpenRouterHttpClientOptions,
  OpenRouterHttpRequest,
} from '../contracts.js'

import {
  OPENROUTER_API_BASE_URL,
  OPENROUTER_HTTP_TIMEOUT_MS,
  OPENROUTER_MAX_REQUEST_BYTES,
  OpenRouterHttpError,
} from '../contracts.js'
import {
  openRouterErrorForStatus,
  openRouterRetryAfterMs,
  openRouterTransportError,
} from '../errors.js'
import {
  OPENROUTER_DEFAULT_APP_CATEGORIES,
  OPENROUTER_DEFAULT_APP_TITLE,
  OPENROUTER_DEFAULT_HTTP_REFERER,
} from '../identity.js'
import { readOpenRouterProviderError } from '../responses/provider-error.js'

/** Authenticated low-level request operation shared by response readers. */
export type OpenRouterRequestExecutor = (
  input: OpenRouterHttpRequest,
) => Promise<Response>

/** Creates authenticated request execution with size and timeout enforcement. */
export function createOpenRouterRequestExecutor(
  options: OpenRouterHttpClientOptions,
): OpenRouterRequestExecutor {
  let apiKey: string
  try {
    apiKey = (options.credential?.resolveApiKey() ?? '').trim()
    if (!apiKey)
      throw new TypeError('openrouter_api_key_missing')
  }
  catch {
    throw new OpenRouterHttpError({ code: 'authentication', retryable: false })
  }
  const baseUrl = (options.baseUrl ?? OPENROUTER_API_BASE_URL).replace(/\/$/, '')
  const fetchImplementation = options.fetch ?? globalThis.fetch

  return async (input) => {
    if (!input.path.startsWith('/api/'))
      throw new TypeError('openrouter_path_invalid')
    let body: string | undefined
    if (input.body !== undefined) {
      body = JSON.stringify(input.body)
      if (new TextEncoder().encode(body).byteLength > OPENROUTER_MAX_REQUEST_BYTES)
        throw new TypeError('openrouter_request_too_large')
    }
    const timeoutSignal = AbortSignal.timeout(
      input.timeoutMs ?? OPENROUTER_HTTP_TIMEOUT_MS,
    )
    const signals = [input.signal, options.signal, timeoutSignal]
      .filter((signal): signal is AbortSignal => signal !== undefined)
    const signal = signals.length === 1 ? signals[0]! : AbortSignal.any(signals)
    try {
      const response = await fetchImplementation(`${baseUrl}${input.path}`, {
        body,
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': OPENROUTER_DEFAULT_HTTP_REFERER,
          'X-OpenRouter-Categories': OPENROUTER_DEFAULT_APP_CATEGORIES,
          'X-Title': OPENROUTER_DEFAULT_APP_TITLE,
        },
        method: input.method,
        signal,
      })
      if (!response.ok) {
        const providerError = await readOpenRouterProviderError(response)
        throw openRouterErrorForStatus(
          response.status,
          openRouterRetryAfterMs(response.headers.get('retry-after')),
          providerError,
        )
      }
      return response
    }
    catch (error) {
      throw openRouterTransportError(error, signal)
    }
  }
}
