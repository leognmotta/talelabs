import type {
  FlowRunPlanV1,
  FlowRunSnapshotExecutionContract,
  GenerationModelContractVersion,
  GenerationModelId,
} from '@talelabs/flows'

import type { CommandRequest } from './contracts.js'
import { db } from '@talelabs/db'

import {
  GENERATION_REGISTRY_VERSION,
  planFlowRun,
} from '@talelabs/flows'
import { listPriorOutputs } from '../../data/flow-run-planning.data.js'
import { getFlowGraphRows, listFlowGraphReferenceRows } from '../../data/flows.data.js'
import { HttpError, TenantResourceNotFoundError } from '../../middleware/error.js'
import { getGenerationProviderRoute } from '../../routes/config/generation-provider-routes.js'
import { getFlowGraph } from '../../services/flows.service.js'
import { toFlowRunCommand } from './contracts.js'
import { summaryFromPlan } from './helpers.js'
import { logRunEngine } from './logging.js'

export const MOCK_PROVIDER = 'talelabs-mock'
export const MOCK_ADAPTER_VERSION = 'mock-adapter-v1'

function validationError(issues: readonly {
  code: string
  field: string
  params?: Record<string, boolean | number | string>
}[]) {
  return new HttpError(
    422,
    'run_plan_invalid',
    'The Flow run could not be planned.',
    issues.map(issue => ({
      code: issue.code,
      field: issue.field,
      message: issue.code,
      params: issue.params,
    })),
  )
}

export function executionContracts(
  plan: FlowRunPlanV1,
): FlowRunSnapshotExecutionContract[] {
  return plan.executionNodes.map((node) => {
    const route = getGenerationProviderRoute({
      modelContractVersion: node.modelContractVersion as GenerationModelContractVersion,
      operationId: node.operationId,
      productModelId: node.modelId as GenerationModelId,
    })
    if (!route) {
      throw validationError([{
        code: 'generation_provider_route_unavailable',
        field: `nodes.${node.nodeId}.modelId`,
      }])
    }
    return {
      adapterVersion: MOCK_ADAPTER_VERSION,
      modelContractVersion: node.modelContractVersion,
      modelId: node.modelId,
      modelRegistryVersion: GENERATION_REGISTRY_VERSION,
      nodeId: node.nodeId,
      operationId: node.operationId,
      provider: MOCK_PROVIDER,
      providerModel: route.providerRoute.nativeModelId,
      providerRouteVersion: route.routeVersion,
    }
  })
}

export async function loadFlowRunPlan(input: {
  command: CommandRequest
  flowId: string
  organizationId: string
}) {
  const startedAt = performance.now()
  const graph = await getFlowGraphRows(db, input.organizationId, input.flowId)
  if (!graph)
    throw new TenantResourceNotFoundError()
  if (Number(graph.flow.revision) !== input.command.expectedFlowRevision) {
    throw new HttpError(
      409,
      'flow_revision_changed',
      'The Flow changed before this run could be planned.',
    )
  }

  const wireGraph = await getFlowGraph(input.organizationId, input.flowId)
  const assetIds = [...new Set(wireGraph.nodes.flatMap(node =>
    node.assetId ? [node.assetId] : []))]
  const references = await listFlowGraphReferenceRows(db as any, {
    assetIds,
    organizationId: input.organizationId,
  })
  const result = planFlowRun({
    command: toFlowRunCommand(input.command),
    context: {
      assetTypesById: Object.fromEntries(
        references.assets.map(asset => [asset.id, asset.type]),
      ),
    },
    flow: {
      edges: wireGraph.edges,
      id: input.flowId,
      nodes: wireGraph.nodes,
      revision: wireGraph.revision,
    },
    priorOutputs: await listPriorOutputs(input.organizationId, input.flowId),
  })
  if (!result.ok) {
    logRunEngine('warn', 'flow_run.plan.failed', {
      durationMs: Math.round(performance.now() - startedAt),
      flowId: input.flowId,
      flowRevision: wireGraph.revision,
      issues: result.issues.map(issue => ({
        code: issue.code,
        field: issue.field,
        nodeId: issue.nodeId,
        params: issue.params,
        slotId: issue.slotId,
      })),
      mode: input.command.mode,
      organizationId: input.organizationId,
    })
    throw validationError(result.issues)
  }

  logRunEngine('info', 'flow_run.plan.succeeded', {
    durationMs: Math.round(performance.now() - startedAt),
    flowId: input.flowId,
    flowRevision: result.plan.flowRevision,
    mode: input.command.mode,
    organizationId: input.organizationId,
    planHash: result.plan.planHash,
    summary: summaryFromPlan(result.plan),
  })
  return result.plan
}

export async function preflightFlowRun(input: {
  command: CommandRequest
  flowId: string
  organizationId: string
}) {
  return summaryFromPlan(await loadFlowRunPlan(input))
}
