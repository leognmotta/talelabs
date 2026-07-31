/** Durable generation-job terminal transitions and hierarchical aggregation. */

import type { DatabaseExecutor } from '@talelabs/db'
import type { toSafeRunFailure } from '../../../../shared/failures/run-failure.js'
import type { JobCoordinates } from './read.js'

import {
  db,
  settleGenerationJobCredits,
  withDatabaseTransaction,
} from '@talelabs/db'

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
  return withDatabaseTransaction(database, async (trx) => {
    const job = await trx.updateTable('generationJobs')
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
    await settleGenerationJobCredits({
      generationJobId: input.jobId,
      organizationId: input.organizationId,
      outcome: 'release',
      reasonCode: input.failure.code,
    }, trx)
    logRunEngine('error', 'generation_job.failed', {
      code: input.failure.code,
      internalError: input.failure.internal,
      jobId: input.jobId,
      organizationId: input.organizationId,
    })
    await aggregateJobState(job, input.organizationId, trx)
    return true
  })
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
  await settleGenerationJobCredits({
    generationJobId: input.jobId,
    organizationId: input.organizationId,
    outcome: 'capture',
    reasonCode: 'usable_output',
  }, database)
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
  return withDatabaseTransaction(database, async (trx) => {
    const completed = await trx.updateTable('generationJobs')
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
      await settleGenerationJobCredits({
        generationJobId: input.job.id,
        organizationId: input.organizationId,
        outcome: 'capture',
        reasonCode: 'usable_output',
      }, trx)
      await aggregateJobState(input.job, input.organizationId, trx)
      return { state: 'succeeded' as const }
    }

    const current = await getGenerationJobState({
      jobId: input.job.id,
      organizationId: input.organizationId,
    }, trx)
    if (current?.status === 'succeeded') {
      return finishSucceededJob({
        flowRunId: current.flowRunId,
        jobId: current.id,
        organizationId: input.organizationId,
      }, trx)
    }
    if (current?.status === 'running') {
      await trx.updateTable('generationJobs')
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
      await settleGenerationJobCredits({
        generationJobId: input.job.id,
        organizationId: input.organizationId,
        outcome: 'release',
        reasonCode: 'run_canceled',
      }, trx)
    }
    logRunEngine('info', 'generation_job.completion_skipped', {
      generationJobId: input.job.id,
      organizationId: input.organizationId,
      reason: 'job_not_running',
      runId: input.job.flowRunId,
      status: current?.status,
    })
    await aggregateJobState(input.job, input.organizationId, trx)
    return { state: 'canceled' as const }
  })
}
