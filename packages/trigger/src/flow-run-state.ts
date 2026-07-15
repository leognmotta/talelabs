import type { Database, FlowRunStatus, Transaction } from '@talelabs/db'
import type { SafeRunFailure } from './run-failure.js'

import { db, sql } from '@talelabs/db'
import { runs as triggerRuns } from '@trigger.dev/sdk'

import {
  cleanupUncommittedGeneratedOutputObjects,
  cleanupUncommittedGeneratedOutputObjectsForRun,
} from './generated-output-storage.js'
import { toSafeRunFailure } from './run-failure.js'

const ACTIVE_DOMAIN_STATUSES: FlowRunStatus[] = ['pending', 'running']
const ACTIVE_TRIGGER_STATUSES = new Set([
  'PENDING_VERSION',
  'QUEUED',
  'DEQUEUED',
  'EXECUTING',
  'WAITING',
  'DELAYED',
])
const TERMINAL_TRIGGER_STATUSES = new Set([
  'COMPLETED',
  'CANCELED',
  'FAILED',
  'CRASHED',
  'SYSTEM_FAILURE',
  'EXPIRED',
  'TIMED_OUT',
])
const STALE_GENERATION_JOB_MS = 15 * 60 * 1000

async function updateRunStatus(
  trx: Transaction<Database>,
  organizationId: string,
  flowRunId: string,
  now: Date,
) {
  const updated = await sql<{ status: FlowRunStatus }>`
    with run_status as (
      select
        node."organizationId",
        node."flowRunId",
        case
          when count(*) filter (
            where node."status" in ('pending', 'running')
          ) > 0 then 'running'
          when count(*) filter (where node."status" = 'partial') > 0
            or (
              count(*) filter (where node."status" = 'succeeded') > 0
              and count(*) filter (
                where node."status" in ('failed', 'canceled', 'skipped')
              ) > 0
            ) then 'partial'
          when count(*) > 0
            and count(*) filter (where node."status" = 'succeeded') = count(*)
            then 'succeeded'
          when count(*) filter (where node."status" = 'canceled') > 0
            then 'canceled'
          else 'failed'
        end as status
      from "flowRunNodes" as node
      where node."organizationId" = ${organizationId}
        and node."flowRunId" = ${flowRunId}
      group by node."organizationId", node."flowRunId"
    )
    update "flowRuns" as run
    set
      "completedAt" = case
        when run_status.status = 'running' then null
        else coalesce(run."completedAt", ${now})
      end,
      "providerCostUsd" = 0,
      "status" = run_status.status
    from run_status
    where run."organizationId" = run_status."organizationId"
      and run."id" = run_status."flowRunId"
      and run."status" <> 'canceled'
    returning run."status" as status
  `.execute(trx)
  if (updated.rows[0])
    return updated.rows[0].status

  const run = await trx.selectFrom('flowRuns')
    .select('status')
    .where('organizationId', '=', organizationId)
    .where('id', '=', flowRunId)
    .executeTakeFirst()
  return run?.status ?? null
}

/**
 * Incrementally repairs only the completed job's item and node before deriving
 * the small run summary. This is the normal child-completion path.
 */
