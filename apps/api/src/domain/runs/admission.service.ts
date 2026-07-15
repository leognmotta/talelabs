import type {
  FlowRunNodeItemTable,
  FlowRunNodeTable,
  GenerationJobInputTable,
  GenerationJobSourceTable,
  GenerationJobTable,
  JsonValue,
} from '@talelabs/db'
import type { Insertable } from 'kysely'

import type { RunMode } from './contracts.js'
import { createId } from '@paralleldrive/cuid2'
import { db } from '@talelabs/db'
import {
  CANONICAL_SERIALIZER_VERSION,
  createFlowRunSnapshotArtifact,
  FLOW_RUN_LIMITS,
  FLOW_RUN_SNAPSHOT_VERSION,
  GENERATION_MODEL_REGISTRY,
  GENERATION_REGISTRY_VERSION,
  hashFlowRunRequest,
} from '@talelabs/flows'

import { FLOW_RUN_EXECUTOR_CONTRACT_VERSION } from '@talelabs/trigger'
import { acquireFlowRunAdmissionLocks } from '../../data/flow-run-admission.data.js'
import { localUserIdOrNull } from '../../data/flow-run-planning.data.js'
import { insertRunExecutionRows } from '../../data/run-persistence.data.js'
import { HttpError, TenantResourceNotFoundError } from '../../middleware/error.js'
import { commandFromAdmissionBody } from './contracts.js'
import { dispatchFlowRun } from './dispatch.service.js'
import {
  assetReferencesFromValue,
  collectPlanPreExistingAssetIds,
  jsonb,
} from './helpers.js'
import { logRunEngine } from './logging.js'
import {
  executionContracts,
  loadFlowRunPlan,
  MOCK_ADAPTER_VERSION,
  MOCK_PROVIDER,
} from './planning.service.js'
import { getRunDetail } from './read.service.js'

export async function admitFlowRun(input: {
  body: {
    expectedFlowRevision: number
    expectedPlanHash?: string
    flowId: string
    mode: RunMode
    selectedNodeIds?: string[]
    targetNodeId?: string
  }
  idempotencyKey: string | null
  organizationId: string
  userId: string
}) {
  if (!input.idempotencyKey)
    throw new HttpError(400, 'idempotency_key_required', 'Idempotency-Key is required.')

  const requestHash = hashFlowRunRequest(input.body)
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

  const contracts = executionContracts(plan)
  const contractsByNode = new Map(contracts.map(contract => [contract.nodeId, contract]))
  const artifact = createFlowRunSnapshotArtifact({
    adapterContractVersion: 'normalized-generation-v1',
    canonicalSerializerVersion: CANONICAL_SERIALIZER_VERSION,
    executionContracts: contracts,
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
    if (plannedAssetIds.length) {
      const lockedAssets = await trx.selectFrom('assets')
        .select(['deletedAt', 'id', 'processingState', 'purgeRequestedAt', 'purgedAt'])
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

    await trx.insertInto('flowRuns').values({
      createdBy,
      executorVersion: FLOW_RUN_EXECUTOR_CONTRACT_VERSION,
      flowId: input.body.flowId,
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
            adapterVersion: MOCK_ADAPTER_VERSION,
            createdBy,
            flowId: input.body.flowId,
            flowRunId: runId,
            id: jobId,
            idempotencyKey: `${runId}:${node.nodeId}:${item.itemKey}:${shard.requestIndex}`,
            itemKey: item.itemKey,
            mediaType: (model?.mediaType ?? 'image') as any,
            model: node.modelId,
            modelRegistryVersion: GENERATION_REGISTRY_VERSION,
            nodeId: node.nodeId,
            operation: node.operationId,
            organizationId: input.organizationId,
            provider: MOCK_PROVIDER,
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

  if (admittedRunId === runId) {
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
