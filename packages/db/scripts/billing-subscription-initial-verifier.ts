/** Initial Invoice-first projection and scheduled-cancellation certification. */

import type { Kysely } from 'kysely'
import type { Database } from '../src/schema.js'

import { BILLING_CATALOG } from '@talelabs/billing'

import { createSubscriptionPaymentStripeFixture } from './billing-subscription-payment-fixture.js'
import { invariant } from './billing-verifier-support.js'

type SubscriptionProcessor
  = typeof import(
    '../../trigger/src/billing/stripe-subscription-invoices.js'
  )
  & typeof import('../../trigger/src/billing/stripe-subscriptions.js')

const organizationId = 'billing-org-zz-subscription-invoice-first'
const customerId = 'cus_subscription_invoice_first'
const invoiceId = 'in_subscription_invoice_first'
const stripeSubscriptionId = 'sub_subscription_invoice_first'
const option = BILLING_CATALOG.plans.pro.currentRecurringOptions
  .find(candidate => candidate.code === 'pro-5300')!

/**
 * Proves an initial paid Invoice can create its missing lifecycle projection,
 * then recognizes and clears Stripe's explicit scheduled-cancellation form.
 */
export async function verifyInitialSubscriptionInvoiceProjection(
  database: Kysely<Database>,
  subscriptionProcessor: SubscriptionProcessor,
) {
  const servicePeriodStart = new Date()
  servicePeriodStart.setUTCDate(servicePeriodStart.getUTCDate() - 1)
  servicePeriodStart.setUTCMilliseconds(0)
  const servicePeriodEnd = new Date(servicePeriodStart)
  servicePeriodEnd.setUTCFullYear(servicePeriodEnd.getUTCFullYear() + 1)
  await database
    .updateTable('organizationBillingAccounts')
    .set({ stripeCustomerId: customerId })
    .where('organizationId', '=', organizationId)
    .execute()
  const fixture = createSubscriptionPaymentStripeFixture({
    capturedAt: new Date(),
    customerId,
    historical: {
      invoiceId: 'in_unused_subscription_history',
      lineId: 'il_unused_subscription_history',
      offer: {
        ...option.year,
        billingInterval: 'year',
        monthlyCredits: option.monthlyCredits,
        recurringOptionCode: option.code,
      },
      projectionOffer: option.year,
      projectionRecurringOptionCode: option.code,
      servicePeriodEnd,
      servicePeriodStart,
      stripePriceId: 'price_unused_subscription_history',
      stripeSubscriptionId: 'sub_unused_subscription_history',
    },
    organizationId,
    replacement: {
      invoiceId,
      lineId: 'il_subscription_invoice_first',
      monthlyCredits: option.monthlyCredits,
      offer: option.year,
      recurringOptionCode: option.code,
      servicePeriodEnd,
      servicePeriodStart,
      stripePriceId: 'price_subscription_invoice_first',
      stripeSubscriptionId,
    },
  })
  await subscriptionProcessor.processPaidStripeInvoice(
    invoiceId,
    database,
    fixture.stripe,
    BILLING_CATALOG,
  )
  invariant(
    fixture.subscriptionRetrievals.length === 1
    && fixture.subscriptionRetrievals[0] === stripeSubscriptionId,
    'initial_invoice_did_not_project_missing_subscription_once',
  )
  const initial = await database
    .selectFrom('billingSubscriptions')
    .select(['cancelAtPeriodEnd', 'paidThrough', 'status'])
    .where('organizationId', '=', organizationId)
    .where('stripeSubscriptionId', '=', stripeSubscriptionId)
    .executeTakeFirstOrThrow()
  const account = await database
    .selectFrom('organizationBillingAccounts')
    .select(['currentPlanCode', 'currentRecurringOptionCode', 'paidThrough'])
    .where('organizationId', '=', organizationId)
    .executeTakeFirstOrThrow()
  invariant(
    initial.status === 'active'
    && !initial.cancelAtPeriodEnd
    && initial.paidThrough?.getTime() === servicePeriodEnd.getTime()
    && account.currentPlanCode === 'pro'
    && account.currentRecurringOptionCode === option.code
    && account.paidThrough?.getTime() === servicePeriodEnd.getTime(),
    'initial_invoice_projection_or_entitlement_invalid',
  )
  fixture.setReplacementCancellationAt(servicePeriodEnd)
  await subscriptionProcessor.projectStripeSubscription(
    stripeSubscriptionId,
    database,
    fixture.stripe,
    BILLING_CATALOG,
  )
  const canceling = await database
    .selectFrom('billingSubscriptions')
    .select('cancelAtPeriodEnd')
    .where('stripeSubscriptionId', '=', stripeSubscriptionId)
    .executeTakeFirstOrThrow()
  fixture.setReplacementCancellationAt(null)
  await subscriptionProcessor.projectStripeSubscription(
    stripeSubscriptionId,
    database,
    fixture.stripe,
    BILLING_CATALOG,
  )
  const reactivated = await database
    .selectFrom('billingSubscriptions')
    .select('cancelAtPeriodEnd')
    .where('stripeSubscriptionId', '=', stripeSubscriptionId)
    .executeTakeFirstOrThrow()
  invariant(
    canceling.cancelAtPeriodEnd && !reactivated.cancelAtPeriodEnd,
    'explicit_subscription_cancellation_not_projected_or_cleared',
  )
}
