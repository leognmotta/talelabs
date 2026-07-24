/**
 * Generic durable persistence for one admitted immutable execution plan.
 *
 * Both Flow and direct Create admission use the same relational run-step,
 * item, generation-job, source, and input projection.
 */

import type {
  Database,
  FlowRunNodeItemTable,
  FlowRunNodeTable,
  GenerationJobInputTable,
  GenerationJobSourceTable,
  GenerationJobTable,
  JsonValue,
  Transaction,
} from '@talelabs/db'
import type {
  ExecutionPlan,
  FlowRunSnapshotExecutionContract,
  PlannedJobRequestPayload,
} from '@talelabs/flows'
import type { Insertable } from 'kysely'
import type { ProviderCostNodeRouting } from './provider-cost-routing.js'

import { createId } from '@paralleldrive/cuid2'
import {
  GENERATION_MODEL_REGISTRY,
  generationJobInputBindingId,
  generationJobInputSourceId,
  generationJobInputTargetSlotId,
  promptTemplateResolvedText,
  selectedProviderRequestInputs,
} from '@talelabs/flows'

import { insertRunExecutionRows } from '../../data/run-persistence.data.js'
import { assetReferencesFromValue } from './asset-prerequisites.js'
import { jsonb } from './jsonb.js'

function initialResolvedPrompt(payload: PlannedJobRequestPayload): null | string {
  const connected = payload.inputs.flatMap(input => (
    generationJobInputTargetSlotId(input) === 'prompt'
      ? input.items.flatMap(item => (
          item.value.kind === 'text' ? [item.value.text] : []
        ))
      : []
  ))
  if (connected.length > 0)
    return connected.includes(null) ? null : connected.join('\n')
  return payload.promptTemplates?.prompt
    ? promptTemplateResolvedText(payload.promptTemplates.prompt)
    : payload.inline.prompt ?? null
}

