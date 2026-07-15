import type {
  FlowGraphEdge,
  FlowGraphNode,
  FlowGraphValidationContext,
  FlowNodeType,
} from '../types.js'
import type { RuntimeInputBinding } from './item-expansion.js'
import type {
  FlowRunCommand,
  FlowRunInclusionReason,
  FlowRunPlanningIssue,
  NormalizedFlowRunCommand,
} from './run-command.js'
import type { FlowRunLimits } from './run-limits.js'
import type {
  FlowItem,
  FlowItemReference,
  FlowRuntimeValue,
  PriorNodeOutputDescriptor,
  RuntimeDimensions,
} from './runtime-values.js'

import { compareFlowEdgesByPriority } from '../edge-ordering.js'
import {
  getGenerationModel,
  getGenerationOperation,
  isGenerationNodeType,
} from '../generation-registry.js'
import {
  validateExecutableFlowGraph,
  validateFlowGraphDraft,
} from '../graph-validation.js'
import { getFlowNodeHandles } from '../handles.js'
import { compareStableStrings } from '../stable-order.js'
import {
  canonicalByteLength,
  hashFlowRunJob,
  hashFlowRunPlan,
} from './canonical-json.js'
import { selectFlowRunGraph } from './graph-selection.js'
import {
  expandRuntimeInputCoordinates,
  RuntimeCoordinateLimitError,
} from './item-expansion.js'
import {
  compareFlowRunPlanningIssues,
  normalizeFlowRunCommand,
} from './run-command.js'
import { resolveFlowRunLimits } from './run-limits.js'
import {
  createRuntimeItem,
  createStaticAssetItem,
  createStaticTextItem,
  deriveRuntimeItemKey,
  runtimeValueType,
} from './runtime-values.js'
import {
  FLOW_RUN_PLAN_VERSION,
  FLOW_RUN_PLANNER_VERSION,
} from './snapshot-contract.js'
import {
  createFlowRunTopologicalPlan,
  findFlowGraphCycleNodeIds,
} from './topological-plan.js'

export interface FlowRunPlannerInput {
  command: FlowRunCommand
  context: FlowGraphValidationContext
  flow: {
    edges: readonly FlowGraphEdge[]
    id: string
    nodes: readonly FlowGraphNode[]
    revision: number
  }
  /** Internal verifier overrides; production callers use FLOW_RUN_LIMITS. */
  limits?: Partial<FlowRunLimits>
  priorOutputs?: readonly PriorNodeOutputDescriptor[]
}

export interface PlannedStaticAssetPrerequisite {
  assetId: string
  mediaType: string
  nodeId: string
}

export interface PlannedPriorOutputRequirement {
  completedAt: string
  generationJobId: string
  itemKeys: readonly string[]
  nodeId: string
  outputHandleId: string
}

export interface PlannedRunInput {
  edgeId: string
  items: readonly FlowItem<FlowRuntimeValue>[]
  sourceHandleId: string
  sourceNodeId: string
  targetHandleId: string
}

export interface PlannedJobRequestInput {
  edgeId: string
  items: readonly FlowItem<FlowRuntimeValue>[]
  sourceHandleId: string
  sourceNodeId: string
  targetHandleId: string
}

export interface PlannedJobRequestPayload {
  inline: Readonly<Record<string, string>>
  inputSelections: Readonly<Record<string, readonly string[]>>
  inputs: readonly PlannedJobRequestInput[]
  itemKey: string
  modelContractVersion: string
  modelId: string
  nodeId: string
  operationId: string
  outputCount: number
  requestIndex: number
  requestPayloadVersion: 1
  settings: Readonly<Record<string, boolean | number | string>>
}

export interface PlannedRequestShard {
  jobHash: string
  requestPayload: PlannedJobRequestPayload
  requestIndex: number
}

export interface PlannedNodeWorkItem {
  dimensions: RuntimeDimensions
  expectedOutputCount: number
  inputs: readonly PlannedRunInput[]
  itemKey: string
  lineage: readonly FlowItemReference[]
  requestShards: readonly PlannedRequestShard[]
  sortOrder: number
}

