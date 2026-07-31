/**
 * Adds payment-gated subscription changes and database-enforced monthly credit
 * ceilings without rewriting the applied M8 billing migrations.
 */

import type { Kysely } from 'kysely'

import { sql } from 'kysely'

/** Adds durable upgrade facts, credit-period ceilings, and grant provenance. */
export async function up(db: Kysely<unknown>) {
  await sql`
    alter table "billingSubscriptions"
      add column "creditScheduleRevision" bigint not null default 0
        check ("creditScheduleRevision" >= 0),
      add column "scheduledBillingInterval" text
        check (
          "scheduledBillingInterval" is null
          or "scheduledBillingInterval" in ('month', 'year')
        )
  `.execute(db)

  await sql`
    update "billingSubscriptions"
    set "scheduledBillingInterval" = "billingInterval"
    where "scheduledPlanCode" is not null
  `.execute(db)

  await sql`
    alter table "billingSubscriptions"
      drop constraint "billingSubscriptionsScheduledChangeCheck",
      add constraint "billingSubscriptionsScheduledChangeCheck"
        check (
          (
            "scheduledPlanCode" is null
            and "scheduledRecurringOptionCode" is null
            and "scheduledOfferCode" is null
            and "scheduledBillingInterval" is null
          )
          or (
            "scheduledPlanCode" in ('creator', 'pro')
            and "scheduledRecurringOptionCode" is not null
            and "scheduledOfferCode" is not null
            and "scheduledBillingInterval" is not null
          )
        )
  `.execute(db)

  await sql`
    create table "subscriptionCreditPeriods" (
      "id" text primary key,
      "organizationId" text not null,
      "billingSubscriptionId" text not null,
      "scheduleRevision" bigint not null
        check ("scheduleRevision" >= 0),
      "ordinal" integer not null check ("ordinal" >= 0),
      "periodStart" timestamptz not null,
      "periodEnd" timestamptz not null,
      "targetCredits" integer not null check ("targetCredits" > 0),
      "carriedCredits" integer not null default 0
        check ("carriedCredits" >= 0),
      "grantedCredits" integer not null default 0
        check ("grantedCredits" >= 0),
      "createdAt" timestamptz not null default now(),
      "updatedAt" timestamptz not null default now(),
      unique ("organizationId", "id"),
      unique (
        "organizationId",
        "billingSubscriptionId",
        "scheduleRevision",
        "ordinal"
      ),
      foreign key ("organizationId", "billingSubscriptionId")
        references "billingSubscriptions" ("organizationId", "id")
        on delete cascade,
      check ("periodEnd" > "periodStart"),
      check ("carriedCredits" + "grantedCredits" <= "targetCredits")
    )
  `.execute(db)

  await sql`
    insert into "subscriptionCreditPeriods" (
      "id",
      "organizationId",
      "billingSubscriptionId",
      "scheduleRevision",
      "ordinal",
      "periodStart",
      "periodEnd",
      "targetCredits",
      "carriedCredits",
      "grantedCredits"
    )
    select
      'scp_' || md5(
        grant_row."organizationId"
        || ':' || subscription_row."id"
        || ':' || grant_row."grantPeriodStart"::text
      ),
      grant_row."organizationId",
      subscription_row."id",
      0,
      row_number() over (
        partition by grant_row."organizationId", subscription_row."id"
        order by grant_row."grantPeriodStart", grant_row."id"
      ) - 1,
      grant_row."grantPeriodStart",
      grant_row."grantPeriodEnd",
      grant_row."originalCredits",
      0,
      grant_row."originalCredits"
    from "creditGrants" grant_row
    join "billingSubscriptions" subscription_row
      on subscription_row."organizationId" = grant_row."organizationId"
      and subscription_row."stripeSubscriptionId"
        = grant_row."stripeSubscriptionId"
    where grant_row."source" = 'subscription'
  `.execute(db)

  await sql`
    alter table "billingSubscriptionChangeIntents"
      add column "changeMode" text not null default 'renewal'
        check ("changeMode" in ('immediate', 'renewal')),
      add column "fromPlanCode" text
        check ("fromPlanCode" in ('creator', 'pro')),
      add column "fromOfferCode" text,
      add column "fromBillingInterval" text
        check ("fromBillingInterval" in ('month', 'year')),
      add column "fromMonthlyCredits" integer
        check ("fromMonthlyCredits" is null or "fromMonthlyCredits" > 0),
      add column "toPlanCode" text
        check ("toPlanCode" in ('creator', 'pro')),
      add column "toBillingInterval" text
        check ("toBillingInterval" in ('month', 'year')),
      add column "toMonthlyCredits" integer
        check ("toMonthlyCredits" is null or "toMonthlyCredits" > 0),
      add column "currentPeriodStart" timestamptz,
      add column "prorationDate" timestamptz,
      add column "creditAdjustment" integer not null default 0
        check ("creditAdjustment" >= 0),
      add column "expectedAmountDueMinor" integer
        check (
          "expectedAmountDueMinor" is null
          or "expectedAmountDueMinor" >= 0
        ),
      add column "stripePriceId" text,
      add column "stripeInvoiceId" text
  `.execute(db)

  await sql`
    update "billingSubscriptionChangeIntents" intent
    set
      "fromPlanCode" = subscription_row."planCode",
      "fromOfferCode" = subscription_row."offerCode",
      "fromBillingInterval" = subscription_row."billingInterval",
      "toPlanCode" = 'pro',
      "toBillingInterval" = subscription_row."billingInterval",
      "currentPeriodStart" = subscription_row."currentPeriodStart"
    from "billingSubscriptions" subscription_row
    where subscription_row."organizationId" = intent."organizationId"
      and subscription_row."id" = intent."billingSubscriptionId"
  `.execute(db)

  await sql`
    alter table "billingSubscriptionChangeIntents"
      alter column "fromPlanCode" set not null,
      alter column "fromOfferCode" set not null,
      alter column "fromBillingInterval" set not null,
      alter column "toPlanCode" set not null,
      alter column "toBillingInterval" set not null,
      alter column "currentPeriodStart" set not null,
      drop constraint "billingSubscriptionChangeIntents_check",
      drop constraint "billingSubscriptionChangeIntents_check2",
      add constraint "billingSubscriptionChangeIntentTargetCheck"
        check (
          "fromPlanCode" <> "toPlanCode"
          or "fromRecurringOptionCode" <> "toRecurringOptionCode"
          or "fromBillingInterval" <> "toBillingInterval"
        ),
      add constraint "billingSubscriptionChangeIntentModeCheck"
        check (
          (
            "changeMode" = 'renewal'
            and "prorationDate" is null
            and "expectedAmountDueMinor" is null
          )
          or (
            "changeMode" = 'immediate'
            and "prorationDate" is not null
            and "expectedAmountDueMinor" is not null
            and "stripePriceId" is not null
            and "fromMonthlyCredits" is not null
            and "toMonthlyCredits" is not null
          )
        ),
      add constraint "billingSubscriptionChangeIntentStateCheck"
        check (
          (
            "status" = 'pending'
            and "completedAt" is null
          )
          or (
            "status" = 'applied'
            and "completedAt" is not null
            and (
              (
                "changeMode" = 'renewal'
                and "stripeScheduleId" is not null
              )
              or (
                "changeMode" = 'immediate'
                and "stripeInvoiceId" is not null
              )
            )
          )
          or (
            "status" = 'failed'
            and "completedAt" is not null
          )
        )
  `.execute(db)

  await sql`
    create unique index "billingSubscriptionChangeIntentsInvoiceUidx"
      on "billingSubscriptionChangeIntents" ("stripeInvoiceId")
      where "stripeInvoiceId" is not null
  `.execute(db)

  await sql`
    alter table "creditGrants"
      add column "subscriptionCreditPeriodId" text,
      add column "billingSubscriptionChangeIntentId" text
  `.execute(db)

  await sql`
    update "creditGrants" grant_row
    set "subscriptionCreditPeriodId" = period_row."id"
    from "subscriptionCreditPeriods" period_row
    join "billingSubscriptions" subscription_row
      on subscription_row."organizationId" = period_row."organizationId"
      and subscription_row."id" = period_row."billingSubscriptionId"
    where grant_row."source" = 'subscription'
      and grant_row."organizationId" = period_row."organizationId"
      and grant_row."stripeSubscriptionId"
        = subscription_row."stripeSubscriptionId"
      and grant_row."grantPeriodStart" = period_row."periodStart"
  `.execute(db)

  await sql`
    drop index "creditGrantsSubscriptionPeriodUidx"
  `.execute(db)

  await sql`
    alter table "creditGrants"
      drop constraint "creditGrants_check3",
      add constraint "creditGrantsSubscriptionPeriodFk"
        foreign key ("organizationId", "subscriptionCreditPeriodId")
        references "subscriptionCreditPeriods" ("organizationId", "id"),
      add constraint "creditGrantsSubscriptionChangeIntentFk"
        foreign key (
          "organizationId",
          "billingSubscriptionChangeIntentId"
        )
        references "billingSubscriptionChangeIntents" (
          "organizationId",
          "id"
        ),
      add constraint "creditGrantsSourceFactsCheck"
        check (
          (
            "source" = 'founder_welcome'
            and "planCode" = 'free'
            and "creditPurchaseId" is null
            and "stripeSubscriptionId" is null
            and "subscriptionCreditPeriodId" is null
            and "billingSubscriptionChangeIntentId" is null
          )
          or (
            "source" = 'subscription'
            and "planCode" in ('creator', 'pro')
            and "offerCode" is not null
            and "stripeSubscriptionId" is not null
            and "stripeInvoiceId" is not null
            and "grantPeriodStart" is not null
            and "subscriptionCreditPeriodId" is not null
          )
          or (
            "source" = 'purchase'
            and "creditPurchaseId" is not null
            and "recognizedRevenueUsdCents" is not null
            and "subscriptionCreditPeriodId" is null
            and "billingSubscriptionChangeIntentId" is null
          )
          or (
            "source" = 'manual'
            and "subscriptionCreditPeriodId" is null
            and "billingSubscriptionChangeIntentId" is null
          )
        )
  `.execute(db)

  await sql`
    create unique index "creditGrantsSubscriptionBasePeriodUidx"
      on "creditGrants" ("organizationId", "subscriptionCreditPeriodId")
      where "source" = 'subscription'
        and "billingSubscriptionChangeIntentId" is null
  `.execute(db)

  await sql`
    create unique index "creditGrantsSubscriptionChangeUidx"
      on "creditGrants" (
        "organizationId",
        "billingSubscriptionChangeIntentId"
      )
      where "billingSubscriptionChangeIntentId" is not null
  `.execute(db)
}

/** Immediate-upgrade accounting is intentionally forward-only. */
export async function down(_db: Kysely<unknown>) {}
