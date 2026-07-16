import type {
  FlowGraphIssue,
  FlowGraphNode,
  FlowGraphValidationContext,
  FlowValueType,
} from './types.js'
import { isGenerationNodeType } from '../generation/registry/index.js'
import {
  isFlowNodeType,
  parseAndUpcastFlowNodeData,
  validateNodeReferences,
} from '../nodes/registry/index.js'
import { assetTypeToValueType } from './asset-value-types.js'
import { addFlowGraphIssue } from './validation-issues.js'

export function normalizeFlowGraphNodes(
  nodes: readonly FlowGraphNode[],
  issues: FlowGraphIssue[],
) {
  const validNodeIds = new Set<string>()
  const normalizedNodes = nodes.map((node, index) => {
    if (!isFlowNodeType(node.type)) {
      addFlowGraphIssue(issues, 'unknown_node_type', `nodes.${index}.type`)
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
        addFlowGraphIssue(issues, 'invalid_node_reference', `nodes.${index}`)
      validNodeIds.add(node.id)
      return normalized
    }
    catch {
      addFlowGraphIssue(issues, 'invalid_node_data', `nodes.${index}.data`)
      return node
    }
  })

  return { nodes: normalizedNodes, validNodeIds }
}

export function sourceCandidateAssetIds(
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

export function sourceRuntimeItemCount(node: FlowGraphNode) {
  if (node.type === 'text')
    return String(node.data.text ?? '').trim().length > 0 ? 1 : 0
  return isGenerationNodeType(node.type) ? 1 : 0
}