export interface PlannedExecutionNode {
  inclusionReason: FlowRunInclusionReason
  level: number
  modelContractVersion: string
  modelId: string
  nodeId: string
  nodeType: FlowNodeType
  operationId: string
  outputHandleId: string
  outputValueType: string
  settings: Readonly<Record<string, boolean | number | string>>
  workItems: readonly PlannedNodeWorkItem[]
}

export interface FlowRunPlanV1 {
  capturedEdges: readonly {
    id: string
    order: number
    sourceHandle: null | string
    sourceNodeId: string
    targetHandle: null | string
    targetNodeId: string
  }[]
  capturedNodes: readonly {
    assetId: null | string
    data: Readonly<Record<string, unknown>>
    id: string
    schemaVersion: number
    type: string
  }[]
  command: NormalizedFlowRunCommand
  executionNodes: readonly PlannedExecutionNode[]
  flowId: string
  flowRevision: number
  planVersion: typeof FLOW_RUN_PLAN_VERSION
  plannerVersion: typeof FLOW_RUN_PLANNER_VERSION
  prerequisites: {
    priorOutputs: readonly PlannedPriorOutputRequirement[]
    staticAssets: readonly PlannedStaticAssetPrerequisite[]
  }
  summary: {
    expectedOutputCount: number
    planBytes: number
    plannedExecutableCount: number
    plannedItemCount: number
    plannedJobCount: number
    requestedExecutableCount: number
    topologicalDepth: number
  }
  topologicalLevels: readonly (readonly string[])[]
}

export type FlowRunPlanningResult
  = | { issues: readonly FlowRunPlanningIssue[], ok: false }
    | { ok: true, plan: FlowRunPlanV1 & { planHash: string } }

function failure(issues: readonly FlowRunPlanningIssue[]): FlowRunPlanningResult {
  const unique = new Map<string, FlowRunPlanningIssue>()
  for (const issue of issues) {
    const key = [issue.field, issue.code, issue.nodeId ?? '', issue.slotId ?? '']
      .join('\u0000')
    if (!unique.has(key))
      unique.set(key, issue)
  }
  return {
    issues: Object.freeze(
      [...unique.values()].toSorted(compareFlowRunPlanningIssues),
    ),
    ok: false,
  }
}

function graphIssues(input: ReturnType<typeof validateFlowGraphDraft>) {
  return input.issues.map(issue => ({
    code: issue.code,
    field: issue.field,
    ...(issue.params ? { params: issue.params } : {}),
  })) satisfies FlowRunPlanningIssue[]
}

function issueNodeId(
  issue: FlowRunPlanningIssue,
  nodes: readonly FlowGraphNode[],
  nodesById: ReadonlyMap<string, FlowGraphNode>,
) {
  const match = /^nodes\.([^.]+)/.exec(issue.field)
  if (!match)
    return undefined
  const segment = match[1]!
  if (nodesById.has(segment))
    return segment
  const index = Number.parseInt(segment, 10)
  return Number.isSafeInteger(index) ? nodes[index]?.id : undefined
}

function issueEdgeId(
  issue: FlowRunPlanningIssue,
  edges: readonly FlowGraphEdge[],
) {
  const match = /^edges\.([^.]+)/.exec(issue.field)
  if (!match)
    return undefined
  const index = Number.parseInt(match[1]!, 10)
  return Number.isSafeInteger(index) ? edges[index]?.id : undefined
}

function isDraftIssueRelevantToSelection(input: {
  capturedEdgeIds: ReadonlySet<string>
  capturedNodeIds: ReadonlySet<string>
  edges: readonly FlowGraphEdge[]
  issue: FlowRunPlanningIssue
  nodes: readonly FlowGraphNode[]
  nodesById: ReadonlyMap<string, FlowGraphNode>
}) {
  const nodeId = issueNodeId(input.issue, input.nodes, input.nodesById)
  if (nodeId)
    return input.capturedNodeIds.has(nodeId)
  const edgeId = issueEdgeId(input.issue, input.edges)
  if (edgeId)
    return input.capturedEdgeIds.has(edgeId)
  return true
}

function executableNodeData(data: Record<string, unknown>) {
  const { locked: _locked, ...contractData } = data
  return contractData
}

