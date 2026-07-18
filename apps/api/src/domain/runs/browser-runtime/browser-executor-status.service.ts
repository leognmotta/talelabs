/** Safe authoritative diagnostics for browser executors and credential blocks. */

import { db } from '@talelabs/db'

import {
  HttpError,
  TenantResourceNotFoundError,
} from '../../../middleware/error.js'

/** Stable non-secret browser executor codes accepted from the current user. */
export type BrowserExecutorCode
  = | 'browser_api_unavailable'
    | 'browser_authorization_failed'
    | 'browser_executor_failed'
    | 'browser_journal_unavailable'
    | 'browser_locks_unavailable'
    | 'browser_manifest_invalid'
    | 'browser_run_not_found'
    | 'credential_required'
    | 'credential_store_unavailable'
    | 'provider_cancellation_pending'

/** Persists an actionable browser condition without changing run lifecycle state. */
export async function updateBrowserExecutorStatus(input: {
  code: BrowserExecutorCode | null
  organizationId: string
  runId: string
  status: 'blocked' | 'canceling' | 'error' | 'ready' | 'retrying'
  userId: string
}) {
  const run = await db
    .selectFrom('flowRuns')
    .select([
      'cancellationReconciledAt',
      'createdBy',
      'executionRuntime',
      'status',
    ])
    .where('organizationId', '=', input.organizationId)
    .where('id', '=', input.runId)
    .executeTakeFirst()
  if (!run || run.createdBy !== input.userId)
    throw new TenantResourceNotFoundError()
  if (run.executionRuntime !== 'browser') {
    throw new HttpError(
      409,
      'invalid_execution_runtime',
      'This run is not browser-executed.',
    )
  }
  if (
    !['pending', 'running'].includes(run.status)
    && !(run.status === 'canceled' && run.cancellationReconciledAt === null)
  ) {
    throw new HttpError(
      409,
      'run_terminal',
      'This run no longer accepts browser executor updates.',
    )
  }
  if (input.status === 'ready' && input.code !== null) {
    throw new HttpError(
      422,
      'validation_error',
      'Ready browser execution cannot have an error code.',
    )
  }
  if (input.status !== 'ready' && input.code === null) {
    throw new HttpError(
      422,
      'validation_error',
      'Blocked browser execution requires a safe code.',
    )
  }
  const now = new Date()
  const updated = await db
    .updateTable('flowRuns')
    .set({
      browserExecutorCode: input.code,
      browserExecutorStatus: input.status,
      browserExecutorUpdatedAt: now,
    })
    .where('organizationId', '=', input.organizationId)
    .where('id', '=', input.runId)
    .where('createdBy', '=', input.userId)
    .where(eb =>
      eb.or([
        eb('status', 'in', ['pending', 'running']),
        eb.and([
          eb('status', '=', 'canceled'),
          eb('cancellationReconciledAt', 'is', null),
        ]),
      ]),
    )
    .returning('id')
    .executeTakeFirst()
  if (!updated) {
    throw new HttpError(
      409,
      'run_terminal',
      'This run no longer accepts browser executor updates.',
    )
  }
  return {
    code: input.code,
    status: input.status,
    updatedAt: now.toISOString(),
  }
}
