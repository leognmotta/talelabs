/** Tenant-scoped Flow run planning and preflight orchestration. */

import type {
  FlowGraphEdge,
  FlowGraphNode,
  FlowGraphValidationContext,
  FlowRunGraphSelectionIndex,
  FlowRunPlan,
  PriorNodeOutputDescriptor,
} from '@talelabs/flows'
import type { ProviderCostInputAsset } from '@talelabs/providers/server'
import type { CommandRequest } from './contracts.js'
import type { PublicRunCostEstimate } from './provider-cost.service.js'
import { db } from '@talelabs/db'

import {
  compareFlowEdgesByPriority,
  createFlowRunGraphSelectionIndex,
  executionPlanFromFlowRunPlan,
  hashCanonicalValue,
  planFlowRun,
  selectFlowRunGraph,
} from '@talelabs/flows'
import { loadProviderPricingSnapshot } from '@talelabs/providers/server'
import { listPriorOutputs } from '../../data/flow-run-planning.data.js'
import { getFlowRunPlanningRows } from '../../data/flows.data.js'
import { HttpError, TenantResourceNotFoundError } from '../../middleware/error.js'
import {
  buildFlowGraphValidationContext,
  presentEdge,
  presentNode,
} from '../../services/flow-graph-reference.service.js'
import { collectPlanPreExistingAssetIds } from './asset-prerequisites.js'
import { toFlowRunCommand } from './contracts.js'
import { logRunEngine } from './logging.js'
import { summaryFromPlan } from './plan-summary.js'
import { flowRunPlanValidationError } from './planning-error.js'
import { availableProvidersForRun } from './provider-availability.js'
import { loadProviderCostInputAssets } from './provider-cost-assets.js'
import {
  providerCostCandidateBindingsForMode,
  publicRunCostEstimate,
  resolvePlanProviderCosts,
} from './provider-cost.service.js'

/** Shared saved-graph facts loaded once for one or many run commands. */
export interface FlowRunPlanningSource {
  /** Tenant-validated Asset and Element references used by graph validation. */
  context: FlowGraphValidationContext
  /** Saved wire graph whose revision every command must capture. */
  flow: {
    edges: readonly FlowGraphEdge[]
    id: string
    nodes: readonly FlowGraphNode[]
    revision: number
  }
  /** Latest successful provider outputs available to partial commands. */
  priorOutputs: readonly PriorNodeOutputDescriptor[]
}

/** Credits-funded cost preflight input for one exact run command. */
export interface FlowRunCostPreflightInput {
  command: CommandRequest
  executionMode?: 'debug' | 'live'
  executionRuntime?: 'browser' | 'managed'
  flowId: string
  fundingSource: 'credits'
  organizationId: string
  signal?: AbortSignal
}

/** Public plan summary and provider-cost estimate for one command. */
export interface FlowRunCostPreflightResult {
  costEstimate: PublicRunCostEstimate
  expectedOutputCount: number
  flowId: string
  flowRevision: number
  planHash: string
  plannedExecutableCount: number
  plannedItemCount: number
  plannedJobCount: number
  requestedExecutableCount: number
  topologicalDepth: number
}

function recoverablePreflightNodeIds(input: {
  error: HttpError
  graph: FlowRunPlanningSource['flow']
}): Set<string> {
  const nodeIds = new Set(input.graph.nodes.map(node => node.id))
  const edgesById = new Map(input.graph.edges.map(edge => [edge.id, edge]))
  const recoverable = new Set<string>()
  for (const detail of input.error.details ?? []) {
    const nodeMatch = /^nodes\.([^.]+)/.exec(detail.field)
    if (nodeMatch?.[1] && nodeIds.has(nodeMatch[1]))
      recoverable.add(nodeMatch[1])

    const edgeMatch = /^edges\.([^.]+)/.exec(detail.field)
    const edge = edgeMatch?.[1] ? edgesById.get(edgeMatch[1]) : undefined
    if (edge)
      recoverable.add(edge.targetNodeId)

    const parameterNodeIds = typeof detail.params?.nodeIds === 'string'
      ? detail.params.nodeIds.split(',')
      : []
    for (const nodeId of parameterNodeIds) {
      if (nodeIds.has(nodeId))
        recoverable.add(nodeId)
    }
  }
  return recoverable
}

