import type { NormalizedGenerationProviderAdapter } from '@talelabs/flows'

import type { createOpenRouterHttpClient, OpenRouterSpeechRequestProfile } from '@talelabs/openrouter'
import type { PinnedGenerationProviderRoute } from '../../contracts.js'
import { createOpenRouterHttpClient as createClient } from '@talelabs/openrouter'
import { lookupOpenRouterGenerationCost } from '../shared/generation-metadata.js'
import { providerFacts } from '../shared/provider-facts.js'
import { createOpenRouterSpeechPreparation } from './submission.js'

export function createOpenRouterSpeechAdapter(input: {
  client?: ReturnType<typeof createOpenRouterHttpClient>
  profile: OpenRouterSpeechRequestProfile
  route: Readonly<PinnedGenerationProviderRoute>
}): NormalizedGenerationProviderAdapter {
  const prepare = createOpenRouterSpeechPreparation(input)
  return {
    lifecycle: {
      cancellation: 'unsupported',
      completions: ['response'],
      deliveries: ['bytes'],
      submission: 'immediate',
    },
    prepare,
    reconcileFacts: async (facts) => {
      if (!facts.providerGenerationId)
        return undefined
      const providerCostUsd = await lookupOpenRouterGenerationCost({
        client: input.client ?? createClient(),
        generationId: facts.providerGenerationId,
      })
      return providerFacts({
        generationId: facts.providerGenerationId,
        providerCostUsd,
      })
    },
    submit: async (request) => {
      const submit = await prepare(request)
      return submit()
    },
  }
}
