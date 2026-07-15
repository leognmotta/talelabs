import {
  claimUndispatchedFlowRuns,
  reconcileFlowRunStates,
} from '@talelabs/trigger'

import { dispatchFlowRun } from './dispatch.service.js'
import { logRunEngine } from './logging.js'

export async function reconcileRuns(organizationId: string) {
  const stateRepairs = await reconcileFlowRunStates({ limit: 25, organizationId })
  const runs = await claimUndispatchedFlowRuns({ limit: 25, organizationId })
  let dispatched = 0
  for (const run of runs) {
    const triggerRunId = await dispatchFlowRun({
      eventPrefix: 'flow_run.reconcile',
      organizationId,
      runId: run.id,
    })
    if (triggerRunId)
      dispatched += 1
  }
  logRunEngine('info', 'flow_run.reconcile.completed', {
    candidateCount: runs.length,
    dispatched,
    organizationId,
  })
  return { dispatched, stateRepairs }
}
