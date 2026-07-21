/** Scheduled Trigger.dev entrypoint for bounded managed-provider accounting. */

import { schedules } from '@trigger.dev/sdk'

import { reconcileScheduledProviderCosts } from '../../flow-runs/reconciliation/provider-accounting.js'

/** Reconciles eventual OpenRouter and Fal request costs every five minutes. */
export const reconcileProviderCostsTask = schedules.task({
  id: 'provider-cost-reconcile',
  cron: '*/5 * * * *',
  maxDuration: 240,
  queue: { concurrencyLimit: 1 },
  run: reconcileScheduledProviderCosts,
  ttl: '5m',
})
