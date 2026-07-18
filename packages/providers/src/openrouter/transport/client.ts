/** Bounded OpenRouter HTTP client composed from typed request operations. */

import type { OpenRouterHttpClient, OpenRouterHttpClientOptions } from './contracts.js'

import { OPENROUTER_MAX_MEDIA_RESPONSE_BYTES } from './contracts.js'
import { createOpenRouterBytesRequester } from './requests/bytes.js'
import { createOpenRouterRequestExecutor } from './requests/execute.js'
import { createOpenRouterJsonRequester } from './requests/json.js'
import { createOpenRouterStreamRequester } from './requests/stream.js'
import { boundedOpenRouterResponseLimit } from './responses/body.js'

export * from './contracts.js'

/** Creates an authenticated bounded client from a runtime credential resolver. */
export function createOpenRouterHttpClient(
  options: OpenRouterHttpClientOptions,
): OpenRouterHttpClient {
  const execute = createOpenRouterRequestExecutor(options)
  const requestBytes = createOpenRouterBytesRequester(execute)
  const requestStream = createOpenRouterStreamRequester(execute)
  const runtimeMediaLimit = boundedOpenRouterResponseLimit(
    options.maxMediaResponseBytes,
    OPENROUTER_MAX_MEDIA_RESPONSE_BYTES,
  )
  const cappedResponseBytes = (requested: number | undefined) => Math.min(
    boundedOpenRouterResponseLimit(
      requested,
      OPENROUTER_MAX_MEDIA_RESPONSE_BYTES,
    ),
    runtimeMediaLimit,
  )
  return {
    requestBytes: input => requestBytes({
      ...input,
      maxResponseBytes: cappedResponseBytes(input.maxResponseBytes),
    }),
    requestJson: createOpenRouterJsonRequester(execute),
    requestStream: input => requestStream({
      ...input,
      maxResponseBytes: cappedResponseBytes(input.maxResponseBytes),
    }),
  }
}
