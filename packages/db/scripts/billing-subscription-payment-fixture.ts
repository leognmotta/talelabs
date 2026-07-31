/** Fake Stripe boundary for deterministic subscription payment ordering checks. */

import type {
  BillingHistoricalRecurringOffer,
  BillingOffer,
} from '@talelabs/billing'
import type { StripeClient } from '@talelabs/stripe'

/** Injectable Stripe fixture plus observations used by ordering certification. */
export interface SubscriptionPaymentStripeFixture {
  /** Changes only the mutable Stripe metadata returned for the retired Price. */
  setHistoricalPriceRevision: (value: string) => void
  /** Sets or clears an explicit cancellation on the current Subscription. */
  setReplacementCancellationAt: (value: Date | null) => void
  /** Minimal Stripe client implementing the Subscription and Invoice paths. */
  stripe: StripeClient
  /** Subscription retrievals proving paid Invoices never reproject lifecycle. */
  subscriptionRetrievals: string[]
}

function toUnixSeconds(date: Date) {
  return Math.floor(date.getTime() / 1_000)
}

function stripeSubscription(input: {
  cancelAt?: Date | null
  customerId: string
  endsAt: Date
  offer: BillingOffer
  organizationId: string
  recurringOptionCode: string
  startsAt: Date
  status: 'active' | 'canceled'
  stripeSubscriptionId: string
}) {
  return {
    cancel_at: input.cancelAt ? toUnixSeconds(input.cancelAt) : null,
    cancel_at_period_end: false,
    customer: input.customerId,
    id: input.stripeSubscriptionId,
    items: {
      data: [{
        current_period_end: toUnixSeconds(input.endsAt),
        current_period_start: toUnixSeconds(input.startsAt),
        price: {
          currency: 'usd',
          lookup_key: input.offer.stripeLookupKey,
          metadata: {
            talelabs_catalog_revision: input.offer.catalogRevision,
          },
          recurring: { interval: 'year' },
          unit_amount: input.offer.priceUsdCents,
        },
        quantity: 1,
      }],
    },
    livemode: false,
    metadata: {
      talelabs_offer_code: input.offer.offerCode,
      talelabs_organization_id: input.organizationId,
      talelabs_plan_code: 'pro',
      talelabs_recurring_option_code: input.recurringOptionCode,
    },
    status: input.status,
  }
}

function paidInvoice(input: {
  amountPaid: number
  capturedAt: Date
  customerId: string
  invoiceId: string
  stripeSubscriptionId: string
}) {
  return {
    amount_paid: input.amountPaid,
    created: toUnixSeconds(input.capturedAt),
    currency: 'usd',
    customer: input.customerId,
    id: input.invoiceId,
    livemode: false,
    parent: {
      subscription_details: {
        subscription: input.stripeSubscriptionId,
      },
    },
    payments: { data: [] },
    status: 'paid',
    status_transitions: {
      paid_at: toUnixSeconds(input.capturedAt),
    },
  }
}

function invoiceLine(input: {
  amount: number
  endsAt: Date
  invoiceId: string
  lineId: string
  priceId: string
  startsAt: Date
  stripeSubscriptionId: string
}) {
  return {
    amount: input.amount,
    currency: 'usd',
    id: input.lineId,
    invoice: input.invoiceId,
    livemode: false,
    parent: {
      subscription_item_details: {
        proration: false,
        subscription: input.stripeSubscriptionId,
      },
      type: 'subscription_item_details',
    },
    period: {
      end: toUnixSeconds(input.endsAt),
      start: toUnixSeconds(input.startsAt),
    },
    pricing: {
      price_details: {
        price: input.priceId,
      },
    },
    quantity: 1,
  }
}

function stripePrice(input: {
  catalogRevision?: string
  monthlyCredits: number
  offer: BillingOffer
  priceId: string
  recurringOptionCode: string
}) {
  return {
    currency: 'usd',
    id: input.priceId,
    livemode: false,
    lookup_key: input.offer.stripeLookupKey,
    metadata: {
      talelabs_catalog_revision:
        input.catalogRevision ?? input.offer.catalogRevision,
      talelabs_monthly_credits: String(input.monthlyCredits),
      talelabs_offer_code: input.offer.offerCode,
      talelabs_plan_code: 'pro',
      talelabs_recurring_option_code: input.recurringOptionCode,
    },
    recurring: { interval: 'year' },
    unit_amount: input.offer.priceUsdCents,
  }
}

/**
 * Creates one minimal Stripe client whose immutable Invoice lines and mutable
 * Subscription projections can be delivered in either valid webhook order.
 */
