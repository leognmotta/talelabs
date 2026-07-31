/**
 * Captures immutable subscription grant authority from the exact paid invoice
 * line without rewriting previously applied billing migrations.
 */

import type { Kysely } from 'kysely'

import { sql } from 'kysely'

/** Adds exact paid-line provenance and protects it after first capture. */
export async function up(db: Kysely<unknown>) {
  await sql`
    alter table "billingPayments"
      add column "stripeInvoiceLineItemId" text,
      add column "stripePriceId" text,
      add column "subscriptionPlanCode" text
        check (
          "subscriptionPlanCode" is null
          or "subscriptionPlanCode" in ('creator', 'pro')
        ),
      add column "subscriptionRecurringOptionCode" text,
      add column "subscriptionOfferCode" text,
      add column "subscriptionMonthlyCredits" integer
        check (
          "subscriptionMonthlyCredits" is null
          or "subscriptionMonthlyCredits" > 0
        ),
      add column "subscriptionBillingInterval" text
        check (
          "subscriptionBillingInterval" is null
          or "subscriptionBillingInterval" in ('month', 'year')
        ),
      add column "subscriptionCatalogRevision" text,
      add column "subscriptionGrantFactsCapturedAt" timestamptz,
      add constraint "billingPaymentsSubscriptionGrantFactsCheck"
        check (
          (
            "paymentKind" = 'credit_topup'
            and "stripeInvoiceLineItemId" is null
            and "stripePriceId" is null
            and "subscriptionPlanCode" is null
            and "subscriptionRecurringOptionCode" is null
            and "subscriptionOfferCode" is null
            and "subscriptionMonthlyCredits" is null
            and "subscriptionBillingInterval" is null
            and "subscriptionCatalogRevision" is null
            and "subscriptionGrantFactsCapturedAt" is null
          )
          or (
            "paymentKind" = 'subscription'
            and (
              (
                "stripeInvoiceLineItemId" is null
                and "stripePriceId" is null
                and "subscriptionPlanCode" is null
                and "subscriptionRecurringOptionCode" is null
                and "subscriptionOfferCode" is null
                and "subscriptionMonthlyCredits" is null
                and "subscriptionBillingInterval" is null
                and "subscriptionCatalogRevision" is null
                and "subscriptionGrantFactsCapturedAt" is null
              )
              or (
                "stripeInvoiceLineItemId" is not null
                and "stripeInvoiceLineItemId" <> ''
                and "stripePriceId" is not null
                and "stripePriceId" <> ''
                and "subscriptionPlanCode" is not null
                and "subscriptionRecurringOptionCode" is not null
                and "subscriptionRecurringOptionCode" <> ''
                and "subscriptionOfferCode" is not null
                and "subscriptionOfferCode" <> ''
                and "subscriptionMonthlyCredits" is not null
                and "subscriptionBillingInterval" is not null
                and "subscriptionCatalogRevision" is not null
                and "subscriptionCatalogRevision" <> ''
                and "subscriptionGrantFactsCapturedAt" is not null
              )
            )
          )
        )
  `.execute(db)

  await sql`
    create unique index "billingPaymentsInvoiceLineItemUidx"
      on "billingPayments" ("stripeInvoiceLineItemId")
      where "stripeInvoiceLineItemId" is not null
  `.execute(db)

  await sql`
    create function "preventBillingPaymentGrantFactMutation"()
    returns trigger
    language plpgsql
    as $$
    begin
      if old."subscriptionGrantFactsCapturedAt" is not null
        and row(
          new."paymentKind",
          new."billingSubscriptionId",
          new."stripeInvoiceId",
          new."stripeInvoiceLineItemId",
          new."stripePriceId",
          new."amountPaidMinor",
          new."currency",
          new."servicePeriodStart",
          new."servicePeriodEnd",
          new."subscriptionPlanCode",
          new."subscriptionRecurringOptionCode",
          new."subscriptionOfferCode",
          new."subscriptionMonthlyCredits",
          new."subscriptionBillingInterval",
          new."subscriptionCatalogRevision",
          new."subscriptionGrantFactsCapturedAt"
        ) is distinct from row(
          old."paymentKind",
          old."billingSubscriptionId",
          old."stripeInvoiceId",
          old."stripeInvoiceLineItemId",
          old."stripePriceId",
          old."amountPaidMinor",
          old."currency",
          old."servicePeriodStart",
          old."servicePeriodEnd",
          old."subscriptionPlanCode",
          old."subscriptionRecurringOptionCode",
          old."subscriptionOfferCode",
          old."subscriptionMonthlyCredits",
          old."subscriptionBillingInterval",
          old."subscriptionCatalogRevision",
          old."subscriptionGrantFactsCapturedAt"
        )
      then
        raise exception 'billing_payment_grant_facts_immutable'
          using errcode = '23514';
      end if;
      return new;
    end
    $$
  `.execute(db)

  await sql`
    create trigger "billingPaymentsGrantFactsImmutable"
    before update on "billingPayments"
    for each row
    execute function "preventBillingPaymentGrantFactMutation"()
  `.execute(db)
}

/** Subscription payment grant provenance is intentionally forward-only. */
export async function down(_db: Kysely<unknown>) {}
