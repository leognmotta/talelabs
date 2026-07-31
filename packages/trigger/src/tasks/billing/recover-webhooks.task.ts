/** Bounded scheduled recovery for Stripe events not yet processed. */

import { idempotencyKeys, schedules } from '@trigger.dev/sdk'

import {
  findRecoverableStripeWebhookEvents,
} from '../../billing/webhook-processor.js'
import { billingWebhookTask } from './webhook.task.js'

/** Redelivers pending, failed, and stale-processing event identities. */
export const recoverBillingWebhooksTask = schedules.task({
  cron: '*/5 * * * *',
  id: 'billing-webhook-recover',
  run: async () => {
    const events = await findRecoverableStripeWebhookEvents()
    for (const event of events) {
      const key = await idempotencyKeys.create(
        `${event.stripeEventId}:${event.attemptCount}`,
        { scope: 'global' },
      )
      await billingWebhookTask.trigger({
        stripeEventId: event.stripeEventId,
      }, { idempotencyKey: key })
    }
    return { dispatched: events.length }
  },
})
