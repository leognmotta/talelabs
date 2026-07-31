/**
 * Adds durable retry and quarantine state for terminal credit settlement
 * reconciliation without rewriting the applied M8 billing migrations.
 */

import type { Kysely } from 'kysely'

import { sql } from 'kysely'

/** Prevents one inconsistent terminal job from starving settlement sweeps. */
export async function up(db: Kysely<unknown>) {
  await sql`
    alter table "generationJobs"
      add column "creditSettlementReconciliationAttempts"
        integer not null default 0
        check ("creditSettlementReconciliationAttempts" >= 0),
      add column "creditSettlementReconciliationAttemptedAt" timestamptz,
      add column "creditSettlementReconciliationErrorCode" text,
      add column "creditSettlementReconciliationNextAt" timestamptz,
      add column "creditSettlementReconciliationQuarantinedAt" timestamptz,
      add constraint "generationJobsCreditSettlementReconciliationShape"
        check (
          (
            "creditSettlementReconciliationAttempts" = 0
            and "creditSettlementReconciliationAttemptedAt" is null
            and "creditSettlementReconciliationErrorCode" is null
            and "creditSettlementReconciliationNextAt" is null
            and "creditSettlementReconciliationQuarantinedAt" is null
          )
          or (
            "creditSettlementReconciliationAttempts" > 0
            and "creditSettlementReconciliationAttemptedAt" is not null
            and "creditSettlementReconciliationErrorCode" is not null
            and (
              (
                "creditSettlementReconciliationQuarantinedAt" is null
                and "creditSettlementReconciliationNextAt" is not null
              )
              or (
                "creditSettlementReconciliationQuarantinedAt" is not null
                and "creditSettlementReconciliationNextAt" is null
              )
            )
          )
        )
  `.execute(db)

  await sql`
    create index "generationJobsCreditSettlementReconciliationIdx"
      on "generationJobs" ("completedAt", "id")
      where
        "creditSettlement" = 'reserved'
        and "status" in ('canceled', 'failed', 'succeeded')
        and "creditSettlementReconciliationQuarantinedAt" is null
  `.execute(db)
}

/** Billing reconciliation recovery is intentionally forward-only. */
export async function down(_db: Kysely<unknown>) {}