export async function aggregateGenerationJobState(input: {
  flowRunId: string
  itemKey: string
  nodeId: string
  organizationId: string
}) {
  return db.transaction().execute(async (trx) => {
    const now = new Date()
    await sql`
      with item_status as (
        select
          item."organizationId",
          item."flowRunId",
          item."nodeId",
          item."itemKey",
          case
            when count(job."id") filter (where job."status" = 'running') > 0
              then 'running'
            when count(job."id") filter (where job."status" = 'pending') > 0
              then 'pending'
            when count(job."id") filter (where job."status" = 'succeeded') > 0
              and count(job."id") filter (
                where job."status" in ('failed', 'canceled')
              ) > 0 then 'partial'
            when count(job."id") > 0
              and count(job."id") filter (
                where job."status" = 'succeeded'
              ) = count(job."id") then 'succeeded'
            when count(job."id") filter (where job."status" = 'canceled') > 0
              then 'canceled'
            when count(job."id") filter (where job."status" = 'failed') > 0
              then 'failed'
            else item."status"
          end as status
        from "flowRunNodeItems" as item
        left join "generationJobs" as job
          on job."organizationId" = item."organizationId"
          and job."flowRunId" = item."flowRunId"
          and job."nodeId" = item."nodeId"
          and job."itemKey" = item."itemKey"
        where item."organizationId" = ${input.organizationId}
          and item."flowRunId" = ${input.flowRunId}
          and item."nodeId" = ${input.nodeId}
          and item."itemKey" = ${input.itemKey}
        group by
          item."organizationId",
          item."flowRunId",
          item."nodeId",
          item."itemKey",
          item."status"
      )
      update "flowRunNodeItems" as item
      set "status" = item_status.status, "updatedAt" = ${now}
      from item_status
      where item."organizationId" = item_status."organizationId"
        and item."flowRunId" = item_status."flowRunId"
        and item."nodeId" = item_status."nodeId"
        and item."itemKey" = item_status."itemKey"
        and item."status" not in ('canceled', 'skipped')
        and item."status" is distinct from item_status.status
    `.execute(trx)

    await sql`
      with node_status as (
        select
          item."organizationId",
          item."flowRunId",
          item."nodeId",
          case
            when count(*) filter (where item."status" = 'running') > 0
              or (
                count(*) filter (where item."status" = 'pending') > 0
                and count(*) filter (where item."status" = 'pending') < count(*)
              ) then 'running'
            when count(*) filter (where item."status" = 'pending') = count(*)
              then 'pending'
            when count(*) filter (where item."status" = 'partial') > 0
              or (
                count(*) filter (where item."status" = 'succeeded') > 0
                and count(*) filter (
                  where item."status" in ('failed', 'canceled', 'skipped')
                ) > 0
              ) then 'partial'
            when count(*) > 0
              and count(*) filter (
                where item."status" = 'succeeded'
              ) = count(*) then 'succeeded'
            when count(*) filter (where item."status" = 'failed') > 0
              then 'failed'
            when count(*) filter (where item."status" = 'canceled') > 0
              then 'canceled'
            when count(*) filter (where item."status" = 'skipped') > 0
              then 'skipped'
            else 'pending'
          end as status
        from "flowRunNodeItems" as item
        where item."organizationId" = ${input.organizationId}
          and item."flowRunId" = ${input.flowRunId}
          and item."nodeId" = ${input.nodeId}
        group by item."organizationId", item."flowRunId", item."nodeId"
      )
      update "flowRunNodes" as node
      set "status" = node_status.status, "updatedAt" = ${now}
      from node_status
      where node."organizationId" = node_status."organizationId"
        and node."flowRunId" = node_status."flowRunId"
        and node."nodeId" = node_status."nodeId"
        and node."status" <> 'canceled'
        and node."status" is distinct from node_status.status
    `.execute(trx)

    return updateRunStatus(
      trx,
      input.organizationId,
      input.flowRunId,
      now,
    )
  })
}

/**
 * Set-based authoritative repair used only by parent finalization and durable
 * reconciliation, never once per child job.
 */