export function createSubscriptionPaymentStripeFixture(input: {
  /** Stripe Invoice paid instant shared by both fixture payments. */
  capturedAt: Date
  /** Verified Stripe Customer shared by both Subscriptions. */
  customerId: string
  /** Retired paid Invoice and old Subscription facts. */
  historical: {
    /** Historical Invoice identity. */
    invoiceId: string
    /** Historical Invoice Line Item identity. */
    lineId: string
    /** Complete retired offer authorized by the Invoice line. */
    offer: BillingHistoricalRecurringOffer
    /** Current Price facts seen on the old Subscription deletion event. */
    projectionOffer: BillingOffer
    /** Current option seen on the old Subscription deletion event. */
    projectionRecurringOptionCode: string
    /** Historical Price identity. */
    stripePriceId: string
    /** Old Stripe Subscription identity. */
    stripeSubscriptionId: string
    /** Exclusive historical service-period end. */
    servicePeriodEnd: Date
    /** Inclusive historical service-period start. */
    servicePeriodStart: Date
  }
  /** Tenant that owns both fixture Subscriptions. */
  organizationId: string
  /** Paid replacement Invoice and current Subscription facts. */
  replacement: {
    /** Replacement Invoice identity. */
    invoiceId: string
    /** Replacement Invoice Line Item identity. */
    lineId: string
    /** Current credits emitted per eligible monthly period. */
    monthlyCredits: number
    /** Current replacement offer authorized by its Invoice line. */
    offer: BillingOffer
    /** Current replacement recurring option identity. */
    recurringOptionCode: string
    /** Replacement Price identity. */
    stripePriceId: string
    /** Replacement Stripe Subscription identity. */
    stripeSubscriptionId: string
    /** Exclusive replacement service-period end. */
    servicePeriodEnd: Date
    /** Inclusive replacement service-period start. */
    servicePeriodStart: Date
  }
}): SubscriptionPaymentStripeFixture {
  let historicalPriceRevision = input.historical.offer.catalogRevision
  let replacementCancellationAt: Date | null = null
  const subscriptionRetrievals: string[] = []
  const stripe = {
    invoices: {
      listLineItems: async (invoiceId: string) => ({
        data: [invoiceId === input.historical.invoiceId
          ? invoiceLine({
              amount: input.historical.offer.priceUsdCents,
              endsAt: input.historical.servicePeriodEnd,
              invoiceId,
              lineId: input.historical.lineId,
              priceId: input.historical.stripePriceId,
              startsAt: input.historical.servicePeriodStart,
              stripeSubscriptionId: input.historical.stripeSubscriptionId,
            })
          : invoiceLine({
              amount: input.replacement.offer.priceUsdCents,
              endsAt: input.replacement.servicePeriodEnd,
              invoiceId,
              lineId: input.replacement.lineId,
              priceId: input.replacement.stripePriceId,
              startsAt: input.replacement.servicePeriodStart,
              stripeSubscriptionId: input.replacement.stripeSubscriptionId,
            })],
        has_more: false,
      }),
      retrieve: async (invoiceId: string) =>
        invoiceId === input.historical.invoiceId
          ? paidInvoice({
              amountPaid: input.historical.offer.priceUsdCents,
              capturedAt: input.capturedAt,
              customerId: input.customerId,
              invoiceId,
              stripeSubscriptionId: input.historical.stripeSubscriptionId,
            })
          : paidInvoice({
              amountPaid: input.replacement.offer.priceUsdCents,
              capturedAt: input.capturedAt,
              customerId: input.customerId,
              invoiceId,
              stripeSubscriptionId: input.replacement.stripeSubscriptionId,
            }),
    },
    prices: {
      retrieve: async (priceId: string) =>
        priceId === input.historical.stripePriceId
          ? stripePrice({
              catalogRevision: historicalPriceRevision,
              monthlyCredits: input.historical.offer.monthlyCredits,
              offer: input.historical.offer,
              priceId,
              recurringOptionCode: input.historical.offer.recurringOptionCode,
            })
          : stripePrice({
              monthlyCredits: input.replacement.monthlyCredits,
              offer: input.replacement.offer,
              priceId,
              recurringOptionCode: input.replacement.recurringOptionCode,
            }),
    },
    subscriptions: {
      retrieve: async (stripeSubscriptionId: string) => {
        subscriptionRetrievals.push(stripeSubscriptionId)
        const historical
          = stripeSubscriptionId === input.historical.stripeSubscriptionId
        return stripeSubscription(
          historical
            ? {
                customerId: input.customerId,
                endsAt: input.historical.servicePeriodEnd,
                offer: input.historical.projectionOffer,
                organizationId: input.organizationId,
                recurringOptionCode:
                  input.historical.projectionRecurringOptionCode,
                startsAt: input.historical.servicePeriodStart,
                status: 'canceled',
                stripeSubscriptionId,
              }
            : {
                customerId: input.customerId,
                endsAt: input.replacement.servicePeriodEnd,
                offer: input.replacement.offer,
                organizationId: input.organizationId,
                recurringOptionCode: input.replacement.recurringOptionCode,
                startsAt: input.replacement.servicePeriodStart,
                status: 'active',
                stripeSubscriptionId,
                cancelAt: replacementCancellationAt,
              },
        )
      },
    },
  } as unknown as StripeClient
  return {
    setHistoricalPriceRevision(value) {
      historicalPriceRevision = value
    },
    setReplacementCancellationAt(value) {
      replacementCancellationAt = value
    },
    stripe,
    subscriptionRetrievals,
  }
}
