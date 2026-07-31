/**
 * Adds durable per-organization retry and quarantine state for global billing
 * reconciliation without rewriting the applied billing migrations.
 */

import type { Kysely } from 'kysely'

import { sql } from 'kysely'

/** Prevents one tenant-specific failure from starving later organizations. */
export async function up(db: Kysely<unknown>) {
  await sql`
    create table "billingReconciliationFailures" (
      "taskId" text not null,
      "organizationId" text not null
        references "organization" ("id") on delete cascade,
      "attempts" integer not null check ("attempts" > 0),
      "lastErrorCode" text not null,
      "lastAttemptedAt" timestamptz not null,
      "nextAttemptAt" timestamptz,
      "quarantinedAt" timestamptz,
      "resolvedAt" timestamptz,
      "createdAt" timestamptz not null default now(),
      "updatedAt" timestamptz not null default now(),
      primary key ("taskId", "organizationId"),
      check (
        (
          "resolvedAt" is not null
          and "nextAttemptAt" is null
        )
        or (
          "resolvedAt" is null
          and (
            (
              "quarantinedAt" is null
              and "nextAttemptAt" is not null
            )
            or (
              "quarantinedAt" is not null
              and "nextAttemptAt" is null
            )
          )
        )
      )
    )
  `.execute(db)

  await sql`
    create index "billingReconciliationFailuresDueIdx"
      on "billingReconciliationFailures" (
        "taskId",
        "nextAttemptAt",
        "organizationId"
      )
      where "resolvedAt" is null and "quarantinedAt" is null
  `.execute(db)
}

/** Billing reconciliation failure recovery is intentionally forward-only. */
export async function down(_db: Kysely<unknown>) {}
