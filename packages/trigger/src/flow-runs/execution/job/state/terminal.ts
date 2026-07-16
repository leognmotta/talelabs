import type { toSafeRunFailure } from '../../../../shared/failures/run-failure.js'
import type { JobCoordinates } from './read.js'

import { db } from '@talelabs/db'

import { logRunEngine } from '../../../observability/logging.js'
import {
  aggregateJobState,
  getGenerationJobState,
} from './read.js'

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
  job: JobCoordinates & { id: string, provider: string }
  organizationId: string
}) {
  const completed = await db.updateTable('generationJobs')
    .set({
      completedAt: new Date(),
      creditCost: input.job.provider === 'talelabs-mock' ? 0 : null,
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
