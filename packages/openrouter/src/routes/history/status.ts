import type { GenerationProviderRoute } from '../contracts.js'

export function historicalGenerationProviderRoutes(
  routes: readonly GenerationProviderRoute[],
) {
  return routes.map(route => ({
    ...route,
    routingStatus: 'historical' as const,
  }))
}
