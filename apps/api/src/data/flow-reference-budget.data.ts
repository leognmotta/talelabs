import type { Database } from '@talelabs/db'
import type { Kysely, Transaction } from 'kysely'

import { sql } from '@talelabs/db'

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
    .where('referenceKind', '=', 'master')
    .executeTakeFirstOrThrow()
  let linkedAssetQuery = executor.selectFrom('elementAssets')
    .select(({ fn }) => fn.count<number>('assetId').distinct().as('count'))
    .where('organizationId', '=', input.organizationId)
    .where('elementId', 'in', elementIds)
    .where('referenceKind', '=', 'master')
  if (assetIds.length)
    linkedAssetQuery = linkedAssetQuery.where('assetId', 'not in', assetIds)
  const linkedAssetCount = await linkedAssetQuery.executeTakeFirstOrThrow()

  return {
    assets: assetIds.length + Number(linkedAssetCount.count),
    elementAssets: Number(linkCount.count),
  }
}
