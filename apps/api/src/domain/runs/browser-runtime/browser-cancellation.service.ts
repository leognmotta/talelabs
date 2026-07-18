/** Durable provider-cancellation acknowledgement for terminal browser runs. */

import {
  HttpError,
  TenantResourceNotFoundError,
} from '../../../middleware/error.js'
import { retireBrowserRunLeaseIfTerminal } from './browser-lease.service.js'
import { withBrowserRunLease } from './browser-runtime-policy.js'

/** Records a safe provider cancellation outcome under the current lease fence. */
export async function acknowledgeBrowserJobCancellation(input: {
  executorId: string
  fenceToken: number
  final: boolean
  jobId: string
  organizationId: string
  result: 'accepted' | 'rejected' | 'unavailable' | 'unsupported'
  runId: string
  userId: string
}) {
  const response = await withBrowserRunLease(input, async (run, trx) => {
    if (run.status !== 'canceled') {
      throw new HttpError(
        409,
        'invalid_state',
        'The run is not awaiting cancellation reconciliation.',
      )
    }
    const job = await trx
      .selectFrom('generationJobs')
      .select(['browserCancelRequestedAt', 'id'])
      .where('organizationId', '=', input.organizationId)
      .where('flowRunId', '=', input.runId)
      .where('id', '=', input.jobId)
      .executeTakeFirst()
    if (!job)
      throw new TenantResourceNotFoundError()
    if (!job.browserCancelRequestedAt) {
      throw new HttpError(
        409,
        'invalid_state',
        'The job does not require provider cancellation.',
      )
    }
    if (['unavailable', 'unsupported'].includes(input.result) && !input.final) {
      throw new HttpError(
        422,
        'validation_error',
        'This cancellation outcome must be final.',
      )
    }

    const now = new Date()
    await trx
      .updateTable('generationJobs')
      .set({
        browserCancelAcknowledgedAt: now,
        browserCancelFinal: input.final,
        browserCancelStatus: input.result,
        providerSettlementResolvedAt: now,
        providerSettlementStatus: 'unknown',
      })
      .where('organizationId', '=', input.organizationId)
      .where('flowRunId', '=', input.runId)
      .where('id', '=', input.jobId)
      .execute()
    const pending = await trx
      .selectFrom('generationJobs')
      .select('id')
      .where('organizationId', '=', input.organizationId)
      .where('flowRunId', '=', input.runId)
      .where('browserCancelRequestedAt', 'is not', null)
      .where(eb =>
        eb.or([
          eb('browserCancelAcknowledgedAt', 'is', null),
          eb('browserCancelFinal', '=', false),
        ]),
      )
      .executeTakeFirst()
    if (!pending) {
      await trx
        .updateTable('flowRuns')
        .set({
          browserExecutorCode: null,
          browserExecutorStatus: 'ready',
          browserExecutorUpdatedAt: now,
          cancellationReconciledAt: now,
        })
        .where('organizationId', '=', input.organizationId)
        .where('id', '=', input.runId)
        .where('status', '=', 'canceled')
        .execute()
    }
    return {
      cancellationReconciled: !pending,
      state: 'canceled' as const,
    }
  })
  await retireBrowserRunLeaseIfTerminal(input)
  return response
}
