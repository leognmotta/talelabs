/** Durable signed Stripe webhook event processing task. */

import { schemaTask } from '@trigger.dev/sdk'

import { processStripeWebhookEvent } from '../../billing/webhook-processor.js'
import { billingWebhookTaskPayloadSchema } from './contracts.js'

/** Processes one event identity from the PostgreSQL webhook inbox. */
export const billingWebhookTask = schemaTask({
  id: 'billing-webhook-process',
  retry: {
    factor: 2,
    maxAttempts: 5,
    maxTimeoutInMs: 60_000,
    minTimeoutInMs: 2_000,
  },
  schema: billingWebhookTaskPayloadSchema,
  run: async payload => processStripeWebhookEvent(payload.stripeEventId),
})
