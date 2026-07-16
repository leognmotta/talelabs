import type {
  NormalizedGenerationRequest,
  NormalizedGenerationSubmissionContext,
} from '@talelabs/flows'
import type { ResolvedGenerationProviderAdapter } from '../contracts.js'

export async function prepareGenerationProviderSubmission(input: {
  request: NormalizedGenerationRequest
  resolvedAdapter: ResolvedGenerationProviderAdapter
  submissionContext?: NormalizedGenerationSubmissionContext
}) {
  if (input.resolvedAdapter.adapter.prepare) {
    return input.resolvedAdapter.adapter.prepare(
      input.request,
      input.submissionContext,
    )
  }
  if (input.resolvedAdapter.requiresDurableSubmissionBoundary)
    throw new Error('generation_provider_preparation_unavailable')
  const { adapter } = input.resolvedAdapter
  if (adapter.lifecycle.submission === 'immediate') {
    return () => adapter.submit(input.request, input.submissionContext)
  }
  return () => adapter.submit(input.request, input.submissionContext)
}
