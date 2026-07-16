/** Deferred provider-cost reconciliation for speech generations. */

import type { OpenRouterHttpClient } from '../../transport/contracts.js'

import { providerFacts } from '../../provider-facts.js'
import { lookupOpenRouterGenerationCost } from '../../server/accounting.js'

/** Creates the speech provider-facts reconciliation callback. */
export function createOpenRouterSpeechFactsReconciler(input: {
  client: OpenRouterHttpClient
}) {
  return async (facts: { providerGenerationId?: string }) => {
    if (!facts.providerGenerationId)
      return undefined
    const providerCostUsd = await lookupOpenRouterGenerationCost({
      client: input.client,
      generationId: facts.providerGenerationId,
    })
    return providerFacts({
      generationId: facts.providerGenerationId,
      providerCostUsd,
    })
  }
}
