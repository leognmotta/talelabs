/** Server-authoritative batched cost preflight for visible canvas run scopes. */

import type { PublicRunCostEstimate } from './provider-cost.service.js'

import {
  FLOW_RUN_LIMITS,
  isGenerationNodeType,
} from '@talelabs/flows'
import { logRunEngine } from './logging.js'
import {
  loadFlowRunPlanningSource,
  preflightLoadedFlowRuns,
} from './planning.service.js'
import { publicRunCostEstimate } from './provider-cost.service.js'

/** One runnable node's isolated preflight cost within a graph manifest. */
export interface FlowRunCostManifestNode {
  /** Advisory provider cost for running only this node. */
  costEstimate: PublicRunCostEstimate
  /** Stable saved Flow node identity. */
  nodeId: string
}

/** Graph-level cost response reused by every visible canvas run control. */
export interface FlowRunCostManifest {
  /** Advisory provider cost for every runnable node, when explicitly requested. */
  allCostEstimate?: PublicRunCostEstimate
  /** Flow identity whose saved revision was planned. */
  flowId: string
  /** Exact saved revision used by every estimate in this response. */
  flowRevision: number
  /** Isolated estimates for requested runnable generation nodes only. */
  nodes: FlowRunCostManifestNode[]
}

/** Inputs selecting one bounded managed Credits manifest request. */
export interface FlowRunCostManifestInput {
  /** Debug versus live binding and pricing behavior. */
  executionMode?: 'debug' | 'live'
  /** Managed runtime required by Credits-funded execution. */
  executionRuntime?: 'browser' | 'managed'
  /** Saved revision the browser has fully synchronized. */
  expectedFlowRevision: number
  /** Flow whose requested generation scopes should be estimated. */
  flowId: string
  /** Credits discriminator preventing accidental BYOK estimation. */
  fundingSource: 'credits'
  /** Whether the whole-Flow estimate is needed in this response. */
  includeAll: boolean
  /** Direct-node estimates missing from the browser's current scope cache. */
  nodeIds: readonly string[]
  /** Tenant owning the Flow and every referenced Asset. */
  organizationId: string
  /** Caller cancellation propagated to bounded provider pricing I/O. */
  signal?: AbortSignal
}

/** Recomputes requested scopes from one graph load and one pricing snapshot. */
export async function getFlowRunCostManifest(
  input: FlowRunCostManifestInput,
): Promise<FlowRunCostManifest> {
  input.signal?.throwIfAborted()
  const startedAt = performance.now()
  const source = await loadFlowRunPlanningSource({
    expectedFlowRevision: input.expectedFlowRevision,
    flowId: input.flowId,
    organizationId: input.organizationId,
  })
  input.signal?.throwIfAborted()
  const generationNodeIds = source.flow.nodes
    .filter(node => isGenerationNodeType(node.type))
    .map(node => node.id)
    .toSorted()
  const requestedNodeIds = new Set(input.nodeIds)
  const nodeIds = generationNodeIds.filter(nodeId => requestedNodeIds.has(nodeId))
  const includeRunnableAll = input.includeAll
    && generationNodeIds.length <= FLOW_RUN_LIMITS.executableNodes
  const commands = [
    ...(includeRunnableAll
      ? [{
          expectedFlowRevision: input.expectedFlowRevision,
          mode: 'all' as const,
        }]
      : []),
    ...nodeIds.map(nodeId => ({
      expectedFlowRevision: input.expectedFlowRevision,
      mode: 'node' as const,
      targetNodeId: nodeId,
    })),
  ]
  const results = await preflightLoadedFlowRuns({
    commands,
    executionMode: input.executionMode ?? 'live',
    executionRuntime: input.executionRuntime ?? 'managed',
    fundingSource: input.fundingSource,
    organizationId: input.organizationId,
    signal: input.signal,
    source,
  })
  const allResult = includeRunnableAll ? results[0] : undefined
  const nodeResults = includeRunnableAll ? results.slice(1) : results
  const manifest = {
    ...(input.includeAll
      ? {
          allCostEstimate: allResult?.costEstimate ?? publicRunCostEstimate({
            plannedJobCount: 0,
            routes: new Map(),
          }),
        }
      : {}),
    flowId: input.flowId,
    flowRevision: input.expectedFlowRevision,
    nodes: nodeResults.map((result, index) => ({
      costEstimate: result.costEstimate,
      nodeId: nodeIds[index]!,
    })),
  } satisfies FlowRunCostManifest
  logRunEngine('info', 'flow_run.cost_manifest.calculated', {
    calculatedScopeCount: commands.length,
    durationMs: Math.round(performance.now() - startedAt),
    flowId: input.flowId,
    flowRevision: input.expectedFlowRevision,
    nodeEstimateCount: manifest.nodes.length,
    organizationId: input.organizationId,
    requestedNodeEstimateCount: nodeIds.length,
    requestedScopeCount: commands.length,
  })
  return manifest
}
