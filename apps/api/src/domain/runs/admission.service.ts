/** Transactional Flow run admission, immutable snapshot persistence, and dispatch. */

import type { JsonValue } from '@talelabs/db'
import type { ProviderCostInputAsset } from '@talelabs/providers/server'

import type { RunMode } from './contracts.js'
import { createId } from '@paralleldrive/cuid2'
import { db } from '@talelabs/db'
import {
  CANONICAL_SERIALIZER_VERSION,
  createFlowRunSnapshotArtifact,
  executionPlanFromFlowRunPlan,
  FLOW_RUN_LIMITS,
  FLOW_RUN_SNAPSHOT_VERSION,
  flowRunSourceFromPlan,
  GENERATION_CATALOG_REVISION,
  hashFlowRunRequest,
} from '@talelabs/flows'
import { loadProviderPricingSnapshot } from '@talelabs/providers/server'

import { FLOW_RUN_EXECUTOR_CONTRACT_VERSION } from '@talelabs/trigger'
import { acquireFlowRunAdmissionLocks } from '../../data/flow-run-admission.data.js'
import { localUserIdOrNull } from '../../data/flow-run-planning.data.js'
import { HttpError, TenantResourceNotFoundError } from '../../middleware/error.js'
import {
  assertRunAdmissionCapacity,
  assertRunRuntimePolicy,
} from './admission-policy.js'
import { collectPlanPreExistingAssetIds } from './asset-prerequisites.js'
import { commandFromAdmissionBody } from './contracts.js'
import { dispatchFlowRun } from './dispatch.service.js'
import { persistRunExecutionPlan } from './execution-persistence.js'
import {
  generationExecutionContracts,
  resolvedGenerationExecutionBindings,
} from './generation-execution-contracts.js'
import { logRunEngine } from './logging.js'
import { loadFlowRunPlan } from './planning.service.js'
import { availableProvidersForRun } from './provider-availability.js'
import { requireCompleteProviderCostEstimate } from './provider-cost-admission.js'
import {
  providerCostCandidateBindingsForMode,
  publicRunCostEstimate,
  resolvePlanProviderCosts,
} from './provider-cost.service.js'
import { getRunDetail } from './read.service.js'

