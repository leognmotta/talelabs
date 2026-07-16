import type { OpenRouterHttpClient } from '../contracts.js'
import type { OpenRouterRequestExecutor } from './execute.js'

import { OPENROUTER_MAX_MEDIA_RESPONSE_BYTES } from '../contracts.js'
import {
  boundedOpenRouterResponseLimit,
  openRouterResponseFacts,
} from '../responses/body.js'
import { assertBoundedOpenRouterStream } from '../responses/stream.js'

export function createOpenRouterStreamRequester(
  execute: OpenRouterRequestExecutor,
): OpenRouterHttpClient['requestStream'] {
  return async (input) => {
    const response = await execute(input)
    const maximumBytes = boundedOpenRouterResponseLimit(
      input.maxResponseBytes,
      OPENROUTER_MAX_MEDIA_RESPONSE_BYTES,
    )
    const stream = assertBoundedOpenRouterStream(response, maximumBytes)
    return openRouterResponseFacts(response, stream)
  }
}
