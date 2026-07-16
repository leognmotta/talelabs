/** Public facade for the immediate OpenRouter image protocol. */

import type { NormalizedGenerationProviderAdapter } from '@talelabs/flows'
import type { OpenRouterHttpClient } from '../transport/contracts.js'
import type { OpenRouterAssetResolver, OpenRouterImageBinding } from '../types.js'

import { createOpenRouterImagePreparation } from './image/prepare.js'
import { createOpenRouterImmediateAdapter } from './immediate-adapter.js'

export { createOpenRouterImagePreparation } from './image/prepare.js'

/** Creates the shared immediate image protocol adapter. */
export function createOpenRouterImageAdapter(input: {
  binding: OpenRouterImageBinding
  client: OpenRouterHttpClient
  resolveAsset: OpenRouterAssetResolver
}): NormalizedGenerationProviderAdapter {
  return createOpenRouterImmediateAdapter({
    deliveries: ['bytes'],
    prepare: createOpenRouterImagePreparation(input),
  })
}
