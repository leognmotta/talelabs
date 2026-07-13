import type { Database } from '@talelabs/db'
import type { FlowReferenceBudgetViolation } from '@talelabs/flows'
import type { Kysely, Transaction } from 'kysely'

import { sql } from '@talelabs/db'
import {
  FLOW_GRAPH_LIMITS,
  getFlowReferenceBudgetViolation,
} from '@talelabs/flows'

export type FlowReferenceBudgetExecutor
  = | Kysely<Database>
    | Transaction<Database>

const FLOW_REFERENCE_BUDGET_LOCK_NAMESPACE = 'talelabs:flow-reference-budget'

/**
 * Graph topology and Element links both affect the same derived budget. The
 * organization-scoped transaction lock prevents either mutation from
 * validating against an incomplete concurrent state.
 */
export async function lockFlowReferenceBudget(
  executor: Transaction<Database>,
  organizationId: string,
) {
  await sql`
    select pg_advisory_xact_lock(
      hashtext(${FLOW_REFERENCE_BUDGET_LOCK_NAMESPACE}),
      hashtext(${organizationId})
    )
  `.execute(executor)
}

export async function getFlowReferenceBudget(
  executor: FlowReferenceBudgetExecutor,
  input: {
    assetIds: readonly string[]
    elementIds: readonly string[]
    organizationId: string
  },
) {
  const assetIds = [...new Set(input.assetIds)]
  const elementIds = [...new Set(input.elementIds)]
  if (elementIds.length === 0) {
    return {
      assets: assetIds.length,
      elementAssets: 0,
    }
  }

  const linkCount = await executor.selectFrom('elementAssets')
    .select(({ fn }) => fn.countAll<number>().as('count'))
    .where('organizationId', '=', input.organizationId)
    .where('elementId', 'in', elementIds)
    .executeTakeFirstOrThrow()
  let linkedAssetQuery = executor.selectFrom('elementAssets')
    .select(({ fn }) => fn.count<number>('assetId').distinct().as('count'))
    .where('organizationId', '=', input.organizationId)
    .where('elementId', 'in', elementIds)
  if (assetIds.length)
    linkedAssetQuery = linkedAssetQuery.where('assetId', 'not in', assetIds)
  const linkedAssetCount = await linkedAssetQuery.executeTakeFirstOrThrow()

  return {
    assets: assetIds.length + Number(linkedAssetCount.count),
    elementAssets: Number(linkCount.count),
  }
}

export async function findElementFlowReferenceBudgetViolation(
  executor: FlowReferenceBudgetExecutor,
  input: {
    elementId: string
    organizationId: string
  },
): Promise<(FlowReferenceBudgetViolation & { flowId: string }) | null> {
  const result = await sql<{
    assets: number
    elementAssets: number
    flowId: string
  }>`
    with "affectedFlows" as (
      select distinct "flowId"
      from "flowNodes"
      where "organizationId" = ${input.organizationId}
        and "elementId" = ${input.elementId}
    ),
    "flowElements" as (
      select distinct node."flowId", node."elementId"
      from "flowNodes" node
      join "affectedFlows" affected
        on affected."flowId" = node."flowId"
      where node."organizationId" = ${input.organizationId}
        and node."elementId" is not null
    ),
    "directAssets" as (
      select distinct node."flowId", node."assetId"
      from "flowNodes" node
      join "affectedFlows" affected
        on affected."flowId" = node."flowId"
      where node."organizationId" = ${input.organizationId}
        and node."assetId" is not null
    ),
    "elementLinks" as (
      select element."flowId", link."assetId"
      from "flowElements" element
      join "elementAssets" link
        on link."organizationId" = ${input.organizationId}
        and link."elementId" = element."elementId"
    ),
    "assetReferences" as (
      select "flowId", "assetId" from "directAssets"
      union
      select "flowId", "assetId" from "elementLinks"
    ),
    "linkBudgets" as (
      select "flowId", count(*)::integer as count
      from "elementLinks"
      group by "flowId"
    ),
    "assetBudgets" as (
      select "flowId", count(*)::integer as count
      from "assetReferences"
      group by "flowId"
    )
    select
      affected."flowId",
      coalesce(assets.count, 0)::integer as assets,
      coalesce(links.count, 0)::integer as "elementAssets"
    from "affectedFlows" affected
    left join "assetBudgets" assets
      on assets."flowId" = affected."flowId"
    left join "linkBudgets" links
      on links."flowId" = affected."flowId"
    where coalesce(links.count, 0) > ${FLOW_GRAPH_LIMITS.referenceLinks}
      or coalesce(assets.count, 0) > ${FLOW_GRAPH_LIMITS.referenceAssets}
    order by
      case
        when coalesce(links.count, 0) > ${FLOW_GRAPH_LIMITS.referenceLinks}
          then 0
        else 1
      end,
      affected."flowId"
    limit 1
  `.execute(executor)

  const budget = result.rows[0]
  if (!budget)
    return null
  const violation = getFlowReferenceBudgetViolation(budget)
  if (!violation)
    throw new Error('Flow reference budget query returned a valid budget')
  return { ...violation, flowId: budget.flowId }
}
