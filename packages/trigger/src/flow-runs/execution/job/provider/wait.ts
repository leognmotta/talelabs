import type { GenerationJobProviderContext } from './context.js'

import { waitForGenerationProviderCallback } from '../../provider-results/wait.js'

export function waitForGenerationJobProvider(
  context: GenerationJobProviderContext,
  delayMs: number,
  allowPersistedCompletion: boolean,
) {
  return waitForGenerationProviderCallback({
    allowPersistedCompletion,
    callbackEnabled: context.callbackEnabled,
    delayMs,
    jobId: context.jobId,
    organizationId: context.organizationId,
  })
}
