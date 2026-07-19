/** Whole-graph validation producing run-blocking and advisory issues. */

import type {
  FlowGraphIssue,
  FlowGraphValidationResult,
} from './types.js'
import type { ValidateGraphInput } from './validation-contracts.js'
import { areHandlesCompatible, getFlowNodeHandles } from './handles.js'
import { FLOW_GRAPH_LIMITS } from './limits.js'
import {
  validateGenerationConstraints,
  validateGenerationSelections,
} from './validation-generation.js'
import {
  addFlowGraphIssue,
  flowNodeDataByteLength,
} from './validation-issues.js'
import {
  getElementNodeElementId,
  normalizeFlowGraphNodes,
  resolveElementNodeReferences,
} from './validation-nodes.js'

function validateGraph(
  input: ValidateGraphInput,
  requiredNodeIds: ReadonlySet<string> | null,
): FlowGraphValidationResult {
  const issues: FlowGraphIssue[] = []

  if (input.nodes.length > FLOW_GRAPH_LIMITS.nodes)
    addFlowGraphIssue(issues, 'node_limit', 'nodes', { maximum: FLOW_GRAPH_LIMITS.nodes })
  if (input.edges.length > FLOW_GRAPH_LIMITS.edges)
    addFlowGraphIssue(issues, 'edge_limit', 'edges', { maximum: FLOW_GRAPH_LIMITS.edges })

  const normalized = normalizeFlowGraphNodes(input.nodes, issues)
  const nodes = normalized.nodes
  const nodeIds = new Set<string>()
  let aggregateDataBytes = 0
  for (const [index, node] of nodes.entries()) {
    if (nodeIds.has(node.id))
      addFlowGraphIssue(issues, 'duplicate_node_id', `nodes.${index}.id`)
    nodeIds.add(node.id)

    const bytes = flowNodeDataByteLength(node.data)
    aggregateDataBytes += bytes
    if (bytes > FLOW_GRAPH_LIMITS.nodeDataBytes) {
      addFlowGraphIssue(issues, 'node_data_limit', `nodes.${index}.data`, {
        maximum: FLOW_GRAPH_LIMITS.nodeDataBytes,
      })
    }

    if (
      node.type === 'asset'
      && node.assetId
      && !input.context.assetTypesById[node.assetId]
    ) {
      addFlowGraphIssue(issues, 'unresolved_asset_reference', `nodes.${index}.assetId`)
    }
  }

  if (aggregateDataBytes > FLOW_GRAPH_LIMITS.aggregateNodeDataBytes) {
    addFlowGraphIssue(issues, 'aggregate_node_data_limit', 'nodes', {
      maximum: FLOW_GRAPH_LIMITS.aggregateNodeDataBytes,
    })
  }

  const nodesById = new Map(
    nodes
      .filter(node => normalized.validNodeIds.has(node.id))
      .map(node => [node.id, node]),
  )
  const edgeIds = new Set<string>()
  const connectionKeys = new Set<string>()
  const incomingCounts = new Map<string, number>()
  const outgoingCounts = new Map<string, number>()

  for (const [index, edge] of input.edges.entries()) {
    if (edgeIds.has(edge.id))
      addFlowGraphIssue(issues, 'duplicate_edge_id', `edges.${index}.id`)
    edgeIds.add(edge.id)

    const connectionKey = [
      edge.sourceNodeId,
      edge.sourceHandle ?? '',
      edge.targetNodeId,
      edge.targetHandle ?? '',
    ].join(':')
    if (connectionKeys.has(connectionKey))
      addFlowGraphIssue(issues, 'duplicate_connection', `edges.${index}`)
    connectionKeys.add(connectionKey)

    const sourceNode = nodesById.get(edge.sourceNodeId)
    const targetNode = nodesById.get(edge.targetNodeId)
    if (!sourceNode) {
      if (!nodeIds.has(edge.sourceNodeId))
        addFlowGraphIssue(issues, 'unknown_source_node', `edges.${index}.sourceNodeId`)
      continue
    }
    if (!targetNode) {
      if (!nodeIds.has(edge.targetNodeId))
        addFlowGraphIssue(issues, 'unknown_target_node', `edges.${index}.targetNodeId`)
      continue
    }
    if (sourceNode.id === targetNode.id) {
      addFlowGraphIssue(issues, 'self_connection', `edges.${index}`)
      continue
    }

    const sourceHandles = getFlowNodeHandles(sourceNode, input.context)
    const targetHandles = getFlowNodeHandles(targetNode, input.context)
    const sourceHandle = sourceHandles.find(
      handle =>
        handle.direction === 'output' && handle.id === edge.sourceHandle,
    )
    const targetHandle = targetHandles.find(
      handle =>
        handle.direction === 'input' && handle.id === edge.targetHandle,
    )

    if (!sourceHandle) {
      addFlowGraphIssue(issues, 'unknown_source_handle', `edges.${index}.sourceHandle`)
      continue
    }
    if (!targetHandle) {
      addFlowGraphIssue(issues, 'unknown_target_handle', `edges.${index}.targetHandle`)
      continue
    }
    if (!areHandlesCompatible(sourceHandle, targetHandle)) {
      addFlowGraphIssue(issues, 'incompatible_connection', `edges.${index}`)
      continue
    }

    const incomingKey = `${targetNode.id}:${targetHandle.id}`
    const outgoingKey = `${sourceNode.id}:${sourceHandle.id}`
    incomingCounts.set(incomingKey, (incomingCounts.get(incomingKey) ?? 0) + 1)
    outgoingCounts.set(outgoingKey, (outgoingCounts.get(outgoingKey) ?? 0) + 1)
  }

  // A deleted Element or a stale custom selection never blocks draft
  // persistence; both only invalidate runs that would consume the node.
  const flaggedElementNodeIds = new Set<string>()
  for (const edge of input.edges) {
    if (!requiredNodeIds?.has(edge.targetNodeId))
      continue
    const sourceNode = nodesById.get(edge.sourceNodeId)
    if (!sourceNode || flaggedElementNodeIds.has(sourceNode.id))
      continue
    const elementId = getElementNodeElementId(sourceNode)
    if (!elementId)
      continue
    if (!input.context.elementReferencesById[elementId]) {
      flaggedElementNodeIds.add(sourceNode.id)
      addFlowGraphIssue(
        issues,
        'unresolved_element_reference',
        `nodes.${sourceNode.id}.data.elementId`,
      )
      continue
    }
    const resolved = resolveElementNodeReferences(sourceNode, input.context)
    if (resolved.stale.length > 0) {
      flaggedElementNodeIds.add(sourceNode.id)
      addFlowGraphIssue(
        issues,
        'stale_element_selection',
        `nodes.${sourceNode.id}.data.selectedAssetIds`,
        { count: resolved.stale.length },
      )
    }
  }

  for (const node of nodesById.values()) {
    for (const handle of getFlowNodeHandles(node, input.context)) {
      const key = `${node.id}:${handle.id}`
      const count
        = handle.direction === 'input'
          ? (incomingCounts.get(key) ?? 0)
          : (outgoingCounts.get(key) ?? 0)
      if (handle.maxConnections !== null && count > handle.maxConnections) {
        addFlowGraphIssue(
          issues,
          'handle_cardinality_overflow',
          `nodes.${node.id}.handles.${handle.id}`,
          { maximum: handle.maxConnections },
        )
      }
      if (requiredNodeIds?.has(node.id) && count < handle.minConnections) {
        addFlowGraphIssue(
          issues,
          'required_connection_missing',
          `nodes.${node.id}.handles.${handle.id}`,
          { minimum: handle.minConnections },
        )
      }
    }
  }

  validateGenerationSelections(
    nodesById,
    input.edges,
    input.context,
    issues,
    requiredNodeIds,
  )
  validateGenerationConstraints(
    nodesById,
    input.edges,
    input.context,
    issues,
    requiredNodeIds,
  )

  return { issues, nodes, valid: issues.length === 0 }
}

/** Validates a persistable canvas draft. Missing optional/required inputs are allowed. */
export function validateFlowGraphDraft(input: ValidateGraphInput) {
  return validateGraph(input, null)
}

/** Validates required inputs only for the executable nodes selected by a run. */
export function validateExecutableFlowGraph(
  input: ValidateGraphInput,
  executableNodeIds: ReadonlySet<string> = new Set(
    input.nodes.map(node => node.id),
  ),
) {
  return validateGraph(input, executableNodeIds)
}
