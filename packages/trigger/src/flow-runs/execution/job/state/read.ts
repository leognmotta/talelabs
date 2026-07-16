import { db } from '@talelabs/db'

import { logRunEngine } from '../../../observability/logging.js'
import { aggregateGenerationJobState } from '../../../persistence/state.js'

export interface JobCoordinates {
  flowRunId: string
  itemKey: string
  nodeId: string
}

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
    .where(eb => eb.exists(
      eb.selectFrom('flowRuns')
        .select('id')
        .whereRef('flowRuns.organizationId', '=', 'generationJobs.organizationId')
        .whereRef('flowRuns.id', '=', 'generationJobs.flowRunId')
        .where('flowRuns.status', '<>', 'canceled'),
    ))
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
