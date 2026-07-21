/** Bounded fal response-body readers for JSON and media delivery. */

import { FAL_MAX_MEDIA_RESPONSE_BYTES, FalHttpError } from './contracts.js'

/** Resolves a safe response byte limit from a requested value and a fallback. */
export function boundedFalResponseLimit(
  value: number | undefined,
  fallback: number,
) {
  if (value === undefined)
    return fallback
  if (
    !Number.isSafeInteger(value)
    || value <= 0
    || value > FAL_MAX_MEDIA_RESPONSE_BYTES
  ) {
    throw new TypeError('fal_response_limit_invalid')
  }
  return value
}

/** Reads a complete response while enforcing the configured byte limit. */
export async function readBoundedFalBytes(
  response: Response,
  maximumBytes: number,
) {
  const contentLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
    throw new FalHttpError({
      code: 'response_too_large',
      retryable: false,
      status: response.status,
    })
  }
  if (!response.body) {
    throw new FalHttpError({
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
        throw new FalHttpError({
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

/** Wraps a media response body in a byte-limited pass-through stream. */
export function boundedFalStream(
  response: Response,
  maximumBytes: number,
): ReadableStream<Uint8Array> {
  if (!response.body) {
    throw new FalHttpError({
      code: 'malformed_response',
      retryable: false,
      status: response.status,
    })
  }
  let seen = 0
  return response.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      seen += chunk.byteLength
      if (seen > maximumBytes) {
        controller.error(new FalHttpError({
          code: 'response_too_large',
          retryable: false,
          status: response.status,
        }))
        return
      }
      controller.enqueue(chunk)
    },
  }))
}
