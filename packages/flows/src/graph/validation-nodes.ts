/** Per-node-type validation helpers and Element reference resolution. */

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

/** Validates raw nodes against their registry schemas, collecting issues. */
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

/** Reads the Element reference stored in an element node's data payload. */
export function getElementNodeElementId(node: FlowGraphNode) {
  if (node.type !== 'element')
    return null
  const elementId = node.data.elementId
  return typeof elementId === 'string' && elementId.length > 0
    ? elementId
    : null
}

/** Reads the explicit reference subset an element node was configured with. */
export function getElementNodeSelectedAssetIds(node: FlowGraphNode) {
  if (node.type !== 'element')
    return []
  const selectedAssetIds = node.data.selectedAssetIds
  return Array.isArray(selectedAssetIds)
    ? selectedAssetIds.filter((id): id is string => typeof id === 'string')
    : []
}

/**
 * Resolves the ordered references an element node emits. The node's explicit
 * choice intersects the Element's current references in Element order;
 * `stale` lists chosen Assets the Element no longer references — they
 * invalidate runs instead of vanishing silently.
 */
export function resolveElementNodeReferences(
  node: FlowGraphNode,
  context: FlowGraphValidationContext,
) {
  const elementId = getElementNodeElementId(node)
  const references = elementId
    ? context.elementReferencesById[elementId] ?? []
    : []
  const selected = new Set(getElementNodeSelectedAssetIds(node))
  return {
    assetIds: references.filter(assetId => selected.has(assetId)),
    stale: getElementNodeSelectedAssetIds(node)
      .filter(assetId => !references.includes(assetId)),
  }
}

/** Candidate Asset IDs one source node can feed into a consuming slot. */
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

  const elementId = getElementNodeElementId(node)
  if (elementId && acceptedTypes.includes('ImageSet')) {
    return resolveElementNodeReferences(node, context).assetIds.filter(assetId => context.assetTypesById[assetId] === 'image')
  }

  return []
}

/** How many runtime items a source node emits for limit checks. */
export function sourceRuntimeItemCount(node: FlowGraphNode) {
  if (node.type === 'text')
    return String(node.data.text ?? '').trim().length > 0 ? 1 : 0
  return isGenerationNodeType(node.type) ? 1 : 0
}
