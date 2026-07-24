/**
 * Direct-generation estimate and admission composition.
 *
 * This is Create's only server-owned layer: it validates a bounded request,
 * compiles a generic execution plan, and hands that plan to the existing run
 * persistence, routing, dispatch, and execution stack.
 */

import type { JsonValue } from '@talelabs/db'
import type { DirectGenerationRequest } from './direct-generation-resolution.js'
import type { PublicRunCostEstimate } from './provider-cost.service.js'

import { createId } from '@paralleldrive/cuid2'
import { db } from '@talelabs/db'
import {
  CANONICAL_SERIALIZER_VERSION,
  createFlowRunSnapshotArtifact,
  FLOW_RUN_LIMITS,
  FLOW_RUN_SNAPSHOT_VERSION,
  GENERATION_CATALOG_REVISION,
  hashFlowRunRequest,
} from '@talelabs/flows'
import { loadProviderPricingSnapshot } from '@talelabs/providers/server'
import { FLOW_RUN_EXECUTOR_CONTRACT_VERSION } from '@talelabs/trigger'

import {
  resolveCreateSessionForAdmission,
  touchCreateSessionRow,
} from '../../data/create-sessions.data.js'
import { acquireFlowRunAdmissionLocks } from '../../data/flow-run-admission.data.js'
import { HttpError } from '../../middleware/error.js'
import {
  assertRunAdmissionCapacity,
  assertRunRuntimePolicy,
} from './admission-policy.js'
import {
  directGenerationCostAssets,
  loadDirectGenerationAssets,
} from './direct-generation-assets.js'
import { resolveDirectGeneration } from './direct-generation-resolution.js'
import { dispatchFlowRun } from './dispatch.service.js'
import { persistRunExecutionPlan } from './execution-persistence.js'
import {
  generationExecutionContracts,
  resolvedGenerationExecutionBindings,
} from './generation-execution-contracts.js'
import { logRunEngine } from './logging.js'
import { availableProvidersForRun } from './provider-availability.js'
import { requireCompleteProviderCostEstimate } from './provider-cost-admission.js'
import {
  providerCostCandidateBindingsForMode,
  publicRunCostEstimate,
  resolvePlanProviderCosts,
} from './provider-cost.service.js'
import { getRunDetail } from './read.service.js'

/** Public direct estimate returned without persisting a run or mutable draft. */
export interface DirectGenerationEstimate {
  /** Advisory provider cost using the same canonical job as admission. */
  costEstimate: PublicRunCostEstimate
  /** Canonical source-neutral execution plan hash. */
  executionPlanHash: string
  /** Canonical outputs expected from the request. */
  expectedOutputCount: number
  /** Provider requests compiled for the direct operation. */
  plannedJobCount: number
}

function requestAssetIds(request: DirectGenerationRequest) {
  return request.inputs.map(input => input.assetId)
}

function assertIdempotencyKey(
  idempotencyKey: null | string,
): asserts idempotencyKey is string {
  if (!idempotencyKey) {
    throw new HttpError(
      400,
      'idempotency_key_required',
      'Idempotency-Key is required.',
    )
  }
}

/**
 * Estimates one direct request through the shared compiler and cost resolver.
 *
 * The estimate is advisory. Admission repeats resolution from locked Asset
 * rows and never trusts this response as execution authority.
 */
