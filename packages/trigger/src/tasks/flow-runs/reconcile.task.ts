import { schedules } from '@trigger.dev/sdk'

import { reconcileFlowRunDispatches } from '../../flow-runs/reconciliation/dispatch.js'

export const reconcileFlowRunsTask = schedules.task({
  id: 'flow-run-reconcile',
  cron: '*/5 * * * *',
  run: reconcileFlowRunDispatches,
})
