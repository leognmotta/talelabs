/** Fair bounded claims for generation jobs missing eventual provider costs. */

import { db, sql } from '@talelabs/db'
import { OPENROUTER_PROVIDER } from '@talelabs/providers/server'

const PROVIDER_ACCOUNTING_FAST_RETRY_MS = 5 * 60 * 1_000
const PROVIDER_ACCOUNTING_MEDIUM_RETRY_MS = 30 * 60 * 1_000
const PROVIDER_ACCOUNTING_SLOW_RETRY_MS = 4 * 60 * 60 * 1_000
const PROVIDER_ACCOUNTING_MAX_ATTEMPTS = 12

/** Fairly claims successful jobs whose eventual OpenRouter cost is still absent. */
export async function claimMissingOpenRouterProviderCosts(input: {
  limit: number
  organizationId?: string
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
    providerGenerationId: string
    providerResultCostUsd: null | string
  }>`
    with candidates as (
      select
        job."organizationId",
        job."id",
        job."flowRunId",
        job."providerGenerationId",
        result."providerCostUsd" as "providerResultCostUsd"
      from "generationJobs" as job
      inner join "generationProviderResults" as result
        on result."organizationId" = job."organizationId"
        and result."jobId" = job."id"
      where job."status" = 'succeeded'
        and job."provider" = ${OPENROUTER_PROVIDER}
        and job."providerGenerationId" is not null
        and job."providerCostUsd" is null
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
      candidates."providerGenerationId",
      candidates."providerResultCostUsd"
  `.execute(db)
  return result.rows
}
