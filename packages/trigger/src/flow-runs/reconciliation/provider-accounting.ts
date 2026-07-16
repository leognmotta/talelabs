/** Post-success reconciliation for eventually consistent OpenRouter costs. */

import type {
  OpenRouterHttpClient,
  OpenRouterRuntimeCredential,
} from '@talelabs/providers/server'

import { db } from '@talelabs/db'
import {
  createOpenRouterHttpClient as createClient,
  lookupOpenRouterGenerationCost,
  resolveProviderRuntimeCredential,
  safeProviderCost,
} from '@talelabs/providers/server'
import { claimMissingOpenRouterProviderCosts } from '../persistence/accounting-queries.js'
import { recomputeFlowRunProviderCost } from '../persistence/costs.js'

const ACCOUNTING_METADATA_DELAYS_MS = [0] as const

async function persistReconciledProviderCost(input: {
  cost: number
  flowRunId: string
  generationJobId: string
  organizationId: string
  providerGenerationId: string
}) {
  return db.transaction().execute(async (trx) => {
    const job = await trx.updateTable('generationJobs')
      .set({ providerCostUsd: String(input.cost) })
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.generationJobId)
      .where('flowRunId', '=', input.flowRunId)
      .where('status', '=', 'succeeded')
      .where('providerGenerationId', '=', input.providerGenerationId)
      .where('providerCostUsd', 'is', null)
      .returning('id')
      .executeTakeFirst()
    if (!job)
      return false

    const checkpoint = await trx.updateTable('generationProviderResults')
      .set({
        providerCostUsd: String(input.cost),
        providerGenerationId: input.providerGenerationId,
      })
      .where('organizationId', '=', input.organizationId)
      .where('jobId', '=', input.generationJobId)
      .where(eb => eb.or([
        eb('providerGenerationId', 'is', null),
        eb('providerGenerationId', '=', input.providerGenerationId),
      ]))
      .returning('jobId')
      .executeTakeFirst()
    if (!checkpoint)
      throw new Error('provider_accounting_checkpoint_missing')

    await recomputeFlowRunProviderCost(
      trx,
      input.organizationId,
      input.flowRunId,
    )
    return true
  })
}

/** Recovers eventual accounting facts without reopening or delaying output success. */
export async function reconcileOpenRouterProviderCosts(input: {
  client?: OpenRouterHttpClient
  limit?: number
  metadataTimeoutMs?: number
  organizationId?: string
  runtimeCredential?: OpenRouterRuntimeCredential
}) {
  const candidates = await claimMissingOpenRouterProviderCosts({
    limit: input.limit ?? 10,
    organizationId: input.organizationId,
  })
  let client = input.client
  let failed = 0
  let recovered = 0
  let unavailable = 0

  for (const candidate of candidates) {
    const checkpointCost = safeProviderCost(candidate.providerResultCostUsd)
    let cost = checkpointCost
    if (cost === undefined) {
      try {
        client ??= createClient({
          credential: resolveProviderRuntimeCredential(
            'openrouter',
            input.runtimeCredential,
          ),
        })
        cost = await lookupOpenRouterGenerationCost({
          client,
          delaysMs: ACCOUNTING_METADATA_DELAYS_MS,
          generationId: candidate.providerGenerationId,
          timeoutMs: input.metadataTimeoutMs,
        })
      }
      catch {
        failed += 1
        continue
      }
    }
    if (cost === undefined) {
      unavailable += 1
      continue
    }
    try {
      if (await persistReconciledProviderCost({
        cost,
        flowRunId: candidate.flowRunId,
        generationJobId: candidate.generationJobId,
        organizationId: candidate.organizationId,
        providerGenerationId: candidate.providerGenerationId,
      })) {
        recovered += 1
      }
    }
    catch {
      failed += 1
    }
  }

  return {
    checked: candidates.length,
    failed,
    recovered,
    unavailable,
  }
}

/** Runs the global bounded accounting sweep independently of Flow dispatch. */
export function reconcileScheduledOpenRouterProviderCosts() {
  return reconcileOpenRouterProviderCosts({ limit: 10 })
}
