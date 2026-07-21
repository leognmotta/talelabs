/** Durable provider lifecycle callbacks backed by one generation-job row. */

import type { GenerationJobProviderContext } from './context.js'

import { safeProviderCost } from '@talelabs/providers/server'

import {
  checkpointGenerationProviderResult,
  resumeGenerationProviderResult,
} from './checkpoint.js'
import {
  beginGenerationProviderSubmission,
  isGenerationProviderCancellationRequested,
  recordGenerationProviderFacts,
  recordGenerationProviderSubmission,
} from './state.js'
import { waitForGenerationJobProvider } from './wait.js'

/** Binds provider lifecycle persistence to one tenant-scoped generation job. */
export function generationJobProviderLifecycleOptions(input: {
  context: GenerationJobProviderContext
  providerCostUsd: null | string
  providerGenerationId: null | string
  providerJobId: null | string
  providerSubmittedAt: Date | null
  requiresDurableSubmissionBoundary: boolean
}) {
  const { context } = input
  const providerCostUsd = safeProviderCost(input.providerCostUsd)
  const resumeFacts = {
    ...(providerCostUsd === undefined ? {} : { providerCostUsd }),
    ...(input.providerGenerationId
      ? { providerGenerationId: input.providerGenerationId }
      : {}),
  }
  if (!input.requiresDurableSubmissionBoundary) {
    return {
      onFacts: recordGenerationProviderFacts.bind(null, context),
    }
  }
  return {
    beforeSubmit: beginGenerationProviderSubmission.bind(null, context),
    isCancellationRequested:
      isGenerationProviderCancellationRequested.bind(null, context),
    onCompleted: checkpointGenerationProviderResult.bind(null, context),
    onFacts: recordGenerationProviderFacts.bind(null, context),
    onSubmitted: recordGenerationProviderSubmission.bind(null, context),
    providerSubmittedAt: input.providerSubmittedAt,
    resumeCompleted: resumeGenerationProviderResult.bind(null, context),
    resumeExternalJobId: input.providerJobId,
    resumeFacts,
    waitForPoll: waitForGenerationJobProvider.bind(null, context),
  }
}
