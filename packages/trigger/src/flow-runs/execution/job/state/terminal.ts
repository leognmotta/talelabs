/** Durable generation-job terminal transitions and hierarchical aggregation. */

import type { DatabaseExecutor } from '@talelabs/db'
import type { toSafeRunFailure } from '../../../../shared/failures/run-failure.js'
import type { JobCoordinates } from './read.js'

import { db } from '@talelabs/db'

import { logRunEngine } from '../../../observability/logging.js'
import {
  aggregateJobState,
  getGenerationJobState,
} from './read.js'

/**
 * Fails an active job once and recomputes its item, node, and run state.
 * Returns whether this call won the terminal transition; callers must not
 * apply failure side effects (descendant skips, settlement) when it lost.
 */
export async function markJobFailed(
  input: {
    failure: ReturnType<typeof toSafeRunFailure>
    jobId: string
    organizationId: string
  },
  database: DatabaseExecutor = db,
) {
  const job = await database.updateTable('generationJobs')
    .set({
      completedAt: new Date(),
      errorCode: input.failure.code,
      errorMessage: input.failure.message,
      status: 'failed',
    })
    .where('organizationId', '=', input.organizationId)
    .where('id', '=', input.jobId)
    .where('status', 'in', ['pending', 'running'])
    .returning(['flowRunId', 'itemKey', 'nodeId'])
    .executeTakeFirst()
  if (!job) {
    logRunEngine('info', 'generation_job.failure_skipped', {
      code: input.failure.code,
      jobId: input.jobId,
      organizationId: input.organizationId,
      reason: 'job_not_active',
    })
    return false
  }
  logRunEngine('error', 'generation_job.failed', {
    code: input.failure.code,
    internalError: input.failure.internal,
    jobId: input.jobId,
    organizationId: input.organizationId,
  })
  await aggregateJobState(job, input.organizationId, database)
  return true
}

/** Re-aggregates an already successful job during idempotent recovery. */
export async function finishSucceededJob(
  input: {
    flowRunId: string
    jobId: string
    organizationId: string
  },
  database: DatabaseExecutor = db,
) {
  const job = await getGenerationJobState(input, database)
  if (job)
    await aggregateJobState(job, input.organizationId, database)
  logRunEngine('info', 'generation_job.succeeded_recovered', {
    generationJobId: input.jobId,
    organizationId: input.organizationId,
    runId: input.flowRunId,
  })
  return { state: 'succeeded' as const }
}

/** Marks one running job successful without overriding cancellation or failure. */
export async function completeGenerationJob(
  input: {
    creditCost?: number | null
    job: JobCoordinates & { id: string, provider: string }
    organizationId: string
  },
  database: DatabaseExecutor = db,
) {
  const completed = await database.updateTable('generationJobs')
    .set({
      completedAt: new Date(),
      creditCost: input.creditCost
        ?? (input.job.provider === 'talelabs-mock' ? 0 : null),
      status: 'succeeded',
    })
    .where('organizationId', '=', input.organizationId)
    .where('id', '=', input.job.id)
    .where('status', '=', 'running')
    .where(eb => eb.exists(
      eb.selectFrom('flowRuns')
        .select('id')
        .whereRef('flowRuns.organizationId', '=', 'generationJobs.organizationId')
        .whereRef('flowRuns.id', '=', 'generationJobs.flowRunId')
        .where('flowRuns.status', '<>', 'canceled'),
    ))
    .returning('id')
    .executeTakeFirst()
  if (completed) {
    await aggregateJobState(input.job, input.organizationId, database)
    return { state: 'succeeded' as const }
  }

  const current = await getGenerationJobState({
    jobId: input.job.id,
    organizationId: input.organizationId,
  }, database)
  if (current?.status === 'succeeded') {
    return finishSucceededJob({
      flowRunId: current.flowRunId,
      jobId: current.id,
      organizationId: input.organizationId,
    }, database)
  }
  if (current?.status === 'running') {
    await database.updateTable('generationJobs')
      .set({ completedAt: new Date(), status: 'canceled' })
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.job.id)
      .where('status', '=', 'running')
      .where(eb => eb.exists(
        eb.selectFrom('flowRuns')
          .select('id')
          .whereRef('flowRuns.organizationId', '=', 'generationJobs.organizationId')
          .whereRef('flowRuns.id', '=', 'generationJobs.flowRunId')
          .where('flowRuns.status', '=', 'canceled'),
      ))
      .execute()
  }
  logRunEngine('info', 'generation_job.completion_skipped', {
    generationJobId: input.job.id,
    organizationId: input.organizationId,
    reason: 'job_not_running',
    runId: input.job.flowRunId,
    status: current?.status,
  })
  await aggregateJobState(input.job, input.organizationId, database)
  return { state: 'canceled' as const }
}