function emptyRunCostPreflight(input: {
  command: CommandRequest
  flowId: string
}) {
  return {
    costEstimate: publicRunCostEstimate({
      plannedJobCount: 0,
      routes: new Map(),
    }),
    expectedOutputCount: 0,
    flowId: input.flowId,
    flowRevision: input.command.expectedFlowRevision,
    planHash: hashCanonicalValue('talelabs:run-cost-empty-plan:v1', {
      flowId: input.flowId,
      flowRevision: input.command.expectedFlowRevision,
    }),
    plannedExecutableCount: 0,
    plannedItemCount: 0,
    plannedJobCount: 0,
    requestedExecutableCount: 0,
    topologicalDepth: 0,
  }
}

function recoverFlowRunPlan(input: {
  command: CommandRequest
  organizationId: string
  selectionIndex: FlowRunGraphSelectionIndex
  source: FlowRunPlanningSource
}, error: unknown): (FlowRunPlan & { planHash: string }) | null {
  if (
    !(error instanceof HttpError)
    || error.code !== 'run_plan_invalid'
    || error.status !== 422
  ) {
    throw error
  }
  const graph = input.source.flow
  const failedNodeIds = recoverablePreflightNodeIds({ error, graph })
  if (failedNodeIds.size === 0)
    throw error
  const selection = selectFlowRunGraph({
    command: toFlowRunCommand(input.command),
    edges: graph.edges,
    index: input.selectionIndex,
    nodes: graph.nodes,
  })
  const selectedNodeIds = selection.executableNodes
    .map(node => node.nodeId)
    .filter(nodeId => !failedNodeIds.has(nodeId))
  if (selectedNodeIds.length === selection.executableNodes.length)
    throw error
  if (selectedNodeIds.length === 0)
    return null

  const command = {
    expectedFlowRevision: input.command.expectedFlowRevision,
    mode: 'selection' as const,
    selectedNodeIds,
  }
  try {
    return planLoadedFlowRun({
      command,
      logSuccess: false,
      logValidationFailure: false,
      organizationId: input.organizationId,
      selectionIndex: input.selectionIndex,
      source: input.source,
    })
  }
  catch (nextError) {
    return recoverFlowRunPlan({
      command,
      organizationId: input.organizationId,
      selectionIndex: input.selectionIndex,
      source: input.source,
    }, nextError)
  }
}

/** Loads one tenant-scoped graph, validation context, and prior-output set. */
export async function loadFlowRunPlanningSource(input: {
  expectedFlowRevision: number
  flowId: string
  organizationId: string
}): Promise<FlowRunPlanningSource> {
  const graph = await getFlowRunPlanningRows(
    db,
    input.organizationId,
    input.flowId,
  )
  if (!graph)
    throw new TenantResourceNotFoundError()
  const revision = Number(graph.flow.revision)
  if (revision !== input.expectedFlowRevision) {
    throw new HttpError(
      409,
      'flow_revision_changed',
      'The Flow changed before this run could be planned.',
    )
  }

  const nodes = graph.nodes.map(presentNode)
  const edges = graph.edges
    .map(presentEdge)
    .toSorted(compareFlowEdgesByPriority)
  const [context, priorOutputs] = await Promise.all([
    buildFlowGraphValidationContext({
      executor: db as any,
      nodes,
      organizationId: input.organizationId,
    }),
    listPriorOutputs(input.organizationId, input.flowId),
  ])
  return {
    context,
    flow: {
      edges,
      id: input.flowId,
      nodes,
      revision,
    },
    priorOutputs,
  }
}

