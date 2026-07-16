/** Read-only model discovery through the official OpenRouter SDK. */

import type { OpenRouterModelListOptions } from './contracts.js'

import { createOpenRouterClient } from './client.js'

/** Lists OpenRouter models for read-only research without changing the catalog. */
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
