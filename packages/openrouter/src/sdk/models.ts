import type { OpenRouterModelListOptions } from './contracts.js'

import { createOpenRouterClient } from './client.js'

export async function listOpenRouterModels(
  options: OpenRouterModelListOptions = {},
) {
  const {
    apiKey,
    appCategories,
    appTitle,
    client,
    env,
    httpReferer,
    requestOptions,
    ...filters
  } = options
  const openRouter = client ?? createOpenRouterClient({
    apiKey,
    appCategories,
    appTitle,
    env,
    httpReferer,
  })

  return openRouter.models.list(filters, requestOptions)
}
