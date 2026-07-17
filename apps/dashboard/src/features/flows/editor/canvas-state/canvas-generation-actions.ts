/** Model-adaptive graph reconciliation and generation configuration mutations. */

import type { GenerationConfigurationUpdate } from '../../generation/flow-generation-configuration'
import type { CanvasEdge, CanvasNode, FlowReferenceData } from '../flow-canvas-types'
import type { CanvasStore } from './canvas-store'

import {
  getAdaptiveGenerationInlineValues,
  getGenerationModel,
  isAdaptiveGenerationNodeType,
  resolveAdaptiveGenerationState,
} from '@talelabs/flows'
import { getCompatibleCanvasGenerationEdgeIds } from '../../generation/flow-generation-compatibility'
import { getFlowInputState } from '../../generation/flow-input-state'
import { captureCanvasHistory } from './canvas-history-actions'

/** Derives the adaptive operation for one node against the supplied graph. */
export function deriveCanvasAdaptiveOperation(input: {
  /** Optional candidate data used while updating the node. */
  data?: CanvasNode['data']
  /** Candidate graph edges. */
  edges: readonly CanvasEdge[]
  /** Node whose operation is being derived. */
  node: CanvasNode
  /** Candidate graph nodes. */
  nodes: readonly CanvasNode[]
  /** External Asset and model reference data needed by input resolution. */
  referenceData: FlowReferenceData
}) {
  const data = input.data ?? input.node.data
  if (!isAdaptiveGenerationNodeType(input.node.type))
    return data.operationId
  const model = getGenerationModel(
    String(data.modelId ?? ''),
    data.modelContractVersion,
  )
  if (!model)
    return data.operationId
  const connectionCounts: Record<string, number> = {}
  for (const edge of input.edges) {
    if (edge.target !== input.node.id || !edge.targetHandle)
      continue
    connectionCounts[edge.targetHandle]
      = (connectionCounts[edge.targetHandle] ?? 0) + 1
  }
  const itemCounts = Object.fromEntries(model.inputSlots.map((slot) => {
    const inputState = getFlowInputState({
      edges: [...input.edges],
      nodeId: input.node.id,
      nodes: [...input.nodes],
      referenceData: input.referenceData,
      slotId: slot.id,
    })
    return [
      slot.id,
      Math.max(
        inputState?.selectedAvailableCount ?? 0,
        connectionCounts[slot.id] ?? 0,
      ),
    ]
  }))
  return resolveAdaptiveGenerationState({
    connectionCounts,
    ...getAdaptiveGenerationInlineValues(data),
    itemCounts,
    model,
    nodeType: input.node.type,
    settings: data.settings ?? {},
  })?.resolvedOperationId ?? data.operationId
}

/** Reconciles adaptive operation IDs after a graph or node-data change. */
export function reconcileCanvasGenerationNodes(input: {
  /** Candidate graph edges. */
  edges: readonly CanvasEdge[]
  /** Candidate graph nodes. */
  nodes: readonly CanvasNode[]
  /** External reference data used to resolve executable input items. */
  referenceData: FlowReferenceData
}): CanvasNode[] {
  return input.nodes.map((node) => {
    if (!isAdaptiveGenerationNodeType(node.type))
      return node
    const operationId = deriveCanvasAdaptiveOperation({ ...input, node })
    return operationId === node.data.operationId
      ? node
      : { ...node, data: { ...node.data, operationId } }
  })
}

/** Applies a model transition with compatible edges and settings in one mutation. */
export function updateCanvasGenerationConfiguration(
  input: {
    /** External reference data used for compatibility and operation resolution. */
    referenceData: FlowReferenceData
    /** Scoped canvas store receiving the configuration transaction. */
    store: CanvasStore
  },
  /** Node receiving the configuration. */
  nodeId: string,
  /** Resolved target generation configuration. */
  configuration: GenerationConfigurationUpdate,
): void {
  const state = input.store.getState()
  captureCanvasHistory(input.store)
  const aliasedEdges = state.edges.map(edge => (
    edge.target === nodeId
    && edge.targetHandle
    && configuration.inputHandleAliases?.[edge.targetHandle]
      ? {
          ...edge,
          targetHandle: configuration.inputHandleAliases[edge.targetHandle],
        }
      : edge
  ))
  const compatibleEdgeIds = getCompatibleCanvasGenerationEdgeIds({
    candidateEdges: aliasedEdges,
    inputContracts: configuration.activeInputContracts,
    nodeId,
    nodes: state.nodes,
    referenceData: input.referenceData,
  })
  const nextEdges = aliasedEdges.filter(
    edge => edge.target !== nodeId || compatibleEdgeIds.has(edge.id),
  )
  const nextNodes = reconcileCanvasGenerationNodes({
    edges: nextEdges,
    nodes: state.nodes.map((node) => {
      if (node.id !== nodeId)
        return node
      return {
        ...node,
        data: {
          ...node.data,
          inputSelections: Object.fromEntries(
            configuration.inputSlotIds.map((slotId) => {
              const legacySlotId = Object.entries(
                configuration.inputHandleAliases ?? {},
              ).find(([, target]) => target === slotId)?.[0]
              const currentSelection = node.data.inputSelections?.[slotId]
                ?? (legacySlotId
                  ? node.data.inputSelections?.[legacySlotId]
                  : undefined) ?? { mode: 'auto' }
              const maximum = configuration.inputMaximums?.[slotId]
              const selection = currentSelection.mode === 'manual'
                && Array.isArray(currentSelection.assetIds)
                && maximum !== undefined
                ? {
                    ...currentSelection,
                    assetIds: currentSelection.assetIds.slice(0, maximum),
                  }
                : currentSelection
              return [slotId, selection]
            }),
          ),
          modelContractVersion: configuration.modelContractVersion,
          modelId: configuration.modelId,
          operationId: configuration.operationId,
          settings: configuration.settings,
        },
      }
    }),
    referenceData: input.referenceData,
  })
  input.store.setState({
    edges: nextEdges,
    graphRevision: state.graphRevision + 1,
    nodes: nextNodes,
  })
}
