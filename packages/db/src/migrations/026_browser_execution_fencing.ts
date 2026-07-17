/** Adds fencing, cancellation acknowledgement, and untrusted browser facts. */

import type { Kysely } from 'kysely'

import { sql } from 'kysely'

/** Strengthens browser lifecycle ownership without rewriting admitted snapshots. */
export async function up(db: Kysely<unknown>) {
  await sql`
    alter table "flowRunBrowserLeases"
      add column "fenceToken" integer not null default 1,
      add constraint "flowRunBrowserLeasesFenceTokenCheck"
        check ("fenceToken" > 0)
  `.execute(db)
  await sql`
    alter table "flowRuns"
      add column "browserExecutorStatus" text,
      add column "browserExecutorCode" text,
      add column "browserExecutorUpdatedAt" timestamptz,
      add constraint "flowRunsBrowserExecutorStatusCheck"
        check (
          "browserExecutorStatus" is null
          or "browserExecutorStatus" in ('ready', 'blocked', 'retrying', 'error', 'canceling')
        ),
      add constraint "flowRunsBrowserExecutorPairCheck"
        check (
          ("browserExecutorStatus" is null and "browserExecutorCode" is null)
          or "browserExecutorStatus" is not null
        )
  `.execute(db)
  await sql`
    update "flowRuns"
      set "browserExecutorStatus" = 'ready',
          "browserExecutorUpdatedAt" = now()
      where "executionRuntime" = 'browser'
        and "browserExecutorStatus" is null
  `.execute(db)
  await sql`
    alter table "generationJobs"
      add column "browserFenceToken" integer,
      add column "browserSubmissionState" text not null default 'not_started',
      add column "browserReportedProviderCostUsd" numeric(20, 10),
      add column "browserReportedProviderGenerationId" text,
      add column "browserCancelAcknowledgedAt" timestamptz,
      add column "browserCancelStatus" text,
      add column "browserCancelFinal" boolean,
      add constraint "generationJobsBrowserFenceTokenCheck"
        check ("browserFenceToken" is null or "browserFenceToken" > 0),
      add constraint "generationJobsBrowserSubmissionStateCheck"
        check ("browserSubmissionState" in ('not_started', 'submitting', 'submitted')),
      add constraint "generationJobsBrowserReportedCostCheck"
        check (
          "browserReportedProviderCostUsd" is null
          or "browserReportedProviderCostUsd" >= 0
        ),
      add constraint "generationJobsBrowserCancelStatusCheck"
        check (
          "browserCancelStatus" is null
          or "browserCancelStatus" in ('accepted', 'rejected', 'unsupported', 'unavailable')
        ),
      add constraint "generationJobsBrowserCancelAcknowledgementCheck"
        check (
          ("browserCancelAcknowledgedAt" is null and "browserCancelStatus" is null and "browserCancelFinal" is null)
          or ("browserCancelAcknowledgedAt" is not null and "browserCancelStatus" is not null and "browserCancelFinal" is not null)
        )
  `.execute(db)
  await sql`
    create index "generationJobsBrowserCancellationIndex"
      on "generationJobs" ("organizationId", "flowRunId", "browserCancelAcknowledgedAt")
      where "browserCancelRequestedAt" is not null
  `.execute(db)
  await sql`
    update "generationJobs" as job
      set "browserSubmissionState" = case
        when job."providerJobId" is not null then 'submitted'
        else 'submitting'
      end
      where job."providerSubmittedAt" is not null
        and exists (
          select 1
          from "flowRuns" as run
          where run."organizationId" = job."organizationId"
            and run."id" = job."flowRunId"
            and run."executionRuntime" = 'browser'
        )
  `.execute(db)
  await sql`
    update "flowRuns" as run
      set "browserExecutorStatus" = 'canceling',
          "browserExecutorCode" = 'provider_cancellation_pending',
          "browserExecutorUpdatedAt" = now(),
          "cancellationReconciledAt" = null
      where run."executionRuntime" = 'browser'
        and run."status" = 'canceled'
        and exists (
          select 1
          from "generationJobs" as job
          where job."organizationId" = run."organizationId"
            and job."flowRunId" = run."id"
            and job."browserCancelRequestedAt" is not null
            and job."browserCancelAcknowledgedAt" is null
        )
  `.execute(db)
}

/** Removes only the fencing additions when explicitly rolled back. */
export async function down(db: Kysely<unknown>) {
  await sql`drop index if exists "generationJobsBrowserCancellationIndex"`.execute(
    db,
  )
  await sql`
    alter table "generationJobs"
      drop constraint if exists "generationJobsBrowserCancelAcknowledgementCheck",
      drop constraint if exists "generationJobsBrowserCancelStatusCheck",
      drop constraint if exists "generationJobsBrowserReportedCostCheck",
      drop constraint if exists "generationJobsBrowserSubmissionStateCheck",
      drop constraint if exists "generationJobsBrowserFenceTokenCheck",
      drop column if exists "browserCancelFinal",
      drop column if exists "browserCancelStatus",
      drop column if exists "browserCancelAcknowledgedAt",
      drop column if exists "browserReportedProviderGenerationId",
      drop column if exists "browserReportedProviderCostUsd",
      drop column if exists "browserSubmissionState",
      drop column if exists "browserFenceToken"
  `.execute(db)
  await sql`
    alter table "flowRuns"
      drop constraint if exists "flowRunsBrowserExecutorPairCheck",
      drop constraint if exists "flowRunsBrowserExecutorStatusCheck",
      drop column if exists "browserExecutorUpdatedAt",
      drop column if exists "browserExecutorCode",
      drop column if exists "browserExecutorStatus"
  `.execute(db)
  await sql`
    alter table "flowRunBrowserLeases"
      drop constraint if exists "flowRunBrowserLeasesFenceTokenCheck",
      drop column if exists "fenceToken"
  `.execute(db)
}
