import type { TaskRunContext } from '@trigger.dev/sdk'

import type { FlowRunTaskPayload } from '../../tasks/flow-runs/contracts.js'
import { db } from '@talelabs/db'

import { cleanupUncommittedGeneratedOutputObjectsForRun } from '../../assets/outputs/generated-storage.js'
import { toSafeRunFailure } from '../../shared/failures/run-failure.js'
import { logRunEngine } from '../observability/logging.js'
import { aggregateFlowRunState } from '../persistence/state.js'

export async function handleFlowRunOrchestratorFailure(input: {
  ctx: TaskRunContext
  error: unknown
  payload: FlowRunTaskPayload
}) {
  const ownedRun = await db.selectFrom('flowRuns')
    .select('id')
    .where('organizationId', '=', input.payload.organizationId)
    .where('id', '=', input.payload.flowRunId)
    .where('status', 'in', ['pending', 'running'])
    .where('triggerRunId', '=', input.ctx.run.id)
    .executeTakeFirst()
  if (!ownedRun)
    return
  const failure = toSafeRunFailure(input.error, 'trigger_parent_failed')
  logRunEngine('error', 'flow_run.worker.failed', {
    internalError: failure.internal,
    organizationId: input.payload.organizationId,
    runId: input.payload.flowRunId,
    triggerRunId: input.ctx.run.id,
  })
  await db.updateTable('generationJobs')
    .set({
      completedAt: new Date(),
      errorCode: failure.code,
      errorMessage: failure.message,
      status: 'failed',
    })
    .where('organizationId', '=', input.payload.organizationId)
    .where('flowRunId', '=', input.payload.flowRunId)
    .where('status', 'in', ['pending', 'running'])
    .execute()
  await cleanupUncommittedGeneratedOutputObjectsForRun({
    flowRunId: input.payload.flowRunId,
    organizationId: input.payload.organizationId,
  })
  await aggregateFlowRunState(
    input.payload.organizationId,
    input.payload.flowRunId,
  )
}
