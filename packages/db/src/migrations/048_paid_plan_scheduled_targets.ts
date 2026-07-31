/**
 * Removes the original Pro-only column guard so renewal-boundary paid-plan
 * changes may target either Creator or Pro.
 */

import type { Kysely } from 'kysely'

import { sql } from 'kysely'

/** Aligns the legacy column constraint with the complete scheduled tuple. */
export async function up(db: Kysely<unknown>) {
  await sql`
    alter table "billingSubscriptions"
      drop constraint "billingSubscriptions_scheduledPlanCode_check",
      add constraint "billingSubscriptionsScheduledPlanCodeCheck"
        check (
          "scheduledPlanCode" is null
          or "scheduledPlanCode" in ('creator', 'pro')
        )
  `.execute(db)
}

/** Paid-plan scheduled targets are intentionally forward-only. */
export async function down(_db: Kysely<unknown>) {}
