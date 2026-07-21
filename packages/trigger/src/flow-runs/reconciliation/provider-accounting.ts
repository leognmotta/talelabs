/** Durable request-level provider-cost reconciliation after output completion. */

import type {
  FalGenerationCostLookup,
  FalRuntimeCredential,
  OpenRouterHttpClient,
  OpenRouterRuntimeCredential,
} from '@talelabs/providers/server'

import { db } from '@talelabs/db'
import {
  createFalGenerationCostLookup,
  createOpenRouterHttpClient as createOpenRouterClient,
  FAL_PROVIDER,
  lookupOpenRouterGenerationCost,
  OPENROUTER_PROVIDER,
  resolveProviderRuntimeCredential,
  safeProviderCost,
} from '@talelabs/providers/server'
import {
  claimMissingProviderCosts,
  PROVIDER_ACCOUNTING_MAX_ATTEMPTS,
} from '../persistence/accounting-queries.js'
import { recomputeFlowRunProviderCost } from '../persistence/costs.js'
import { runProviderAccountingBudget } from './provider-accounting-budget.js'

const ACCOUNTING_METADATA_DELAYS_MS = [0] as const
const FAL_ACCOUNTING_BATCH_SIZE = 50
const FAL_ACCOUNTING_MAX_CHECKS = 1_000
const FAL_ACCOUNTING_TIME_BUDGET_MS = 90_000

