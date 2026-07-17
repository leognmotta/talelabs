/** Pure generation-input compatibility queries for the editable canvas graph. */

import type { Connection } from '@xyflow/react'
import type { CanvasEdge, CanvasNode, FlowReferenceData } from '../editor/flow-canvas-types'
import type { GenerationInputContract } from './flow-generation-configuration'

import {
  areHandlesCompatible,
  compareFlowEdgesByPriority,
  getAdaptiveGenerationInlineValues,
  getFlowNodeHandles,
  getGenerationModel,
  isAdaptiveGenerationConnectionAdmissible,
  isAdaptiveGenerationNodeType,
  isGenerationConnectionAdmissible,
  isGenerationNodeType,
} from '@talelabs/flows'
import { canvasNodeToGraphNode } from '../editor/persistence/flow-node-serialization'
import { getFlowInputState } from './flow-input-state'

/** Resolves one input slot from the current graph without subscribing to it. */
export function getCanvasInputState(input: {
  /** Current editable edges. */
  edges: readonly CanvasEdge[]
  /** Node that owns the input slot. */
  nodeId: string
  /** Current editable nodes. */
  nodes: readonly CanvasNode[]
  /** External references used to resolve available Assets. */
  referenceData: FlowReferenceData
  /** Stable semantic slot ID. */
  slotId: string
}) {
  return getFlowInputState({
    edges: [...input.edges],
    nodeId: input.nodeId,
    nodes: [...input.nodes],
    referenceData: input.referenceData,
    slotId: input.slotId,
  })
}

/** Returns the incoming edge IDs that survive a target generation contract. */
export function getCompatibleCanvasGenerationEdgeIds(input: {
  /** Candidate edges, including any pending handle aliases. */
  candidateEdges: readonly CanvasEdge[]
  /** Input contracts exposed by the target model and operation. */
  inputContracts: readonly GenerationInputContract[]
  /** Generation node receiving the candidate edges. */
  nodeId: string
  /** Current editable nodes. */
  nodes: readonly CanvasNode[]
  /** External references needed to resolve source handles. */
  referenceData: FlowReferenceData
}): Set<string> {
  const contractsById = new Map(
    input.inputContracts.map(contract => [contract.id, contract]),
  )
  const connectionCounts = new Map<string, number>()
  const exclusiveGroupSlots = new Map<string, string>()
  let candidateOperationIds: null | Set<string> = null
  const compatibleEdgeIds = new Set<string>()
  const incomingEdges = input.candidateEdges
    .filter(edge => edge.target === input.nodeId)
    .toSorted(compareFlowEdgesByPriority)

  for (const edge of incomingEdges) {
    const contract = edge.targetHandle
      ? contractsById.get(edge.targetHandle)
      : undefined
    const sourceNode = input.nodes.find(node => node.id === edge.source)
    if (!contract || !sourceNode || !edge.sourceHandle)
      continue
    const sourceHandle = getFlowNodeHandles(
      canvasNodeToGraphNode(sourceNode),
      input.referenceData,
    ).find(
      handle => handle.direction === 'output' && handle.id === edge.sourceHandle,
    )
    if (!sourceHandle)
      continue
    const targetHandle = {
      direction: 'input' as const,
      id: contract.id,
      maxConnections: contract.maxConnections,
      minConnections: 0,
      valueTypes: contract.valueTypes,
    }
    if (!areHandlesCompatible(sourceHandle, targetHandle))
      continue
    const connectionCount = connectionCounts.get(contract.id) ?? 0
    if (connectionCount >= contract.maxConnections)
      continue
    if (contract.exclusiveGroup) {
      const selectedSlot = exclusiveGroupSlots.get(contract.exclusiveGroup)
      if (selectedSlot && selectedSlot !== contract.id)
        continue
      exclusiveGroupSlots.set(contract.exclusiveGroup, contract.id)
    }
    if (contract.operationIds) {
      const nextCandidates = new Set(
        contract.operationIds.filter(operationId =>
          !candidateOperationIds || candidateOperationIds.has(operationId),
        ),
      )
      if (!nextCandidates.size)
        continue
      candidateOperationIds = nextCandidates
    }
    connectionCounts.set(contract.id, connectionCount + 1)
    compatibleEdgeIds.add(edge.id)
  }
  return compatibleEdgeIds
}

/** Checks model-operation admission for one proposed generation connection. */
export function isCanvasGenerationConnectionAdmissible(input: {
  /** Proposed new or reconnected edge. */
  connection: CanvasEdge | Connection
  /** Current editable edges. */
  edges: readonly CanvasEdge[]
  /** Current editable nodes. */
  nodes: readonly CanvasNode[]
  /** External references used to count executable input items. */
  referenceData: FlowReferenceData
  /** Generation node receiving the connection. */
  targetNode: CanvasNode
}): boolean {
  if (!isGenerationNodeType(input.targetNode.type))
    return true
  if (!input.connection.targetHandle)
    return false
  const model = getGenerationModel(
    String(input.targetNode.data.modelId ?? ''),
    input.targetNode.data.modelContractVersion,
  )
  if (!model)
    return false
  const connectionCounts: Record<string, number> = {}
  for (const edge of input.edges) {
    if (
      edge.id === ('id' in input.connection ? input.connection.id : undefined)
      || edge.target !== input.targetNode.id
      || !edge.targetHandle
    ) {
      continue
    }
    connectionCounts[edge.targetHandle]
      = (connectionCounts[edge.targetHandle] ?? 0) + 1
  }
  const itemCounts = Object.fromEntries(model.inputSlots.map((slot) => {
    const inputState = getCanvasInputState({
      edges: input.edges,
      nodeId: input.targetNode.id,
      nodes: input.nodes,
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
  return isAdaptiveGenerationNodeType(input.targetNode.type)
    ? isAdaptiveGenerationConnectionAdmissible({
        connectionCounts,
        ...getAdaptiveGenerationInlineValues(input.targetNode.data),
        itemCounts,
        model,
        nodeType: input.targetNode.type,
        settings: input.targetNode.data.settings ?? {},
        slotId: input.connection.targetHandle,
      })
    : isGenerationConnectionAdmissible({
        connectionCounts,
        model,
        operationId: String(input.targetNode.data.operationId ?? ''),
        settings: input.targetNode.data.settings ?? {},
        slotId: input.connection.targetHandle,
      })
}
