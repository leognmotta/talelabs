import type { toSafeRunFailure } from '../../run-failure.js'

import { db } from '@talelabs/db'
import {
  aggregateGenerationJobState,
} from '../../flow-run-state.js'
import { logRunEngine } from './logging.js'

interface JobCoordinates { flowRunId: string, itemKey: string, nodeId: string }

export async function getGenerationJobState(input: {
  jobId: string
  organizationId: string
}) {
  return db.selectFrom('generationJobs')
    .select(['flowRunId', 'id', 'itemKey', 'nodeId', 'status'])
    .where('organizationId', '=', input.organizationId)
    .where('id', '=', input.jobId)
    .executeTakeFirst()
}

export function aggregateJobState(
  job: JobCoordinates,
  organizationId: string,
) {
  return aggregateGenerationJobState({
    flowRunId: job.flowRunId,
    itemKey: job.itemKey,
    nodeId: job.nodeId,
    organizationId,
  })
}

export async function markJobFailed(input: {
  failure: ReturnType<typeof toSafeRunFailure>
  jobId: string
  organizationId: string
}) {
  logRunEngine('error', 'generation_job.failed', {
    code: input.failure.code,
    internalError: input.failure.internal,
    jobId: input.jobId,
    organizationId: input.organizationId,
  })
  const job = await db.updateTable('generationJobs')
    .set({
      completedAt: new Date(),
      errorCode: input.failure.code,
      errorMessage: input.failure.message,
      providerCostUsd: '0',
      status: 'failed',
    })
    .where('organizationId', '=', input.organizationId)
    .where('id', '=', input.jobId)
    .where('status', 'in', ['pending', 'running'])
    .returning(['flowRunId', 'itemKey', 'nodeId'])
    .executeTakeFirst()
  if (job)
    await aggregateJobState(job, input.organizationId)
}

export async function claimRunningJob(input: {
  jobId: string
  organizationId: string
  runId: string
  stage: string
}) {
  const job = await db.updateTable('generationJobs')
    .set({ status: 'running' })
    .where('organizationId', '=', input.organizationId)
    .where('id', '=', input.jobId)
    .where('flowRunId', '=', input.runId)
    .where('status', '=', 'running')
    .returning('id')
    .executeTakeFirst()
  if (job)
    return true

  logRunEngine('info', 'generation_job.worker.stage_skipped', {
    generationJobId: input.jobId,
    organizationId: input.organizationId,
    reason: 'job_not_running',
    runId: input.runId,
    stage: input.stage,
  })
  const current = await getGenerationJobState(input)
  if (current)
    await aggregateJobState(current, input.organizationId)
  return false
}

export async function finishSucceededJob(input: {
  flowRunId: string
  jobId: string
  organizationId: string
}) {
  const job = await getGenerationJobState(input)
  if (job)
    await aggregateJobState(job, input.organizationId)
  logRunEngine('info', 'generation_job.succeeded_recovered', {
    generationJobId: input.jobId,
    organizationId: input.organizationId,
    runId: input.flowRunId,
  })
  return { state: 'succeeded' as const }
}

export async function completeGenerationJob(input: {
  job: JobCoordinates & { id: string }
  organizationId: string
}) {
  const completed = await db.updateTable('generationJobs')
    .set({
      completedAt: new Date(),
      creditCost: 0,
      providerCostUsd: '0',
      status: 'succeeded',
    })
    .where('organizationId', '=', input.organizationId)
    .where('id', '=', input.job.id)
    .where('status', '=', 'running')
    .returning('id')
    .executeTakeFirst()
  if (completed) {
    await aggregateJobState(input.job, input.organizationId)
    return { state: 'succeeded' as const }
  }

  const current = await getGenerationJobState({
    jobId: input.job.id,
    organizationId: input.organizationId,
  })
  if (current?.status === 'succeeded') {
    return finishSucceededJob({
      flowRunId: current.flowRunId,
      jobId: current.id,
      organizationId: input.organizationId,
    })
  }
  logRunEngine('info', 'generation_job.completion_skipped', {
    generationJobId: input.job.id,
    organizationId: input.organizationId,
    reason: 'job_not_running',
    runId: input.job.flowRunId,
    status: current?.status,
  })
  await aggregateJobState(input.job, input.organizationId)
  return { state: 'canceled' as const }
}
