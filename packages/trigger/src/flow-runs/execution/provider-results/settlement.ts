/** Durable provider-settlement transitions independent of output retention. */

import type { DatabaseExecutor } from '@talelabs/db'
import type { SafeRunFailure } from '../../../shared/failures/run-failure.js'

import { db, sql } from '@talelabs/db'

/** Settles a provider-reported failure without creating canonical output. */
export async function markProviderSettlementFailed(input: {
  jobId: string
  organizationId: string
}) {
  const resolvedAt = new Date()
  await db.updateTable('generationJobs')
    .set({
      providerCompletionReceivedAt: sql`coalesce(
        "providerCompletionReceivedAt", ${resolvedAt}
      )`,
      providerCompletionStatus: sql`coalesce(
        "providerCompletionStatus", 'failed'
      )`,
      providerSettlementResolvedAt: resolvedAt,
      providerSettlementStatus: 'settled',
    })
    .where('organizationId', '=', input.organizationId)
    .where('id', '=', input.jobId)
    .where('providerSettlementStatus', '=', 'pending')
    .execute()
}

/** Closes bounded recovery when provider settlement cannot be established. */
export async function markProviderSettlementUnknown(input: {
  jobId: string
  organizationId: string
}) {
  await db.updateTable('generationJobs')
    .set({
      providerSettlementResolvedAt: new Date(),
      providerSettlementStatus: 'unknown',
    })
    .where('organizationId', '=', input.organizationId)
    .where('id', '=', input.jobId)
    .where('providerSettlementStatus', '=', 'pending')
    .execute()
}

/** Makes a settled submitted job user-terminal after its run was canceled. */
export async function cancelGenerationJobAfterSettlement(
  input: {
    failure?: SafeRunFailure
    jobId: string
    organizationId: string
  },
  database: DatabaseExecutor = db,
) {
  await database.updateTable('generationJobs')
    .set({
      completedAt: new Date(),
      errorCode: input.failure?.code ?? null,
      errorMessage: input.failure?.message ?? null,
      status: 'canceled',
    })
    .where('organizationId', '=', input.organizationId)
    .where('id', '=', input.jobId)
    .where('status', 'in', ['pending', 'running'])
    .execute()
}
