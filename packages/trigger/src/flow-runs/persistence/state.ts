import type { Database, FlowRunStatus, Transaction } from '@talelabs/db'

import { db, sql } from '@talelabs/db'
import { recomputeFlowRunProviderCost } from './costs.js'

async function updateRunStatus(
  trx: Transaction<Database>,
  organizationId: string,
  flowRunId: string,
  now: Date,
) {
  await recomputeFlowRunProviderCost(trx, organizationId, flowRunId)
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

export { reconcileFlowRunStates } from '../reconciliation/reconcile.js'
export {
  claimFlowRunTriggerParent,
  claimUndispatchedFlowRuns,
} from './claims.js'
