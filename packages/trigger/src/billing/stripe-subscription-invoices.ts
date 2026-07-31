/** Paid and failed Stripe Invoice projection for recurring subscriptions. */

import type { BillingCatalog } from '@talelabs/billing'
import type { DatabaseExecutor } from '@talelabs/db'
import type { Stripe, StripeClient } from '@talelabs/stripe'

import { createId } from '@paralleldrive/cuid2'
import { BILLING_CATALOG } from '@talelabs/billing'
import {
  applyPaidSubscriptionChange,
  db,
  reconcileDueSubscriptionGrantsForSubscription,
  withDatabaseTransaction,
} from '@talelabs/db'
import {
  assertStripeTestMode,
  resolvePaidInvoicePaymentIntentId,
  resolvePaidSubscriptionChangeFacts,
  stripeClient,
} from '@talelabs/stripe'

import {
  assertStripeTestResource,
  retrieveStripeSettlementFacts,
  stripeObjectId,
} from './stripe-facts.js'
import { resolvePaidInvoiceGrantFacts } from './stripe-subscription-invoice-facts.js'
import {
  lockOrganizationSubscriptionState,
} from './stripe-subscription-state.js'
import { projectStripeSubscription } from './stripe-subscriptions.js'

function fromUnixSeconds(value: number) {
  return new Date(value * 1_000)
}

function invoiceSubscriptionId(invoice: Stripe.Invoice) {
  return stripeObjectId(invoice.parent?.subscription_details?.subscription)
}

async function resolveInvoiceSubscriptionOwner(
  invoice: Stripe.Invoice,
  stripeSubscriptionId: string,
  database: DatabaseExecutor,
  stripe: StripeClient,
  catalog: BillingCatalog,
) {
  const customerId = stripeObjectId(invoice.customer)
  if (!customerId)
    throw new Error('stripe_invoice_customer_missing')
  let subscription = await database
    .selectFrom('billingSubscriptions')
    .selectAll()
    .where('stripeSubscriptionId', '=', stripeSubscriptionId)
    .executeTakeFirst()
  if (!subscription) {
    // Initial invoice.paid may arrive before subscription.created. Project only
    // a missing exact subscription; existing historical rows remain immutable.
    await projectStripeSubscription(
      stripeSubscriptionId,
      database,
      stripe,
      catalog,
    )
    subscription = await database
      .selectFrom('billingSubscriptions')
      .selectAll()
      .where('stripeSubscriptionId', '=', stripeSubscriptionId)
      .executeTakeFirst()
  }
  if (!subscription)
    throw new Error('stripe_invoice_subscription_projection_missing')
  const account = await database
    .selectFrom('organizationBillingAccounts')
    .select('stripeCustomerId')
    .where('organizationId', '=', subscription.organizationId)
    .executeTakeFirstOrThrow()
  if (
    subscription.stripeCustomerId !== customerId
    || account.stripeCustomerId !== customerId
  ) {
    throw new Error('stripe_invoice_customer_mismatch')
  }
  return { customerId, subscription }
}

