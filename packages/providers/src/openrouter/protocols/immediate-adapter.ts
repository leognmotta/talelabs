/** Shared normalized adapter plumbing for immediate OpenRouter protocols. */

import type {
  GenerationProviderDelivery,
  NormalizedGenerationProviderAdapter,
  NormalizedGenerationProviderFacts,
  NormalizedGenerationRequest,
  NormalizedGenerationSubmission,
  NormalizedGenerationSubmissionContext,
} from '@talelabs/flows'

type CompletedSubmission = Extract<
  NormalizedGenerationSubmission,
  { status: 'completed' }
>

/** Spend-boundary preparation contract shared by immediate protocols. */
export type OpenRouterImmediatePreparation = (
  request: NormalizedGenerationRequest,
  context?: NormalizedGenerationSubmissionContext,
) => Promise<() => Promise<CompletedSubmission>>

/** Creates an immediate adapter without duplicating prepare-to-submit plumbing. */
export function createOpenRouterImmediateAdapter(input: {
  deliveries: readonly [GenerationProviderDelivery, ...GenerationProviderDelivery[]]
  prepare: OpenRouterImmediatePreparation
  reconcileFacts?: (
    facts: NormalizedGenerationProviderFacts,
  ) => Promise<NormalizedGenerationProviderFacts | undefined>
}): NormalizedGenerationProviderAdapter {
  return {
    lifecycle: {
      cancellation: 'unsupported',
      completions: ['response'],
      deliveries: input.deliveries,
      submission: 'immediate',
    },
    prepare: input.prepare,
    ...(input.reconcileFacts ? { reconcileFacts: input.reconcileFacts } : {}),
    submit: async (request, context) => {
      const submit = await input.prepare(request, context)
      return submit()
    },
  }
}
