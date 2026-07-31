/** Webhook-order certification for immutable subscription payment authority. */

import type { BillingCatalog } from '@talelabs/billing'
import type { Kysely } from 'kysely'
import type { Database } from '../src/schema.js'

import process from 'node:process'

import { BILLING_CATALOG } from '@talelabs/billing'
import { sql } from 'kysely'

import { verifyInitialSubscriptionInvoiceProjection } from './billing-subscription-initial-verifier.js'
import { createSubscriptionPaymentStripeFixture } from './billing-subscription-payment-fixture.js'
import { expectRejected, invariant } from './billing-verifier-support.js'

type SubscriptionProcessor
  = typeof import(
    '../../trigger/src/billing/stripe-subscription-invoices.js'
  )
  & typeof import('../../trigger/src/billing/stripe-subscriptions.js')

const historicalAnnualOffer = {
  billingInterval: 'year',
  catalogRevision: '2026-07-27.4',
  monthlyCredits: 5_300,
  offerCode: 'pro-annual-5300-2026-06',
  priceUsdCents: 54_800,
  recurringOptionCode: 'pro-5300-legacy',
  stripeLookupKey: 'talelabs_pro_annual_5300_2026_06',
} as const

const historicalInvoiceCatalog: BillingCatalog = {
  ...BILLING_CATALOG,
  plans: {
    ...BILLING_CATALOG.plans,
    pro: {
      ...BILLING_CATALOG.plans.pro,
      historicalOffers: [historicalAnnualOffer],
    },
  },
}
const oldProjectionOption = BILLING_CATALOG.plans.pro.currentRecurringOptions
  .find(option => option.code === 'pro-11300')!
const replacementOption = BILLING_CATALOG.plans.pro.currentRecurringOptions
  .find(option => option.code === 'pro-29500')!
const historicalServiceStart = new Date('2026-01-01T00:00:00.000Z')
const historicalServiceEnd = new Date('2027-01-01T00:00:00.000Z')
const replacementServiceStart = historicalServiceEnd
const replacementServiceEnd = new Date('2028-01-01T00:00:00.000Z')
const capturedAt = new Date('2027-01-02T00:00:00.000Z')
interface PaymentOrderingScenario {
  invoiceOrder: 'historical_first' | 'replacement_first'
  key: string
  organizationId: string
}
const scenarios: readonly PaymentOrderingScenario[] = [
  {
    invoiceOrder: 'historical_first',
    key: 'ordered',
    organizationId: 'billing-org-zz-subscription-facts',
  },
  {
    invoiceOrder: 'replacement_first',
    key: 'reordered',
    organizationId: 'billing-org-zz-subscription-facts-reordered',
  },
]
function scenarioIds(scenario: PaymentOrderingScenario) {
  return {
    customer: `cus_subscription_facts_${scenario.key}`,
    historicalInvoice: `in_subscription_facts_history_${scenario.key}`,
    historicalLine: `il_subscription_facts_history_${scenario.key}`,
    historicalPrice: `price_subscription_facts_history_${scenario.key}`,
    oldLocal: `subscription-payment-facts-${scenario.key}`,
    oldStripe: `sub_subscription_facts_old_${scenario.key}`,
    replacementInvoice:
      `in_subscription_facts_replacement_${scenario.key}`,
    replacementLine:
      `il_subscription_facts_replacement_${scenario.key}`,
    replacementPrice:
      `price_subscription_facts_replacement_${scenario.key}`,
    replacementStripe: `sub_subscription_facts_new_${scenario.key}`,
  }
}

function createScenarioStripeFixture(scenario: PaymentOrderingScenario) {
  const ids = scenarioIds(scenario)
  return createSubscriptionPaymentStripeFixture({
    capturedAt,
    customerId: ids.customer,
    historical: {
      invoiceId: ids.historicalInvoice,
      lineId: ids.historicalLine,
      offer: historicalAnnualOffer,
      projectionOffer: oldProjectionOption.year,
      projectionRecurringOptionCode: oldProjectionOption.code,
      servicePeriodEnd: historicalServiceEnd,
      servicePeriodStart: historicalServiceStart,
      stripePriceId: ids.historicalPrice,
      stripeSubscriptionId: ids.oldStripe,
    },
    organizationId: scenario.organizationId,
    replacement: {
      invoiceId: ids.replacementInvoice,
      lineId: ids.replacementLine,
      monthlyCredits: replacementOption.monthlyCredits,
      offer: replacementOption.year,
      recurringOptionCode: replacementOption.code,
      servicePeriodEnd: replacementServiceEnd,
      servicePeriodStart: replacementServiceStart,
      stripePriceId: ids.replacementPrice,
      stripeSubscriptionId: ids.replacementStripe,
    },
  })
}