export async function aggregateFlowRunState(
  organizationId: string,
  flowRunId: string,
) {
  return db.transaction().execute(async (trx) => {
    const run = await trx.selectFrom('flowRuns')
      .select('status')
      .where('organizationId', '=', organizationId)
      .where('id', '=', flowRunId)
      .executeTakeFirst()
    if (!run || run.status === 'canceled')
      return run?.status ?? null

    const now = new Date()
    await sql`
      with item_status as (
        select
          item."organizationId",
          item."flowRunId",
          item."nodeId",
          item."itemKey",
          case
            when count(job."id") filter (where job."status" = 'running') > 0
              then 'running'
            when count(job."id") filter (where job."status" = 'pending') > 0
              then 'pending'
            when count(job."id") filter (where job."status" = 'succeeded') > 0
              and count(job."id") filter (
                where job."status" in ('failed', 'canceled')
              ) > 0 then 'partial'
            when count(job."id") > 0
              and count(job."id") filter (
                where job."status" = 'succeeded'
              ) = count(job."id") then 'succeeded'
            when count(job."id") filter (where job."status" = 'canceled') > 0
              then 'canceled'
            when count(job."id") filter (where job."status" = 'failed') > 0
              then 'failed'
            else item."status"
          end as status
        from "flowRunNodeItems" as item
        left join "generationJobs" as job
          on job."organizationId" = item."organizationId"
          and job."flowRunId" = item."flowRunId"
          and job."nodeId" = item."nodeId"
          and job."itemKey" = item."itemKey"
        where item."organizationId" = ${organizationId}
          and item."flowRunId" = ${flowRunId}
        group by
          item."organizationId",
          item."flowRunId",
          item."nodeId",
          item."itemKey",
          item."status"
      )
      update "flowRunNodeItems" as item
      set "status" = item_status.status, "updatedAt" = ${now}
      from item_status
      where item."organizationId" = item_status."organizationId"
        and item."flowRunId" = item_status."flowRunId"
        and item."nodeId" = item_status."nodeId"
        and item."itemKey" = item_status."itemKey"
        and item."status" not in ('canceled', 'skipped')
        and item."status" is distinct from item_status.status
    `.execute(trx)

    await sql`
      with node_status as (
        select
          item."organizationId",
          item."flowRunId",
          item."nodeId",
          case
            when count(*) filter (where item."status" = 'running') > 0
              or (
                count(*) filter (where item."status" = 'pending') > 0
                and count(*) filter (where item."status" = 'pending') < count(*)
              ) then 'running'
            when count(*) filter (where item."status" = 'pending') = count(*)
              then 'pending'
            when count(*) filter (where item."status" = 'partial') > 0
              or (
                count(*) filter (where item."status" = 'succeeded') > 0
                and count(*) filter (
                  where item."status" in ('failed', 'canceled', 'skipped')
                ) > 0
              ) then 'partial'
            when count(*) > 0
              and count(*) filter (
                where item."status" = 'succeeded'
              ) = count(*) then 'succeeded'
            when count(*) filter (where item."status" = 'failed') > 0
              then 'failed'
            when count(*) filter (where item."status" = 'canceled') > 0
              then 'canceled'
            when count(*) filter (where item."status" = 'skipped') > 0
              then 'skipped'
            else 'pending'
          end as status
        from "flowRunNodeItems" as item
        where item."organizationId" = ${organizationId}
          and item."flowRunId" = ${flowRunId}
        group by item."organizationId", item."flowRunId", item."nodeId"
      )
      update "flowRunNodes" as node
      set "status" = node_status.status, "updatedAt" = ${now}
      from node_status
      where node."organizationId" = node_status."organizationId"
        and node."flowRunId" = node_status."flowRunId"
        and node."nodeId" = node_status."nodeId"
        and node."status" <> 'canceled'
        and node."status" is distinct from node_status.status
    `.execute(trx)

    return updateRunStatus(trx, organizationId, flowRunId, now)
  })
}

