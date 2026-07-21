/** Expands bounded cost reconciliation to Fal and unsettled canceled outputs. */

import type { Kysely } from 'kysely'

import { sql } from 'kysely'

/** Repairs missing-cost settlement and widens the accounting claim index. */
export async function up(db: Kysely<unknown>) {
  await sql`
    drop index if exists "generationJobsProviderCostReconciliationIdx"
  `.execute(db)

  await sql`
    update "generationJobs"
    set
      "providerSettlementResolvedAt" = null,
      "providerSettlementStatus" = 'pending'
    where "provider" in ('fal', 'openrouter')
      and "providerSubmittedAt" is not null
      and "providerGenerationId" is not null
      and "providerCostUsd" is null
      and "providerCostReconciliationAttempts" < 12
      and "status" in ('canceled', 'failed', 'succeeded')
      and "providerCompletionStatus" = 'completed'
  `.execute(db)

  await sql`
    update "generationJobs"
    set
      "providerSettlementResolvedAt" = coalesce(
        "providerSettlementResolvedAt",
        now()
      ),
      "providerSettlementStatus" = 'unknown'
    where "provider" in ('fal', 'openrouter')
      and "providerSubmittedAt" is not null
      and "providerCostUsd" is null
      and "providerCostReconciliationAttempts" >= 12
      and "providerSettlementStatus" = 'settled'
  `.execute(db)

  await sql`
    create index "generationJobsProviderCostReconciliationIdx"
      on "generationJobs" (
        "providerCostReconciliationAttemptedAt", "createdAt", "id"
      )
      include ("organizationId")
      where "status" in ('canceled', 'failed', 'succeeded')
        and "providerCompletionStatus" = 'completed'
        and "provider" in ('fal', 'openrouter')
        and "providerGenerationId" is not null
        and "providerCostUsd" is null
        and "providerSettlementStatus" = 'pending'
        and "providerCostReconciliationAttempts" < 12
  `.execute(db)
}

/** Managed provider-cost settlement is intentionally forward-only. */
export async function down(_db: Kysely<unknown>) {}
