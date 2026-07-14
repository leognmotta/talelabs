import type {
  FlowGraphEdge,
  FlowGraphIssue,
  FlowGraphNode,
  FlowGraphValidationContext,
  FlowGraphValidationResult,
  FlowInputSelection,
  FlowValueType,
} from './types.js'

import {
  getAdaptiveGenerationInlineValues,
  resolveAdaptiveGenerationState,
} from './adaptive-generation-resolver.js'
import { evaluateGenerationContract } from './generation-evaluator.js'
import {
  getActiveGenerationInputSlots,
  getGenerationModel,
  isAdaptiveGenerationNodeType,
  isGenerationNodeType,
} from './generation-registry.js'
import {
  areHandlesCompatible,
  assetTypeToValueType,
  getFlowNodeHandles,
} from './handles.js'
import { FLOW_GRAPH_LIMITS } from './limits.js'
import {
  isFlowNodeType,
  parseAndUpcastFlowNodeData,
  validateNodeReferences,
} from './node-registry.js'

interface ValidateGraphInput {
  context: FlowGraphValidationContext
  edges: readonly FlowGraphEdge[]
  nodes: readonly FlowGraphNode[]
}

function dataByteLength(data: unknown) {
  return new TextEncoder().encode(JSON.stringify(data)).byteLength
}

function issue(
  issues: FlowGraphIssue[],
  code: string,
  field: string,
  params?: FlowGraphIssue['params'],
) {
  issues.push({ code, field, params })
}

function normalizeNodes(
  nodes: readonly FlowGraphNode[],
  issues: FlowGraphIssue[],
) {
  const validNodeIds = new Set<string>()
  const normalizedNodes = nodes.map((node, index) => {
    if (!isFlowNodeType(node.type)) {
      issue(issues, 'unknown_node_type', `nodes.${index}.type`)
      return node
    }

    try {
      const parsed = parseAndUpcastFlowNodeData(node)
      const normalized = {
        ...node,
        data: parsed.data,
        schemaVersion: parsed.schemaVersion,
        type: parsed.type,
      }
      if (!validateNodeReferences(normalized))
        issue(issues, 'invalid_node_reference', `nodes.${index}`)
      validNodeIds.add(node.id)
      return normalized
    }
    catch {
      issue(issues, 'invalid_node_data', `nodes.${index}.data`)
      return node
    }
  })

  return { nodes: normalizedNodes, validNodeIds }
}

function sourceCandidateAssetIds(
  node: FlowGraphNode,
  context: FlowGraphValidationContext,
  acceptedTypes: readonly FlowValueType[],
) {
  if (node.type === 'asset' && node.assetId) {
    const type = context.assetTypesById[node.assetId]
    return type && acceptedTypes.includes(assetTypeToValueType(type))
      ? [node.assetId]
      : []
  }

  return []
}

function sourceRuntimeItemCount(node: FlowGraphNode) {
  if (node.type === 'text')
    return String(node.data.text ?? '').trim().length > 0 ? 1 : 0
  return isGenerationNodeType(node.type) ? 1 : 0
}

function validateGenerationSelections(
  nodesById: Map<string, FlowGraphNode>,
  edges: readonly FlowGraphEdge[],
  context: FlowGraphValidationContext,
  issues: FlowGraphIssue[],
  strictSelections: boolean,
) {
  for (const node of nodesById.values()) {
    if (!isGenerationNodeType(node.type))
      continue

    const modelId
      = typeof node.data.modelId === 'string' ? node.data.modelId : ''
    const model = getGenerationModel(modelId, node.data.modelContractVersion)
    if (!model)
      continue

    const selections = node.data.inputSelections as Record<
      string,
      FlowInputSelection
    >
    const slotsById = new Map(model.inputSlots.map(slot => [slot.id, slot]))
    for (const slotId of Object.keys(selections)) {
      if (!slotsById.has(slotId)) {
        issue(
          issues,
          'unknown_input_selection',
          `nodes.${node.id}.data.inputSelections.${slotId}`,
        )
      }
    }

    const selectionSlots = isAdaptiveGenerationNodeType(node.type)
      ? model.inputSlots
      : getActiveGenerationInputSlots(model, node.data.operationId)
    for (const slot of selectionSlots) {
      const selection = selections[slot.id]
      if (!selection || selection.mode === 'auto')
        continue

      const uniqueAssetIds = new Set(selection.assetIds)
      if (uniqueAssetIds.size !== selection.assetIds.length) {
        issue(
          issues,
          'duplicate_selected_asset',
          `nodes.${node.id}.data.inputSelections.${slot.id}.assetIds`,
        )
      }
      const candidates = new Set<string>()
      for (const edge of edges) {
        if (edge.targetNodeId !== node.id || edge.targetHandle !== slot.id)
          continue
        const sourceNode = nodesById.get(edge.sourceNodeId)
        if (!sourceNode)
          continue
        for (const assetId of sourceCandidateAssetIds(
          sourceNode,
          context,
          slot.accepts,
        )) {
          candidates.add(assetId)
        }
      }

      if (!strictSelections)
        continue

      const validSelectedCount = selection.assetIds.filter(assetId =>
        candidates.has(assetId),
      ).length
      if (validSelectedCount > slot.maxItems) {
        issue(
          issues,
          'input_selection_overflow',
          `nodes.${node.id}.data.inputSelections.${slot.id}.assetIds`,
          { maximum: slot.maxItems },
        )
      }

      for (const [assetIndex, assetId] of selection.assetIds.entries()) {
        if (!candidates.has(assetId)) {
          issue(
            issues,
            'selected_asset_not_candidate',
            `nodes.${node.id}.data.inputSelections.${slot.id}.assetIds.${assetIndex}`,
          )
        }
      }
    }
  }
}

