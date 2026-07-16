/** Public facade for the immediate OpenRouter chat protocol. */

import type { NormalizedGenerationProviderAdapter } from '@talelabs/flows'
import type { createOpenRouterHttpClient } from '../transport/client.js'
import type { OpenRouterAssetResolver, OpenRouterChatBinding } from '../types.js'

import { createOpenRouterChatPreparation } from './chat/prepare.js'
import { createOpenRouterImmediateAdapter } from './immediate-adapter.js'

export { createOpenRouterChatPreparation } from './chat/prepare.js'

/** Creates the shared immediate chat protocol adapter. */
export function createOpenRouterChatAdapter(input: {
  binding: OpenRouterChatBinding
  client?: ReturnType<typeof createOpenRouterHttpClient>
  resolveAsset: OpenRouterAssetResolver
}): NormalizedGenerationProviderAdapter {
  return createOpenRouterImmediateAdapter({
    deliveries: ['text'],
    prepare: createOpenRouterChatPreparation(input),
  })
}
