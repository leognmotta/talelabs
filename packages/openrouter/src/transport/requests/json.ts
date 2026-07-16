import type { OpenRouterHttpClient } from '../contracts.js'
import type { OpenRouterRequestExecutor } from './execute.js'

import {
  OPENROUTER_MAX_JSON_RESPONSE_BYTES,
  OpenRouterHttpError,
} from '../contracts.js'
import { openRouterTransportError } from '../errors.js'
import {
  boundedOpenRouterResponseLimit,
  openRouterResponseFacts,
  readBoundedOpenRouterBytes,
} from '../responses/body.js'

export function createOpenRouterJsonRequester(
  execute: OpenRouterRequestExecutor,
): OpenRouterHttpClient['requestJson'] {
  return async (input) => {
    const response = await execute(input)
    const maximumBytes = boundedOpenRouterResponseLimit(
      input.maxResponseBytes,
      OPENROUTER_MAX_JSON_RESPONSE_BYTES,
    )
    let bytes: Uint8Array
    try {
      bytes = await readBoundedOpenRouterBytes(response, maximumBytes)
    }
    catch (error) {
      throw openRouterTransportError(error)
    }
    try {
      const parsed = input.schema.safeParse(
        JSON.parse(new TextDecoder().decode(bytes)),
      )
      if (!parsed.success)
        throw new TypeError('schema_invalid')
      return openRouterResponseFacts(response, parsed.data)
    }
    catch {
      throw new OpenRouterHttpError({
        code: 'malformed_response',
        retryable: false,
        status: response.status,
      })
    }
  }
}
