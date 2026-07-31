/** Verified test-mode Stripe Customer, Price, Product, Portal, and URL helpers. */

import type { DatabaseExecutor } from '@talelabs/db'
import type { Stripe, StripeClient } from '@talelabs/stripe'

import process from 'node:process'
import { BILLING_CATALOG } from '@talelabs/billing'
import {
  db,
  ensureOrganizationBillingState,
  withDatabaseTransaction,
} from '@talelabs/db'
import { assertStripeTestMode, stripeClient } from '@talelabs/stripe'

import { HttpError } from '../../middleware/error.js'

const STRIPE_PORTAL_CONFIGURATION_KIND = 'customer_portal'
const STRIPE_PORTAL_POLICY_VERSION = '1'

function getDashboardUrl() {
  const value
    = process.env.DASHBOARD_URL
      ?? (process.env.NODE_ENV === 'production' ? null : 'http://localhost:5173')
  if (!value)
    throw new Error('DASHBOARD_URL is required for Stripe-hosted redirects.')
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol))
    throw new Error('DASHBOARD_URL must be an HTTP(S) URL.')
  return url
}

/** Builds one dashboard return URL for a stable Settings destination. */
export function createBillingReturnUrl(
  settings: 'credits' | 'plans',
  result?: 'canceled' | 'success',
) {
  const url = getDashboardUrl()
  url.pathname = '/create'
  url.searchParams.set('settings', settings)
  if (result)
    url.searchParams.set('billingReturn', result)
  return url.toString()
}

function assertTestResource(
  resource: { livemode: boolean },
  resourceName: string,
) {
  if (resource.livemode)
    throw new Error(`Live-mode Stripe ${resourceName} was refused.`)
}

/** Creates or verifies the one Stripe Customer mapped to an organization. */
export async function ensureStripeCustomer(
  organizationId: string,
  database: DatabaseExecutor = db,
  stripe: StripeClient = stripeClient,
) {
  assertStripeTestMode()
  await ensureOrganizationBillingState(
    {
      catalogRevision: BILLING_CATALOG.revision,
      organizationId,
    },
    database,
  )
  const account = await database
    .selectFrom('organizationBillingAccounts')
    .select('stripeCustomerId')
    .where('organizationId', '=', organizationId)
    .executeTakeFirstOrThrow()
  if (account.stripeCustomerId) {
    const customer = await stripe.customers.retrieve(account.stripeCustomerId)
    if (customer.deleted) {
      throw new HttpError(
        503,
        'stripe_customer_unavailable',
        'The billing customer is unavailable.',
      )
    }
    assertTestResource(customer, 'Customer')
    return customer
  }

  const created = await stripe.customers.create(
    {
      metadata: {
        talelabs_catalog_revision: BILLING_CATALOG.revision,
        talelabs_organization_id: organizationId,
      },
    },
    {
      idempotencyKey: `talelabs-customer:${organizationId}`,
    },
  )
  assertTestResource(created, 'Customer')
  const selectedCustomerId = await withDatabaseTransaction(
    database,
    async (trx) => {
      const locked = await trx
        .selectFrom('organizationBillingAccounts')
        .select('stripeCustomerId')
        .where('organizationId', '=', organizationId)
        .forUpdate()
        .executeTakeFirstOrThrow()
      if (!locked.stripeCustomerId) {
        await trx
          .updateTable('organizationBillingAccounts')
          .set(eb => ({
            stripeCustomerId: created.id,
            updatedAt: new Date(),
            revision: eb('revision', '+', '1'),
          }))
          .where('organizationId', '=', organizationId)
          .execute()
      }
      return locked.stripeCustomerId ?? created.id
    },
  )
  if (selectedCustomerId === created.id)
    return created
  const existing = await stripe.customers.retrieve(selectedCustomerId)
  if (existing.deleted) {
    throw new HttpError(
      503,
      'stripe_customer_unavailable',
      'The billing customer is unavailable.',
    )
  }
  assertTestResource(existing, 'Customer')
  return existing
}

