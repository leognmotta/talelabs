import type { PinnedGenerationProviderRoute } from '../../contracts.js'

export function pinnedOpenRouterProvider(
  route: Readonly<PinnedGenerationProviderRoute>,
  requireParameters = false,
) {
  if (!route.providerEndpointTag)
    return undefined
  return {
    allow_fallbacks: false,
    only: [route.providerEndpointTag],
    ...(requireParameters ? { require_parameters: true } : {}),
  }
}
