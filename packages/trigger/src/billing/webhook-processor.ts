/** Durable Stripe webhook inbox claiming, dispatch, and recovery selection. */

import type { DatabaseExecutor } from '@talelabs/db'
import type { StripeClient } from '@talelabs/stripe'

import { db, withDatabaseTransaction } from '@talelabs/db'
import { assertStripeTestMode, stripeClient } from '@talelabs/stripe'

import { processStripeCheckoutSession } from './stripe-checkout-sessions.js'
import { assertStripeTestResource } from './stripe-facts.js'
import {
  processRefundedStripeCharge,
  processStripeDispute,
} from './stripe-reversals.js'
import {
  processStripeSubscriptionChangeSchedule,
  processSubscriptionChangePaymentAction,
} from './stripe-subscription-changes.js'
import {
  processFailedStripeInvoice,
  processPaidStripeInvoice,
} from './stripe-subscription-invoices.js'
import { projectStripeSubscription } from './stripe-subscriptions.js'

const PROCESSING_STALE_AFTER_MS = 15 * 60 * 1_000

function eventObjectId(event: { data: { object: unknown } }) {
  const object = event.data.object
  return object
    && typeof object === 'object'
    && 'id' in object
    && typeof object.id === 'string'
    ? object.id
    : null
}

async function claimWebhookEvent(
  stripeEventId: string,
  database: DatabaseExecutor,
) {
  return withDatabaseTransaction(database, async (trx) => {
    const inbox = await trx
      .selectFrom('stripeWebhookEvents')
      .selectAll()
      .where('stripeEventId', '=', stripeEventId)
      .forUpdate()
      .executeTakeFirstOrThrow()
    if (inbox.processingStatus === 'succeeded')
      return null
    if (
      inbox.processingStatus === 'processing'
      && inbox.updatedAt.getTime() > Date.now() - PROCESSING_STALE_AFTER_MS
    ) {
      return null
    }
    await trx
      .updateTable('stripeWebhookEvents')
      .set(eb => ({
        attemptCount: eb('attemptCount', '+', 1),
        lastErrorCode: null,
        processingStatus: 'processing',
        processedAt: null,
        updatedAt: new Date(),
      }))
      .where('stripeEventId', '=', stripeEventId)
      .execute()
    return inbox
  })
}

async function dispatchStripeEvent(
  event: Awaited<ReturnType<StripeClient['events']['retrieve']>>,
  database: DatabaseExecutor,
  stripe: StripeClient,
) {
  const objectId = eventObjectId(event)
  if (!objectId)
    throw new Error('stripe_event_object_missing')
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
    case 'checkout.session.async_payment_failed':
    case 'checkout.session.expired':
      return processStripeCheckoutSession(
        {
          eventType: event.type,
          stripeCheckoutSessionId: objectId,
        },
        database,
        stripe,
      )
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      return projectStripeSubscription(objectId, database, stripe)
    case 'invoice.paid':
      return processPaidStripeInvoice(objectId, database, stripe)
    case 'invoice.payment_failed':
      return processFailedStripeInvoice(objectId, database, stripe)
    case 'invoice.payment_action_required':
      return processSubscriptionChangePaymentAction(
        objectId,
        database,
        stripe,
      )
    case 'subscription_schedule.created':
    case 'subscription_schedule.updated':
      return processStripeSubscriptionChangeSchedule(
        {
          eventType: event.type,
          stripeScheduleId: objectId,
        },
        database,
        stripe,
      )
    case 'charge.refunded':
      return processRefundedStripeCharge(
        {
          eventId: event.id,
          stripeChargeId: objectId,
        },
        database,
        stripe,
      )
    case 'charge.dispute.created':
    case 'charge.dispute.closed':
      return processStripeDispute(
        {
          eventId: event.id,
          stripeDisputeId: objectId,
        },
        database,
        stripe,
      )
    default:
      return { ignored: true as const }
  }
}

function assertProjectionComplete(result: unknown) {
  if (
    result
    && typeof result === 'object'
    && 'matched' in result
    && result.matched === false
    && 'deferred' in result
    && result.deferred === true
  ) {
    throw new Error('stripe_payment_projection_pending')
  }
}

/** Processes one signed event from the durable inbox idempotently. */
export async function processStripeWebhookEvent(
  stripeEventId: string,
  database: DatabaseExecutor = db,
  stripe: StripeClient = stripeClient,
) {
  assertStripeTestMode()
  const inbox = await claimWebhookEvent(stripeEventId, database)
  if (!inbox)
    return { replayed: true as const }
  try {
    const event = await stripe.events.retrieve(stripeEventId)
    assertStripeTestResource(event, 'event')
    if (event.type !== inbox.eventType)
      throw new Error('stripe_event_type_mismatch')
    const result = await dispatchStripeEvent(event, database, stripe)
    assertProjectionComplete(result)
    await database
      .updateTable('stripeWebhookEvents')
      .set({
        lastErrorCode: null,
        processedAt: new Date(),
        processingStatus: 'succeeded',
        updatedAt: new Date(),
      })
      .where('stripeEventId', '=', stripeEventId)
      .execute()
    return { replayed: false as const }
  }
  catch (error) {
    const code
      = error instanceof Error && /^[a-z0-9_]+$/.test(error.message)
        ? error.message.slice(0, 100)
        : 'billing_webhook_processing_failed'
    await database
      .updateTable('stripeWebhookEvents')
      .set({
        lastErrorCode: code,
        processingStatus: 'failed',
        updatedAt: new Date(),
      })
      .where('stripeEventId', '=', stripeEventId)
      .execute()
    throw error
  }
}

/** Finds bounded pending, failed, or stale webhook inbox rows for redelivery. */
export async function findRecoverableStripeWebhookEvents(
  database: DatabaseExecutor = db,
  now = new Date(),
) {
  const staleBefore = new Date(now.getTime() - PROCESSING_STALE_AFTER_MS)
  return database
    .selectFrom('stripeWebhookEvents')
    .select(['attemptCount', 'stripeEventId'])
    .where(eb =>
      eb.or([
        eb('processingStatus', 'in', ['pending', 'failed']),
        eb.and([
          eb('processingStatus', '=', 'processing'),
          eb('updatedAt', '<=', staleBefore),
        ]),
      ]),
    )
    .orderBy('updatedAt')
    .orderBy('stripeEventId')
    .limit(100)
    .execute()
}