/** Resolves and verifies an immutable recurring Price by catalog lookup key. */
export async function resolveStripeBillingPrice(
  input: {
    /** Catalog revision that originally created the immutable Price. */
    catalogRevision: string
    /** Current monthly or annual cadence. */
    billingInterval: 'month' | 'year'
    /** Immutable catalog offer code. */
    offerCode: string
    /** Creator or Pro plan identity. */
    planCode: 'creator' | 'pro'
    /** Exact customer price in USD cents. */
    priceUsdCents: number
    /** Current recurring allowance identity. */
    recurringOptionCode: string
    /** Stable Stripe lookup key. */
    stripeLookupKey: string
    /** Exact monthly credits represented by the offer. */
    monthlyCredits: number
  },
  stripe: StripeClient = stripeClient,
) {
  assertStripeTestMode()
  const prices = await stripe.prices.list({
    active: true,
    limit: 2,
    lookup_keys: [input.stripeLookupKey],
  })
  if (prices.data.length !== 1) {
    throw new HttpError(
      503,
      'stripe_catalog_unavailable',
      'The selected billing offer is unavailable.',
    )
  }
  const price = prices.data[0]!
  assertTestResource(price, 'Price')
  const matches
    = price.currency === BILLING_CATALOG.currency
      && price.unit_amount === input.priceUsdCents
      && price.recurring?.interval === input.billingInterval
      && price.metadata.talelabs_catalog_revision === input.catalogRevision
      && price.metadata.talelabs_offer_code === input.offerCode
      && price.metadata.talelabs_plan_code === input.planCode
      && price.metadata.talelabs_recurring_option_code
      === input.recurringOptionCode
      && price.metadata.talelabs_monthly_credits === String(input.monthlyCredits)
  if (!matches) {
    throw new HttpError(
      503,
      'stripe_catalog_mismatch',
      'The selected Stripe Price does not match the billing catalog.',
    )
  }
  return price
}

/** Resolves the single synced Stripe Credits Product. */
export async function resolveStripeCreditsProduct(
  stripe: StripeClient = stripeClient,
) {
  assertStripeTestMode()
  const matches: Stripe.Product[] = []
  for await (const product of stripe.products.list({
    active: true,
    limit: 100,
  })) {
    if (product.metadata.talelabs_code === 'credits')
      matches.push(product)
    if (matches.length > 1)
      break
  }
  if (matches.length !== 1) {
    throw new HttpError(
      503,
      'stripe_catalog_unavailable',
      'The Stripe Credits Product is unavailable.',
    )
  }
  assertTestResource(matches[0]!, 'Product')
  return matches[0]!
}

function isCurrentStripePortalConfiguration(
  configuration: Stripe.BillingPortal.Configuration,
) {
  return (
    configuration.metadata?.talelabs_configuration
    === STRIPE_PORTAL_CONFIGURATION_KIND
    && configuration.metadata.talelabs_catalog_revision
    === BILLING_CATALOG.revision
    && configuration.metadata.talelabs_portal_policy_version
    === STRIPE_PORTAL_POLICY_VERSION
  )
}

/** Creates or reuses the locked-down TaleLabs Customer Portal configuration. */
export async function ensureStripePortalConfiguration(
  stripe: StripeClient = stripeClient,
) {
  assertStripeTestMode()
  for await (const configuration of stripe.billingPortal.configurations.list({
    active: true,
    limit: 100,
  })) {
    assertTestResource(configuration, 'Portal Configuration')
    if (isCurrentStripePortalConfiguration(configuration))
      return configuration
  }

  const configuration = await stripe.billingPortal.configurations.create(
    {
      features: {
        customer_update: { enabled: false },
        invoice_history: { enabled: true },
        payment_method_update: { enabled: true },
        subscription_cancel: {
          enabled: true,
          mode: 'at_period_end',
        },
        subscription_update: { enabled: false },
      },
      metadata: {
        talelabs_catalog_revision: BILLING_CATALOG.revision,
        talelabs_configuration: STRIPE_PORTAL_CONFIGURATION_KIND,
        talelabs_portal_policy_version: STRIPE_PORTAL_POLICY_VERSION,
      },
      name: `TaleLabs managed portal (${BILLING_CATALOG.revision})`,
    },
    {
      idempotencyKey: [
        'talelabs-portal',
        BILLING_CATALOG.revision,
        STRIPE_PORTAL_POLICY_VERSION,
      ].join(':'),
    },
  )
  assertTestResource(configuration, 'Portal Configuration')
  return configuration
}
