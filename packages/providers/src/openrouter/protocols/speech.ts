/** Public facade for the immediate OpenRouter speech protocol. */

import type {
  NormalizedGenerationProviderAdapter,
  NormalizedGenerationProviderFacts,
} from '@talelabs/flows'
import type { OpenRouterHttpClient } from '../transport/contracts.js'
import type { OpenRouterSpeechBinding } from '../types.js'

import { createOpenRouterImmediateAdapter } from './immediate-adapter.js'
import { createOpenRouterSpeechPreparation } from './speech/prepare.js'

export { createOpenRouterSpeechPreparation } from './speech/prepare.js'

/** Creates the shared immediate speech protocol adapter. */
export function createOpenRouterSpeechAdapter(input: {
  binding: OpenRouterSpeechBinding
  client: OpenRouterHttpClient
  reconcileFacts?: (
    facts: NormalizedGenerationProviderFacts,
  ) => Promise<NormalizedGenerationProviderFacts | undefined>
}): NormalizedGenerationProviderAdapter {
  return createOpenRouterImmediateAdapter({
    deliveries: ['bytes'],
    prepare: createOpenRouterSpeechPreparation(input),
    reconcileFacts: input.reconcileFacts,
  })
}