async function seedScenario(
  database: Kysely<Database>,
  scenario: PaymentOrderingScenario,
) {
  const ids = scenarioIds(scenario)
  await database
    .updateTable('organizationBillingAccounts')
    .set({
      stripeCustomerId: ids.customer,
    })
    .where('organizationId', '=', scenario.organizationId)
    .execute()
  await database
    .insertInto('billingSubscriptions')
    .values({
      billingInterval: 'year',
      catalogRevision: oldProjectionOption.year.catalogRevision,
      currentPeriodEnd: historicalServiceEnd,
      currentPeriodStart: historicalServiceStart,
      id: ids.oldLocal,
      offerCode: oldProjectionOption.year.offerCode,
      organizationId: scenario.organizationId,
      originalAnchorAt: historicalServiceStart,
      paidThrough: null,
      planCode: 'pro',
      recurringOptionCode: oldProjectionOption.code,
      status: 'active',
      stripeCustomerId: ids.customer,
      stripeSubscriptionId: ids.oldStripe,
    })
    .execute()
}

async function assertScenarioState(
  database: Kysely<Database>,
  scenario: PaymentOrderingScenario,
) {
  const ids = scenarioIds(scenario)
  const payment = await database
    .selectFrom('billingPayments')
    .select([
      'servicePeriodEnd',
      'servicePeriodStart',
      'stripeInvoiceLineItemId',
      'stripePriceId',
      'subscriptionBillingInterval',
      'subscriptionCatalogRevision',
      'subscriptionMonthlyCredits',
      'subscriptionOfferCode',
      'subscriptionPlanCode',
      'subscriptionRecurringOptionCode',
    ])
    .where('stripeInvoiceId', '=', ids.historicalInvoice)
    .executeTakeFirstOrThrow()
  invariant(
    payment.servicePeriodStart?.getTime()
    === historicalServiceStart.getTime()
    && payment.servicePeriodEnd?.getTime() === historicalServiceEnd.getTime()
    && payment.stripeInvoiceLineItemId === ids.historicalLine
    && payment.stripePriceId === ids.historicalPrice
    && payment.subscriptionBillingInterval === 'year'
    && payment.subscriptionCatalogRevision
    === historicalAnnualOffer.catalogRevision
    && payment.subscriptionMonthlyCredits
    === historicalAnnualOffer.monthlyCredits
    && payment.subscriptionOfferCode === historicalAnnualOffer.offerCode
    && payment.subscriptionPlanCode === 'pro'
    && payment.subscriptionRecurringOptionCode
    === historicalAnnualOffer.recurringOptionCode,
    `${scenario.key}_subscription_invoice_line_facts_not_captured`,
  )
  const historicalGrants = await database
    .selectFrom('creditGrants')
    .select([
      'catalogRevision',
      'offerCode',
      'originalCredits',
      'recognizedRevenueUsdCents',
    ])
    .where('organizationId', '=', scenario.organizationId)
    .where('stripeSubscriptionId', '=', ids.oldStripe)
    .orderBy('grantPeriodStart')
    .execute()
  invariant(
    historicalGrants.length === 12
    && historicalGrants.every(
      grant =>
        grant.catalogRevision === historicalAnnualOffer.catalogRevision
        && grant.offerCode === historicalAnnualOffer.offerCode
        && grant.originalCredits === historicalAnnualOffer.monthlyCredits,
    )
    && historicalGrants.reduce(
      (total, grant) => total + (grant.recognizedRevenueUsdCents ?? 0),
      0,
    ) === historicalAnnualOffer.priceUsdCents,
    `${scenario.key}_subscription_payment_provenance_not_preserved`,
  )
  const replacementGrants = await database
    .selectFrom('creditGrants')
    .select(['catalogRevision', 'offerCode', 'originalCredits'])
    .where('organizationId', '=', scenario.organizationId)
    .where('stripeSubscriptionId', '=', ids.replacementStripe)
    .execute()
  invariant(
    replacementGrants.length === 1
    && replacementGrants[0]?.catalogRevision
    === replacementOption.year.catalogRevision
    && replacementGrants[0].offerCode === replacementOption.year.offerCode
    && replacementGrants[0].originalCredits
    === replacementOption.monthlyCredits,
    `${scenario.key}_replacement_grant_not_preserved`,
  )
  const subscriptions = await database
    .selectFrom('billingSubscriptions')
    .select(['paidThrough', 'status', 'stripeSubscriptionId'])
    .where('organizationId', '=', scenario.organizationId)
    .where('stripeSubscriptionId', 'in', [
      ids.oldStripe,
      ids.replacementStripe,
    ])
    .execute()
  const oldSubscription = subscriptions.find(
    subscription => subscription.stripeSubscriptionId === ids.oldStripe,
  )
  const replacementSubscription = subscriptions.find(
    subscription =>
      subscription.stripeSubscriptionId === ids.replacementStripe,
  )
  invariant(
    oldSubscription?.status === 'canceled'
    && oldSubscription.paidThrough?.getTime()
    === historicalServiceEnd.getTime()
    && replacementSubscription?.status === 'active'
    && replacementSubscription.paidThrough?.getTime()
    === replacementServiceEnd.getTime(),
    `${scenario.key}_subscription_status_or_paid_through_changed`,
  )
  const account = await database
    .selectFrom('organizationBillingAccounts')
    .select([
      'catalogRevision',
      'currentOfferCode',
      'currentPlanCode',
      'currentRecurringOptionCode',
      'managedExecutionReason',
      'managedExecutionStatus',
      'paidThrough',
    ])
    .where('organizationId', '=', scenario.organizationId)
    .executeTakeFirstOrThrow()
  invariant(
    account.catalogRevision === replacementOption.year.catalogRevision
    && account.currentOfferCode === replacementOption.year.offerCode
    && account.currentPlanCode === 'pro'
    && account.currentRecurringOptionCode === replacementOption.code
    && account.managedExecutionReason === null
    && account.managedExecutionStatus === 'active'
    && account.paidThrough?.getTime() === replacementServiceEnd.getTime(),
    `${scenario.key}_historical_invoice_overwrote_current_account`,
  )
}