function validateGenerationConstraints(
  nodesById: Map<string, FlowGraphNode>,
  edges: readonly FlowGraphEdge[],
  context: FlowGraphValidationContext,
  issues: FlowGraphIssue[],
  requireComplete: boolean,
) {
  for (const node of nodesById.values()) {
    if (!isGenerationNodeType(node.type))
      continue
    const model = getGenerationModel(
      String(node.data.modelId ?? ''),
      node.data.modelContractVersion,
    )
    if (!model)
      continue

    const connectionCounts: Record<string, number> = {}
    for (const edge of edges) {
      if (edge.targetNodeId !== node.id || !edge.targetHandle)
        continue
      connectionCounts[edge.targetHandle]
        = (connectionCounts[edge.targetHandle] ?? 0) + 1
    }
    const settings = node.data.settings as Record<
      string,
      boolean | number | string
    >
    const itemCounts: Record<string, number> = {}
    const selections = node.data.inputSelections as Record<
      string,
      FlowInputSelection
    >
    for (const slot of model.inputSlots) {
      const candidates = new Set<string>()
      let opaqueRuntimeItems = 0
      for (const edge of edges.toSorted(
        (left, right) =>
          left.createdAt.localeCompare(right.createdAt)
          || left.id.localeCompare(right.id),
      )) {
        if (edge.targetNodeId !== node.id || edge.targetHandle !== slot.id)
          continue
        const sourceNode = nodesById.get(edge.sourceNodeId)
        if (!sourceNode)
          continue
        const assetIds = sourceCandidateAssetIds(
          sourceNode,
          context,
          slot.accepts,
        )
        for (const assetId of assetIds) candidates.add(assetId)
        if (!assetIds.length)
          opaqueRuntimeItems += sourceRuntimeItemCount(sourceNode)
      }
      const selection = selections[slot.id]
      const selectedCandidateCount
        = selection?.mode === 'manual'
          ? selection.assetIds.length
          : Math.min(candidates.size, slot.maxItems)
      itemCounts[slot.id] = selectedCandidateCount + opaqueRuntimeItems
    }
    const adaptiveEvaluation = isAdaptiveGenerationNodeType(node.type)
      ? resolveAdaptiveGenerationState({
          connectionCounts,
          ...getAdaptiveGenerationInlineValues(node.data),
          itemCounts,
          model,
          nodeType: node.type,
          settings,
        })
      : null
    const evaluation
      = adaptiveEvaluation
        ?? evaluateGenerationContract({
          connectionCounts,
          itemCounts,
          model,
          operationId: String(node.data.operationId ?? ''),
          requireComplete,
          settings,
        })
    if (
      adaptiveEvaluation
      && adaptiveEvaluation.resolvedOperationId
      !== String(node.data.operationId ?? '')
    ) {
      issue(
        issues,
        'derived_operation_mismatch',
        `nodes.${node.id}.data.operationId`,
        { resolvedOperationId: adaptiveEvaluation.resolvedOperationId ?? '' },
      )
    }
    const incompleteCodes = new Set([
      'generation_input_at_least_one',
      'generation_input_required',
      'generation_setting_required',
    ])
    for (const contractIssue of evaluation.issues) {
      if (!requireComplete && incompleteCodes.has(contractIssue.code))
        continue
      issue(
        issues,
        contractIssue.code,
        contractIssue.inputId
          ? `nodes.${node.id}.handles.${contractIssue.inputId}`
          : contractIssue.settingId
            ? `nodes.${node.id}.data.settings.${contractIssue.settingId}`
            : `nodes.${node.id}.data`,
        {
          ...(contractIssue.constraintId
            ? { constraint: contractIssue.constraintId }
            : {}),
          ...(contractIssue.messageKey
            ? { messageKey: contractIssue.messageKey }
            : {}),
        },
      )
    }
  }
}

