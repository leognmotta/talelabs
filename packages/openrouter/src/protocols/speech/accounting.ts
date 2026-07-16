/** Deferred provider-cost reconciliation for speech generations. */

import type { createOpenRouterHttpClient } from '../../transport/client.js'

import { lookupOpenRouterGenerationCost, providerFacts } from '../../provider-facts.js'
import { createOpenRouterHttpClient as createClient } from '../../transport/client.js'

/** Creates the speech provider-facts reconciliation callback. */
export function createOpenRouterSpeechFactsReconciler(input: {
  client?: ReturnType<typeof createOpenRouterHttpClient>
}) {
  return async (facts: { providerGenerationId?: string }) => {
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
  }
}
