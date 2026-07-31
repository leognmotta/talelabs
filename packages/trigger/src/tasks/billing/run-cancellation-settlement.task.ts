/** Durable settlement acceleration after a run becomes user-canceled. */

import { schemaTask } from '@trigger.dev/sdk'

import {
  settleCanceledRunCredits,
} from '../../billing/run-cancellation-settlement.js'
import {
  billingRunCancellationSettlementTaskPayloadSchema,
} from './contracts.js'

/** Releases canceled-run credit holds outside the cancellation request. */
export const billingRunCancellationSettlementTask = schemaTask({
  id: 'billing-run-cancellation-settle',
  queue: { concurrencyLimit: 10 },
  retry: {
    factor: 2,
    maxAttempts: 3,
    maxTimeoutInMs: 60_000,
    minTimeoutInMs: 2_000,
  },
  schema: billingRunCancellationSettlementTaskPayloadSchema,
  run: async payload => settleCanceledRunCredits(payload),
})
