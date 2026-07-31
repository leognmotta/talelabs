/** Strict test-mode Stripe identity and settlement extraction helpers. */

import type { Stripe, StripeClient } from '@talelabs/stripe'

import {
  assertStripeTestMode,
  stripeClient,
} from '@talelabs/stripe'

/** Resolves an expandable Stripe identity to its stable object ID. */
export function stripeObjectId(
  value: null | string | { id: string } | undefined,
) {
  return typeof value === 'string' ? value : value?.id ?? null
}

/** Rejects a Stripe object whenever it originated in live mode. */
export function assertStripeTestResource(
  resource: { livemode: boolean },
  kind: string,
) {
  if (resource.livemode)
    throw new Error(`stripe_live_${kind}_refused`)
}

/** Realized settlement fields captured from the successful PaymentIntent charge. */
export interface StripeSettlementFacts {
  /** Stripe BalanceTransaction identity. */
  stripeBalanceTransactionId: string | null
  /** Stripe PaymentIntent identity. */
  stripePaymentIntentId: string | null
  /** Settlement exchange rate represented exactly as a decimal string. */
  settlementExchangeRate: string | null
  /** Realized fee in settlement minor units. */
  settlementFeeMinor: number | null
  /** Realized gross in settlement minor units. */
  settlementGrossMinor: number | null
  /** Realized net in settlement minor units. */
  settlementNetMinor: number | null
  /** Realized settlement currency. */
  settlementCurrency: string | null
}

const emptySettlement: StripeSettlementFacts = {
  settlementCurrency: null,
  settlementExchangeRate: null,
  settlementFeeMinor: null,
  settlementGrossMinor: null,
  settlementNetMinor: null,
  stripeBalanceTransactionId: null,
  stripePaymentIntentId: null,
}

function settlementFromBalanceTransaction(
  paymentIntentId: string,
  balance: Stripe.BalanceTransaction,
): StripeSettlementFacts {
  return {
    settlementCurrency: balance.currency,
    settlementExchangeRate: balance.exchange_rate === null
      ? null
      : String(balance.exchange_rate),
    settlementFeeMinor: balance.fee,
    settlementGrossMinor: balance.amount,
    settlementNetMinor: balance.net,
    stripeBalanceTransactionId: balance.id,
    stripePaymentIntentId: paymentIntentId,
  }
}

/** Retrieves current test-mode PaymentIntent and realized settlement facts. */
export async function retrieveStripeSettlementFacts(
  paymentIntent: null | string | Stripe.PaymentIntent | undefined,
  stripe: StripeClient = stripeClient,
): Promise<StripeSettlementFacts> {
  assertStripeTestMode()
  const paymentIntentId = stripeObjectId(paymentIntent)
  if (!paymentIntentId)
    return emptySettlement
  const resolved = paymentIntent !== null
    && typeof paymentIntent === 'object'
    && paymentIntent.object === 'payment_intent'
    ? paymentIntent
    : await stripe.paymentIntents.retrieve(paymentIntentId, {
        expand: ['latest_charge.balance_transaction'],
      })
  assertStripeTestResource(resolved, 'payment_intent')
  const charge = resolved.latest_charge
  if (!charge || typeof charge === 'string') {
    return { ...emptySettlement, stripePaymentIntentId: paymentIntentId }
  }
  assertStripeTestResource(charge, 'charge')
  const balance = charge.balance_transaction
  if (!balance) {
    return { ...emptySettlement, stripePaymentIntentId: paymentIntentId }
  }
  const resolvedBalance = typeof balance === 'string'
    ? await stripe.balanceTransactions.retrieve(balance)
    : balance
  return settlementFromBalanceTransaction(paymentIntentId, resolvedBalance)
}
