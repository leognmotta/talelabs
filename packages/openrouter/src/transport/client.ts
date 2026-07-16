import type { OpenRouterHttpClient, OpenRouterHttpClientOptions } from './contracts.js'

import { createOpenRouterBytesRequester } from './requests/bytes.js'
import { createOpenRouterRequestExecutor } from './requests/execute.js'
import { createOpenRouterJsonRequester } from './requests/json.js'
import { createOpenRouterStreamRequester } from './requests/stream.js'

export * from './contracts.js'

export function createOpenRouterHttpClient(
  options: OpenRouterHttpClientOptions = {},
): OpenRouterHttpClient {
  const execute = createOpenRouterRequestExecutor(options)
  return {
    requestBytes: createOpenRouterBytesRequester(execute),
    requestJson: createOpenRouterJsonRequester(execute),
    requestStream: createOpenRouterStreamRequester(execute),
  }
}