/** Claims the one persisted Trigger parent without allowing ownership takeover. */
export async function claimFlowRunTriggerParent(input: {
  triggerDeploymentVersion?: string | null
  flowRunId: string
  organizationId: string
  triggerRunId: string
}) {
  let query = db.updateTable('flowRuns')
    .set(input.triggerDeploymentVersion
      ? {
          triggerDeploymentVersion: input.triggerDeploymentVersion,
          triggerRunId: input.triggerRunId,
        }
      : { triggerRunId: input.triggerRunId })
    .where('organizationId', '=', input.organizationId)
    .where('id', '=', input.flowRunId)
    .where('status', 'in', ACTIVE_DOMAIN_STATUSES)
    .where(eb => eb.or([
      eb('triggerRunId', 'is', null),
      eb('triggerRunId', '=', input.triggerRunId),
    ]))
  if (input.triggerDeploymentVersion) {
    query = query.where(eb => eb.or([
      eb('triggerDeploymentVersion', 'is', null),
      eb('triggerDeploymentVersion', '=', input.triggerDeploymentVersion!),
    ]))
  }
  const claimed = await query
    .returning('id')
    .executeTakeFirst()
  return Boolean(claimed)
}

async function failActiveJobs(input: {
  failure: SafeRunFailure
  flowRunId: string
  organizationId: string
}) {
  const now = new Date()
  await db.updateTable('generationJobs')
    .set({
      completedAt: now,
      errorCode: input.failure.code,
      errorMessage: input.failure.message,
      status: 'failed',
    })
    .where('organizationId', '=', input.organizationId)
    .where('flowRunId', '=', input.flowRunId)
    .where('status', 'in', ['pending', 'running'])
    .execute()
  await cleanupUncommittedGeneratedOutputObjectsForRun({
    flowRunId: input.flowRunId,
    organizationId: input.organizationId,
  })
  return aggregateFlowRunState(input.organizationId, input.flowRunId)
}

async function retrieveStatus(triggerRunId: string) {
  try {
    const run = await triggerRuns.retrieve(triggerRunId)
    return {
      status: run.status,
      version: run.version?.trim() || null,
    }
  }
  catch (error) {
    const status = typeof error === 'object' && error && 'status' in error
      ? Number(error.status)
      : null
    return status === 404
      ? { status: 'MISSING' as const, version: null }
      : null
  }
}

function organizationFilter(organizationId?: string) {
  return organizationId
    ? sql`and run."organizationId" = ${organizationId}`
    : sql``
}

