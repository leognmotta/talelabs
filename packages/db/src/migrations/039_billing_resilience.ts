/**
 * Adds durable Stripe mutation intents, reversal recovery, and fair billing
 * reconciliation cursors without rewriting the applied M8 foundation.
 */

import type { Kysely } from 'kysely'

import { sql } from 'kysely'

/** Hardens billing state transitions against concurrency and event reordering. */
export async function up(db: Kysely<unknown>) {
  await sql`
    alter table "billingSubscriptions"
      add column "changeRevision" bigint not null default 0
        check ("changeRevision" >= 0)
  `.execute(db)

  await sql`
    alter table "creditPurchases"
      add column "refundedAmountMinor" integer not null default 0
        check (
          "refundedAmountMinor" >= 0
          and "refundedAmountMinor" <= "amountMinor"
        ),
      drop constraint "creditPurchases_status_check",
      drop constraint "creditPurchases_check1",
      add constraint "creditPurchasesStatusCheck"
        check (
          "status" in (
            'pending', 'paid', 'failed', 'expired', 'partially_refunded',
            'refunded', 'disputed'
          )
        ),
      add constraint "creditPurchasesPaidStateCheck"
        check (
          (
            "status" in (
              'paid', 'partially_refunded', 'refunded', 'disputed'
            )
            and "paidAt" is not null
          )
          or (
            "status" in ('pending', 'failed', 'expired')
            and "paidAt" is null
          )
        )
  `.execute(db)

  await sql`
    alter table "billingPayments"
      add column "refundedAmountMinor" integer not null default 0
        check (
          "refundedAmountMinor" >= 0
          and "refundedAmountMinor" <= "amountPaidMinor"
        )
  `.execute(db)

  await sql`
    create table "billingSubscriptionCheckoutIntents" (
      "id" text primary key,
      "organizationId" text not null
        references "organizationBillingAccounts" ("organizationId")
        on delete cascade,
      "status" text not null default 'pending'
        check ("status" in ('pending', 'completed', 'expired', 'failed')),
      "planCode" text not null check ("planCode" in ('creator', 'pro')),
      "recurringOptionCode" text not null,
      "offerCode" text not null,
      "billingInterval" text not null
        check ("billingInterval" in ('month', 'year')),
      "catalogRevision" text not null,
      "idempotencyKey" text not null,
      "stripeCheckoutSessionId" text,
      "stripeSubscriptionId" text,
      "stripeRequestLeaseToken" text,
      "stripeRequestLeaseExpiresAt" timestamptz,
      "expiresAt" timestamptz not null,
      "completedAt" timestamptz,
      "createdAt" timestamptz not null default now(),
      "updatedAt" timestamptz not null default now(),
      unique ("organizationId", "id"),
      unique ("organizationId", "idempotencyKey"),
      check (
        (
          "stripeRequestLeaseToken" is null
          and "stripeRequestLeaseExpiresAt" is null
        )
        or (
          "stripeRequestLeaseToken" is not null
          and "stripeRequestLeaseExpiresAt" is not null
        )
      ),
      check (
        (
          "status" = 'completed'
          and "stripeSubscriptionId" is not null
          and "completedAt" is not null
        )
        or (
          "status" <> 'completed'
          and "completedAt" is null
        )
      )
    )
  `.execute(db)
  await sql`
    create unique index "billingSubscriptionCheckoutIntentsPendingOrgUidx"
      on "billingSubscriptionCheckoutIntents" ("organizationId")
      where "status" = 'pending'
  `.execute(db)
  await sql`
    create unique index "billingSubscriptionCheckoutIntentsSessionUidx"
      on "billingSubscriptionCheckoutIntents" ("stripeCheckoutSessionId")
      where "stripeCheckoutSessionId" is not null
  `.execute(db)
  await sql`
    create unique index "billingSubscriptionCheckoutIntentsSubscriptionUidx"
      on "billingSubscriptionCheckoutIntents" ("stripeSubscriptionId")
      where "stripeSubscriptionId" is not null
  `.execute(db)

  await sql`
    create table "billingSubscriptionChangeIntents" (
      "id" text primary key,
      "organizationId" text not null,
      "billingSubscriptionId" text not null,
      "revision" bigint not null check ("revision" > 0),
      "status" text not null default 'pending'
        check ("status" in ('pending', 'applied', 'failed')),
      "fromRecurringOptionCode" text not null,
      "toRecurringOptionCode" text not null,
      "toOfferCode" text not null,
      "catalogRevision" text not null,
      "currentPeriodEnd" timestamptz not null,
      "idempotencyKey" text not null,
      "stripeScheduleId" text,
      "stripeRequestLeaseToken" text,
      "stripeRequestLeaseExpiresAt" timestamptz,
      "lastErrorCode" text,
      "expiresAt" timestamptz not null,
      "completedAt" timestamptz,
      "createdAt" timestamptz not null default now(),
      "updatedAt" timestamptz not null default now(),
      unique ("organizationId", "id"),
      unique ("organizationId", "idempotencyKey"),
      unique ("organizationId", "billingSubscriptionId", "revision"),
      foreign key ("organizationId", "billingSubscriptionId")
        references "billingSubscriptions" ("organizationId", "id")
        on delete cascade,
      check ("fromRecurringOptionCode" <> "toRecurringOptionCode"),
      check (
        (
          "stripeRequestLeaseToken" is null
          and "stripeRequestLeaseExpiresAt" is null
        )
        or (
          "stripeRequestLeaseToken" is not null
          and "stripeRequestLeaseExpiresAt" is not null
        )
      ),
      check (
        (
          "status" = 'pending'
          and "completedAt" is null
        )
        or (
          "status" = 'applied'
          and "stripeScheduleId" is not null
          and "completedAt" is not null
        )
        or (
          "status" = 'failed'
          and "completedAt" is not null
        )
      )
    )
  `.execute(db)
  await sql`
    create unique index "billingSubscriptionChangeIntentsPendingOrgUidx"
      on "billingSubscriptionChangeIntents" ("organizationId")
      where "status" = 'pending'
  `.execute(db)

  await sql`
    create table "billingPaymentDisputes" (
      "stripeDisputeId" text primary key,
      "organizationId" text not null,
      "billingPaymentId" text not null,
      "status" text not null check (
        "status" in ('open', 'lost', 'prevented', 'won', 'warning_closed')
      ),
      "amountMinor" integer not null check ("amountMinor" > 0),
      "currency" text not null check ("currency" = 'usd'),
      "resolvedAt" timestamptz,
      "createdAt" timestamptz not null default now(),
      "updatedAt" timestamptz not null default now(),
      unique ("organizationId", "stripeDisputeId"),
      foreign key ("organizationId", "billingPaymentId")
        references "billingPayments" ("organizationId", "id")
        on delete cascade,
      check (
        ("status" = 'open' and "resolvedAt" is null)
        or ("status" <> 'open' and "resolvedAt" is not null)
      )
    )
  `.execute(db)
  await sql`
    create index "billingPaymentDisputesPaymentIdx"
      on "billingPaymentDisputes" (
        "organizationId", "billingPaymentId", "status"
      )
  `.execute(db)

  await sql`
    create table "billingDisputeGrantReversals" (
      "organizationId" text not null,
      "stripeDisputeId" text not null,
      "creditGrantId" text not null,
      "reversedCredits" integer not null check ("reversedCredits" > 0),
      "reinstatedCredits" integer not null default 0 check (
        "reinstatedCredits" >= 0
        and "reinstatedCredits" <= "reversedCredits"
      ),
      "createdAt" timestamptz not null default now(),
      "updatedAt" timestamptz not null default now(),
      primary key ("stripeDisputeId", "creditGrantId"),
      foreign key ("organizationId", "stripeDisputeId")
        references "billingPaymentDisputes" (
          "organizationId", "stripeDisputeId"
        )
        on delete cascade,
      foreign key ("organizationId", "creditGrantId")
        references "creditGrants" ("organizationId", "id")
    )
  `.execute(db)

  await sql`
    create table "billingReconciliationCursors" (
      "taskId" text primary key,
      "cursorOrganizationId" text
        references "organization" ("id") on delete set null,
      "updatedAt" timestamptz not null default now()
    )
  `.execute(db)
}

/** Billing resilience state is intentionally forward-only. */
export async function down(_db: Kysely<unknown>) {}
