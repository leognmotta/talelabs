import { db } from '@talelabs/db'
import { toSafeRunFailure, runs as triggerRuns } from '@talelabs/trigger'

import { HttpError, TenantResourceNotFoundError } from '../../middleware/error.js'
import { logRunEngine } from './logging.js'
import { getRunDetail } from './read.service.js'

export async function cancelRun(input: {
  organizationId: string
  runId: string
}) {
  const now = new Date()
  const cancellation = await db.transaction().execute(async (trx) => {
    const run = await trx.selectFrom('flowRuns')
      .select(['id', 'status', 'triggerRunId'])
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.runId)
      .forUpdate()
      .executeTakeFirst()
    if (!run)
      throw new TenantResourceNotFoundError()
    if (!['pending', 'running'].includes(run.status))
      throw new HttpError(409, 'invalid_state', 'Only active runs can be canceled.')
    await trx.updateTable('generationJobs')
      .set({
        completedAt: now,
        providerSettlementResolvedAt: null,
        providerSettlementStatus: 'not_required',
        status: 'canceled',
      })
      .where('organizationId', '=', input.organizationId)
      .where('flowRunId', '=', input.runId)
      .where('status', 'in', ['pending', 'running'])
      .where('providerSubmittedAt', 'is', null)
      .execute()
    const submitted = await trx.selectFrom('generationJobs')
      .select(eb => eb.fn.countAll<number>().as('count'))
      .where('organizationId', '=', input.organizationId)
      .where('flowRunId', '=', input.runId)
      .where('status', 'in', ['pending', 'running'])
      .where('providerSubmittedAt', 'is not', null)
      .executeTakeFirst()
    const submittedJobCount = Number(submitted?.count ?? 0)
    await trx.updateTable('flowRunNodeItems')
      .set({ status: 'canceled', updatedAt: now })
      .where('organizationId', '=', input.organizationId)
      .where('flowRunId', '=', input.runId)
      .where('status', 'in', ['pending', 'running'])
      .execute()
    await trx.updateTable('flowRunNodes')
      .set({ status: 'canceled', updatedAt: now })
      .where('organizationId', '=', input.organizationId)
      .where('flowRunId', '=', input.runId)
      .where('status', 'in', ['pending', 'running'])
      .execute()
    await trx.updateTable('flowRuns')
      .set({
        cancellationReconciledAt:
          run.triggerRunId || submittedJobCount > 0 ? null : now,
        completedAt: now,
        status: 'canceled',
      })
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.runId)
      .execute()
    return { submittedJobCount, triggerRunId: run.triggerRunId }
  })
  if (cancellation.triggerRunId && cancellation.submittedJobCount === 0) {
    try {
      await triggerRuns.cancel(cancellation.triggerRunId)
    }
    catch (error) {
      const failure = toSafeRunFailure(error)
      logRunEngine('error', 'flow_run.cancel.trigger_cancel_failed', {
        internalError: failure.internal,
        organizationId: input.organizationId,
        runId: input.runId,
        triggerRunId: cancellation.triggerRunId,
      })
    }
  }
  return getRunDetail(input.organizationId, input.runId)
}
