/** Generation-job state reads, running claims, and aggregate delegation. */

import type { DatabaseExecutor } from '@talelabs/db'

import { db } from '@talelabs/db'

import { logRunEngine } from '../../../observability/logging.js'
import { aggregateGenerationJobState } from '../../../persistence/state.js'

/** Persisted coordinates required to recompute one job's aggregate owners. */
export interface JobCoordinates {
  /** Durable Flow run containing the job. */
  flowRunId: string
  /** Stable runtime item represented by the job. */
  itemKey: string
  /** Saved snapshot node that owns the item. */
  nodeId: string
}

/** Reads tenant-scoped job coordinates and current lifecycle status. */
export async function getGenerationJobState(
  input: {
    jobId: string
    organizationId: string
  },
  database: DatabaseExecutor = db,
) {
  return database.selectFrom('generationJobs')
    .select(['flowRunId', 'id', 'itemKey', 'nodeId', 'status'])
    .where('organizationId', '=', input.organizationId)
    .where('id', '=', input.jobId)
    .executeTakeFirst()
}

/** Recomputes item, node, and run aggregates for one persisted job. */
export function aggregateJobState(
  job: JobCoordinates,
  organizationId: string,
  database: DatabaseExecutor = db,
) {
  return aggregateGenerationJobState({
    flowRunId: job.flowRunId,
    itemKey: job.itemKey,
    nodeId: job.nodeId,
    organizationId,
  }, database)
}

/** Confirms a non-canceled running job before an irreversible worker stage. */
export async function claimRunningJob(
  input: {
    jobId: string
    organizationId: string
    runId: string
    stage: string
  },
  database: DatabaseExecutor = db,
) {
  const job = await database.updateTable('generationJobs')
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
  const current = await getGenerationJobState(input, database)
  if (current)
    await aggregateJobState(current, input.organizationId, database)
  return false
}
