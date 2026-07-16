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
} from '@talelabs/flows'

import {
  getCatalogModel,
  getCatalogProviderBinding,
  MODEL_CATALOG,
} from '@talelabs/models-catalog'
import { flowRunPlanValidationError } from './planning-error.js'

/**
 * Resolves one exact private binding for every planned executable node.
 *
 * @param plan - Provider-neutral plan produced from the locked Flow revision.
 * @returns Self-contained execution contracts ready for snapshot persistence.
 * @throws When a model revision or operation cannot resolve exactly.
 */
export function generationExecutionContracts(
  plan: FlowRunPlan,
): FlowRunSnapshotExecutionContract[] {
  return plan.executionNodes.map((node) => {
    const model = getCatalogModel(node.modelId)
    const binding = getCatalogProviderBinding(node.modelId, node.operationId)
    if (
      !model
      || !binding
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
      providerBinding: binding,
      providerEndpoint: binding.endpoint,
      providerEndpointTag: binding.providerTag,
      providerLifecycle: binding.lifecycle,
      providerModel: binding.nativeModelId,
      providerRouteVersion: binding.routeVersion,
    }
  })
}
