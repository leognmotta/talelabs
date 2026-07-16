import type {
  NormalizedGenerationProviderFacts,
} from '@talelabs/flows'
import type { ResolvedGenerationProviderAdapter } from '../../src/generation/adapters/contracts.js'

export async function reconcileImmediateFacts(
  facts: NormalizedGenerationProviderFacts,
) {
  return { ...facts, providerCostUsd: 0.02 }
}

export async function rejectUnexpectedImmediateSubmission(): Promise<never> {
  throw new Error('unexpected_provider_resubmission')
}

export const immediateRecoveryAdapter
  = {
    lifecycle: {
      cancellation: 'unsupported',
      completions: ['response'],
      deliveries: ['bytes'],
      submission: 'immediate',
    },
    reconcileFacts: reconcileImmediateFacts,
    submit: rejectUnexpectedImmediateSubmission,
  } satisfies ResolvedGenerationProviderAdapter['adapter']
