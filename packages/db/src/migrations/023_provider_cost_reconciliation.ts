import type { Kysely } from 'kysely'

import { sql } from 'kysely'

/** Keeps eventual provider-cost recovery bounded to a small partial index. */
export async function up(db: Kysely<unknown>) {
  await sql`
    alter table "generationJobs"
      alter column "providerCostUsd" type numeric(20, 10)
  `.execute(db)
  await sql`
    alter table "flowRuns"
      alter column "providerCostUsd" type numeric(20, 10)
  `.execute(db)

  await sql`
    alter table "generationJobs"
      add column "providerCostReconciliationAttempts" smallint
        not null default 0,
      add column "providerCostReconciliationAttemptedAt" timestamptz,
      add constraint "generationJobs_provider_cost_attempts_check"
        check (
          "providerCostReconciliationAttempts" between 0 and 12
        )
  `.execute(db)

  await sql`
    create index "generationJobsProviderCostReconciliationIdx"
      on "generationJobs" (
        "providerCostReconciliationAttemptedAt", "createdAt", "id"
      )
      include ("organizationId")
      where "status" = 'succeeded'
        and "provider" = 'openrouter'
        and "providerGenerationId" is not null
        and "providerCostUsd" is null
        and "providerCostReconciliationAttempts" < 12
  `.execute(db)
}

/** Provider-cost accounting is intentionally forward-only. */
export async function down(_db: Kysely<unknown>) {}
