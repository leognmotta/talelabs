/** Bounded fal HTTP client composed from typed request operations. */

import type { FalHttpClient, FalHttpClientOptions } from './contracts.js'

import {
  boundedFalResponseLimit,
  boundedFalStream,
  readBoundedFalBytes,
} from './body.js'
import {
  FAL_MAX_JSON_RESPONSE_BYTES,
  FAL_MAX_MEDIA_RESPONSE_BYTES,
  FalHttpError,
} from './contracts.js'
import { falRetryAfterMs, falTransportError } from './errors.js'
import { createFalRequestExecutor } from './execute.js'

export * from './contracts.js'

function contentTypeOf(response: Response) {
  return response.headers.get('content-type')?.split(';', 1)[0]?.trim() || null
}

/** Creates an authenticated bounded client from a runtime credential resolver. */
export function createFalHttpClient(
  options: FalHttpClientOptions,
): FalHttpClient {
  const execute = createFalRequestExecutor(options)
  const runtimeMediaLimit = boundedFalResponseLimit(
    options.maxMediaResponseBytes,
    FAL_MAX_MEDIA_RESPONSE_BYTES,
  )
  return {
    requestJson: async (input) => {
      const response = await execute({
        authenticated: true,
        body: input.body,
        method: input.method,
        timeoutMs: input.timeoutMs,
        url: input.url,
      })
      let bytes: Uint8Array
      try {
        bytes = await readBoundedFalBytes(response, FAL_MAX_JSON_RESPONSE_BYTES)
      }
      catch (error) {
        throw falTransportError(error)
      }
      try {
        const parsed = input.schema.safeParse(
          JSON.parse(new TextDecoder().decode(bytes)),
        )
        if (!parsed.success)
          throw new TypeError('schema_invalid')
        return {
          contentType: contentTypeOf(response),
          retryAfterMs: falRetryAfterMs(response.headers.get('retry-after')),
          value: parsed.data,
        }
      }
      catch {
        throw new FalHttpError({
          code: 'malformed_response',
          retryable: false,
          status: response.status,
        })
      }
    },
    requestMediaStream: async (input) => {
      const response = await execute({
        authenticated: false,
        method: 'GET',
        timeoutMs: input.timeoutMs,
        url: input.url,
      })
      const limit = Math.min(
        boundedFalResponseLimit(input.maxResponseBytes, FAL_MAX_MEDIA_RESPONSE_BYTES),
        runtimeMediaLimit,
      )
      return {
        contentType: contentTypeOf(response),
        retryAfterMs: null,
        value: boundedFalStream(response, limit),
      }
    },
  }
}
