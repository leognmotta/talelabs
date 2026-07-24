/**
 * Admission-time resolution of immutable generation execution bindings.
 *
 * New workers execute the captured provider binding directly and never query
 * mutable current catalog state during retries.
 *
 */

import type {
  ExecutionPlan,
  FlowRunSnapshotExecutionContract,
  FlowRunSnapshotProviderCostEstimate,
  FlowRunSnapshotProviderSelection,
} from '@talelabs/flows'
import type {
  CatalogProviderBinding,
  CatalogProviderId,
} from '@talelabs/models-catalog'
import type { ProviderCostNodeRouting } from './provider-cost-routing.js'

import {
  getCatalogModel,
  getCatalogProviderBinding,
  MODEL_CATALOG,
  selectProviderBinding,
} from '@talelabs/models-catalog'
import { flowRunPlanValidationError } from './planning-error.js'

interface GenerationExecutionContractPlan {
  steps: readonly Pick<
    ExecutionPlan['steps'][number],
    | 'catalogRevision'
    | 'catalogVersion'
    | 'modelContractVersion'
    | 'modelId'
    | 'modelRevision'
    | 'operationId'
    | 'stepId'
  >[]
}

interface LegacyGenerationExecutionContractPlan {
  executionNodes: readonly {
    catalogRevision: string
    catalogVersion: number
    modelContractVersion: string
    modelId: string
    modelRevision: number
    nodeId: string
    operationId: string
  }[]
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

/** Projects generic cost-routing decisions into snapshot execution bindings. */
export function resolvedGenerationExecutionBindings(
  routes: ReadonlyMap<string, ProviderCostNodeRouting>,
): Map<string, ResolvedGenerationExecutionBinding> {
  return new Map([...routes].map(([stepId, route]) => {
    const providerCostEstimate: FlowRunSnapshotProviderCostEstimate | undefined
      = route.estimate.status === 'estimated'
        ? {
            ...route.estimate,
            jobCount: route.jobEstimates.size,
            quoteVersion: 1,
          }
        : undefined
    const providerSelection: FlowRunSnapshotProviderSelection = route.selection
    return [stepId, {
      binding: route.binding,
      ...(providerCostEstimate ? { providerCostEstimate } : {}),
      providerSelection,
    }] as const
  }))
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
  plan: GenerationExecutionContractPlan | LegacyGenerationExecutionContractPlan,
  executionRuntime: 'browser' | 'managed' = 'managed',
  executionMode: 'debug' | 'live' = 'live',
  availableProviders: ReadonlySet<CatalogProviderId> = new Set(),
  resolvedBindings: ReadonlyMap<string, ResolvedGenerationExecutionBinding> = new Map(),
): FlowRunSnapshotExecutionContract[] {
  const steps = 'steps' in plan
    ? plan.steps
    : plan.executionNodes.map(node => ({ ...node, stepId: node.nodeId }))
  return steps.map((step) => {
    const model = getCatalogModel(step.modelId)
    const resolved = resolvedBindings.get(step.stepId)
    const binding = resolved?.binding ?? (
      executionMode === 'live'
        ? selectProviderBinding({
            availableProviders,
            executionRuntime,
            modelId: step.modelId,
            operationId: step.operationId,
          })
        : getCatalogProviderBinding(step.modelId, step.operationId)
    )
    if (
      !model
      || !binding
      || binding.operationId !== step.operationId
      || step.catalogRevision !== MODEL_CATALOG.catalogRevision
      || step.catalogVersion !== MODEL_CATALOG.catalogVersion
      || step.modelRevision !== model.revision
    ) {
      throw flowRunPlanValidationError([{
        code: 'generation_provider_route_unavailable',
        field: `steps.${step.stepId}.modelId`,
      }])
    }
    return {
      adapterVersion: binding.adapterVersion,
      catalogRevision: step.catalogRevision,
      catalogVersion: step.catalogVersion,
      modelContractVersion: step.modelContractVersion,
      modelId: step.modelId,
      modelRevision: step.modelRevision,
      operationId: step.operationId,
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
      stepId: step.stepId,
      ...(resolved?.providerSelection
        ? { providerSelection: resolved.providerSelection }
        : {}),
    }
  })
}
