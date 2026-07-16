/** Bounded OpenRouter HTTP client composed from typed request operations. */

import type { OpenRouterHttpClient, OpenRouterHttpClientOptions } from './contracts.js'

import { createOpenRouterBytesRequester } from './requests/bytes.js'
import { createOpenRouterRequestExecutor } from './requests/execute.js'
import { createOpenRouterJsonRequester } from './requests/json.js'
import { createOpenRouterStreamRequester } from './requests/stream.js'

export * from './contracts.js'

/** Creates an authenticated bounded client from a runtime credential resolver. */
export function createOpenRouterHttpClient(
  options: OpenRouterHttpClientOptions,
): OpenRouterHttpClient {
  const execute = createOpenRouterRequestExecutor(options)
  return {
    requestBytes: createOpenRouterBytesRequester(execute),
    requestJson: createOpenRouterJsonRequester(execute),
    requestStream: createOpenRouterStreamRequester(execute),
  }
}
