import { runs as triggerRuns } from '@trigger.dev/sdk'

export const ACTIVE_TRIGGER_STATUSES = new Set([
  'PENDING_VERSION',
  'QUEUED',
  'DEQUEUED',
  'EXECUTING',
  'WAITING',
  'DELAYED',
])
export const TERMINAL_TRIGGER_STATUSES = new Set([
  'COMPLETED',
  'CANCELED',
  'FAILED',
  'CRASHED',
  'SYSTEM_FAILURE',
  'EXPIRED',
  'TIMED_OUT',
])

export async function retrieveTriggerRunStatus(triggerRunId: string) {
  try {
    const run = await triggerRuns.retrieve(triggerRunId)
    return { status: run.status, version: run.version?.trim() || null }
  }
  catch (error) {
    const status = typeof error === 'object' && error && 'status' in error
      ? Number(error.status)
      : null
    return status === 404
      ? { status: 'MISSING' as const, version: null }
      : null
  }
}
