import type { Kysely } from 'kysely'

import { sql } from 'kysely'

/** Separates user cancellation from the financial settlement of paid work. */
export async function up(db: Kysely<unknown>) {
  await sql`
    alter table "generationProviderOutputs"
      drop constraint "generationProviderOutputs_status_check",
      add constraint "generationProviderOutputs_status_check"
        check ("status" in ('staging', 'ready', 'discarded'))
  `.execute(db)

  await sql`
    alter table "generationJobs"
      add column "providerSettlementStatus" text not null
        default 'not_required',
      add column "providerSettlementResolvedAt" timestamptz
  `.execute(db)

  await sql`
    update "generationJobs" as job
    set
      "providerSettlementStatus" = case
        when job."providerSubmittedAt" is null then 'not_required'
        when job."providerCompletionStatus" is not null
          or job."status" = 'succeeded'
          or exists (
            select 1
            from "generationProviderResults" as result
            where result."organizationId" = job."organizationId"
              and result."jobId" = job."id"
          ) then 'settled'
        when job."status" in ('pending', 'running') then 'pending'
        else 'unknown'
      end,
      "providerSettlementResolvedAt" = case
        when job."providerSubmittedAt" is null then null
        when job."providerCompletionStatus" is not null
          or job."status" = 'succeeded'
          or exists (
            select 1
            from "generationProviderResults" as result
            where result."organizationId" = job."organizationId"
              and result."jobId" = job."id"
          ) then coalesce(
            job."providerCompletionReceivedAt",
            job."completedAt",
            now()
          )
        when job."status" in ('pending', 'running') then null
        else coalesce(job."completedAt", now())
      end
  `.execute(db)

  await sql`
    alter table "generationJobs"
      add constraint "generationJobs_provider_settlement_check"
        check (
          ("providerSettlementStatus" = 'not_required'
            and "providerSubmittedAt" is null
            and "providerSettlementResolvedAt" is null)
          or ("providerSettlementStatus" = 'pending'
            and "providerSubmittedAt" is not null
            and "providerSettlementResolvedAt" is null)
          or ("providerSettlementStatus" in ('settled', 'unknown')
            and "providerSubmittedAt" is not null
            and "providerSettlementResolvedAt" is not null)
        )
  `.execute(db)

  await sql`
    create index "generationJobsProviderSettlementIdx"
      on "generationJobs" (
        "organizationId", "providerSettlementStatus", "lastReconciledAt"
      )
      where "providerSettlementStatus" in ('pending', 'unknown')
  `.execute(db)
}

/** Provider-settlement provenance is intentionally forward-only. */
export async function down(_db: Kysely<unknown>) {}
