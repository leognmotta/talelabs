import type { Kysely } from 'kysely'

import { sql } from 'kysely'

/**
 * Retires canceled runs from Trigger reconciliation only after their external
 * parent is terminal (or when no parent was ever dispatched).
 */
export async function up(db: Kysely<unknown>) {
  await sql`
    alter table "flowRuns"
      add column "cancellationReconciledAt" timestamptz,
      add constraint "flowRunsCancellationReconciledCheck"
        check (
          "cancellationReconciledAt" is null
          or "status" = 'canceled'
        )
  `.execute(db)

  await sql`
    update "flowRuns"
    set "cancellationReconciledAt" = coalesce("completedAt", now())
    where "status" = 'canceled'
      and "triggerRunId" is null
  `.execute(db)

  await sql`
    drop index if exists "flowRunsReconciliationIdx";

    create index "flowRunsReconciliationIdx"
      on "flowRuns" (
        "lastReconciledAt" asc nulls first,
        "createdAt",
        "id"
      )
      where "status" in ('pending', 'running')
        or (
          "status" = 'canceled'
          and "cancellationReconciledAt" is null
        )
  `.execute(db)
}

export async function down(db: Kysely<unknown>) {
  await sql`
    drop index if exists "flowRunsReconciliationIdx";

    create index "flowRunsReconciliationIdx"
      on "flowRuns" (
        "lastReconciledAt" asc nulls first,
        "createdAt",
        "id"
      )
      where "status" in ('pending', 'running', 'canceled');

    alter table "flowRuns"
      drop constraint if exists "flowRunsCancellationReconciledCheck",
      drop column if exists "cancellationReconciledAt"
  `.execute(db)
}