async function runScenario(
  database: Kysely<Database>,
  accounting: typeof import('../src/index.js'),
  subscriptionProcessor: SubscriptionProcessor,
  scenario: PaymentOrderingScenario,
) {
  const ids = scenarioIds(scenario)
  await seedScenario(database, scenario)
  const {
    setHistoricalPriceRevision,
    stripe,
    subscriptionRetrievals,
  } = createScenarioStripeFixture(scenario)
  await subscriptionProcessor.projectStripeSubscription(
    ids.oldStripe,
    database,
    stripe,
    historicalInvoiceCatalog,
  )
  setHistoricalPriceRevision('mutable-stripe-metadata-drift')
  await expectRejected(
    () =>
      subscriptionProcessor.processPaidStripeInvoice(
        ids.historicalInvoice,
        database,
        stripe,
        historicalInvoiceCatalog,
      ),
    `${scenario.key}_historical_catalog_revision_drift`,
  )
  setHistoricalPriceRevision(historicalAnnualOffer.catalogRevision)
  if (scenario.invoiceOrder === 'historical_first') {
    await subscriptionProcessor.processPaidStripeInvoice(
      ids.historicalInvoice,
      database,
      stripe,
      historicalInvoiceCatalog,
    )
  }
  await subscriptionProcessor.projectStripeSubscription(
    ids.replacementStripe,
    database,
    stripe,
    historicalInvoiceCatalog,
  )
  await subscriptionProcessor.processPaidStripeInvoice(
    ids.replacementInvoice,
    database,
    stripe,
    historicalInvoiceCatalog,
  )
  if (scenario.invoiceOrder === 'replacement_first') {
    await subscriptionProcessor.processPaidStripeInvoice(
      ids.historicalInvoice,
      database,
      stripe,
      historicalInvoiceCatalog,
    )
  }
  invariant(
    subscriptionRetrievals.length === 2
    && subscriptionRetrievals[0] === ids.oldStripe
    && subscriptionRetrievals[1] === ids.replacementStripe,
    `${scenario.key}_invoice_reprojected_mutable_subscription`,
  )
  const subscriptions = await database
    .selectFrom('billingSubscriptions')
    .select('id')
    .where('organizationId', '=', scenario.organizationId)
    .where('stripeSubscriptionId', 'in', [
      ids.oldStripe,
      ids.replacementStripe,
    ])
    .execute()
  invariant(
    subscriptions.length === 2,
    `${scenario.key}_subscription_projection_count`,
  )
  for (const subscription of subscriptions) {
    await accounting.reconcileDueSubscriptionGrantsForSubscription(
      {
        billingSubscriptionId: subscription.id,
        organizationId: scenario.organizationId,
      },
      database,
      capturedAt,
    )
  }
  await assertScenarioState(database, scenario)
}

function createDeferred() {
  let resolve!: () => void
  const promise = new Promise<void>((complete) => {
    resolve = complete
  })
  return { promise, resolve }
}

function delay(milliseconds: number) {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

function postgresErrorCode(error: unknown) {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    ? String(error.code)
    : null
}

async function waitForAccountLock(
  database: Kysely<Database>,
  organizationId: string,
) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      await database.transaction().execute(async (trx) => {
        await sql`set local lock_timeout = '50ms'`.execute(trx)
        await trx
          .selectFrom('organizationBillingAccounts')
          .select('organizationId')
          .where('organizationId', '=', organizationId)
          .forUpdate()
          .executeTakeFirstOrThrow()
      })
    }
    catch (error) {
      if (postgresErrorCode(error) === '55P03')
        return
      throw error
    }
    await delay(10)
  }
  throw new Error('concurrent_invoice_did_not_lock_billing_account')
}

