/** Transactional Flow run admission, immutable snapshot persistence, and dispatch. */

import type {
  FlowRunNodeItemTable,
  FlowRunNodeTable,
  GenerationJobInputTable,
  GenerationJobSourceTable,
  GenerationJobTable,
  JsonValue,
} from '@talelabs/db'
import type {
  FlowRunSnapshotProviderCostEstimate,
  FlowRunSnapshotProviderSelection,
} from '@talelabs/flows'
import type { ProviderCostInputAsset } from '@talelabs/providers/server'
import type { Insertable } from 'kysely'

import type { RunMode } from './contracts.js'
import { createId } from '@paralleldrive/cuid2'
import { db } from '@talelabs/db'
import {
  BROWSER_EXECUTION_ENABLED,
  CANONICAL_SERIALIZER_VERSION,
  createFlowRunSnapshotArtifact,
  FLOW_RUN_LIMITS,
  FLOW_RUN_SNAPSHOT_VERSION,
  GENERATION_CATALOG_REVISION,
  GENERATION_MODEL_REGISTRY,
  hashFlowRunRequest,
} from '@talelabs/flows'
import { loadProviderPricingSnapshot } from '@talelabs/providers/server'

import { FLOW_RUN_EXECUTOR_CONTRACT_VERSION } from '@talelabs/trigger'
import { acquireFlowRunAdmissionLocks } from '../../data/flow-run-admission.data.js'
import { localUserIdOrNull } from '../../data/flow-run-planning.data.js'
import { insertRunExecutionRows } from '../../data/run-persistence.data.js'
import { HttpError, TenantResourceNotFoundError } from '../../middleware/error.js'
import {
  assetReferencesFromValue,
  collectPlanPreExistingAssetIds,
} from './asset-prerequisites.js'
import { commandFromAdmissionBody } from './contracts.js'
import { dispatchFlowRun } from './dispatch.service.js'
import { generationExecutionContracts } from './generation-execution-contracts.js'
import { jsonb } from './jsonb.js'
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
  if (executionRuntime === 'browser' && !BROWSER_EXECUTION_ENABLED)
    throw new HttpError(409, 'invalid_execution_runtime', 'Browser execution is unavailable.')
  if (
    (fundingSource === 'credits' && executionRuntime !== 'managed')
    || (fundingSource === 'byok' && executionRuntime !== 'browser')
  ) {
    throw new HttpError(
      409,
      'invalid_execution_runtime',
      'The selected funding source is unavailable for this execution runtime.',
    )
  }
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
    return getRunDetail(input.organizationId, existing.id)
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

  const availableProviders = availableProvidersForRun(
    executionRuntime,
    executionRuntime === 'browser' ? input.body.byokProviders : undefined,
  )
  const candidatesByNode = providerCostCandidateBindingsForMode({
    availableProviders,
    executionMode,
    executionRuntime,
    plan,
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

    const activeRunCount = await trx.selectFrom('flowRuns')
      .select(eb => eb.fn.countAll<number>().as('count'))
      .where('organizationId', '=', input.organizationId)
      .where('status', 'in', ['pending', 'running'])
      .executeTakeFirst()
    if (Number(activeRunCount?.count ?? 0) >= FLOW_RUN_LIMITS.organizationActiveRuns) {
      throw new HttpError(
        429,
        'organization_run_capacity_exceeded',
        'This organization has too many active Flow runs.',
        [{
          code: 'organization_run_capacity_exceeded',
          field: 'organizationId',
          message: 'organization_run_capacity_exceeded',
          params: { maximum: FLOW_RUN_LIMITS.organizationActiveRuns },
        }],
      )
    }

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
      plan,
      pricing,
    })
    if (costEstimationEnabled) {
      requireCompleteProviderCostEstimate(publicRunCostEstimate({
        plannedJobCount: plan.summary.plannedJobCount,
        routes: costRoutes,
      }))
    }
    const resolvedBindings = new Map([...costRoutes].map(([nodeId, route]) => {
      const providerCostEstimate: FlowRunSnapshotProviderCostEstimate | undefined
        = route.estimate.status === 'estimated'
          ? {
              ...route.estimate,
              jobCount: route.jobEstimates.size,
              quoteVersion: 1,
            }
          : undefined
      const providerSelection: FlowRunSnapshotProviderSelection = route.selection
      return [nodeId, {
        binding: route.binding,
        ...(providerCostEstimate ? { providerCostEstimate } : {}),
        providerSelection,
      }] as const
    }))
    const contracts = generationExecutionContracts(
      plan,
      executionRuntime,
      executionMode,
      availableProviders,
      resolvedBindings,
    )
    const contractsByNode = new Map(contracts.map(contract => [contract.nodeId, contract]))
    const artifact = createFlowRunSnapshotArtifact({
      adapterContractVersion: 'normalized-generation-v3',
      canonicalSerializerVersion: CANONICAL_SERIALIZER_VERSION,
      catalogRevision: GENERATION_CATALOG_REVISION,
      executionContracts: contracts,
      executionMode,
      executionRuntime,
      executorVersion: FLOW_RUN_EXECUTOR_CONTRACT_VERSION,
      plan,
      plannerVersion: plan.plannerVersion,
      snapshotVersion: FLOW_RUN_SNAPSHOT_VERSION,
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
      status: 'pending',
      targetNodeId: input.body.targetNodeId ?? null,
    }).execute()

    const nodeRows: Insertable<FlowRunNodeTable>[] = []
    const itemRows: Insertable<FlowRunNodeItemTable>[] = []
    const jobRows: Insertable<GenerationJobTable>[] = []
    const sourceRows: Insertable<GenerationJobSourceTable>[] = []
    const inputRows: Insertable<GenerationJobInputTable>[] = []
    for (const node of plan.executionNodes) {
      const model = GENERATION_MODEL_REGISTRY[node.modelId]
      const executionContract = contractsByNode.get(node.nodeId)!
      nodeRows.push({
        flowRunId: runId,
        nodeId: node.nodeId,
        organizationId: input.organizationId,
        status: 'pending',
      })
      for (const item of node.workItems) {
        itemRows.push({
          dimensions: jsonb(item.dimensions as JsonValue),
          flowRunId: runId,
          itemKey: item.itemKey,
          lineage: jsonb(item.lineage as unknown as JsonValue),
          nodeId: node.nodeId,
          organizationId: input.organizationId,
          sortOrder: item.sortOrder,
          status: 'pending',
        })
        for (const shard of item.requestShards) {
          const jobId = createId()
          jobRows.push({
            adapterVersion: executionContract.adapterVersion,
            createdBy,
            flowId: input.body.flowId,
            flowRunId: runId,
            id: jobId,
            idempotencyKey: `${runId}:${node.nodeId}:${item.itemKey}:${shard.requestIndex}`,
            itemKey: item.itemKey,
            mediaType: (model?.mediaType ?? 'image') as any,
            model: node.modelId,
            catalogRevision: GENERATION_CATALOG_REVISION,
            nodeId: node.nodeId,
            operation: node.operationId,
            organizationId: input.organizationId,
            provider: executionContract.provider,
            providerCostEstimate: (() => {
              const estimate = costRoutes.get(node.nodeId)?.jobEstimates.get(shard.jobHash)
              return estimate?.status === 'estimated'
                ? jsonb({ ...estimate, quoteVersion: 1 } as unknown as JsonValue)
                : null
            })(),
            providerEndpoint: executionContract.providerEndpoint,
            providerEndpointTag: executionContract.providerEndpointTag,
            providerLifecycle: executionContract.providerLifecycle as unknown as JsonValue,
            providerModel: executionContract.providerModel,
            providerRouteVersion: executionContract.providerRouteVersion,
            requestHash: shard.jobHash,
            requestIndex: shard.requestIndex,
            requestPayload: shard.requestPayload as unknown as JsonValue,
            resolvedPrompt: shard.requestPayload.inline.prompt ?? null,
            settings: node.settings as JsonValue,
            status: 'pending',
          })
          let sourceOrder = 0
          let inputOrder = 0
          const insertedInputs = new Set<string>()
          for (const plannedInput of shard.requestPayload.inputs) {
            for (const runtimeItem of plannedInput.items) {
              const sourceId = createId()
              const assetRefs = assetReferencesFromValue(runtimeItem.value)
              sourceRows.push({
                assetId: assetRefs[0]?.assetId ?? null,
                elementId: null,
                id: sourceId,
                jobId,
                nodeId: plannedInput.sourceNodeId,
                organizationId: input.organizationId,
                resolvedText: (runtimeItem.value as any).text ?? null,
                snapshot: runtimeItem as unknown as JsonValue,
                sortOrder: sourceOrder,
                sourceType: assetRefs.length > 0
                  ? (assetRefs[0] as any).source === 'priorOutput'
                      ? 'nodeOutput'
                      : 'asset'
                  : (runtimeItem.value as any).origin?.generationJobId
                      ? 'nodeOutput'
                      : 'text',
              })
              for (const assetRef of assetRefs) {
                const role = plannedInput.targetHandleId || 'reference'
                const inputKey = `${assetRef.assetId}\u0000${role}`
                if (insertedInputs.has(inputKey))
                  continue
                insertedInputs.add(inputKey)
                inputRows.push({
                  assetId: assetRef.assetId,
                  jobId,
                  organizationId: input.organizationId,
                  role,
                  sortOrder: inputOrder,
                  sourceId,
                })
                inputOrder += 1
              }
              sourceOrder += 1
            }
          }
        }
      }
    }
    await insertRunExecutionRows({
      inputs: inputRows,
      items: itemRows,
      jobs: jobRows,
      nodes: nodeRows,
      sources: sourceRows,
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
  return getRunDetail(input.organizationId, admittedRunId)
}