/** Persists generic execution rows without inspecting the run's source kind. */
export async function persistRunExecutionPlan(input: {
  /** Contracts resolved once at admission and keyed by execution-step ID. */
  contracts: readonly FlowRunSnapshotExecutionContract[]
  /** Persisted user identity, or null for an unmapped authenticated principal. */
  createdBy: null | string
  /** Generic immutable plan compiled from either supported source. */
  executionPlan: ExecutionPlan
  /** Saved Flow identity for Flow runs; always null for direct Create runs. */
  flowId: null | string
  /** Tenant owning every inserted row. */
  organizationId: string
  /** Per-step route and per-job quote evidence. */
  routes: ReadonlyMap<string, ProviderCostNodeRouting>
  /** Durable run identity owning all inserted execution rows. */
  runId: string
  /** Transaction holding admission locks and immutable input locks. */
  trx: Transaction<Database>
}) {
  const contractsByStep = new Map(input.contracts.map(contract => [
    contract.stepId,
    contract,
  ]))
  const nodeRows: Insertable<FlowRunNodeTable>[] = []
  const itemRows: Insertable<FlowRunNodeItemTable>[] = []
  const jobRows: Insertable<GenerationJobTable>[] = []
  const sourceRows: Insertable<GenerationJobSourceTable>[] = []
  const inputRows: Insertable<GenerationJobInputTable>[] = []

  for (const step of input.executionPlan.steps) {
    const model = GENERATION_MODEL_REGISTRY[step.modelId]
    const contract = contractsByStep.get(step.stepId)
    if (!contract)
      throw new TypeError('execution_contract_missing')
    nodeRows.push({
      flowRunId: input.runId,
      nodeId: step.stepId,
      organizationId: input.organizationId,
      status: 'pending',
    })
    for (const item of step.workItems) {
      itemRows.push({
        dimensions: jsonb(item.dimensions as JsonValue),
        flowRunId: input.runId,
        itemKey: item.itemKey,
        lineage: jsonb(item.lineage as unknown as JsonValue),
        nodeId: step.stepId,
        organizationId: input.organizationId,
        sortOrder: item.sortOrder,
        status: 'pending',
      })
      for (const shard of item.requestShards) {
        const jobId = createId()
        jobRows.push({
          adapterVersion: contract.adapterVersion,
          catalogRevision: step.catalogRevision,
          createdBy: input.createdBy,
          flowId: input.flowId,
          flowRunId: input.runId,
          id: jobId,
          idempotencyKey:
            `${input.runId}:${step.stepId}:${item.itemKey}:${shard.requestIndex}`,
          itemKey: item.itemKey,
          mediaType: (model?.mediaType ?? 'image') as
          | 'audio'
          | 'image'
          | 'text'
          | 'video',
          model: step.modelId,
          nodeId: step.stepId,
          operation: step.operationId,
          organizationId: input.organizationId,
          provider: contract.provider,
          providerCostEstimate: (() => {
            const estimate = input.routes
              .get(step.stepId)
              ?.jobEstimates
              .get(shard.jobHash)
            return estimate?.status === 'estimated'
              ? jsonb({ ...estimate, quoteVersion: 1 } as unknown as JsonValue)
              : null
          })(),
          providerEndpoint: contract.providerEndpoint,
          providerEndpointTag: contract.providerEndpointTag,
          providerLifecycle: contract.providerLifecycle as unknown as JsonValue,
          providerModel: contract.providerModel,
          providerRouteVersion: contract.providerRouteVersion,
          requestHash: shard.jobHash,
          requestIndex: shard.requestIndex,
          requestPayload: shard.requestPayload as unknown as JsonValue,
          resolvedPrompt: initialResolvedPrompt(shard.requestPayload),
          settings: step.settings as JsonValue,
          status: 'pending',
        })
        let sourceOrder = 0
        let inputOrder = 0
        const sourceIdByAssetLocation = new Map<string, string>()
        for (const plannedInput of shard.requestPayload.inputs) {
          const bindingId = generationJobInputBindingId(plannedInput)
          for (const runtimeItem of plannedInput.items) {
            const sourceId = createId()
            const assetRefs = assetReferencesFromValue(runtimeItem.value)
            sourceRows.push({
              assetId: assetRefs[0]?.assetId ?? null,
              elementId: null,
              id: sourceId,
              jobId,
              nodeId: generationJobInputSourceId(plannedInput),
              organizationId: input.organizationId,
              resolvedText: runtimeItem.value.kind === 'text'
                ? runtimeItem.value.text
                : null,
              snapshot: runtimeItem as unknown as JsonValue,
              sortOrder: sourceOrder,
              sourceType: assetRefs.length > 0
                ? assetRefs[0]?.source === 'priorOutput'
                  ? 'nodeOutput'
                  : 'asset'
                : runtimeItem.value.kind === 'text'
                  && (
                    runtimeItem.value.origin.source === 'priorOutput'
                    || runtimeItem.value.origin.source === 'sameRunOutput'
                  )
                  ? 'nodeOutput'
                  : 'text',
            })
            for (const assetRef of assetRefs) {
              sourceIdByAssetLocation.set(
                `${bindingId}\u0000${runtimeItem.key}\u0000${assetRef.assetId}`,
                sourceId,
              )
            }
            sourceOrder += 1
          }
        }
        for (const plannedInput of selectedProviderRequestInputs(
          shard.requestPayload,
        )) {
          const bindingId = generationJobInputBindingId(plannedInput)
          const role = generationJobInputTargetSlotId(plannedInput)
            || 'reference'
          for (const runtimeItem of plannedInput.items) {
            for (const assetRef of assetReferencesFromValue(runtimeItem.value)) {
              inputRows.push({
                assetId: assetRef.assetId,
                jobId,
                organizationId: input.organizationId,
                role,
                sortOrder: inputOrder,
                sourceId: sourceIdByAssetLocation.get(
                  `${bindingId}\u0000${runtimeItem.key}\u0000${assetRef.assetId}`,
                ) ?? null,
              })
              inputOrder += 1
            }
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
    trx: input.trx,
  })
}
