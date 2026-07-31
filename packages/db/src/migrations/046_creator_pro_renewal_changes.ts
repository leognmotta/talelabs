/**
 * Allows a paid Creator subscription to schedule a Pro offer at renewal.
 */

import type { Kysely } from 'kysely'

import { sql } from 'kysely'

/** Broadens the existing scheduled-Pro tuple to originate from either paid plan. */
export async function up(db: Kysely<unknown>) {
  await sql`
    alter table "billingSubscriptions"
      drop constraint "billingSubscriptions_check1",
      add constraint "billingSubscriptionsScheduledChangeCheck"
        check (
          (
            "scheduledPlanCode" is null
            and "scheduledRecurringOptionCode" is null
            and "scheduledOfferCode" is null
          )
          or (
            "scheduledPlanCode" = 'pro'
            and "scheduledRecurringOptionCode" is not null
            and "scheduledOfferCode" is not null
          )
        )
  `.execute(db)
}

/** Creator-to-Pro renewal scheduling is intentionally forward-only. */
export async function down(_db: Kysely<unknown>) {}
