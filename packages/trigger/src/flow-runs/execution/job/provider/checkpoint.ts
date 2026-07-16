import type { GenerationProviderLifecycleResult } from '../../../../generation/adapters/lifecycle/runner.js'
import type { GenerationJobProviderContext } from './context.js'

import { recoverGenerationProviderResult } from '../../provider-results/recovery.js'
import { stageGenerationProviderResult } from '../../provider-results/staging.js'

export function checkpointGenerationProviderResult(
  context: GenerationJobProviderContext,
  result: GenerationProviderLifecycleResult,
) {
  return stageGenerationProviderResult({
    facts: result.facts,
    jobId: context.jobId,
    organizationId: context.organizationId,
    outputs: result.outputs,
  })
}

export function resumeGenerationProviderResult(
  context: GenerationJobProviderContext,
) {
  return recoverGenerationProviderResult({
    expectedOutputCount: context.expectedOutputCount,
    jobId: context.jobId,
    mediaType: context.mediaType,
    organizationId: context.organizationId,
  })
}
