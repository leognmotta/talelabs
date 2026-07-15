import {
  claimFlowRunTriggerParent,
  flowRunTaskOptions,
  toSafeRunFailure,
  triggerTask,
} from '@talelabs/trigger'

import { logRunEngine } from './logging.js'

export async function dispatchFlowRun(input: {
  eventPrefix: string
  flowId?: null | string
  organizationId: string
  runId: string
}) {
  try {
    const triggerRun = await triggerTask('flow-run-orchestrator', {
      flowRunId: input.runId,
      organizationId: input.organizationId,
    }, flowRunTaskOptions(input.organizationId, {
      idempotencyKey: input.runId,
    }))
    const triggerRunId = typeof triggerRun === 'object'
      && triggerRun
      && 'id' in triggerRun
      ? String(triggerRun.id)
      : null
    if (triggerRunId) {
      await claimFlowRunTriggerParent({
        flowRunId: input.runId,
        organizationId: input.organizationId,
        triggerRunId,
      })
    }
    logRunEngine('info', `${input.eventPrefix}.dispatch_succeeded`, {
      flowId: input.flowId,
      organizationId: input.organizationId,
      runId: input.runId,
      triggerRunId,
    })
    return triggerRunId
  }
  catch (error) {
    const failure = toSafeRunFailure(error)
    logRunEngine('error', `${input.eventPrefix}.dispatch_failed`, {
      flowId: input.flowId,
      internalError: failure.internal,
      organizationId: input.organizationId,
      runId: input.runId,
    })
    return null
  }
}