function planLoadedFlowRun(input: {
  command: CommandRequest
  logSuccess?: boolean
  logValidationFailure?: boolean
  organizationId: string
  selectionIndex?: FlowRunGraphSelectionIndex
  source: FlowRunPlanningSource
  startedAt?: number
}) {
  const startedAt = input.startedAt ?? performance.now()
  const result = planFlowRun({
    command: toFlowRunCommand(input.command),
    context: input.source.context,
    flow: input.source.flow,
    priorOutputs: input.source.priorOutputs,
  }, {
    selectionIndex: input.selectionIndex,
  })
  if (!result.ok) {
    if (input.logValidationFailure !== false) {
      logRunEngine('warn', 'flow_run.plan.failed', {
        durationMs: Math.round(performance.now() - startedAt),
        flowId: input.source.flow.id,
        flowRevision: input.source.flow.revision,
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
    }
    throw flowRunPlanValidationError(result.issues)
  }

  if (input.logSuccess !== false) {
    logRunEngine('info', 'flow_run.plan.succeeded', {
      durationMs: Math.round(performance.now() - startedAt),
      flowId: input.source.flow.id,
      flowRevision: result.plan.flowRevision,
      mode: input.command.mode,
      organizationId: input.organizationId,
      planHash: result.plan.planHash,
      summary: summaryFromPlan(result.plan),
    })
  }
  return result.plan
}

/** Loads and validates an immutable plan from one saved Flow revision. */
export async function loadFlowRunPlan(input: {
  command: CommandRequest
  flowId: string
  logValidationFailure?: boolean
  organizationId: string
}) {
  const startedAt = performance.now()
  const source = await loadFlowRunPlanningSource({
    expectedFlowRevision: input.command.expectedFlowRevision,
    flowId: input.flowId,
    organizationId: input.organizationId,
  })
  return planLoadedFlowRun({
    ...input,
    source,
    startedAt,
  })
}

/**
 * Calculates several command summaries from one graph index, one Asset load,
 * and one provider pricing snapshot shared by every requested scope.
 */
export async function preflightLoadedFlowRuns(input: {
  /** Optional authoritative Asset facts already loaded for this source batch. */
  assetsById?: ReadonlyMap<string, ProviderCostInputAsset>
  commands: readonly CommandRequest[]
  executionMode?: 'debug' | 'live'
  executionRuntime?: 'browser' | 'managed'
  fundingSource: 'credits'
  organizationId: string
  /** Optional request cancellation propagated only to provider pricing I/O. */
  signal?: AbortSignal
  source: FlowRunPlanningSource
}): Promise<FlowRunCostPreflightResult[]> {
  const executionMode = input.executionMode ?? 'live'
  const executionRuntime = input.executionRuntime ?? 'managed'
  if (executionRuntime !== 'managed') {
    throw new HttpError(
      409,
      'invalid_execution_runtime',
      'Credits cost estimation requires managed execution.',
    )
  }
  for (const command of input.commands) {
    if (command.expectedFlowRevision !== input.source.flow.revision) {
      throw new HttpError(
        409,
        'flow_revision_changed',
        'The Flow changed before this run could be planned.',
      )
    }
  }

  const selectionIndex = createFlowRunGraphSelectionIndex({
    edges: input.source.flow.edges,
    nodes: input.source.flow.nodes,
  })
  const plans = input.commands.map((command) => {
    try {
      return planLoadedFlowRun({
        command,
        logSuccess: false,
        logValidationFailure: false,
        organizationId: input.organizationId,
        selectionIndex,
        source: input.source,
      })
    }
    catch (error) {
      return recoverFlowRunPlan({
        command,
        organizationId: input.organizationId,
        selectionIndex,
        source: input.source,
      }, error)
    }
  })
  const availableProviders = availableProvidersForRun(executionRuntime)
  const executionPlans = plans.map(plan => plan
    ? executionPlanFromFlowRunPlan(plan)
    : null)
  const candidatesByPlan = executionPlans.map(plan => plan
    ? providerCostCandidateBindingsForMode({
        availableProviders,
        executionMode,
        executionRuntime,
        plan,
      })
    : null)
  const assetIds = [...new Set(plans.flatMap(plan =>
    plan ? collectPlanPreExistingAssetIds(plan) : []))]
  const [assetsById, pricing] = await Promise.all([
    input.assetsById
      ? Promise.resolve(input.assetsById)
      : assetIds.length > 0
        ? loadProviderCostInputAssets({
            assetIds,
            organizationId: input.organizationId,
          })
        : Promise.resolve(new Map<string, ProviderCostInputAsset>()),
    loadProviderPricingSnapshot({
      bindings: candidatesByPlan.flatMap(candidates =>
        candidates ? [...candidates.values()].flat() : []),
      signal: input.signal,
    }),
  ])
  return plans.map((plan, index) => {
    if (!plan) {
      return emptyRunCostPreflight({
        command: input.commands[index]!,
        flowId: input.source.flow.id,
      })
    }
    const routes = resolvePlanProviderCosts({
      assetsById,
      candidatesByNode: candidatesByPlan[index]!,
      costEstimationEnabled: true,
      costRoutingEnabled: executionMode === 'live',
      plan: executionPlans[index]!,
      pricing,
    })
    return {
      ...summaryFromPlan(plan),
      costEstimate: publicRunCostEstimate({
        plannedJobCount: executionPlans[index]!.summary.plannedJobCount,
        routes,
      }),
    }
  })
}

/** Returns a bounded planning summary without admitting a durable run. */
export async function preflightFlowRun(
  input: FlowRunCostPreflightInput,
): Promise<FlowRunCostPreflightResult> {
  const source = await loadFlowRunPlanningSource({
    expectedFlowRevision: input.command.expectedFlowRevision,
    flowId: input.flowId,
    organizationId: input.organizationId,
  })
  const [result] = await preflightLoadedFlowRuns({
    ...input,
    commands: [input.command],
    source,
  })
  return result!
}