async function waitForLockWaiters(
  database: Kysely<Database>,
  minimumWaiters: number,
) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const result = await sql<{ waiterCount: number }>`
      select count(*)::integer as "waiterCount"
      from "pg_stat_activity"
      where "datname" = current_database()
        and "pid" <> pg_backend_pid()
        and "wait_event_type" = 'Lock'
    `.execute(database)
    if ((result.rows[0]?.waiterCount ?? 0) >= minimumWaiters)
      return
    await delay(10)
  }
  throw new Error('concurrent_subscription_lock_waiters_not_observed')
}

async function verifyConcurrentInvoiceLifecycle(
  database: Kysely<Database>,
  subscriptionProcessor: SubscriptionProcessor,
  scenario: PaymentOrderingScenario,
) {
  const ids = scenarioIds(scenario)
  const { stripe, subscriptionRetrievals }
    = createScenarioStripeFixture(scenario)
  await database
    .updateTable('organizationBillingAccounts')
    .set({
      managedExecutionReason: 'subscription_payment_past_due',
      managedExecutionStatus: 'past_due',
    })
    .where('organizationId', '=', scenario.organizationId)
    .execute()

  const blockerReady = createDeferred()
  const releaseBlocker = createDeferred()
  const blockerPromise = database.transaction().execute(async (trx) => {
    await trx
      .selectFrom('billingSubscriptions')
      .select('id')
      .where('organizationId', '=', scenario.organizationId)
      .where('id', '=', ids.oldLocal)
      .forUpdate()
      .executeTakeFirstOrThrow()
    blockerReady.resolve()
    await releaseBlocker.promise
  })
  await Promise.race([
    blockerReady.promise,
    blockerPromise.then(() => {
      throw new Error('subscription_lock_blocker_exited_before_ready')
    }),
  ])

  const invoicePromise = subscriptionProcessor.processPaidStripeInvoice(
    ids.historicalInvoice,
    database,
    stripe,
    historicalInvoiceCatalog,
  )
  let lifecyclePromise: Promise<unknown> | undefined
  let stagingError: unknown
  try {
    await waitForAccountLock(database, scenario.organizationId)
    lifecyclePromise = subscriptionProcessor.projectStripeSubscription(
      ids.replacementStripe,
      database,
      stripe,
      historicalInvoiceCatalog,
    )
    // The Invoice must wait on the old Subscription while the lifecycle event
    // waits on the account, deterministically exposing an inverted lock order.
    await waitForLockWaiters(database, 2)
  }
  catch (error) {
    stagingError = error
  }
  finally {
    releaseBlocker.resolve()
  }

  const concurrentResults = await Promise.allSettled([
    blockerPromise,
    invoicePromise,
    ...(lifecyclePromise ? [lifecyclePromise] : []),
  ])
  if (stagingError)
    throw stagingError
  const failed = concurrentResults.find(result => result.status === 'rejected')
  if (failed?.status === 'rejected')
    throw failed.reason
  invariant(
    lifecyclePromise !== undefined,
    'concurrent_subscription_lifecycle_not_started',
  )
  invariant(
    subscriptionRetrievals.length === 1
    && subscriptionRetrievals[0] === ids.replacementStripe,
    'concurrent_invoice_reprojected_mutable_subscription',
  )
  await assertScenarioState(database, scenario)
}

/**
 * Proves both valid webhook orders and their concurrent lock race preserve
 * historical grants without resurrecting or overwriting a paid replacement.
 */
export async function verifySubscriptionPaymentGrantFacts(
  database: Kysely<Database>,
  accounting: typeof import('../src/index.js'),
) {
  process.env.STRIPE_SECRET_KEY = 'sk_test_billing_verifier'
  const subscriptionProcessor = {
    ...await import(
      '../../trigger/src/billing/stripe-subscription-invoices.js',
    ),
    ...await import('../../trigger/src/billing/stripe-subscriptions.js'),
  }
  for (const scenario of scenarios) {
    await runScenario(
      database,
      accounting,
      subscriptionProcessor,
      scenario,
    )
  }
  await verifyInitialSubscriptionInvoiceProjection(
    database,
    subscriptionProcessor,
  )
  await verifyConcurrentInvoiceLifecycle(
    database,
    subscriptionProcessor,
    scenarios[1]!,
  )
  const immutableInvoiceId = scenarioIds(scenarios[0]!).historicalInvoice
  await expectRejected(
    () =>
      database
        .updateTable('billingPayments')
        .set({ subscriptionMonthlyCredits: 29_500 })
        .where('stripeInvoiceId', '=', immutableInvoiceId)
        .execute(),
    'subscription_payment_grant_facts_immutable',
  )
}
