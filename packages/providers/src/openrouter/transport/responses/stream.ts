/** Byte-limited stream wrapper for OpenRouter media response bodies. */

import { OpenRouterHttpError } from '../contracts.js'

/** Rejects impossible or declared-oversized streams before downstream upload. */
export function assertBoundedOpenRouterStream(
  response: Response,
  maximumBytes: number,
) {
  const contentLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
    void response.body?.cancel()
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
  return response.body
}
