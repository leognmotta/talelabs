import type { FlowRun } from '@talelabs/sdk'

export function isActiveRunStatus(status: FlowRun['status']) {
  return status === 'pending' || status === 'running'
}

export function isRetryableRunStatus(
  status: FlowRun['status'],
): status is 'canceled' | 'failed' | 'partial' {
  return status === 'canceled' || status === 'failed' || status === 'partial'
}