/** Admits and persists one tenant-scoped immutable Flow run transactionally. */
export async function admitFlowRun(input: {
  body: {
    byokProviders?: ('fal' | 'openrouter')[]
    executionMode?: 'debug' | 'live'
    executionRuntime?: 'browser' | 'managed'
    expectedFlowRevision: number
    expectedPlanHash?: string
    flowId: string
    fundingSource: 'byok' | 'credits'
    mode: RunMode
    selectedNodeIds?: string[]
    targetNodeId?: string
  }
  idempotencyKey: string | null
  organizationId: string
  userId: string
}) {
  const executionMode = input.body.executionMode ?? 'live'
  const executionRuntime = input.body.executionRuntime ?? 'managed'
  const fundingSource = input.body.fundingSource
  assertRunRuntimePolicy({ executionRuntime, fundingSource })
  if (!input.idempotencyKey)
    throw new HttpError(400, 'idempotency_key_required', 'Idempotency-Key is required.')

  const requestHash = hashFlowRunRequest({
    ...input.body,
    executionMode,
    executionRuntime,
  })
  const existing = await db.selectFrom('flowRuns')
    .select(['id', 'requestHash'])
    .where('organizationId', '=', input.organizationId)
    .where('idempotencyKey', '=', input.idempotencyKey)
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

  const command = commandFromAdmissionBody(input.body)
  const plan = await loadFlowRunPlan({
    command,
    flowId: input.body.flowId,
    organizationId: input.organizationId,
  })
  if (input.body.expectedPlanHash && input.body.expectedPlanHash !== plan.planHash) {
    throw new HttpError(
      409,
      'run_plan_changed',
      'The saved Flow plan changed before admission.',
    )
  }
  const executionPlan = executionPlanFromFlowRunPlan(plan)

  const availableProviders = availableProvidersForRun(
    executionRuntime,
    executionRuntime === 'browser' ? input.body.byokProviders : undefined,
  )
  const candidatesByNode = providerCostCandidateBindingsForMode({
    availableProviders,
    executionMode,
    executionRuntime,
    plan: executionPlan,
  })
  const costEstimationEnabled = fundingSource === 'credits'
  const pricing = costEstimationEnabled
    ? await loadProviderPricingSnapshot({
        bindings: [...candidatesByNode.values()].flat(),
      })
    : { rates: [], version: 1 as const }

  const runId = createId()
  const createdBy = await localUserIdOrNull(input.userId)
  let admittedRunId = runId
  await db.transaction().execute(async (trx) => {
    await acquireFlowRunAdmissionLocks(
      trx,
      input.organizationId,
      input.idempotencyKey!,
    )
    const replay = await trx.selectFrom('flowRuns')
      .select(['id', 'requestHash'])
      .where('organizationId', '=', input.organizationId)
      .where('idempotencyKey', '=', input.idempotencyKey!)
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

    await assertRunAdmissionCapacity({ organizationId: input.organizationId, trx })

    const current = await trx.selectFrom('flows')
      .select('revision')
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.body.flowId)
      .forUpdate()
      .executeTakeFirst()
    if (!current)
      throw new TenantResourceNotFoundError()
    if (Number(current.revision) !== input.body.expectedFlowRevision) {
      throw new HttpError(
        409,
        'flow_revision_changed',
        'The Flow changed before this run could be admitted.',
      )
    }

    const plannedAssetIds = collectPlanPreExistingAssetIds(plan)
    const assetsById = new Map<string, ProviderCostInputAsset>()
    if (plannedAssetIds.length) {
      const lockedAssets = await trx.selectFrom('assets')
        .select([
          'deletedAt',
          'durationSeconds',
          'height',
          'id',
          'processingState',
          'purgeRequestedAt',
          'purgedAt',
          'type',
          'width',
        ])
        .where('organizationId', '=', input.organizationId)
        .where('id', 'in', plannedAssetIds)
        .forUpdate()
        .execute()
      const usableIds = new Set(lockedAssets
        .filter(asset => asset.processingState === 'ready'
          && !asset.deletedAt
          && !asset.purgeRequestedAt
          && !asset.purgedAt)
        .map(asset => asset.id))
      const unusableId = plannedAssetIds.find(assetId => !usableIds.has(assetId))
      if (unusableId) {
        throw new HttpError(
          409,
          'invalid_state',
          'A selected Asset is not ready for generation.',
          [{
            code: 'asset_not_usable',
            field: `assets.${unusableId}`,
            message: 'asset_not_usable',
          }],
        )
      }
      for (const asset of lockedAssets) {
        if (asset.type === 'document')
          continue
        assetsById.set(asset.id, {
          assetId: asset.id,
          durationSeconds: asset.durationSeconds,
          height: asset.height,
          mediaType: asset.type,
          width: asset.width,
        })
      }
    }

    const finalFlow = await trx.selectFrom('flows')
      .select('revision')
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.body.flowId)
      .executeTakeFirst()
    if (!finalFlow || Number(finalFlow.revision) !== input.body.expectedFlowRevision) {
      throw new HttpError(
        409,
        'flow_revision_changed',
        'The Flow changed before this run could be admitted.',
      )
    }

    const costRoutes = resolvePlanProviderCosts({
      assetsById,
      candidatesByNode,
      costEstimationEnabled,
      costRoutingEnabled: costEstimationEnabled && executionMode === 'live',
      plan: executionPlan,
      pricing,
    })
    if (costEstimationEnabled) {
      requireCompleteProviderCostEstimate(publicRunCostEstimate({
        plannedJobCount: executionPlan.summary.plannedJobCount,
        routes: costRoutes,
      }))
    }
    const resolvedBindings = resolvedGenerationExecutionBindings(costRoutes)
    const contracts = generationExecutionContracts(
      executionPlan,
      executionRuntime,
      executionMode,
      availableProviders,
      resolvedBindings,
    )
    const artifact = createFlowRunSnapshotArtifact({
      adapterContractVersion: 'normalized-generation-v3',
      canonicalSerializerVersion: CANONICAL_SERIALIZER_VERSION,
      catalogRevision: GENERATION_CATALOG_REVISION,
      executionContracts: contracts,
      executionMode,
      executionRuntime,
      executorVersion: FLOW_RUN_EXECUTOR_CONTRACT_VERSION,
      executionPlan,
      snapshotVersion: FLOW_RUN_SNAPSHOT_VERSION,
      source: flowRunSourceFromPlan(plan),
    })
    if (artifact.bytes > FLOW_RUN_LIMITS.snapshotBytes) {
      throw new HttpError(
        422,
        'run_snapshot_bytes_limit',
        'The Flow run snapshot is too large.',
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
      browserExecutorUpdatedAt: executionRuntime === 'browser' ? new Date() : null,
      createdBy,
      executorVersion: FLOW_RUN_EXECUTOR_CONTRACT_VERSION,
      flowId: input.body.flowId,
      executionRuntime,
      graphSnapshot: artifact.snapshot as unknown as JsonValue,
      id: runId,
      idempotencyKey: input.idempotencyKey!,
      mode: input.body.mode,
      organizationId: input.organizationId,
      requestHash,
      retryOfRunId: null,
      snapshotHash: artifact.hash,
      snapshotVersion: FLOW_RUN_SNAPSHOT_VERSION,
      source: 'flow',
      status: 'pending',
      targetNodeId: input.body.targetNodeId ?? null,
    }).execute()

    await persistRunExecutionPlan({
      contracts,
      createdBy,
      executionPlan,
      flowId: input.body.flowId,
      organizationId: input.organizationId,
      routes: costRoutes,
      runId,
      trx,
    })
  })

  if (admittedRunId === runId && executionRuntime === 'managed') {
    await dispatchFlowRun({
      eventPrefix: 'flow_run.admission',
      flowId: input.body.flowId,
      organizationId: input.organizationId,
      runId,
    })
  }
  logRunEngine('info', 'flow_run.admission.completed', {
    flowId: input.body.flowId,
    organizationId: input.organizationId,
    replayed: admittedRunId !== runId,
    runId: admittedRunId,
  })
  return getRunDetail(input.organizationId, admittedRunId, input.userId)
}
