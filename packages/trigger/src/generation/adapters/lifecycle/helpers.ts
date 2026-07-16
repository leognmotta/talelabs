import type {
  NormalizedGenerationOutput,
  NormalizedGenerationProviderFacts,
  NormalizedGenerationRequest,
} from '@talelabs/flows'
import type { ResolvedGenerationProviderAdapter } from '../contracts.js'

import {
  GenerationProviderOutputValidationError,
  validateGenerationProviderOutputs,
} from '@talelabs/flows'

import { GenerationProviderError } from '../errors.js'

const MIN_PROVIDER_POLL_DELAY_MS = 5_000
const MAX_PROVIDER_POLL_DELAY_MS = 2 * 60 * 1_000

export function mergeGenerationProviderFacts(
  current: NormalizedGenerationProviderFacts,
  next: NormalizedGenerationProviderFacts | undefined,
) {
  return {
    ...(current.providerCostUsd === undefined
      ? {}
      : { providerCostUsd: current.providerCostUsd }),
    ...(current.providerGenerationId === undefined
      ? {}
      : { providerGenerationId: current.providerGenerationId }),
    ...(next?.providerCostUsd === undefined
      ? {}
      : { providerCostUsd: next.providerCostUsd }),
    ...(next?.providerGenerationId === undefined
      ? {}
      : { providerGenerationId: next.providerGenerationId }),
  }
}

export function boundedGenerationProviderPollDelay(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value))
    return 30_000
  return Math.min(
    MAX_PROVIDER_POLL_DELAY_MS,
    Math.max(MIN_PROVIDER_POLL_DELAY_MS, Math.ceil(value)),
  )
}

export function validateLifecycleProviderOutputs(input: {
  outputs: readonly NormalizedGenerationOutput[]
  request: NormalizedGenerationRequest
  resolvedAdapter: ResolvedGenerationProviderAdapter
}) {
  try {
    return validateGenerationProviderOutputs({
      allowedDeliveries: input.resolvedAdapter.adapter.lifecycle.deliveries,
      expectedCount: input.request.outputCount,
      expectedMediaType: input.resolvedAdapter.route.outputType,
      outputs: input.outputs,
    })
  }
  catch (error) {
    if (error instanceof GenerationProviderOutputValidationError) {
      throw new GenerationProviderError({
        code: 'provider_response_invalid',
        retryable: false,
      })
    }
    throw error
  }
}
