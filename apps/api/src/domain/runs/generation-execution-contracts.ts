import type {
  FlowRunPlanV1,
  FlowRunSnapshotExecutionContract,
  GenerationModelContractVersion,
  GenerationModelId,
} from '@talelabs/flows'

import { GENERATION_REGISTRY_VERSION } from '@talelabs/flows'
import { getGenerationProviderRoute } from '../../routes/config/generation-provider-routes.js'
import { flowRunPlanValidationError } from './planning-error.js'

export function generationExecutionContracts(
  plan: FlowRunPlanV1,
): FlowRunSnapshotExecutionContract[] {
  return plan.executionNodes.map((node) => {
    const route = getGenerationProviderRoute({
      modelContractVersion: node.modelContractVersion as GenerationModelContractVersion,
      operationId: node.operationId,
      productModelId: node.modelId as GenerationModelId,
    })
    if (!route) {
      throw flowRunPlanValidationError([{
        code: 'generation_provider_route_unavailable',
        field: `nodes.${node.nodeId}.modelId`,
      }])
    }
    return {
      adapterVersion: route.adapterVersion,
      modelContractVersion: node.modelContractVersion,
      modelId: node.modelId,
      modelRegistryVersion: GENERATION_REGISTRY_VERSION,
      nodeId: node.nodeId,
      operationId: node.operationId,
      provider: route.providerRoute.provider,
      providerEndpoint: route.providerRoute.endpoint,
      providerEndpointTag: route.providerRoute.providerTag,
      providerLifecycle: route.lifecycle,
      providerModel: route.providerRoute.nativeModelId,
      providerRouteVersion: route.routeVersion,
    }
  })
}
