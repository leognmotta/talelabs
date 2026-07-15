import { idempotencyKeys, schedules } from '@trigger.dev/sdk'

import {
  claimFlowRunTriggerParent,
  claimUndispatchedFlowRuns,
  reconcileFlowRunStates,
} from '../../flow-run-state.js'
import { toSafeRunFailure } from '../../run-failure.js'
import { organizationConcurrencyKey } from './contracts.js'
import { logRunEngine } from './logging.js'
import { flowRunOrchestratorTask } from './orchestrator.js'

export const reconcileFlowRunsTask = schedules.task({
  id: 'flow-run-reconcile',
  cron: '*/5 * * * *',
  run: async () => {
    const stateRepairs = await reconcileFlowRunStates({ limit: 100 })
    const runs = await claimUndispatchedFlowRuns({ limit: 100 })
    let dispatched = 0
    for (const run of runs) {
      try {
        const idempotencyKey = await idempotencyKeys.create(run.id, { scope: 'global' })
        const triggerRun = await flowRunOrchestratorTask.trigger({
          flowRunId: run.id,
          organizationId: run.organizationId,
        }, {
          concurrencyKey: organizationConcurrencyKey(run.organizationId),
          idempotencyKey,
          queue: 'flow-runs',
        })
        const triggerRunId = typeof triggerRun === 'object'
          && triggerRun
          && 'id' in triggerRun
          ? String(triggerRun.id)
          : null
        if (triggerRunId) {
          await claimFlowRunTriggerParent({
            flowRunId: run.id,
            organizationId: run.organizationId,
            triggerRunId,
          })
        }
        dispatched += 1
      }
      catch (error) {
        const failure = toSafeRunFailure(error)
        logRunEngine('error', 'flow_run.reconcile.dispatch_failed', {
          internalError: failure.internal,
          organizationId: run.organizationId,
          runId: run.id,
        })
      }
    }
    logRunEngine('info', 'flow_run.reconcile.completed', {
      candidateCount: runs.length,
      dispatched,
      stateRepairs,
    })
    return { candidateCount: runs.length, dispatched, stateRepairs }
  },
})
