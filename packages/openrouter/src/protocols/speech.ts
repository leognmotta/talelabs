/** Public facade for the immediate OpenRouter speech protocol. */

import type { NormalizedGenerationProviderAdapter } from '@talelabs/flows'
import type { createOpenRouterHttpClient } from '../transport/client.js'
import type { OpenRouterSpeechBinding } from '../types.js'

import { createOpenRouterImmediateAdapter } from './immediate-adapter.js'
import { createOpenRouterSpeechFactsReconciler } from './speech/accounting.js'
import { createOpenRouterSpeechPreparation } from './speech/prepare.js'

export { createOpenRouterSpeechPreparation } from './speech/prepare.js'

/** Creates the shared immediate speech protocol adapter. */
export function createOpenRouterSpeechAdapter(input: {
  binding: OpenRouterSpeechBinding
  client?: ReturnType<typeof createOpenRouterHttpClient>
}): NormalizedGenerationProviderAdapter {
  return createOpenRouterImmediateAdapter({
    deliveries: ['bytes'],
    prepare: createOpenRouterSpeechPreparation(input),
    reconcileFacts: createOpenRouterSpeechFactsReconciler(input),
  })
}