function validateGraph(
  input: ValidateGraphInput,
  requireComplete: boolean,
): FlowGraphValidationResult {
  const issues: FlowGraphIssue[] = []

  if (input.nodes.length > FLOW_GRAPH_LIMITS.nodes)
    issue(issues, 'node_limit', 'nodes', { maximum: FLOW_GRAPH_LIMITS.nodes })
  if (input.edges.length > FLOW_GRAPH_LIMITS.edges)
    issue(issues, 'edge_limit', 'edges', { maximum: FLOW_GRAPH_LIMITS.edges })

  const normalized = normalizeNodes(input.nodes, issues)
  const nodes = normalized.nodes
  const nodeIds = new Set<string>()
  let aggregateDataBytes = 0
  for (const [index, node] of nodes.entries()) {
    if (nodeIds.has(node.id))
      issue(issues, 'duplicate_node_id', `nodes.${index}.id`)
    nodeIds.add(node.id)

    const bytes = dataByteLength(node.data)
    aggregateDataBytes += bytes
    if (bytes > FLOW_GRAPH_LIMITS.nodeDataBytes) {
      issue(issues, 'node_data_limit', `nodes.${index}.data`, {
        maximum: FLOW_GRAPH_LIMITS.nodeDataBytes,
      })
    }

    if (
      node.type === 'asset'
      && node.assetId
      && !input.context.assetTypesById[node.assetId]
    ) {
      issue(issues, 'unresolved_asset_reference', `nodes.${index}.assetId`)
    }
  }

  if (aggregateDataBytes > FLOW_GRAPH_LIMITS.aggregateNodeDataBytes) {
    issue(issues, 'aggregate_node_data_limit', 'nodes', {
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
      issue(issues, 'duplicate_edge_id', `edges.${index}.id`)
    edgeIds.add(edge.id)

    const connectionKey = [
      edge.sourceNodeId,
      edge.sourceHandle ?? '',
      edge.targetNodeId,
      edge.targetHandle ?? '',
    ].join(':')
    if (connectionKeys.has(connectionKey))
      issue(issues, 'duplicate_connection', `edges.${index}`)
    connectionKeys.add(connectionKey)

    const sourceNode = nodesById.get(edge.sourceNodeId)
    const targetNode = nodesById.get(edge.targetNodeId)
    if (!sourceNode) {
      if (!nodeIds.has(edge.sourceNodeId))
        issue(issues, 'unknown_source_node', `edges.${index}.sourceNodeId`)
      continue
    }
    if (!targetNode) {
      if (!nodeIds.has(edge.targetNodeId))
        issue(issues, 'unknown_target_node', `edges.${index}.targetNodeId`)
      continue
    }
    if (sourceNode.id === targetNode.id) {
      issue(issues, 'self_connection', `edges.${index}`)
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
      issue(issues, 'unknown_source_handle', `edges.${index}.sourceHandle`)
      continue
    }
    if (!targetHandle) {
      issue(issues, 'unknown_target_handle', `edges.${index}.targetHandle`)
      continue
    }
    if (!areHandlesCompatible(sourceHandle, targetHandle)) {
      issue(issues, 'incompatible_connection', `edges.${index}`)
      continue
    }

    const incomingKey = `${targetNode.id}:${targetHandle.id}`
    const outgoingKey = `${sourceNode.id}:${sourceHandle.id}`
    incomingCounts.set(incomingKey, (incomingCounts.get(incomingKey) ?? 0) + 1)
    outgoingCounts.set(outgoingKey, (outgoingCounts.get(outgoingKey) ?? 0) + 1)
  }

  for (const node of nodesById.values()) {
    for (const handle of getFlowNodeHandles(node, input.context)) {
      const key = `${node.id}:${handle.id}`
      const count
        = handle.direction === 'input'
          ? (incomingCounts.get(key) ?? 0)
          : (outgoingCounts.get(key) ?? 0)
      if (handle.maxConnections !== null && count > handle.maxConnections) {
        issue(
          issues,
          'handle_cardinality_overflow',
          `nodes.${node.id}.handles.${handle.id}`,
          { maximum: handle.maxConnections },
        )
      }
      if (requireComplete && count < handle.minConnections) {
        issue(
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
    requireComplete,
  )
  validateGenerationConstraints(
    nodesById,
    input.edges,
    input.context,
    issues,
    requireComplete,
  )

  return { issues, nodes, valid: issues.length === 0 }
}

/** Validates a persistable canvas draft. Missing optional/required inputs are allowed. */
export function validateFlowGraphDraft(input: ValidateGraphInput) {
  return validateGraph(input, false)
}

/** Reserved for M5 run planning, where every required input must be connected. */
export function validateExecutableFlowGraph(input: ValidateGraphInput) {
  return validateGraph(input, true)
}