async function persistReconciledProviderCost(input: {
  cost: number
  flowRunId: string
  generationJobId: string
  organizationId: string
  provider: typeof FAL_PROVIDER | typeof OPENROUTER_PROVIDER
  providerGenerationId: string
}) {
  return db.transaction().execute(async (trx) => {
    const resolvedAt = new Date()
    const job = await trx.updateTable('generationJobs')
      .set({
        providerCostUsd: String(input.cost),
        providerSettlementResolvedAt: resolvedAt,
        providerSettlementStatus: 'settled',
      })
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.generationJobId)
      .where('flowRunId', '=', input.flowRunId)
      .where('status', 'in', ['canceled', 'failed', 'succeeded'])
      .where('provider', '=', input.provider)
      .where('providerGenerationId', '=', input.providerGenerationId)
      .where('providerCostUsd', 'is', null)
      .where('providerSettlementStatus', '=', 'pending')
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

async function markExhaustedProviderCostUnknown(input: {
  flowRunId: string
  generationJobId: string
  organizationId: string
  providerGenerationId: string
  reconciliationAttempts: number
}) {
  if (input.reconciliationAttempts < PROVIDER_ACCOUNTING_MAX_ATTEMPTS)
    return false
  return db.transaction().execute(async (trx) => {
    const job = await trx.updateTable('generationJobs')
      .set({
        providerSettlementResolvedAt: new Date(),
        providerSettlementStatus: 'unknown',
      })
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.generationJobId)
      .where('flowRunId', '=', input.flowRunId)
      .where('providerGenerationId', '=', input.providerGenerationId)
      .where('providerCostUsd', 'is', null)
      .where('providerSettlementStatus', '=', 'pending')
      .where(
        'providerCostReconciliationAttempts',
        '>=',
        PROVIDER_ACCOUNTING_MAX_ATTEMPTS,
      )
      .returning('id')
      .executeTakeFirst()
    if (!job)
      return false
    await recomputeFlowRunProviderCost(
      trx,
      input.organizationId,
      input.flowRunId,
    )
    return true
  })
}

/** Recovers eventual OpenRouter accounting without reopening provider work. */
export async function reconcileOpenRouterProviderCosts(input: {
  client?: OpenRouterHttpClient
  limit?: number
  metadataTimeoutMs?: number
  organizationId?: string
  runtimeCredential?: OpenRouterRuntimeCredential
}) {
  const candidates = await claimMissingProviderCosts({
    limit: input.limit ?? 10,
    organizationId: input.organizationId,
    provider: OPENROUTER_PROVIDER,
  })
  let client = input.client
  let failed = 0
  let recovered = 0
  let unavailable = 0
  let unknown = 0

  for (const candidate of candidates) {
    let cost = safeProviderCost(candidate.providerResultCostUsd)
    if (cost === undefined) {
      try {
        client ??= createOpenRouterClient({
          credential: resolveProviderRuntimeCredential(
            OPENROUTER_PROVIDER,
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
      }
    }
    if (cost === undefined) {
      unavailable += 1
      if (await markExhaustedProviderCostUnknown({
        flowRunId: candidate.flowRunId,
        generationJobId: candidate.generationJobId,
        organizationId: candidate.organizationId,
        providerGenerationId: candidate.providerGenerationId,
        reconciliationAttempts:
          candidate.providerCostReconciliationAttempts,
      }).catch(() => false)) {
        unknown += 1
      }
      continue
    }
    try {
      if (await persistReconciledProviderCost({
        cost,
        flowRunId: candidate.flowRunId,
        generationJobId: candidate.generationJobId,
        organizationId: candidate.organizationId,
        provider: OPENROUTER_PROVIDER,
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
    unknown,
  }
}

/** Recovers actual Fal billing events for managed completed queue requests. */
export async function reconcileFalProviderCosts(input: {
  limit?: number
  lookup?: FalGenerationCostLookup
  lookupTimeoutMs?: number
  organizationId?: string
  runtimeCredential?: FalRuntimeCredential
}) {
  const candidates = await claimMissingProviderCosts({
    limit: input.limit ?? 10,
    organizationId: input.organizationId,
    provider: FAL_PROVIDER,
  })
  let lookup = input.lookup
  let failed = 0
  let recovered = 0
  let unavailable = 0
  let unknown = 0

  const costs = candidates.map(candidate => (
    safeProviderCost(candidate.providerResultCostUsd)
  ))
  const lookupIndexes = costs.flatMap((cost, index) => (
    cost === undefined ? [index] : []
  ))
  for (
    let offset = 0;
    offset < lookupIndexes.length;
    offset += FAL_ACCOUNTING_BATCH_SIZE
  ) {
    const indexes = lookupIndexes.slice(
      offset,
      offset + FAL_ACCOUNTING_BATCH_SIZE,
    )
    try {
      lookup ??= createFalGenerationCostLookup({
        credential: resolveProviderRuntimeCredential(
          FAL_PROVIDER,
          input.runtimeCredential,
        ),
        timeoutMs: input.lookupTimeoutMs,
      })
      const batchCosts = await lookup.lookupMany(indexes.map((index) => {
        const candidate = candidates[index]!
        return {
          endpointId: candidate.providerModel,
          requestId: candidate.providerGenerationId,
          submittedAt: candidate.providerSubmittedAt,
        }
      }))
      for (let index = 0; index < indexes.length; index += 1)
        costs[indexes[index]!] = batchCosts[index]
    }
    catch {
      failed += indexes.length
    }
  }

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index]!
    const cost = costs[index]
    if (cost === undefined) {
      unavailable += 1
      if (await markExhaustedProviderCostUnknown({
        flowRunId: candidate.flowRunId,
        generationJobId: candidate.generationJobId,
        organizationId: candidate.organizationId,
        providerGenerationId: candidate.providerGenerationId,
        reconciliationAttempts:
          candidate.providerCostReconciliationAttempts,
      }).catch(() => false)) {
        unknown += 1
      }
      continue
    }
    try {
      if (await persistReconciledProviderCost({
        cost,
        flowRunId: candidate.flowRunId,
        generationJobId: candidate.generationJobId,
        organizationId: candidate.organizationId,
        provider: FAL_PROVIDER,
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
    unknown,
  }
}

function reconcileFalProviderCostPages(input: {
  lookup?: FalGenerationCostLookup
  lookupTimeoutMs?: number
  organizationId?: string
  runtimeCredential?: FalRuntimeCredential
} = {}) {
  return runProviderAccountingBudget({
    maxChecks: FAL_ACCOUNTING_MAX_CHECKS,
    pageSize: FAL_ACCOUNTING_BATCH_SIZE,
    reconcilePage: limit => reconcileFalProviderCosts({
      limit,
      ...input,
    }),
    timeBudgetMs: FAL_ACCOUNTING_TIME_BUDGET_MS,
  })
}

/** Runs one bounded scheduled sweep for every reconciled managed provider. */
export async function reconcileScheduledProviderCosts() {
  const fal = await reconcileFalProviderCostPages()
  const openrouter = await reconcileOpenRouterProviderCosts({ limit: 10 })
  return { fal, openrouter }
}
