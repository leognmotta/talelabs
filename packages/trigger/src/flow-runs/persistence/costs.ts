import type { Database, Transaction } from '@talelabs/db'

import { sql } from '@talelabs/db'

/** Recomputes accounting without changing a terminal Flow run's product state. */
export async function recomputeFlowRunProviderCost(
  trx: Transaction<Database>,
  organizationId: string,
  flowRunId: string,
) {
  await trx.updateTable('flowRuns')
    .set({
      providerCostUsd: sql`(
        select case
          when count(*) filter (
            where job."provider" <> 'talelabs-mock'
              and job."providerCostUsd" is null
          ) > 0 then null
          else coalesce(sum(job."providerCostUsd"), 0)
        end
        from "generationJobs" as job
        where job."organizationId" = ${organizationId}
          and job."flowRunId" = ${flowRunId}
      )`,
    })
    .where('organizationId', '=', organizationId)
    .where('id', '=', flowRunId)
    .execute()
}
