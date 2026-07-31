/** Creates Stripe-commerce projections and the durable webhook inbox. */

import type { Kysely } from 'kysely'

import { sql } from 'kysely'

/** Adds run funding fields and durable organization payment projections. */
export async function createBillingCommerceSchema(db: Kysely<unknown>) {
  await sql`
    alter table "flowRuns"
      add column "fundingSource" text not null default 'credits'
        check ("fundingSource" in ('credits', 'byok')),
      add column "creditReservationId" text,
      add column "creditQuoted" integer check (
        "creditQuoted" is null or "creditQuoted" >= 0
      ),
      add column "storageReservedBytes" bigint not null default 0
        check ("storageReservedBytes" >= 0)
  `.execute(db)
  await sql`
    update "flowRuns"
    set "fundingSource" = 'byok'
    where "executionRuntime" = 'browser'
  `.execute(db)
  await sql`
    alter table "generationJobs"
      add column "creditQuoted" integer check (
        "creditQuoted" is null or "creditQuoted" >= 0
      ),
      add column "creditPricingVersion" text,
      add column "creditSettlement" text not null default 'not_applicable'
        check (
          "creditSettlement" in (
            'not_applicable', 'reserved', 'captured', 'released'
          )
        ),
      add column "outputVisibility" text not null default 'private'
        check ("outputVisibility" in ('private', 'public')),
      add column "showcaseEligible" boolean not null default false,
      add column "storageReservedBytes" bigint not null default 0
        check ("storageReservedBytes" >= 0),
      add constraint "generationJobsCreditSettlementShape"
        check (
          ("creditSettlement" = 'not_applicable' and "creditQuoted" is null)
          or (
            "creditSettlement" <> 'not_applicable'
            and "creditQuoted" is not null
            and "creditPricingVersion" is not null
          )
        ),
      add constraint "generationJobsOutputPolicyShape"
        check (
          ("outputVisibility" = 'public' and "showcaseEligible")
          or ("outputVisibility" = 'private' and not "showcaseEligible")
        )
  `.execute(db)
  await sql`
    alter table "assets"
      add column "showcaseEligible" boolean not null default false,
      add constraint "assetsSizeBytesNonnegative"
        check ("sizeBytes" is null or "sizeBytes" >= 0)
  `.execute(db)

  await sql`
    create table "organizationBillingAccounts" (
      "organizationId" text primary key
        references "organization" ("id") on delete cascade,
      "stripeCustomerId" text,
      "currentPlanCode" text not null default 'free'
        check ("currentPlanCode" in ('free', 'creator', 'pro')),
      "currentOfferCode" text,
      "currentRecurringOptionCode" text,
      "catalogRevision" text not null,
      "managedExecutionStatus" text not null default 'active'
        check (
          "managedExecutionStatus" in ('active', 'past_due', 'blocked_review')
        ),
      "managedExecutionReason" text,
      "founderEligibleAt" timestamptz,
      "founderAssignedBy" text references "user" ("id") on delete set null,
      "paidThrough" timestamptz,
      "revision" bigint not null default 0 check ("revision" >= 0),
      "createdAt" timestamptz not null default now(),
      "updatedAt" timestamptz not null default now(),
      check (
        ("currentPlanCode" = 'free'
          and "currentOfferCode" is null
          and "currentRecurringOptionCode" is null)
        or (
          "currentPlanCode" in ('creator', 'pro')
          and "currentOfferCode" is not null
          and "currentRecurringOptionCode" is not null
        )
      ),
      check (
        ("founderEligibleAt" is null and "founderAssignedBy" is null)
        or (
          "founderEligibleAt" is not null
          and "founderAssignedBy" is not null
        )
      )
    )
  `.execute(db)
  await sql`
    create unique index "organizationBillingAccountsStripeCustomerUidx"
      on "organizationBillingAccounts" ("stripeCustomerId")
      where "stripeCustomerId" is not null
  `.execute(db)

  await sql`
    create table "billingSubscriptions" (
      "id" text primary key,
      "organizationId" text not null
        references "organizationBillingAccounts" ("organizationId")
        on delete cascade,
      "stripeCustomerId" text not null,
      "stripeSubscriptionId" text not null unique,
      "planCode" text not null check ("planCode" in ('creator', 'pro')),
      "recurringOptionCode" text not null,
      "offerCode" text not null,
      "catalogRevision" text not null,
      "status" text not null check (
        "status" in (
          'active', 'canceled', 'incomplete', 'incomplete_expired', 'paused',
          'past_due', 'trialing', 'unpaid'
        )
      ),
      "billingInterval" text not null
        check ("billingInterval" in ('month', 'year')),
      "originalAnchorAt" timestamptz not null,
      "currentPeriodStart" timestamptz not null,
      "currentPeriodEnd" timestamptz not null,
      "paidThrough" timestamptz,
      "cancelAtPeriodEnd" boolean not null default false,
      "scheduledPlanCode" text
        check ("scheduledPlanCode" is null or "scheduledPlanCode" = 'pro'),
      "scheduledRecurringOptionCode" text,
      "scheduledOfferCode" text,
      "createdAt" timestamptz not null default now(),
      "updatedAt" timestamptz not null default now(),
      unique ("organizationId", "id"),
      unique ("organizationId", "stripeSubscriptionId"),
      check ("currentPeriodEnd" > "currentPeriodStart"),
      check (
        ("scheduledPlanCode" is null
          and "scheduledRecurringOptionCode" is null
          and "scheduledOfferCode" is null)
        or (
          "planCode" = 'pro'
          and "scheduledPlanCode" = 'pro'
          and "scheduledRecurringOptionCode" is not null
          and "scheduledOfferCode" is not null
        )
      )
    )
  `.execute(db)
  await sql`
    create unique index "billingSubscriptionsCurrentOrgUidx"
      on "billingSubscriptions" ("organizationId")
      where "status" not in ('canceled', 'incomplete_expired')
  `.execute(db)
  await sql`
    create index "billingSubscriptionsGrantDueIdx"
      on "billingSubscriptions" ("paidThrough", "organizationId", "id")
      where "paidThrough" is not null
        and "status" in ('active', 'past_due', 'trialing', 'unpaid')
  `.execute(db)

  await sql`
    create table "creditPurchases" (
      "id" text primary key,
      "organizationId" text not null
        references "organizationBillingAccounts" ("organizationId")
        on delete cascade,
      "planCode" text not null check ("planCode" in ('free', 'creator', 'pro')),
      "recurringOptionCode" text,
      "status" text not null default 'pending'
        check (
          "status" in (
            'pending', 'paid', 'failed', 'expired', 'refunded', 'disputed'
          )
        ),
      "amountMinor" integer not null check ("amountMinor" > 0),
      "currency" text not null check ("currency" = 'usd'),
      "credits" integer not null check ("credits" > 0),
      "catalogRevision" text not null,
      "pricingPolicyVersion" text not null,
      "volumeRateImprovementBps" integer not null check (
        "volumeRateImprovementBps" between 0 and 10000
      ),
      "membershipRateImprovementBpsFromFree" integer not null check (
        "membershipRateImprovementBpsFromFree" between 0 and 10000
      ),
      "modeledContributionMarginBps" integer not null check (
        "modeledContributionMarginBps" between -100000 and 10000
      ),
      "stripeCustomerId" text not null,
      "stripeCheckoutSessionId" text,
      "stripePaymentIntentId" text,
      "creditGrantId" text,
      "idempotencyKey" text not null,
      "paidAt" timestamptz,
      "createdAt" timestamptz not null default now(),
      "updatedAt" timestamptz not null default now(),
      unique ("organizationId", "id"),
      unique ("organizationId", "idempotencyKey"),
      check (
        ("planCode" = 'free'
          and "recurringOptionCode" is null)
        or (
          "planCode" in ('creator', 'pro')
          and "recurringOptionCode" is not null
        )
      ),
      check (
        (
          "status" in ('paid', 'refunded', 'disputed')
          and "paidAt" is not null
        )
        or (
          "status" in ('pending', 'failed', 'expired')
          and "paidAt" is null
        )
      )
    )
  `.execute(db)
  await sql`
    create unique index "creditPurchasesCheckoutUidx"
      on "creditPurchases" ("stripeCheckoutSessionId")
      where "stripeCheckoutSessionId" is not null
  `.execute(db)
  await sql`
    create unique index "creditPurchasesPaymentIntentUidx"
      on "creditPurchases" ("stripePaymentIntentId")
      where "stripePaymentIntentId" is not null
  `.execute(db)
  await sql`
    create unique index "creditPurchasesGrantUidx"
      on "creditPurchases" ("creditGrantId")
      where "creditGrantId" is not null
  `.execute(db)

  await sql`
    create table "billingPayments" (
      "id" text primary key,
      "organizationId" text not null
        references "organizationBillingAccounts" ("organizationId")
        on delete cascade,
      "paymentKind" text not null
        check ("paymentKind" in ('subscription', 'credit_topup')),
      "billingSubscriptionId" text,
      "creditPurchaseId" text,
      "stripeInvoiceId" text,
      "stripeCheckoutSessionId" text,
      "stripePaymentIntentId" text,
      "amountPaidMinor" integer not null check ("amountPaidMinor" >= 0),
      "currency" text not null check ("currency" = 'usd'),
      "stripeBalanceTransactionId" text,
      "settlementGrossMinor" integer,
      "settlementFeeMinor" integer,
      "settlementNetMinor" integer,
      "settlementCurrency" text,
      "settlementExchangeRate" numeric(24, 12),
      "status" text not null,
      "servicePeriodStart" timestamptz,
      "servicePeriodEnd" timestamptz,
      "paidAt" timestamptz not null,
      "createdAt" timestamptz not null default now(),
      "updatedAt" timestamptz not null default now(),
      unique ("organizationId", "id"),
      foreign key ("organizationId", "billingSubscriptionId")
        references "billingSubscriptions" ("organizationId", "id"),
      foreign key ("organizationId", "creditPurchaseId")
        references "creditPurchases" ("organizationId", "id"),
      check (
        (
          "paymentKind" = 'subscription'
          and "billingSubscriptionId" is not null
          and "creditPurchaseId" is null
          and "stripeInvoiceId" is not null
          and "servicePeriodStart" is not null
          and "servicePeriodEnd" is not null
        )
        or (
          "paymentKind" = 'credit_topup'
          and "billingSubscriptionId" is null
          and "creditPurchaseId" is not null
          and "stripeInvoiceId" is null
          and "stripeCheckoutSessionId" is not null
          and "servicePeriodStart" is null
          and "servicePeriodEnd" is null
        )
      )
    )
  `.execute(db)
  await sql`
    create unique index "billingPaymentsInvoiceUidx"
      on "billingPayments" ("stripeInvoiceId")
      where "stripeInvoiceId" is not null
  `.execute(db)
  await sql`
    create unique index "billingPaymentsCheckoutUidx"
      on "billingPayments" ("stripeCheckoutSessionId")
      where "stripeCheckoutSessionId" is not null
  `.execute(db)
  await sql`
    create unique index "billingPaymentsPaymentIntentUidx"
      on "billingPayments" ("stripePaymentIntentId")
      where "stripePaymentIntentId" is not null
  `.execute(db)
  await sql`
    create unique index "billingPaymentsPurchaseUidx"
      on "billingPayments" ("creditPurchaseId")
      where "creditPurchaseId" is not null
  `.execute(db)

  await sql`
    create table "stripeWebhookEvents" (
      "stripeEventId" text primary key,
      "eventType" text not null,
      "stripeObjectId" text,
      "processingStatus" text not null default 'pending'
        check (
          "processingStatus" in (
            'pending', 'processing', 'succeeded', 'failed'
          )
        ),
      "attemptCount" integer not null default 0 check ("attemptCount" >= 0),
      "lastErrorCode" text,
      "receivedAt" timestamptz not null default now(),
      "processedAt" timestamptz,
      "updatedAt" timestamptz not null default now(),
      check (
        ("processingStatus" = 'succeeded' and "processedAt" is not null)
        or ("processingStatus" <> 'succeeded')
      )
    )
  `.execute(db)
  await sql`
    create index "stripeWebhookEventsPendingIdx"
      on "stripeWebhookEvents" ("updatedAt", "stripeEventId")
      where "processingStatus" in ('pending', 'failed')
  `.execute(db)
}
