/** Durable provider-settlement transitions independent of output retention. */

import type { DatabaseExecutor } from '@talelabs/db'
import type { NormalizedGenerationProviderFacts } from '@talelabs/flows'
import type { SafeRunFailure } from '../../../shared/failures/run-failure.js'

import { db, sql } from '@talelabs/db'

/** Resolves financial settlement only when completion includes trusted cost. */
export function completedProviderSettlement(
  facts: NormalizedGenerationProviderFacts,
  completedAt: Date,
) {
  if (facts.providerCostUsd !== undefined) {
    return {
      providerSettlementResolvedAt: completedAt,
      providerSettlementStatus: 'settled' as const,
    }
  }
  if (facts.providerGenerationId !== undefined) {
    return {
      providerSettlementResolvedAt: null,
      providerSettlementStatus: 'pending' as const,
    }
  }
  return {
    providerSettlementResolvedAt: completedAt,
    providerSettlementStatus: 'unknown' as const,
  }
}

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
      providerSettlementStatus: sql`case
        when "providerCostUsd" is null then 'unknown'
        else 'settled'
      end`,
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
