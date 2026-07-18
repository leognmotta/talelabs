/** Provider-neutral finalization of ordered generation outputs. */

import type { Database, Transaction } from '@talelabs/db'
import type { NormalizedGenerationOutput } from '@talelabs/flows'

import { aggregateJobState, claimRunningJob } from '../job/state/index.js'
import { finalizeMediaOutput } from './media-finalizer.js'
import { finalizeTextOutput } from './text-finalizer.js'

/** Immutable job identity and tenancy needed by canonical output finalization. */
export interface FinalizableGenerationJob {
  /** User that admitted the run, or null for system-owned work. */
  createdBy: null | string
  /** Saved Flow that owns the output folder, or null for compatible non-Flow work. */
  flowId: null | string
  /** Durable run whose aggregate state is updated after finalization. */
  flowRunId: string
  /** Generation job receiving the ordered outputs. */
  id: string
  /** Stable runtime item key represented by this job. */
  itemKey: string
  /** Output media contract captured at admission. */
  mediaType: 'audio' | 'image' | 'text' | 'video'
  /** Canonical creative model identifier captured at admission. */
  model: string
  /** Saved Flow node that produced the output. */
  nodeId: string
  /** Tenant boundary applied to every persistence operation. */
  organizationId: string
}

/** Context supplied immediately before one canonical output transaction writes. */
export interface GenerationOutputCommitContext {
  /** Generation job whose output is about to become canonical. */
  job: FinalizableGenerationJob
  /** Ordered provider output index being committed. */
  outputIndex: number
  /** Transaction that must retain any ownership lock through canonical writes. */
  trx: Transaction<Database>
}

/** Runtime-specific ownership assertion executed inside the output transaction. */
export type GenerationOutputCommitGuard = (
  context: GenerationOutputCommitContext,
) => Promise<void>

/** Persists normalized provider outputs through one canonical text/Asset path. */
export async function finalizeGenerationOutputs(input: {
  assetIngestion?: 'api' | 'task'
  commitGuard?: GenerationOutputCommitGuard
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
      ? await finalizeTextOutput(input.job, output, input.commitGuard)
      : await finalizeMediaOutput(
          input.job as FinalizableGenerationJob & {
            mediaType: 'audio' | 'image' | 'video'
          },
          output,
          input.assetIngestion,
          input.commitGuard,
        )
    if (!persisted) {
      await aggregateJobState(input.job, input.job.organizationId)
      return { state: 'canceled' as const }
    }
  }
  return { state: 'succeeded' as const }
}
