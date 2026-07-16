import type {
  FlowGraphEdge,
  FlowGraphNode,
  FlowNodeType,
} from '../../graph/types.js'
import type {
  FlowItem,
  FlowRuntimeValue,
  PriorNodeOutputDescriptor,
} from '../values/runtime-values.js'
import type { RuntimeInputBinding } from './input-coordinates.js'
import type {
  FlowRunPlannerInput,
  FlowRunPlanningResult,
  FlowRunPlanV1,
  PlannedExecutionNode,
  PlannedNodeWorkItem,
  PlannedPriorOutputRequirement,
  PlannedStaticAssetPrerequisite,
} from './planner-contracts.js'
import type { FlowRunPlanningIssue } from './run-command.js'

import {
  getGenerationModel,
  getGenerationOperation,
  isGenerationNodeType,
} from '../../generation/registry/index.js'
import { getFlowNodeHandles } from '../../graph/handles.js'
import { compareFlowEdgesByPriority } from '../../graph/ordering/edges.js'
import { compareStableStrings } from '../../graph/ordering/stable.js'
import {
  validateExecutableFlowGraph,
  validateFlowGraphDraft,
} from '../../graph/validation.js'
import { hashFlowRunJob } from '../serialization/execution-hashes.js'
import { hashFlowRunPlan } from '../serialization/plan-hashes.js'
import {
  FLOW_RUN_PLAN_VERSION,
  FLOW_RUN_PLANNER_VERSION,
} from '../snapshots/contracts.js'
import {
  createStaticAssetItem,
} from '../values/runtime-collections.js'
import {
  createRuntimeItem,
  deriveRuntimeItemKey,
} from '../values/runtime-items.js'
import { createStaticTextItem } from '../values/runtime-text.js'
import { expandRuntimeInputCoordinates } from './input-coordinates.js'
import { resolveFlowRunLimits } from './limits.js'
import { isPlanningIssueRelevantToSelection } from './planner-issue-scope.js'
import {
  executableFlowNodeData,
  generationOutputCount,
  normalizedGenerationSettings,
} from './planner-node-data.js'
import { createPlannedJobRequestPayload } from './planner-node-inputs.js'
import {
  plannedRuntimeOutputValue,
  resolvePriorOutput,
} from './planner-outputs.js'
import {
  flowGraphPlanningIssues,
  flowRunPlanningFailure,
} from './planner-result.js'
import { fixedPointPlanBytes } from './planner-size.js'
import {
  normalizeFlowRunCommand,
} from './run-command.js'
import { RuntimeCoordinateLimitError } from './runtime-coordinate-limit-error.js'
import { selectFlowRunGraph } from './selection.js'
import {
  createFlowRunTopologicalPlan,
  findFlowGraphCycleNodeIds,
} from './topology.js'

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
    return flowRunPlanningFailure(normalizedCommand.issues)

  const selection = selectFlowRunGraph({
    command: normalizedCommand.command,
    edges: input.flow.edges,
    nodes: normalizedNodes,
  })
  const capturedNodeIds = new Set(selection.capturedNodeIds)
  const capturedEdgeIds = new Set(selection.capturedEdgeIds)
  const selectedDraftIssues = flowGraphPlanningIssues(draftValidation).filter(issue =>
    isPlanningIssueRelevantToSelection({
      capturedEdgeIds,
      capturedNodeIds,
      edges: input.flow.edges,
      issue,
      nodes: normalizedNodes,
      nodesById,
    }))
  if (selectedDraftIssues.length > 0)
    return flowRunPlanningFailure(selectedDraftIssues)
  const cycleScopeNodeIds = normalizedCommand.command.mode === 'all'
    ? nodeIds
    : capturedNodeIds
  const cycleNodeIds = findFlowGraphCycleNodeIds({
    edges: input.flow.edges,
    nodeIds: cycleScopeNodeIds,
  })
  if (cycleNodeIds.length > 0) {
    return flowRunPlanningFailure([{
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
  issues.push(...flowGraphPlanningIssues(executableValidation))

  const topological = createFlowRunTopologicalPlan({
    dependenciesByNodeId: selection.dependenciesByNodeId,
    maximumDepth: limits.topologicalDepth,
  })
  issues.push(...topological.issues)
  if (issues.length > 0)
    return flowRunPlanningFailure(issues)

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
      const settings = normalizedGenerationSettings(node)
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
          const resolved = resolvePriorOutput({
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
        return flowRunPlanningFailure([...issues, {
          code: 'run_items_per_node_limit',
          field: `nodes.${nodeId}.items`,
          nodeId,
          params: { maximum: limits.itemsPerNode },
        }])
      }
      const outputCount = generationOutputCount(node)
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
        value: plannedRuntimeOutputValue({
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
    return flowRunPlanningFailure(issues)

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
      data: executableFlowNodeData(node.data),
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
    return flowRunPlanningFailure([{
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
