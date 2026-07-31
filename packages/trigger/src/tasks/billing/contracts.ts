/** Validated payloads for durable Stripe billing tasks. */

import { z } from 'zod'

/** Signed Stripe event identity stored in the durable inbox. */
export const billingWebhookTaskPayloadSchema = z.object({
  stripeEventId: z.string().min(1).max(255),
})

/** Canceled run identity whose credit holds should be released. */
export const billingRunCancellationSettlementTaskPayloadSchema = z.object({
  flowRunId: z.string().min(1).max(255),
  organizationId: z.string().min(1).max(255),
})

/** Payload accepted by the Stripe webhook processor task. */
export type BillingWebhookTaskPayload = z.infer<
  typeof billingWebhookTaskPayloadSchema
>

/** Payload accepted by canceled-run credit settlement. */
export type BillingRunCancellationSettlementTaskPayload = z.infer<
  typeof billingRunCancellationSettlementTaskPayloadSchema
>