function outputCountForNode(node: FlowGraphNode) {
  const model = getGenerationModel(
    String(node.data.modelId ?? ''),
    node.data.modelContractVersion,
  )
  const operation = model
    ? getGenerationOperation(model, node.data.operationId)
    : undefined
  const count = operation?.output?.count
  if (!count)
    return 1
  const configured = count.settingId
    ? (node.data.settings as Record<string, unknown>)[count.settingId]
    : count.default
  return typeof configured === 'number' && Number.isSafeInteger(configured)
    ? configured
    : count.default
}

function normalizedSettings(node: FlowGraphNode) {
  return Object.freeze({
    ...(node.data.settings as Record<string, boolean | number | string>),
  })
}

function normalizedInlineText(node: FlowGraphNode) {
  return Object.freeze(Object.fromEntries(
    Object.entries(node.data)
      .filter(([key, value]) =>
        ['instructions', 'lyrics', 'prompt'].includes(key)
        && typeof value === 'string')
      .toSorted(([left], [right]) => compareStableStrings(left, right)),
  ) as Record<string, string>)
}

function normalizedInputSelections(node: FlowGraphNode) {
  const selections = node.data.inputSelections as
    | Record<string, { assetIds?: string[], mode: 'auto' | 'manual' }>
    | undefined
  if (!selections)
    return Object.freeze({})
  return Object.freeze(Object.fromEntries(
    Object.entries(selections)
      .filter(([, selection]) => selection.mode === 'manual')
      .map(([slotId, selection]) => [
        slotId,
        Object.freeze([...(selection.assetIds ?? [])].toSorted(compareStableStrings)),
      ] as const)
      .toSorted(([left], [right]) => compareStableStrings(left, right)),
  ))
}

/** Canonical, provider-independent request identity used for job hashing. */
function createPlannedJobRequestPayload(input: {
  inputs: readonly PlannedRunInput[]
  itemKey: string
  modelContractVersion: string
  modelId: string
  node: FlowGraphNode
  operationId: string
  outputCount: number
  requestIndex: number
  settings: Readonly<Record<string, boolean | number | string>>
}): PlannedJobRequestPayload {
  return Object.freeze({
    inline: normalizedInlineText(input.node),
    inputSelections: normalizedInputSelections(input.node),
    inputs: Object.freeze(input.inputs.map(plannedInput => Object.freeze({
      edgeId: plannedInput.edgeId,
      items: plannedInput.items,
      sourceHandleId: plannedInput.sourceHandleId,
      sourceNodeId: plannedInput.sourceNodeId,
      targetHandleId: plannedInput.targetHandleId,
    }))),
    itemKey: input.itemKey,
    modelContractVersion: input.modelContractVersion,
    modelId: input.modelId,
    nodeId: input.node.id,
    operationId: input.operationId,
    outputCount: input.outputCount,
    requestIndex: input.requestIndex,
    requestPayloadVersion: 1 as const,
    settings: input.settings,
  })
}

function runtimeOutputValue(input: {
  itemKey: string
  mediaType: 'audio' | 'image' | 'text' | 'video'
  nodeId: string
  outputCount: number
}): FlowRuntimeValue {
  if (input.mediaType === 'text') {
    return {
      kind: 'text',
      origin: {
        itemKey: input.itemKey,
        nodeId: input.nodeId,
        source: 'sameRunOutput',
      },
      text: null,
    }
  }
  const kind = input.mediaType === 'image'
    ? 'imageSet'
    : input.mediaType === 'video' ? 'videoSet' : 'audioSet'
  const mediaType = input.mediaType
  return {
    assets: Array.from({ length: input.outputCount }, (_, outputIndex) => ({
      itemKey: input.itemKey,
      mediaType,
      nodeId: input.nodeId,
      outputIndex,
      source: 'sameRunOutput' as const,
    })),
    kind,
  }
}

function priorOutputCompatible(
  descriptor: PriorNodeOutputDescriptor,
  acceptedValueTypes: readonly string[],
) {
  return descriptor.items.length > 0
    && descriptor.items.every(item =>
      acceptedValueTypes.includes(runtimeValueType(item.value)))
}

