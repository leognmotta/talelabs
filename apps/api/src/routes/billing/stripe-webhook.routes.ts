/** Raw-body Stripe webhook verification and durable inbox receipt. */

import type { OpenAPIHono } from '@hono/zod-openapi'
import type { ApiEnv } from '../../types.js'

import { createRoute } from '@hono/zod-openapi'
import { db } from '@talelabs/db'
import {
  constructStripeWebhookEvent,
  getStripeWebhookSecret,
} from '@talelabs/stripe'
import { triggerTask } from '@talelabs/trigger'

import { HttpError } from '../../middleware/error.js'
import { ErrorResponseSchema } from '../../schemas/common.js'
import { StripeWebhookReceiptResponseSchema } from './billing.schemas.js'

const stripeWebhookRoute = createRoute({
  method: 'post',
  operationId: 'receiveStripeWebhook',
  path: '/webhooks/stripe',
  responses: {
    200: {
      content: {
        'application/json': { schema: StripeWebhookReceiptResponseSchema },
      },
      description: 'Signed Stripe event stored in the durable inbox',
    },
    400: {
      content: {
        'application/json': { schema: ErrorResponseSchema },
      },
      description: 'Stripe signature is missing or invalid',
    },
  },
  tags: ['Billing'],
})

function stripeEventObjectId(object: unknown) {
  return object && typeof object === 'object'
    && 'id' in object && typeof object.id === 'string'
    ? object.id
    : null
}

/** Mounts the unauthenticated but Stripe-signed webhook receipt endpoint. */
export function registerStripeWebhookRoutes(app: OpenAPIHono<ApiEnv>) {
  app.openapi(stripeWebhookRoute, async (c) => {
    const signature = c.req.header('Stripe-Signature')
    if (!signature) {
      throw new HttpError(
        400,
        'invalid_webhook_signature',
        'Stripe-Signature is required.',
      )
    }
    let event
    try {
      const payload = await c.req.text()
      event = constructStripeWebhookEvent({
        payload,
        secret: getStripeWebhookSecret(),
        signature,
      })
    }
    catch {
      throw new HttpError(
        400,
        'invalid_webhook_signature',
        'The Stripe webhook signature is invalid.',
      )
    }
    if (event.livemode) {
      throw new HttpError(
        400,
        'stripe_live_event_refused',
        'Live-mode Stripe events are not accepted in this environment.',
      )
    }
    await db.insertInto('stripeWebhookEvents')
      .values({
        eventType: event.type,
        processingStatus: 'pending',
        stripeEventId: event.id,
        stripeObjectId: stripeEventObjectId(event.data.object),
      })
      .onConflict(conflict => conflict.column('stripeEventId').doNothing())
      .execute()
    try {
      await triggerTask('billing-webhook-process', {
        stripeEventId: event.id,
      }, {
        idempotencyKey: event.id,
      })
    }
    catch {
      // The durable recovery task owns redelivery when dispatch is unavailable.
    }
    return c.json({ received: true as const }, 200)
  })
}
