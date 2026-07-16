/** Bounded OpenRouter response-body readers for JSON and binary delivery. */

import type { OpenRouterHttpResponse } from '../contracts.js'

import { OPENROUTER_MAX_MEDIA_RESPONSE_BYTES, OpenRouterHttpError } from '../contracts.js'
import { openRouterRetryAfterMs } from '../errors.js'

/** Resolves a safe response byte limit from headers and configured bounds. */
export function boundedOpenRouterResponseLimit(
  value: number | undefined,
  fallback: number,
) {
  if (value === undefined)
    return fallback
  if (
    !Number.isSafeInteger(value)
    || value <= 0
    || value > OPENROUTER_MAX_MEDIA_RESPONSE_BYTES
  ) {
    throw new TypeError('openrouter_response_limit_invalid')
  }
  return value
}

/** Reads a complete response while enforcing the configured byte limit. */
export async function readBoundedOpenRouterBytes(
  response: Response,
  maximumBytes: number,
) {
  const contentLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
    throw new OpenRouterHttpError({
      code: 'response_too_large',
      retryable: false,
      status: response.status,
    })
  }
  if (!response.body) {
    throw new OpenRouterHttpError({
      code: 'malformed_response',
      retryable: false,
      status: response.status,
    })
  }
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const next = await reader.read()
      if (next.done)
        break
      size += next.value.byteLength
      if (size > maximumBytes) {
        throw new OpenRouterHttpError({
          code: 'response_too_large',
          retryable: false,
          status: response.status,
        })
      }
      chunks.push(next.value)
    }
  }
  finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

/** Projects safe OpenRouter headers alongside one normalized response value. */
export function openRouterResponseFacts<T>(
  response: Response,
  value: T,
): OpenRouterHttpResponse<T> {
  return {
    contentType: response.headers.get('content-type')?.split(';', 1)[0]?.trim() || null,
    generationId: response.headers.get('x-generation-id')?.trim() || null,
    retryAfterMs: openRouterRetryAfterMs(response.headers.get('retry-after')),
    value,
  }
}
