/** Authoritative, replay-safe managed and browser run cancellation. */

import { db } from '@talelabs/db'
import {
  toSafeRunFailure,
  runs as triggerRuns,
  triggerTask,
} from '@talelabs/trigger'

import {
  HttpError,
  TenantResourceNotFoundError,
} from '../../middleware/error.js'
import { lockBrowserRunFence } from './browser-runtime/browser-runtime-policy.js'
import { logRunEngine } from './logging.js'
import { getRunDetail } from './read.service.js'

/** Injectable side effects used by deterministic cancellation certification. */
export interface CancelRunDependencies {
  /** Database owning the run state transition. */
  database?: typeof db
  /** Durable dispatch for asynchronous credit release. */
  dispatchCreditSettlement?: (input: {
    flowRunId: string
    organizationId: string
  }) => Promise<unknown>
  /** Trigger parent cancellation transport. */
  cancelTriggerRun?: (triggerRunId: string) => Promise<unknown>
  /** Authoritative response read after the transition. */
  readRunDetail?: typeof getRunDetail
}

/** Cancels active jobs and records runtime-specific provider settlement intent. */
export async function cancelRun(input: {
  organizationId: string
  runId: string
  userId: string
}, dependencies: CancelRunDependencies = {}) {
  const database = dependencies.database ?? db
  const dispatchCreditSettlement
    = dependencies.dispatchCreditSettlement
      ?? (payload => triggerTask(
        'billing-run-cancellation-settle',
        payload,
        {
          concurrencyKey: payload.organizationId,
          queue: 'billing-settlements',
        },
      ))
  const cancelTriggerRun
    = dependencies.cancelTriggerRun ?? (id => triggerRuns.cancel(id))
  const readRunDetail = dependencies.readRunDetail ?? getRunDetail
  const now = new Date()
  const cancellation = await database.transaction().execute(async (trx) => {
    await lockBrowserRunFence(trx, input)
    const candidate = await trx
      .selectFrom('flowRuns')
      .select(['createdBy', 'id', 'source'])
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.runId)
      .executeTakeFirst()
    if (
      !candidate
      || (candidate.source === 'create' && candidate.createdBy !== input.userId)
    ) {
      throw new TenantResourceNotFoundError()
    }
    // Job finalization locks a job before aggregating its parent run. Cancellation
    // follows the same order so a late output cannot deadlock the user request.
    await trx
      .selectFrom('generationJobs')
      .select('id')
      .where('organizationId', '=', input.organizationId)
      .where('flowRunId', '=', input.runId)
      .orderBy('id')
      .forUpdate()
      .execute()
    const run = await trx
      .selectFrom('flowRuns')
      .select([
        'createdBy',
        'executionRuntime',
        'id',
        'source',
        'status',
        'triggerRunId',
      ])
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.runId)
      .forUpdate()
      .executeTakeFirst()
    if (!run || (run.source === 'create' && run.createdBy !== input.userId))
      throw new TenantResourceNotFoundError()
    if (
      run.status !== 'canceled'
      && !['pending', 'running'].includes(run.status)
    ) {
      throw new HttpError(
        409,
        'invalid_state',
        'Only active runs can be canceled.',
      )
    }
    const replayed = run.status === 'canceled'
    const submitted = await trx
      .selectFrom('generationJobs')
      .select(eb => eb.fn.countAll<number>().as('count'))
      .where('organizationId', '=', input.organizationId)
      .where('flowRunId', '=', input.runId)
      .where('status', 'in', ['pending', 'running'])
      .where('providerSubmittedAt', 'is not', null)
      .executeTakeFirst()
    const submittedJobCount = Number(submitted?.count ?? 0)
    if (replayed) {
      return {
        replayed,
        submittedJobCount,
        triggerRunId: run.triggerRunId,
      }
    }
    await trx
      .updateTable('generationJobs')
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
    if (run.executionRuntime === 'browser') {
      await trx
        .updateTable('generationJobs')
        .set({
          browserCancelRequestedAt: now,
          completedAt: now,
          providerSettlementResolvedAt: null,
          providerSettlementStatus: 'pending',
          status: 'canceled',
        })
        .where('organizationId', '=', input.organizationId)
        .where('flowRunId', '=', input.runId)
        .where('status', 'in', ['pending', 'running'])
        .where('providerSubmittedAt', 'is not', null)
        .execute()
    }
    await trx
      .updateTable('flowRunNodeItems')
      .set({ status: 'canceled', updatedAt: now })
      .where('organizationId', '=', input.organizationId)
      .where('flowRunId', '=', input.runId)
      .where('status', 'in', ['pending', 'running'])
      .execute()
    await trx
      .updateTable('flowRunNodes')
      .set({ status: 'canceled', updatedAt: now })
      .where('organizationId', '=', input.organizationId)
      .where('flowRunId', '=', input.runId)
      .where('status', 'in', ['pending', 'running'])
      .execute()
    await trx
      .updateTable('flowRuns')
      .set({
        browserExecutorCode:
          run.executionRuntime === 'browser' && submittedJobCount > 0
            ? 'provider_cancellation_pending'
            : null,
        browserExecutorStatus:
          run.executionRuntime === 'browser'
            ? submittedJobCount > 0
              ? 'canceling'
              : 'ready'
            : null,
        browserExecutorUpdatedAt:
          run.executionRuntime === 'browser' ? now : null,
        cancellationReconciledAt:
          run.executionRuntime === 'browser'
            ? submittedJobCount > 0
              ? null
              : now
            : run.triggerRunId || submittedJobCount > 0
              ? null
              : now,
        completedAt: now,
        status: 'canceled',
      })
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.runId)
      .execute()
    return {
      replayed,
      submittedJobCount,
      triggerRunId: run.triggerRunId,
    }
  })
  const sideEffects: Promise<unknown>[] = [
    dispatchCreditSettlement({
      flowRunId: input.runId,
      organizationId: input.organizationId,
    }).catch((error) => {
      const failure = toSafeRunFailure(error)
      logRunEngine('error', 'flow_run.cancel.credit_dispatch_failed', {
        internalError: failure.internal,
        organizationId: input.organizationId,
        replayed: cancellation.replayed,
        runId: input.runId,
      })
    }),
  ]
  if (cancellation.triggerRunId && cancellation.submittedJobCount === 0) {
    sideEffects.push(cancelTriggerRun(cancellation.triggerRunId).catch((error) => {
      const failure = toSafeRunFailure(error)
      logRunEngine('error', 'flow_run.cancel.trigger_cancel_failed', {
        internalError: failure.internal,
        organizationId: input.organizationId,
        replayed: cancellation.replayed,
        runId: input.runId,
        triggerRunId: cancellation.triggerRunId,
      })
    }))
  }
  await Promise.all(sideEffects)
  return readRunDetail(input.organizationId, input.runId, input.userId)
}