function resolvedPriorOutput(input: {
  acceptedValueTypes: readonly string[]
  candidates: readonly PriorNodeOutputDescriptor[]
  issues: FlowRunPlanningIssue[]
  nodeId: string
  outputHandleId: string
}) {
  const pinned = input.candidates.filter(candidate => candidate.pinned)
  if (pinned.length > 1) {
    input.issues.push({
      code: 'ambiguous_pinned_upstream_output',
      field: 'priorOutputs',
      nodeId: input.nodeId,
      params: { outputHandleId: input.outputHandleId },
    })
    return undefined
  }
  if (pinned.length === 1) {
    return priorOutputCompatible(pinned[0]!, input.acceptedValueTypes)
      ? pinned[0]
      : undefined
  }
  return input.candidates
    .filter(candidate =>
      priorOutputCompatible(candidate, input.acceptedValueTypes))
    .toSorted((left, right) =>
      compareStableStrings(right.completedAt, left.completedAt)
      || compareStableStrings(right.generationJobId, left.generationJobId))[0]
}

function fixedPointPlanBytes(plan: FlowRunPlanV1) {
  let planBytes = plan.summary.planBytes
  for (let iteration = 0; iteration < 8; iteration += 1) {
    const candidate = {
      ...plan,
      summary: { ...plan.summary, planBytes },
    }
    const next = canonicalByteLength(candidate)
    if (next === planBytes)
      return { ...candidate, summary: { ...candidate.summary, planBytes: next } }
    planBytes = next
  }
  return {
    ...plan,
    summary: { ...plan.summary, planBytes },
  }
}