/** Records a paid Invoice, extends paidThrough, and emits due monthly grants. */
export async function processPaidStripeInvoice(
  stripeInvoiceId: string,
  database: DatabaseExecutor = db,
  stripe: StripeClient = stripeClient,
  catalog: BillingCatalog = BILLING_CATALOG,
) {
  assertStripeTestMode()
  const invoice = await stripe.invoices.retrieve(stripeInvoiceId, {
    expand: ['payments'],
  })
  assertStripeTestResource(invoice, 'invoice')
  if (
    invoice.status !== 'paid'
    || invoice.amount_paid < 1
    || invoice.currency !== catalog.currency
  ) {
    throw new Error('stripe_invoice_not_paid')
  }
  const stripeSubscriptionId = invoiceSubscriptionId(invoice)
  if (!stripeSubscriptionId)
    throw new Error('stripe_invoice_subscription_missing')
  const changeIntentId
    = invoice.parent?.type === 'subscription_details'
      ? invoice.parent.subscription_details?.metadata
        ?.talelabs_subscription_change_intent_id
      : undefined
  const changeIntent = changeIntentId
    ? await database.selectFrom('billingSubscriptionChangeIntents')
        .selectAll()
        .where('id', '=', changeIntentId)
        .executeTakeFirstOrThrow()
    : null
  if (changeIntent?.changeMode === 'renewal') {
    await projectStripeSubscription(
      stripeSubscriptionId,
      database,
      stripe,
      catalog,
    )
  }
  const owner = await resolveInvoiceSubscriptionOwner(
    invoice,
    stripeSubscriptionId,
    database,
    stripe,
    catalog,
  )
  if (changeIntent?.changeMode === 'immediate') {
    if (
      changeIntent.organizationId !== owner.subscription.organizationId
      || !changeIntent.expectedAmountDueMinor
      || !changeIntent.stripePriceId
      || !changeIntent.toMonthlyCredits
    ) {
      throw new Error('stripe_subscription_change_intent_mismatch')
    }
    const subscription = await stripe.subscriptions.retrieve(
      stripeSubscriptionId,
    )
    const changeFacts = await resolvePaidSubscriptionChangeFacts(
      invoice,
      subscription,
      {
        billingInterval: changeIntent.toBillingInterval,
        catalogRevision: changeIntent.catalogRevision,
        expectedAmountDueMinor: changeIntent.expectedAmountDueMinor,
        intentId: changeIntent.id,
        monthlyCredits: changeIntent.toMonthlyCredits,
        offerCode: changeIntent.toOfferCode,
        organizationId: changeIntent.organizationId,
        planCode: changeIntent.toPlanCode,
        recurringOptionCode: changeIntent.toRecurringOptionCode,
        stripePriceId: changeIntent.stripePriceId,
        stripeSubscriptionId,
      },
      stripe,
      catalog,
    )
    const paymentIntentId = await resolvePaidInvoicePaymentIntentId(
      invoice,
      stripe,
    )
    await applyPaidSubscriptionChange({
      ...changeFacts,
      intentId: changeIntent.id,
      organizationId: changeIntent.organizationId,
      paidAt: fromUnixSeconds(
        invoice.status_transitions.paid_at ?? invoice.created,
      ),
      stripePaymentIntentId: paymentIntentId,
    }, database)
    return changeIntent.organizationId
  }
  const grantFacts = await resolvePaidInvoiceGrantFacts(
    invoice,
    stripeSubscriptionId,
    stripe,
    catalog,
  )
  const paymentIntentId = await resolvePaidInvoicePaymentIntentId(
    invoice,
    stripe,
  )
  const settlement = await retrieveStripeSettlementFacts(
    paymentIntentId,
    stripe,
  )
  const paidAt = fromUnixSeconds(
    invoice.status_transitions.paid_at ?? invoice.created,
  )

  const paymentApplied = await withDatabaseTransaction(
    database,
    async (trx) => {
      const lockedState = await lockOrganizationSubscriptionState(
        owner.subscription.organizationId,
        trx,
      )
      const { account } = lockedState
      const locked = lockedState.subscriptions.find(
        subscription => subscription.id === owner.subscription.id,
      )
      if (
        !locked
        || account.stripeCustomerId !== owner.customerId
        || locked.stripeCustomerId !== owner.customerId
        || locked.stripeSubscriptionId !== stripeSubscriptionId
      ) {
        throw new Error('stripe_invoice_payment_owner_mismatch')
      }
      const existingPayment = await trx
        .selectFrom('billingPayments')
        .selectAll()
        .where('stripeInvoiceId', '=', invoice.id)
        .forUpdate()
        .executeTakeFirst()
      if (
        existingPayment
        && (existingPayment.organizationId
          !== owner.subscription.organizationId
          || existingPayment.billingSubscriptionId !== locked.id)
      ) {
        throw new Error('stripe_invoice_payment_owner_mismatch')
      }
      if (existingPayment && existingPayment.status !== 'paid')
        return false
      if (existingPayment?.subscriptionGrantFactsCapturedAt) {
        if (
          existingPayment.amountPaidMinor !== grantFacts.amountPaidMinor
          || existingPayment.servicePeriodStart?.getTime()
          !== grantFacts.servicePeriodStart.getTime()
          || existingPayment.servicePeriodEnd?.getTime()
          !== grantFacts.servicePeriodEnd.getTime()
          || existingPayment.stripeInvoiceLineItemId
          !== grantFacts.stripeInvoiceLineItemId
          || existingPayment.stripePriceId !== grantFacts.stripePriceId
          || existingPayment.subscriptionPlanCode
          !== grantFacts.subscriptionPlanCode
          || existingPayment.subscriptionRecurringOptionCode
          !== grantFacts.subscriptionRecurringOptionCode
          || existingPayment.subscriptionOfferCode
          !== grantFacts.subscriptionOfferCode
          || existingPayment.subscriptionMonthlyCredits
          !== grantFacts.subscriptionMonthlyCredits
          || existingPayment.subscriptionBillingInterval
          !== grantFacts.subscriptionBillingInterval
          || existingPayment.subscriptionCatalogRevision
          !== grantFacts.subscriptionCatalogRevision
        ) {
          throw new Error('stripe_invoice_payment_facts_mismatch')
        }
      }
      else if (existingPayment) {
        await trx
          .updateTable('billingPayments')
          .set({
            ...grantFacts,
            subscriptionGrantFactsCapturedAt: new Date(),
            updatedAt: new Date(),
          })
          .where('organizationId', '=', owner.subscription.organizationId)
          .where('id', '=', existingPayment.id)
          .execute()
      }
      if (!existingPayment) {
        await trx
          .insertInto('billingPayments')
          .values({
            ...grantFacts,
            billingSubscriptionId: locked.id,
            currency: invoice.currency,
            id: createId(),
            organizationId: owner.subscription.organizationId,
            paidAt,
            paymentKind: 'subscription',
            status: 'paid',
            stripeInvoiceId: invoice.id,
            subscriptionGrantFactsCapturedAt: new Date(),
            ...settlement,
          })
          .execute()
      }
      const paidThrough
        = locked.paidThrough && locked.paidThrough > grantFacts.servicePeriodEnd
          ? locked.paidThrough
          : grantFacts.servicePeriodEnd
      // Subscription events own lifecycle status; paid Invoice delivery owns
      // only the exact Subscription's immutable payment entitlement.
      await trx
        .updateTable('billingSubscriptions')
        .set({
          paidThrough,
          updatedAt: new Date(),
        })
        .where('organizationId', '=', owner.subscription.organizationId)
        .where('id', '=', locked.id)
        .execute()
      const currentSubscription = lockedState.subscriptions.find(
        subscription =>
          subscription.status !== 'canceled'
          && subscription.status !== 'incomplete_expired',
      )
      const invoiceOwnsAccountProjection
        = !currentSubscription?.paidThrough
          || currentSubscription.id === locked.id
      if (invoiceOwnsAccountProjection) {
        await trx
          .updateTable('organizationBillingAccounts')
          .set(eb => ({
            catalogRevision: grantFacts.subscriptionCatalogRevision,
            currentOfferCode: grantFacts.subscriptionOfferCode,
            currentPlanCode: grantFacts.subscriptionPlanCode,
            currentRecurringOptionCode:
              grantFacts.subscriptionRecurringOptionCode,
            managedExecutionReason:
              account.managedExecutionStatus === 'blocked_review'
                ? eb.ref('managedExecutionReason')
                : null,
            managedExecutionStatus:
              account.managedExecutionStatus === 'blocked_review'
                ? eb.ref('managedExecutionStatus')
                : 'active',
            paidThrough,
            revision: eb('revision', '+', '1'),
            updatedAt: new Date(),
          }))
          .where('organizationId', '=', owner.subscription.organizationId)
          .execute()
      }
      return true
    },
  )
  if (paymentApplied) {
    await reconcileDueSubscriptionGrantsForSubscription(
      {
        billingSubscriptionId: owner.subscription.id,
        organizationId: owner.subscription.organizationId,
      },
      database,
    )
  }
  return owner.subscription.organizationId
}

/** Marks an unpaid subscription projection without extending paidThrough. */
export async function processFailedStripeInvoice(
  stripeInvoiceId: string,
  database: DatabaseExecutor = db,
  stripe: StripeClient = stripeClient,
  catalog: BillingCatalog = BILLING_CATALOG,
) {
  assertStripeTestMode()
  const invoice = await stripe.invoices.retrieve(stripeInvoiceId)
  assertStripeTestResource(invoice, 'invoice')
  if (invoice.status === 'paid' && invoice.amount_paid > 0) {
    return processPaidStripeInvoice(stripeInvoiceId, database, stripe, catalog)
  }
  const subscriptionId = invoiceSubscriptionId(invoice)
  if (!subscriptionId)
    return null
  const projected = await projectStripeSubscription(
    subscriptionId,
    database,
    stripe,
    catalog,
  )
  return projected.organizationId
}