export async function estimateDirectGeneration(input: {
  /** Validated public request facts. */
  body: DirectGenerationRequest
  /** Authenticated tenant owning referenced Assets. */
  organizationId: string
  /** Cancellation propagated only to mutable pricing metadata I/O. */
  signal?: AbortSignal
}): Promise<DirectGenerationEstimate> {
  assertRunRuntimePolicy({
    executionRuntime: input.body.executionRuntime,
    fundingSource: input.body.fundingSource,
  })
  const assets = await loadDirectGenerationAssets({
    assetIds: requestAssetIds(input.body),
    executor: db,
    organizationId: input.organizationId,
  })
  const compiled = resolveDirectGeneration({
    assetsById: assets,
    request: input.body,
  })
  const availableProviders = availableProvidersForRun('managed')
  const candidatesByNode = providerCostCandidateBindingsForMode({
    availableProviders,
    executionMode: input.body.executionMode,
    executionRuntime: 'managed',
    plan: compiled.executionPlan,
  })
  const pricing = await loadProviderPricingSnapshot({
    bindings: [...candidatesByNode.values()].flat(),
    signal: input.signal,
  })
  const routes = resolvePlanProviderCosts({
    assetsById: directGenerationCostAssets(assets),
    candidatesByNode,
    costEstimationEnabled: true,
    costRoutingEnabled: input.body.executionMode === 'live',
    plan: compiled.executionPlan,
    pricing,
  })
  return {
    costEstimate: publicRunCostEstimate({
      plannedJobCount: compiled.executionPlan.summary.plannedJobCount,
      routes,
    }),
    executionPlanHash: compiled.executionPlan.executionPlanHash,
    expectedOutputCount: compiled.executionPlan.summary.expectedOutputCount,
    plannedJobCount: compiled.executionPlan.summary.plannedJobCount,
  }
}

