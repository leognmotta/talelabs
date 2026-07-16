import type { GenerationJobProviderContext } from './context.js'

import {
  checkpointGenerationProviderResult,
  resumeGenerationProviderResult,
} from './checkpoint.js'
import {
  beginGenerationProviderSubmission,
  recordGenerationProviderFacts,
  recordGenerationProviderSubmission,
} from './state.js'
import { waitForGenerationJobProvider } from './wait.js'

export function generationJobProviderLifecycleOptions(input: {
  context: GenerationJobProviderContext
  providerJobId: null | string
  providerSubmittedAt: Date | null
  requiresDurableSubmissionBoundary: boolean
}) {
  const { context } = input
  if (!input.requiresDurableSubmissionBoundary) {
    return {
      onFacts: recordGenerationProviderFacts.bind(null, context),
    }
  }
  return {
    beforeSubmit: beginGenerationProviderSubmission.bind(null, context),
    onCompleted: checkpointGenerationProviderResult.bind(null, context),
    onFacts: recordGenerationProviderFacts.bind(null, context),
    onSubmitted: recordGenerationProviderSubmission.bind(null, context),
    providerSubmittedAt: input.providerSubmittedAt,
    resumeCompleted: resumeGenerationProviderResult.bind(null, context),
    resumeExternalJobId: input.providerJobId,
    waitForPoll: waitForGenerationJobProvider.bind(null, context),
  }
}
