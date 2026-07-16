import { schedules } from '@trigger.dev/sdk'

import { reconcileScheduledOpenRouterProviderCosts } from '../../flow-runs/reconciliation/provider-accounting.js'

export const reconcileProviderCostsTask = schedules.task({
  id: 'provider-cost-reconcile',
  cron: '*/5 * * * *',
  run: reconcileScheduledOpenRouterProviderCosts,
})
