/**
 * Admission-time resolution of immutable generation execution bindings.
 *
 * New workers execute the captured provider binding directly and never query
 * mutable current catalog state during retries.
 *
 */

import type {
  FlowRunPlan,
  FlowRunSnapshotExecutionContract,
  FlowRunSnapshotProviderCostEstimate,
  FlowRunSnapshotProviderSelection,
} from '@talelabs/flows'
import type {
  CatalogProviderBinding,
  CatalogProviderId,
} from '@talelabs/models-catalog'

import {
  getCatalogModel,
  getCatalogProviderBinding,
  MODEL_CATALOG,
  selectProviderBinding,
} from '@talelabs/models-catalog'
import { flowRunPlanValidationError } from './planning-error.js'

interface GenerationExecutionContractPlan {
  executionNodes: readonly Pick<
    FlowRunPlan['executionNodes'][number],
    | 'catalogRevision'
    | 'catalogVersion'
    | 'modelContractVersion'
    | 'modelId'
    | 'modelRevision'
    | 'nodeId'
    | 'operationId'
  >[]
}

/** Admission-resolved binding and optional immutable cost-routing evidence. */
export interface ResolvedGenerationExecutionBinding {
  /** Exact eligible binding selected for this node. */
  binding: CatalogProviderBinding
  /** Complete deterministic aggregate quote, when available. */
  providerCostEstimate?: FlowRunSnapshotProviderCostEstimate
  /** Private policy explanation for the selected binding. */
  providerSelection?: FlowRunSnapshotProviderSelection
}

/**
 * Resolves one exact private binding for every planned executable node.
 *
 * Live runs select the preferred binding whose provider both supports the
 * requested runtime and has a usable credential in this run's mode; debug runs
 * keep the highest-priority binding because the deterministic mock adapter runs
 * regardless of provider or runtime.
 *
 * @param plan - Provider-neutral plan produced from the locked Flow revision.
 * @param executionRuntime - Where the authenticated request is sent from.
 * @param executionMode - Whether this admits a live or deterministic debug run.
 * @param availableProviders - Providers usable for this run mode; required for
 *   live admission and ignored for debug.
 * @param resolvedBindings - Optional admission-resolved routes keyed by node ID.
 * @returns Self-contained execution contracts ready for snapshot persistence.
 * @throws When a model revision or provider route cannot resolve exactly.
 */
export function generationExecutionContracts(
  plan: GenerationExecutionContractPlan,
  executionRuntime: 'browser' | 'managed' = 'managed',
  executionMode: 'debug' | 'live' = 'live',
  availableProviders: ReadonlySet<CatalogProviderId> = new Set(),
  resolvedBindings: ReadonlyMap<string, ResolvedGenerationExecutionBinding> = new Map(),
): FlowRunSnapshotExecutionContract[] {
  return plan.executionNodes.map((node) => {
    const model = getCatalogModel(node.modelId)
    const resolved = resolvedBindings.get(node.nodeId)
    const binding = resolved?.binding ?? (
      executionMode === 'live'
        ? selectProviderBinding({
            availableProviders,
            executionRuntime,
            modelId: node.modelId,
            operationId: node.operationId,
          })
        : getCatalogProviderBinding(node.modelId, node.operationId)
    )
    if (
      !model
      || !binding
      || binding.operationId !== node.operationId
      || node.catalogRevision !== MODEL_CATALOG.catalogRevision
      || node.catalogVersion !== MODEL_CATALOG.catalogVersion
      || node.modelRevision !== model.revision
    ) {
      throw flowRunPlanValidationError([{
        code: 'generation_provider_route_unavailable',
        field: `nodes.${node.nodeId}.modelId`,
      }])
    }
    return {
      adapterVersion: binding.adapterVersion,
      catalogRevision: node.catalogRevision,
      catalogVersion: node.catalogVersion,
      modelContractVersion: node.modelContractVersion,
      modelId: node.modelId,
      modelRevision: node.modelRevision,
      nodeId: node.nodeId,
      operationId: node.operationId,
      provider: binding.provider,
      ...(resolved?.providerCostEstimate
        ? { providerCostEstimate: resolved.providerCostEstimate }
        : {}),
      providerBinding: binding,
      providerEndpoint: binding.endpoint,
      providerEndpointTag: binding.providerTag,
      providerLifecycle: binding.lifecycle,
      providerModel: binding.nativeModelId,
      providerRouteVersion: binding.routeVersion,
      ...(resolved?.providerSelection
        ? { providerSelection: resolved.providerSelection }
        : {}),
    }
  })
}
