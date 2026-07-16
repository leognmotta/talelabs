import type { NormalizedGenerationOutput } from '@talelabs/flows'

import { aggregateJobState, claimRunningJob } from '../job/state/index.js'
import { finalizeMediaOutput } from './media-finalizer.js'
import { finalizeTextOutput } from './text-finalizer.js'

export interface FinalizableGenerationJob {
  createdBy: null | string
  flowId: null | string
  flowRunId: string
  id: string
  itemKey: string
  mediaType: 'audio' | 'image' | 'text' | 'video'
  model: string
  nodeId: string
  organizationId: string
}

/** Persists normalized provider outputs through one canonical text/Asset path. */
export async function finalizeGenerationOutputs(input: {
  job: FinalizableGenerationJob
  outputs: readonly NormalizedGenerationOutput[]
}) {
  const outputs = [...input.outputs].toSorted(
    (left, right) => left.outputIndex - right.outputIndex,
  )
  for (const output of outputs) {
    if (output.mediaType !== input.job.mediaType)
      throw new Error('generation_output_media_type_mismatch')
    if (!await claimRunningJob({
      jobId: input.job.id,
      organizationId: input.job.organizationId,
      runId: input.job.flowRunId,
      stage: `output:${output.outputIndex}`,
    })) {
      await aggregateJobState(input.job, input.job.organizationId)
      return { state: 'canceled' as const }
    }
    const persisted = input.job.mediaType === 'text'
      ? await finalizeTextOutput(input.job, output)
      : await finalizeMediaOutput(
          input.job as FinalizableGenerationJob & {
            mediaType: 'audio' | 'image' | 'video'
          },
          output,
        )
    if (!persisted) {
      await aggregateJobState(input.job, input.job.organizationId)
      return { state: 'canceled' as const }
    }
  }
  return { state: 'succeeded' as const }
}
