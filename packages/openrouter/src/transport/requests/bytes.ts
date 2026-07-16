import type { OpenRouterHttpClient } from '../contracts.js'
import type { OpenRouterRequestExecutor } from './execute.js'

import {
  OPENROUTER_MAX_MEDIA_RESPONSE_BYTES,
} from '../contracts.js'
import { openRouterTransportError } from '../errors.js'
import {
  boundedOpenRouterResponseLimit,
  openRouterResponseFacts,
  readBoundedOpenRouterBytes,
} from '../responses/body.js'

export function createOpenRouterBytesRequester(
  execute: OpenRouterRequestExecutor,
): OpenRouterHttpClient['requestBytes'] {
  return async (input) => {
    const response = await execute(input)
    const maximumBytes = boundedOpenRouterResponseLimit(
      input.maxResponseBytes,
      OPENROUTER_MAX_MEDIA_RESPONSE_BYTES,
    )
    try {
      const bytes = await readBoundedOpenRouterBytes(response, maximumBytes)
      return openRouterResponseFacts(response, bytes)
    }
    catch (error) {
      throw openRouterTransportError(error)
    }
  }
}
