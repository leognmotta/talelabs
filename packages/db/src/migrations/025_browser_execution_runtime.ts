/** Adds browser run ownership without changing the existing managed default. */

import type { Kysely } from 'kysely'

import { sql } from 'kysely'

/** Adds the driver discriminator and tenant-scoped expiring lease table. */
export async function up(db: Kysely<unknown>) {
  await sql`
    alter table "flowRuns"
      add column "executionRuntime" text not null default 'managed',
      add constraint "flowRunsExecutionRuntimeCheck"
        check ("executionRuntime" in ('managed', 'browser'))
  `.execute(db)
  await sql`
    alter table "generationJobs"
      add column "browserAttemptCount" integer not null default 0,
      add column "browserCancelRequestedAt" timestamptz,
      add column "browserNextEligibleAt" timestamptz
  `.execute(db)
  await sql`
    create table "flowRunBrowserLeases" (
      "organizationId" text not null,
      "flowRunId" text not null,
      "userId" text not null references "user"("id") on delete cascade,
      "executorId" text not null,
      "leaseExpiresAt" timestamptz not null,
      "heartbeatAt" timestamptz not null default now(),
      "createdAt" timestamptz not null default now(),
      "updatedAt" timestamptz not null default now(),
      primary key ("organizationId", "flowRunId"),
      constraint "flowRunBrowserLeasesRunFk"
        foreign key ("flowRunId", "organizationId")
        references "flowRuns" ("id", "organizationId") on delete cascade
    )
  `.execute(db)
  await sql`
    create index "flowRunBrowserLeasesExpiryIndex"
      on "flowRunBrowserLeases" ("leaseExpiresAt")
  `.execute(db)
}

/** Removes browser execution storage when explicitly rolled back. */
export async function down(db: Kysely<unknown>) {
  await sql`drop table if exists "flowRunBrowserLeases"`.execute(db)
  await sql`
    alter table "generationJobs"
      drop column if exists "browserNextEligibleAt",
      drop column if exists "browserCancelRequestedAt",
      drop column if exists "browserAttemptCount"
  `.execute(db)
  await sql`
    alter table "flowRuns"
      drop constraint if exists "flowRunsExecutionRuntimeCheck",
      drop column if exists "executionRuntime"
  `.execute(db)
}
