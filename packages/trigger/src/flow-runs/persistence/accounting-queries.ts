/** Fair bounded claims for generation jobs missing eventual provider costs. */

import type {
  FAL_PROVIDER,
  OPENROUTER_PROVIDER,
} from '@talelabs/providers/server'

import { db, sql } from '@talelabs/db'

const PROVIDER_ACCOUNTING_FAST_RETRY_MS = 5 * 60 * 1_000
const PROVIDER_ACCOUNTING_MEDIUM_RETRY_MS = 30 * 60 * 1_000
const PROVIDER_ACCOUNTING_SLOW_RETRY_MS = 4 * 60 * 60 * 1_000
/** Maximum provider metadata lookups before cost becomes explicitly unknown. */
export const PROVIDER_ACCOUNTING_MAX_ATTEMPTS = 12

/** Managed providers with request-level accounting reconciliation. */
export type ReconciledAccountingProvider
  = | typeof FAL_PROVIDER
    | typeof OPENROUTER_PROVIDER

/** Fairly claims terminal managed jobs whose eventual provider cost is absent. */
export async function claimMissingProviderCosts(input: {
  limit: number
  organizationId?: string
  provider: ReconciledAccountingProvider
}) {
  const limit = Math.max(1, Math.min(input.limit, 100))
  const now = Date.now()
  const fastRetryBefore = new Date(now - PROVIDER_ACCOUNTING_FAST_RETRY_MS)
  const mediumRetryBefore = new Date(now - PROVIDER_ACCOUNTING_MEDIUM_RETRY_MS)
  const slowRetryBefore = new Date(now - PROVIDER_ACCOUNTING_SLOW_RETRY_MS)
  const organizationClause = input.organizationId
    ? sql`and job."organizationId" = ${input.organizationId}`
    : sql``
  const result = await sql<{
    flowRunId: string
    generationJobId: string
    organizationId: string
    provider: ReconciledAccountingProvider
    providerCostReconciliationAttempts: number
    providerGenerationId: string
    providerModel: string
    providerResultCostUsd: null | string
    providerSubmittedAt: Date
  }>`
    with candidates as (
      select
        job."organizationId",
        job."id",
        job."flowRunId",
        job."provider",
        job."providerGenerationId",
        job."providerModel",
        job."providerSubmittedAt",
        result."providerCostUsd" as "providerResultCostUsd"
      from "generationJobs" as job
      inner join "generationProviderResults" as result
        on result."organizationId" = job."organizationId"
        and result."jobId" = job."id"
      inner join "flowRuns" as run
        on run."organizationId" = job."organizationId"
        and run."id" = job."flowRunId"
      where job."status" in ('canceled', 'failed', 'succeeded')
        and job."providerCompletionStatus" = 'completed'
        and run."executionRuntime" = 'managed'
        and job."provider" = ${input.provider}
        and job."providerGenerationId" is not null
        and job."providerSubmittedAt" is not null
        and job."providerCostUsd" is null
        and job."providerSettlementStatus" = 'pending'
        and job."providerCostReconciliationAttempts"
          < ${PROVIDER_ACCOUNTING_MAX_ATTEMPTS}
        and (
          result."providerGenerationId" is null
          or result."providerGenerationId" = job."providerGenerationId"
        )
        and (
          job."providerCostReconciliationAttemptedAt" is null
          or (
            job."providerCostReconciliationAttempts" < 3
            and job."providerCostReconciliationAttemptedAt"
              < ${fastRetryBefore}
          )
          or (
            job."providerCostReconciliationAttempts" between 3 and 5
            and job."providerCostReconciliationAttemptedAt"
              < ${mediumRetryBefore}
          )
          or (
            job."providerCostReconciliationAttempts" between 6 and 11
            and job."providerCostReconciliationAttemptedAt"
              < ${slowRetryBefore}
          )
        )
        ${organizationClause}
      order by
        job."providerCostReconciliationAttemptedAt" asc nulls first,
        job."createdAt",
        job."id"
      for update of job skip locked
      limit ${limit}
    )
    update "generationJobs" as job
    set
      "providerCostReconciliationAttempts" =
        job."providerCostReconciliationAttempts" + 1,
      "providerCostReconciliationAttemptedAt" = now()
    from candidates
    where job."organizationId" = candidates."organizationId"
      and job."id" = candidates."id"
    returning
      candidates."flowRunId",
      candidates."id" as "generationJobId",
      candidates."organizationId",
      candidates."provider",
      job."providerCostReconciliationAttempts",
      candidates."providerGenerationId",
      candidates."providerModel",
      candidates."providerResultCostUsd",
      candidates."providerSubmittedAt"
  `.execute(db)
  return result.rows
}
