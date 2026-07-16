/** Video provider submission and initial response normalization. */

import type { createOpenRouterHttpClient } from '../../transport/client.js'

import { generationProviderError } from '../../errors.js'
import { providerFacts } from '../../provider-facts.js'
import {
  openRouterVideoCreateSchema,
  openRouterVideoJobId,
  optionalOpenRouterProviderId,
  optionalOpenRouterUsageCost,
} from './response.js'

const VIDEO_SUBMISSION_TIMEOUT_MS = 60_000

/** Creates the spend-boundary video submission closure. */
export function createOpenRouterVideoSubmission(input: {
  body: unknown
  callbackExpected: boolean
  client: ReturnType<typeof createOpenRouterHttpClient>
  endpoint: string
}) {
  return async () => {
    try {
      const response = await input.client.requestJson({
        body: input.body,
        method: 'POST',
        path: input.endpoint,
        schema: openRouterVideoCreateSchema,
        timeoutMs: VIDEO_SUBMISSION_TIMEOUT_MS,
      })
      return {
        externalJobId: openRouterVideoJobId(response.value),
        facts: providerFacts({
          generationId:
            optionalOpenRouterProviderId(response.value.generation_id)
            ?? response.generationId,
          providerCostUsd: optionalOpenRouterUsageCost(response.value.usage),
        }),
        pollAfterMs: response.retryAfterMs
          ?? (input.callbackExpected ? 30_000 : 5_000),
        status: 'submitted' as const,
      }
    }
    catch (error) {
      throw generationProviderError(error)
    }
  }
}