async function claimDispatchedFlowRuns(input: {
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

/**
 * Records that a canceled domain run no longer needs Trigger cancellation
 * repair. The Trigger run identity remains intact for audit and diagnostics.
 */
async function acknowledgeCanceledRun(input: {
  flowRunId: string
  organizationId: string
  triggerRunId: string
}) {
  await cleanupUncommittedGeneratedOutputObjectsForRun({
    flowRunId: input.flowRunId,
    organizationId: input.organizationId,
  })
  const result = await db.updateTable('flowRuns')
    .set({ cancellationReconciledAt: new Date() })
    .where('organizationId', '=', input.organizationId)
    .where('id', '=', input.flowRunId)
    .where('status', '=', 'canceled')
    .where('triggerRunId', '=', input.triggerRunId)
    .where('cancellationReconciledAt', 'is', null)
    .executeTakeFirst()
  return Number(result.numUpdatedRows) > 0
}

/** Fairly rotates pending durable outbox rows before Trigger dispatch. */
export async function claimUndispatchedFlowRuns(input: {
  limit?: number
  organizationId?: string
}) {
  const organizationClause = input.organizationId
    ? sql`and run."organizationId" = ${input.organizationId}`
    : sql``
  const result = await sql<{
    id: string
    organizationId: string
  }>`
    with candidates as (
      select run."organizationId", run."id"
      from "flowRuns" as run
      where run."status" = 'pending'
        and run."triggerRunId" is null
        ${organizationClause}
      order by
        run."lastReconciledAt" asc nulls first,
        run."createdAt",
        run."id"
      for update of run skip locked
      limit ${input.limit ?? 100}
    )
    update "flowRuns" as run
    set "lastReconciledAt" = now()
    from candidates
    where run."organizationId" = candidates."organizationId"
      and run."id" = candidates."id"
    returning run."id", run."organizationId"
  `.execute(db)
  return result.rows
}

async function claimStaleGenerationJobs(input: {
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
    triggerRunId: null | string
  }>`
    with candidates as (
      select job."organizationId", job."id"
      from "generationJobs" as job
      inner join "flowRuns" as run
        on run."organizationId" = job."organizationId"
        and run."id" = job."flowRunId"
      where job."status" = 'running'
        and job."startedAt" < ${staleBefore}
        and run."status" in ('pending', 'running')
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
      job."triggerRunId"
  `.execute(db)
  return result.rows
}

/** Repairs divergence between Trigger terminal state and TaleLabs durable state. */
export async function reconcileFlowRunStates(input: {
  limit?: number
  organizationId?: string
}) {
  const limit = input.limit ?? 100
  const candidates = await claimDispatchedFlowRuns({
    limit,
    organizationId: input.organizationId,
  })
  let cancellationAcknowledged = 0
  let canceled = 0
  let failed = 0

  for (const run of candidates) {
    const triggerRunId = run.triggerRunId
    const triggerState = await retrieveStatus(triggerRunId)
    const status = triggerState?.status ?? null
    if (triggerState?.version && run.status !== 'canceled') {
      await claimFlowRunTriggerParent({
        flowRunId: run.id,
        organizationId: run.organizationId,
        triggerDeploymentVersion: triggerState.version,
        triggerRunId,
      })
    }
    if (run.status === 'canceled') {
      if (status && ACTIVE_TRIGGER_STATUSES.has(status)) {
        try {
          await triggerRuns.cancel(triggerRunId)
          canceled += 1
        }
        catch {
          // Durable rotation brings this run back in a later bounded pass.
        }
      }
      else if (
        status === 'MISSING'
        || (status && TERMINAL_TRIGGER_STATUSES.has(status))
      ) {
        if (await acknowledgeCanceledRun({
          flowRunId: run.id,
          organizationId: run.organizationId,
          triggerRunId,
        })) {
          cancellationAcknowledged += 1
        }
      }
      continue
    }
    if (!status || (!TERMINAL_TRIGGER_STATUSES.has(status) && status !== 'MISSING'))
      continue
    const code = status === 'MISSING'
      ? 'trigger_run_missing' as const
      : 'trigger_parent_terminal' as const
    await failActiveJobs({
      failure: toSafeRunFailure(new Error(`Trigger parent status: ${status}`), code),
      flowRunId: run.id,
      organizationId: run.organizationId,
    })
    failed += 1
  }

  const staleJobs = await claimStaleGenerationJobs({
    limit,
    organizationId: input.organizationId,
  })
  const affectedRuns = new Set<string>()
  for (const job of staleJobs) {
    const triggerState = job.triggerRunId
      ? await retrieveStatus(job.triggerRunId)
      : { status: 'MISSING' as const, version: null }
    const status = triggerState?.status ?? null
    if (!status || ACTIVE_TRIGGER_STATUSES.has(status))
      continue
    const failure = toSafeRunFailure(
      new Error(`Trigger child status: ${status}`),
      'trigger_job_stale',
    )
    await db.updateTable('generationJobs')
      .set({
        completedAt: new Date(),
        errorCode: failure.code,
        errorMessage: failure.message,
        status: 'failed',
      })
      .where('organizationId', '=', job.organizationId)
      .where('id', '=', job.id)
      .where('status', '=', 'running')
      .execute()
    await cleanupUncommittedGeneratedOutputObjects({
      generationJobId: job.id,
      organizationId: job.organizationId,
    })
    affectedRuns.add(`${job.organizationId}\u0000${job.flowRunId}`)
  }
  for (const key of affectedRuns) {
    const [organizationId, flowRunId] = key.split('\u0000')
    await aggregateFlowRunState(organizationId!, flowRunId!)
  }

  return {
    cancellationAcknowledged,
    canceled,
    checked: candidates.length,
    failed,
    staleJobs: staleJobs.length,
  }
}
