/** Safe classification of browser executor failures for authoritative status. */

import type { PutRunsIdBrowserExecutorStatusMutationRequest } from '@talelabs/sdk'

import { ApiError } from '@talelabs/sdk'
import { ZodError } from 'zod'

import { getApiErrorCode } from '../../../../shared/lib/api-error'

/** Actionable failure state that contains no provider response text or secret. */
export interface BrowserExecutorFailure {
  /** Stable server-allowlisted condition code. */
  code: NonNullable<PutRunsIdBrowserExecutorStatusMutationRequest['code']>
  /** Whether recovery needs user action, retry, or engineering attention. */
  status: Exclude<
    PutRunsIdBrowserExecutorStatusMutationRequest['status'],
    'canceling' | 'ready'
  >
}

/** Maps unknown runtime errors to safe persisted conditions or expected contention. */
export function classifyBrowserExecutorFailure(
  error: unknown,
): BrowserExecutorFailure | null {
  if (error instanceof DOMException && error.name === 'AbortError')
    return null
  const executorCode = (error as { browserExecutorCode?: unknown })
    ?.browserExecutorCode
  if (
    executorCode === 'credential_required'
    || executorCode === 'credential_store_unavailable'
  ) {
    return {
      code: executorCode,
      status: 'blocked',
    }
  }
  if (executorCode === 'browser_journal_unavailable') {
    return { code: executorCode, status: 'error' }
  }
  if (error instanceof ZodError)
    return { code: 'browser_manifest_invalid', status: 'error' }
  if (error instanceof ApiError) {
    const code = getApiErrorCode(error)
    if (
      error.status === 409
      && (code === 'browser_run_already_leased'
        || code === 'browser_run_lease_lost'
        || code === 'run_terminal')
    ) {
      return null
    }
    if (error.status === 401 || error.status === 403)
      return { code: 'browser_authorization_failed', status: 'error' }
    if (error.status === 404)
      return { code: 'browser_run_not_found', status: 'error' }
    if (error.status === 429 || error.status >= 500)
      return { code: 'browser_api_unavailable', status: 'retrying' }
  }
  if (error instanceof TypeError)
    return { code: 'browser_api_unavailable', status: 'retrying' }
  return { code: 'browser_executor_failed', status: 'error' }
}

/** Identifies a run that became terminal before the next browser reconciliation. */
export function isBrowserRunTerminalError(error: unknown) {
  return error instanceof ApiError
    && error.status === 409
    && getApiErrorCode(error) === 'run_terminal'
}
