import type { FlowRunStatus } from '@talelabs/db'

import { db, sql } from '@talelabs/db'

const STALE_GENERATION_JOB_MS = 15 * 60 * 1000

function organizationFilter(organizationId?: string) {
  return organizationId
    ? sql`and run."organizationId" = ${organizationId}`
    : sql``
}

export async function claimDispatchedFlowRuns(input: {
  limit: number
  organizationId?: string
}) {
  const result = await sql<{
    id: string
    organizationId: string
    status: FlowRunStatus
    triggerRunId: string
  }>`
    with candidates as (
      select run."organizationId", run."id"
      from "flowRuns" as run
      where run."triggerRunId" is not null
        and (
          run."status" in ('pending', 'running')
          or (
            run."status" = 'canceled'
            and run."cancellationReconciledAt" is null
          )
        )
        ${organizationFilter(input.organizationId)}
      order by
        run."lastReconciledAt" asc nulls first,
        run."createdAt",
        run."id"
      for update of run skip locked
      limit ${input.limit}
    )
    update "flowRuns" as run
    set "lastReconciledAt" = now()
    from candidates
    where run."organizationId" = candidates."organizationId"
      and run."id" = candidates."id"
    returning
      run."id",
      run."organizationId",
      run."status",
      run."triggerRunId"
  `.execute(db)
  return result.rows
}

export async function claimStaleGenerationJobs(input: {
  limit: number
  organizationId?: string
}) {
  const organizationClause = input.organizationId
    ? sql`and job."organizationId" = ${input.organizationId}`
    : sql``
  const staleBefore = new Date(Date.now() - STALE_GENERATION_JOB_MS)
  const result = await sql<{
    flowRunId: string
    id: string
    organizationId: string
    providerSettlementStatus: 'not_required' | 'pending' | 'settled' | 'unknown'
    runStatus: FlowRunStatus
    triggerRunId: null | string
  }>`
    with candidates as (
      select
        job."organizationId",
        job."id",
        job."providerSettlementStatus",
        run."status" as "runStatus"
      from "generationJobs" as job
      inner join "flowRuns" as run
        on run."organizationId" = job."organizationId"
        and run."id" = job."flowRunId"
      where job."status" = 'running'
        and job."startedAt" < ${staleBefore}
        and (
          run."status" in ('pending', 'running')
          or (
            run."status" = 'canceled'
            and job."providerSubmittedAt" is not null
            and job."providerSettlementStatus" = 'pending'
          )
        )
        ${organizationClause}
      order by
        job."lastReconciledAt" asc nulls first,
        job."startedAt",
        job."id"
      for update of job skip locked
      limit ${input.limit}
    )
    update "generationJobs" as job
    set "lastReconciledAt" = now()
    from candidates
    where job."organizationId" = candidates."organizationId"
      and job."id" = candidates."id"
    returning
      job."flowRunId",
      job."id",
      job."organizationId",
      candidates."providerSettlementStatus",
      candidates."runStatus",
      job."triggerRunId"
  `.execute(db)
  return result.rows
}
