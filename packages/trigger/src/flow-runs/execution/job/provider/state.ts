import type { NormalizedGenerationProviderFacts } from '@talelabs/flows'
import type { GenerationJobProviderContext } from './context.js'

import {
  markProviderSubmissionStarted,
  persistProviderFacts,
  persistProviderSubmission,
} from '../state/index.js'

export function beginGenerationProviderSubmission(
  context: GenerationJobProviderContext,
) {
  return markProviderSubmissionStarted(context)
}

export function recordGenerationProviderFacts(
  context: GenerationJobProviderContext,
  facts: NormalizedGenerationProviderFacts,
) {
  return persistProviderFacts({ ...context, facts })
}

export function recordGenerationProviderSubmission(
  context: GenerationJobProviderContext,
  submission: {
    externalJobId: string
    facts: NormalizedGenerationProviderFacts
  },
) {
  return persistProviderSubmission({ ...context, ...submission })
}