export function planFlowRun(input: FlowRunPlannerInput): FlowRunPlanningResult {
  const limits = resolveFlowRunLimits(input.limits)
  const draftValidation = validateFlowGraphDraft({
    context: input.context,
    edges: input.flow.edges,
    nodes: input.flow.nodes,
  })

  const normalizedNodes = draftValidation.nodes
  const nodesById = new Map(normalizedNodes.map(node => [node.id, node]))
  const nodeIds = new Set(nodesById.keys())
  const executableNodeIds = new Set(
    normalizedNodes
      .filter(node => isGenerationNodeType(node.type))
      .map(node => node.id),
  )
  const normalizedCommand = normalizeFlowRunCommand({
    command: input.command,
    executableNodeIds,
    nodeIds,
    selectionLimit: limits.selectionIds,
  })
  if (!normalizedCommand.command)
    return failure(normalizedCommand.issues)

  const selection = selectFlowRunGraph({
    command: normalizedCommand.command,
    edges: input.flow.edges,
    nodes: normalizedNodes,
  })
  const capturedNodeIds = new Set(selection.capturedNodeIds)
  const capturedEdgeIds = new Set(selection.capturedEdgeIds)
  const selectedDraftIssues = graphIssues(draftValidation).filter(issue =>
    isDraftIssueRelevantToSelection({
      capturedEdgeIds,
      capturedNodeIds,
      edges: input.flow.edges,
      issue,
      nodes: normalizedNodes,
      nodesById,
    }))
  if (selectedDraftIssues.length > 0)
    return failure(selectedDraftIssues)
  const cycleScopeNodeIds = normalizedCommand.command.mode === 'all'
    ? nodeIds
    : capturedNodeIds
  const cycleNodeIds = findFlowGraphCycleNodeIds({
    edges: input.flow.edges,
    nodeIds: cycleScopeNodeIds,
  })
  if (cycleNodeIds.length > 0) {
    return failure([{
      code: 'executable_cycle',
      field: 'graph',
      params: { nodeIds: cycleNodeIds.join(',') },
    }])
  }
  const plannedExecutableIds = new Set(
    selection.executableNodes.map(node => node.nodeId),
  )
  const issues: FlowRunPlanningIssue[] = []
  if (plannedExecutableIds.size > limits.executableNodes) {
    issues.push({
      code: 'run_executable_node_limit',
      field: 'graph',
      params: { maximum: limits.executableNodes },
    })
  }

  const executableValidation = validateExecutableFlowGraph({
    context: input.context,
    edges: input.flow.edges.filter(edge =>
      selection.capturedEdgeIds.includes(edge.id)),
    nodes: normalizedNodes,
  }, plannedExecutableIds)
  issues.push(...graphIssues(executableValidation))

  const topological = createFlowRunTopologicalPlan({
    dependenciesByNodeId: selection.dependenciesByNodeId,
    maximumDepth: limits.topologicalDepth,
  })
  issues.push(...topological.issues)
  if (issues.length > 0)
    return failure(issues)

  const selectedById = new Map(
    selection.executableNodes.map(node => [node.nodeId, node]),
  )
  const edgeById = new Map(input.flow.edges.map(edge => [edge.id, edge]))
  const capturedEdges = selection.capturedEdgeIds
    .map(edgeId => edgeById.get(edgeId))
    .filter((edge): edge is FlowGraphEdge => Boolean(edge))
    .toSorted(compareFlowEdgesByPriority)
  const incomingByNodeId = new Map<string, FlowGraphEdge[]>()
  for (const edge of capturedEdges) {
    incomingByNodeId.set(edge.targetNodeId, [
      ...(incomingByNodeId.get(edge.targetNodeId) ?? []),
      edge,
    ])
  }

  const priorOutputsByNodeHandle = new Map<string, PriorNodeOutputDescriptor[]>()
  for (const output of input.priorOutputs ?? []) {
    const key = `${output.nodeId}\u0000${output.outputHandleId}`
    priorOutputsByNodeHandle.set(key, [
      ...(priorOutputsByNodeHandle.get(key) ?? []),
      output,
    ])
  }

  const staticAssets = new Map<string, PlannedStaticAssetPrerequisite>()
  const priorRequirements = new Map<string, PlannedPriorOutputRequirement>()
  const outputsByNodeId = new Map<string, {
    handleId: string
    items: readonly FlowItem<FlowRuntimeValue>[]
  }>()
  const executionNodes: PlannedExecutionNode[] = []

  for (const [level, levelNodeIds] of topological.levels.entries()) {
    for (const nodeId of levelNodeIds) {
      const node = nodesById.get(nodeId)!
      const selectedNode = selectedById.get(nodeId)!
      const model = getGenerationModel(
        String(node.data.modelId ?? ''),
        node.data.modelContractVersion,
      )!
      const operation = getGenerationOperation(model, node.data.operationId)!
      const settings = normalizedSettings(node)
      const outputHandle = getFlowNodeHandles(node, input.context)
        .find(handle => handle.direction === 'output')!
      const bindings: RuntimeInputBinding[] = []

      for (const edge of incomingByNodeId.get(nodeId) ?? []) {
        const sourceNode = nodesById.get(edge.sourceNodeId)!
        const sourceHandleId = edge.sourceHandle ?? ''
        const targetHandleId = edge.targetHandle ?? ''
        let items: readonly FlowItem<FlowRuntimeValue>[] = []

        if (sourceNode.type === 'text') {
          const text = String(sourceNode.data.text ?? '')
          if (text.trim().length > 0)
            items = [createStaticTextItem({ nodeId: sourceNode.id, text })]
        }
        else if (sourceNode.type === 'asset' && sourceNode.assetId) {
          const mediaType = input.context.assetTypesById[sourceNode.assetId]
          if (mediaType) {
            items = [createStaticAssetItem({
              assetId: sourceNode.assetId,
              mediaType,
              nodeId: sourceNode.id,
            })]
            staticAssets.set(sourceNode.assetId, {
              assetId: sourceNode.assetId,
              mediaType,
              nodeId: sourceNode.id,
            })
          }
        }
        else if (plannedExecutableIds.has(sourceNode.id)) {
          items = outputsByNodeId.get(sourceNode.id)?.items ?? []
        }
        else if (isGenerationNodeType(sourceNode.type)) {
          const sourceHandle = getFlowNodeHandles(sourceNode, input.context)
            .find(handle =>
              handle.direction === 'output' && handle.id === sourceHandleId)
          const candidates = priorOutputsByNodeHandle.get(
            `${sourceNode.id}\u0000${sourceHandleId}`,
          ) ?? []
          const resolved = resolvedPriorOutput({
            acceptedValueTypes: sourceHandle?.valueTypes ?? [],
            candidates,
            issues,
            nodeId: sourceNode.id,
            outputHandleId: sourceHandleId,
          })
          if (resolved) {
            items = resolved.items
            priorRequirements.set(resolved.generationJobId, {
              completedAt: resolved.completedAt,
              generationJobId: resolved.generationJobId,
              itemKeys: Object.freeze(resolved.items.map(item => item.key)),
              nodeId: resolved.nodeId,
              outputHandleId: resolved.outputHandleId,
            })
          }
          else {
            issues.push({
              code: 'missing_upstream_output',
              field: `nodes.${nodeId}.handles.${targetHandleId}`,
              nodeId,
              params: { sourceNodeId: sourceNode.id, suggestion: 'upstream' },
              slotId: targetHandleId,
            })
          }
        }

        bindings.push({
          edgeId: edge.id,
          items,
          sourceHandleId,
          sourceNodeId: sourceNode.id,
          targetHandleId,
        })
      }

      let coordinates
      try {
        coordinates = expandRuntimeInputCoordinates(
          bindings,
          limits.itemsPerNode,
        )
      }
      catch (error) {
        if (!(error instanceof RuntimeCoordinateLimitError))
          throw error
        return failure([...issues, {
          code: 'run_items_per_node_limit',
          field: `nodes.${nodeId}.items`,
          nodeId,
          params: { maximum: limits.itemsPerNode },
        }])
      }
      const outputCount = outputCountForNode(node)
      const workItems: PlannedNodeWorkItem[] = []
      for (const [sortOrder, coordinate] of coordinates.entries()) {
        for (const inputBinding of coordinate.inputs) {
          if (
            inputBinding.binding.items.length > 0
            && inputBinding.items.length === 0
          ) {
            issues.push({
              code: 'runtime_dimension_coordinate_missing',
              field: `nodes.${nodeId}.handles.${inputBinding.binding.targetHandleId}`,
              nodeId,
              slotId: inputBinding.binding.targetHandleId,
            })
          }
        }
        if (Object.keys(coordinate.dimensions).length > limits.dimensionsPerItem) {
          issues.push({
            code: 'run_item_dimension_limit',
            field: `nodes.${nodeId}.items.${sortOrder}.dimensions`,
            nodeId,
            params: { maximum: limits.dimensionsPerItem },
          })
        }
        const itemKey = deriveRuntimeItemKey({
          dimensions: coordinate.dimensions,
          lineage: coordinate.lineage,
          nodeId,
        })
        const plannedInputs = coordinate.inputs.map(({ binding, items }) => ({
          edgeId: binding.edgeId,
          items,
          sourceHandleId: binding.sourceHandleId,
          sourceNodeId: binding.sourceNodeId,
          targetHandleId: binding.targetHandleId,
        }))
        const requestIndex = 0
        const requestPayload = createPlannedJobRequestPayload({
          inputs: plannedInputs,
          itemKey,
          modelContractVersion: String(node.data.modelContractVersion),
          modelId: model.id,
          node,
          operationId: operation.id,
          outputCount,
          requestIndex,
          settings,
        })
        workItems.push(Object.freeze({
          dimensions: coordinate.dimensions,
          expectedOutputCount: outputCount,
          inputs: Object.freeze(plannedInputs),
          itemKey,
          lineage: coordinate.lineage,
          requestShards: Object.freeze([{
            jobHash: hashFlowRunJob(requestPayload),
            requestPayload,
            requestIndex,
          }]),
          sortOrder,
        }))
      }

      if (workItems.length > limits.itemsPerNode) {
        issues.push({
          code: 'run_items_per_node_limit',
          field: `nodes.${nodeId}.items`,
          nodeId,
          params: { maximum: limits.itemsPerNode },
        })
      }

      const outputItems = workItems.map(workItem => createRuntimeItem({
        dimensions: workItem.dimensions,
        key: workItem.itemKey,
        lineage: workItem.lineage,
        nodeId,
        value: runtimeOutputValue({
          itemKey: workItem.itemKey,
          mediaType: model.mediaType,
          nodeId,
          outputCount,
        }),
      }))
      outputsByNodeId.set(nodeId, {
        handleId: outputHandle.id,
        items: outputItems,
      })
      executionNodes.push(Object.freeze({
        inclusionReason: selectedNode.inclusionReason,
        level,
        modelContractVersion: String(node.data.modelContractVersion),
        modelId: model.id,
        nodeId,
        nodeType: node.type as FlowNodeType,
        operationId: operation.id,
        outputHandleId: outputHandle.id,
        outputValueType: outputHandle.valueTypes[0] ?? model.mediaType,
        settings,
        workItems: Object.freeze(workItems),
      }))
    }
  }

  const plannedItemCount = executionNodes
    .reduce((count, node) => count + node.workItems.length, 0)
  const plannedJobCount = executionNodes.reduce(
    (count, node) => count + node.workItems.reduce(
      (nodeCount, item) => nodeCount + item.requestShards.length,
      0,
    ),
    0,
  )
  const expectedOutputCount = executionNodes.reduce(
    (count, node) => count + node.workItems.reduce(
      (nodeCount, item) => nodeCount + item.expectedOutputCount,
      0,
    ),
    0,
  )
  if (plannedJobCount > limits.jobsPerRun) {
    issues.push({
      code: 'run_job_limit',
      field: 'plan.jobs',
      params: { maximum: limits.jobsPerRun },
    })
  }
  if (expectedOutputCount > limits.outputsPerRun) {
    issues.push({
      code: 'run_output_limit',
      field: 'plan.outputs',
      params: { maximum: limits.outputsPerRun },
    })
  }
  if (issues.length > 0)
    return failure(issues)

  const topologicalOrder = topological.levels.flat()
  const captureOrder = new Map(topologicalOrder.map((nodeId, index) => [
    nodeId,
    index,
  ]))
  const capturedNodes = selection.capturedNodeIds
    .map(nodeId => nodesById.get(nodeId))
    .filter((node): node is FlowGraphNode => Boolean(node))
    .toSorted((left, right) => {
      const leftOrder = captureOrder.get(left.id)
      const rightOrder = captureOrder.get(right.id)
      if (leftOrder !== undefined || rightOrder !== undefined) {
        return (leftOrder ?? Number.MAX_SAFE_INTEGER)
          - (rightOrder ?? Number.MAX_SAFE_INTEGER)
      }
      return compareStableStrings(left.id, right.id)
    })
    .map(node => ({
      assetId: node.assetId,
      data: executableNodeData(node.data),
      id: node.id,
      schemaVersion: node.schemaVersion,
      type: node.type,
    }))
  const planWithoutHash: FlowRunPlanV1 = {
    capturedEdges: capturedEdges.map((edge, order) => ({
      id: edge.id,
      order,
      sourceHandle: edge.sourceHandle,
      sourceNodeId: edge.sourceNodeId,
      targetHandle: edge.targetHandle,
      targetNodeId: edge.targetNodeId,
    })),
    capturedNodes,
    command: normalizedCommand.command,
    executionNodes,
    flowId: input.flow.id,
    flowRevision: input.flow.revision,
    planVersion: FLOW_RUN_PLAN_VERSION,
    plannerVersion: FLOW_RUN_PLANNER_VERSION,
    prerequisites: {
      priorOutputs: [...priorRequirements.values()]
        .toSorted((left, right) =>
          compareStableStrings(left.nodeId, right.nodeId)
          || compareStableStrings(left.outputHandleId, right.outputHandleId)
          || compareStableStrings(left.generationJobId, right.generationJobId)),
      staticAssets: [...staticAssets.values()]
        .toSorted((left, right) =>
          compareStableStrings(left.assetId, right.assetId)
          || compareStableStrings(left.nodeId, right.nodeId)),
    },
    summary: {
      expectedOutputCount,
      planBytes: 0,
      plannedExecutableCount: executionNodes.length,
      plannedItemCount,
      plannedJobCount,
      requestedExecutableCount: selection.requestedExecutableCount,
      topologicalDepth: topological.levels.length,
    },
    topologicalLevels: topological.levels,
  }
  const canonicalPlan = fixedPointPlanBytes(planWithoutHash)
  if (canonicalPlan.summary.planBytes > limits.snapshotBytes) {
    return failure([{
      code: 'run_snapshot_bytes_limit',
      field: 'plan',
      params: { maximum: limits.snapshotBytes },
    }])
  }

  return {
    ok: true,
    plan: Object.freeze({
      ...canonicalPlan,
      planHash: hashFlowRunPlan(canonicalPlan),
    }),
  }
}