/** Admits one direct request into the shared immutable durable run engine. */
export async function admitDirectGeneration(input: {
  /** Validated public request facts with no provider-private data. */
  body: DirectGenerationRequest
  /** Stable caller-supplied replay identity. */
  idempotencyKey: null | string
  /** Authenticated tenant owning the request and every referenced Asset. */
  organizationId: string
  /** Authenticated creator used for private history scoping. */
  userId: string
}) {
  assertIdempotencyKey(input.idempotencyKey)
  const idempotencyKey = input.idempotencyKey
  assertRunRuntimePolicy({
    executionRuntime: input.body.executionRuntime,
    fundingSource: input.body.fundingSource,
  })
  const requestHash = hashFlowRunRequest({
    request: input.body,
    source: 'create',
  })
  const existing = await db.selectFrom('flowRuns')
    .select(['id', 'requestHash'])
    .where('organizationId', '=', input.organizationId)
    .where('idempotencyKey', '=', idempotencyKey)
    .executeTakeFirst()
  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw new HttpError(
        409,
        'idempotency_conflict',
        'Idempotency-Key was already used for a different run request.',
      )
    }
    return getRunDetail(input.organizationId, existing.id, input.userId)
  }

  const initialAssets = await loadDirectGenerationAssets({
    assetIds: requestAssetIds(input.body),
    executor: db,
    organizationId: input.organizationId,
  })
  const initial = resolveDirectGeneration({
    assetsById: initialAssets,
    request: input.body,
  })
  const executionMode = input.body.executionMode
  const executionRuntime = input.body.executionRuntime
  const fundingSource = input.body.fundingSource
  const availableProviders = availableProvidersForRun(
    executionRuntime,
    executionRuntime === 'browser' ? input.body.byokProviders : undefined,
  )
  const initialCandidates = providerCostCandidateBindingsForMode({
    availableProviders,
    executionMode,
    executionRuntime,
    plan: initial.executionPlan,
  })
  const costEstimationEnabled = fundingSource === 'credits'
  const pricing = costEstimationEnabled
    ? await loadProviderPricingSnapshot({
        bindings: [...initialCandidates.values()].flat(),
      })
    : { rates: [], version: 1 as const }

  const runId = createId()
  const newSessionId = createId()
  const createdBy = input.userId
  let admittedRunId = runId
  await db.transaction().execute(async (trx) => {
    await acquireFlowRunAdmissionLocks(
      trx,
      input.organizationId,
      idempotencyKey,
    )
    const replay = await trx.selectFrom('flowRuns')
      .select(['id', 'requestHash'])
      .where('organizationId', '=', input.organizationId)
      .where('idempotencyKey', '=', idempotencyKey)
      .executeTakeFirst()
    if (replay) {
      if (replay.requestHash !== requestHash) {
        throw new HttpError(
          409,
          'idempotency_conflict',
          'Idempotency-Key was already used for a different run request.',
        )
      }
      admittedRunId = replay.id
      return
    }
    await assertRunAdmissionCapacity({
      organizationId: input.organizationId,
      trx,
    })
    const createSessionId = await resolveCreateSessionForAdmission({
      createSessionId: input.body.createSessionId ?? null,
      createdBy,
      newSessionId,
      organizationId: input.organizationId,
      trx,
    })
    if (!createSessionId) {
      throw new HttpError(
        404,
        'not_found',
        'Create session not found.',
      )
    }

    const lockedAssets = await loadDirectGenerationAssets({
      assetIds: requestAssetIds(input.body),
      executor: trx,
      lockForUpdate: true,
      organizationId: input.organizationId,
    })
    const compiled = resolveDirectGeneration({
      assetsById: lockedAssets,
      request: input.body,
    })
    const candidatesByNode = providerCostCandidateBindingsForMode({
      availableProviders,
      executionMode,
      executionRuntime,
      plan: compiled.executionPlan,
    })
    const costRoutes = resolvePlanProviderCosts({
      assetsById: directGenerationCostAssets(lockedAssets),
      candidatesByNode,
      costEstimationEnabled,
      costRoutingEnabled: costEstimationEnabled && executionMode === 'live',
      plan: compiled.executionPlan,
      pricing,
    })
    if (costEstimationEnabled) {
      requireCompleteProviderCostEstimate(publicRunCostEstimate({
        plannedJobCount: compiled.executionPlan.summary.plannedJobCount,
        routes: costRoutes,
      }))
    }
    const contracts = generationExecutionContracts(
      compiled.executionPlan,
      executionRuntime,
      executionMode,
      availableProviders,
      resolvedGenerationExecutionBindings(costRoutes),
    )
    const artifact = createFlowRunSnapshotArtifact({
      adapterContractVersion: 'normalized-generation-v3',
      canonicalSerializerVersion: CANONICAL_SERIALIZER_VERSION,
      catalogRevision: GENERATION_CATALOG_REVISION,
      executionContracts: contracts,
      executionMode,
      executionPlan: compiled.executionPlan,
      executionRuntime,
      executorVersion: FLOW_RUN_EXECUTOR_CONTRACT_VERSION,
      snapshotVersion: FLOW_RUN_SNAPSHOT_VERSION,
      source: compiled.source,
    })
    if (artifact.bytes > FLOW_RUN_LIMITS.snapshotBytes) {
      throw new HttpError(
        422,
        'run_snapshot_bytes_limit',
        'The run snapshot is too large.',
        [{
          code: 'run_snapshot_bytes_limit',
          field: 'snapshot',
          message: 'run_snapshot_bytes_limit',
          params: { maximum: FLOW_RUN_LIMITS.snapshotBytes },
        }],
      )
    }

    await trx.insertInto('flowRuns').values({
      browserExecutorStatus: executionRuntime === 'browser' ? 'ready' : null,
      browserExecutorUpdatedAt: executionRuntime === 'browser'
        ? new Date()
        : null,
      createdBy,
      createSessionId,
      executionRuntime,
      executorVersion: FLOW_RUN_EXECUTOR_CONTRACT_VERSION,
      flowId: null,
      graphSnapshot: artifact.snapshot as unknown as JsonValue,
      id: runId,
      idempotencyKey,
      mode: 'direct',
      organizationId: input.organizationId,
      requestHash,
      retryOfRunId: null,
      snapshotHash: artifact.hash,
      snapshotVersion: FLOW_RUN_SNAPSHOT_VERSION,
      source: 'create',
      status: 'pending',
      targetNodeId: null,
    }).execute()
    await persistRunExecutionPlan({
      contracts,
      createdBy,
      executionPlan: compiled.executionPlan,
      flowId: null,
      organizationId: input.organizationId,
      routes: costRoutes,
      runId,
      trx,
    })
    await touchCreateSessionRow(
      trx,
      input.organizationId,
      createSessionId,
    )
  })

  if (admittedRunId === runId && executionRuntime === 'managed') {
    await dispatchFlowRun({
      eventPrefix: 'direct_run.admission',
      flowId: null,
      organizationId: input.organizationId,
      runId,
    })
  }
  logRunEngine('info', 'direct_run.admission.completed', {
    organizationId: input.organizationId,
    replayed: admittedRunId !== runId,
    runId: admittedRunId,
  })
  return getRunDetail(input.organizationId, admittedRunId, input.userId)
}
