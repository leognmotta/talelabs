/** Stable Flow run status and run-ID normalization helpers. */

import type { FlowRun } from '@talelabs/sdk'

type ActiveFlowRunStatus = Extract<FlowRun['status'], 'pending' | 'running'>
type RetryableFlowRunStatus = Extract<
  FlowRun['status'],
  'canceled' | 'failed' | 'partial'
>

/** Returns whether a run still needs realtime or fallback refresh. */
export function isActiveRunStatus(
  status: FlowRun['status'],
): status is ActiveFlowRunStatus {
  return status === 'pending' || status === 'running'
}

/** Returns whether a terminal run can be retried through the run API. */
export function isRetryableRunStatus(
  status: FlowRun['status'],
): status is RetryableFlowRunStatus {
  return status === 'canceled' || status === 'failed' || status === 'partial'
}

export { isActiveRunStatus as isActiveFlowRunStatus }
