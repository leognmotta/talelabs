import type {
  Connection,
} from '@xyflow/react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import type {
  GenerationConfigurationUpdate,
  GenerationInputContract,
} from './flow-canvas-context'
import type {
  CanvasEdge,
  CanvasNode,
  FlowReferenceData,
} from './flow-canvas-types'

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
  resolveAdaptiveGenerationState,
} from '@talelabs/flows'
import { useCallback } from 'react'
import { canvasNodeToGraphNode } from './flow-canvas-serialization'
import { getFlowInputState } from './flow-input-state'

export function deriveAdaptiveOperation(input: {
  data?: CanvasNode['data']
  edges: readonly CanvasEdge[]
  node: CanvasNode
  nodes: readonly CanvasNode[]
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
  // A connected opaque source is provisional graph intent. Runtime readiness
  // uses the mock/run planner's executable item counts instead.
  const itemCounts = Object.fromEntries(
    model.inputSlots.map((slot) => {
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
    }),
  )
  return resolveAdaptiveGenerationState({
    connectionCounts,
    ...getAdaptiveGenerationInlineValues(data),
    itemCounts,
    model,
    nodeType: input.node.type,
    settings: data.settings ?? {},
  })?.resolvedOperationId ?? data.operationId
}

export function reconcileAdaptiveOperations(input: {
  edges: readonly CanvasEdge[]
  nodes: readonly CanvasNode[]
  referenceData: FlowReferenceData
}) {
  return input.nodes.map((node) => {
    if (!isAdaptiveGenerationNodeType(node.type))
      return node
    const operationId = deriveAdaptiveOperation({ ...input, node })
    return operationId === node.data.operationId
      ? node
      : { ...node, data: { ...node.data, operationId } }
  })
}

function compatibleGenerationEdgeIds(input: {
  candidateEdges: readonly CanvasEdge[]
  inputContracts: readonly GenerationInputContract[]
  nodeId: string
  nodes: readonly CanvasNode[]
  referenceData: FlowReferenceData
}) {
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

export function useFlowGenerationCompatibility(input: {
  captureHistory: () => void
  edgesRef: RefObject<CanvasEdge[]>
  markDirty: () => void
  nodesRef: RefObject<CanvasNode[]>
  referenceDataRef: RefObject<FlowReferenceData>
  setEdges: Dispatch<SetStateAction<CanvasEdge[]>>
  setNodes: Dispatch<SetStateAction<CanvasNode[]>>
}) {
  const {
    captureHistory,
    edgesRef,
    markDirty,
    nodesRef,
    referenceDataRef,
    setEdges,
    setNodes,
  } = input
  const getInputState = useCallback(
    (nodeId: string, slotId: string) => getFlowInputState({
      edges: edgesRef.current,
      nodeId,
      nodes: nodesRef.current,
      referenceData: referenceDataRef.current,
      slotId,
    }),
    [edgesRef, nodesRef, referenceDataRef],
  )
  const getCompatibleGenerationEdgeIds = useCallback((
    nodeId: string,
    inputContracts: readonly GenerationInputContract[],
    candidateEdges: readonly CanvasEdge[] = edgesRef.current,
  ) => compatibleGenerationEdgeIds({
    candidateEdges,
    inputContracts,
    nodeId,
    nodes: nodesRef.current,
    referenceData: referenceDataRef.current,
  }), [edgesRef, nodesRef, referenceDataRef])
  const getIncompatibleGenerationEdgeCount = useCallback((
    nodeId: string,
    inputContracts: readonly GenerationInputContract[],
    inputHandleAliases?: Readonly<Record<string, string>>,
  ) => {
    const candidateEdges = edgesRef.current.map(edge => (
      edge.target === nodeId
      && edge.targetHandle
      && inputHandleAliases?.[edge.targetHandle]
        ? { ...edge, targetHandle: inputHandleAliases[edge.targetHandle] }
        : edge
    ))
    const compatibleEdgeIds = getCompatibleGenerationEdgeIds(
      nodeId,
      inputContracts,
      candidateEdges,
    )
    return candidateEdges.filter(
      edge => edge.target === nodeId && !compatibleEdgeIds.has(edge.id),
    ).length
  }, [edgesRef, getCompatibleGenerationEdgeIds])
  const getIncompatibleGenerationEdges = useCallback((
    nodeId: string,
    inputContracts: readonly GenerationInputContract[],
  ) => {
    const compatibleEdgeIds = getCompatibleGenerationEdgeIds(
      nodeId,
      inputContracts,
    )
    return edgesRef.current
      .filter(edge => edge.target === nodeId && !compatibleEdgeIds.has(edge.id))
      .toSorted(compareFlowEdgesByPriority)
  }, [edgesRef, getCompatibleGenerationEdgeIds])
  const isCanvasGenerationConnectionAdmissible = useCallback((
    connection: CanvasEdge | Connection,
    targetNode: CanvasNode,
  ): boolean => {
    if (!isGenerationNodeType(targetNode.type))
      return true
    if (!connection.targetHandle)
      return false
    const model = getGenerationModel(
      String(targetNode.data.modelId ?? ''),
      targetNode.data.modelContractVersion,
    )
    if (!model)
      return false
    const connectionCounts: Record<string, number> = {}
    for (const edge of edgesRef.current) {
      if (
        edge.id === ('id' in connection ? connection.id : undefined)
        || edge.target !== targetNode.id
        || !edge.targetHandle
      ) {
        continue
      }
      connectionCounts[edge.targetHandle]
        = (connectionCounts[edge.targetHandle] ?? 0) + 1
    }
    const itemCounts = Object.fromEntries(model.inputSlots.map((slot) => {
      const inputState = getInputState(targetNode.id, slot.id)
      return [
        slot.id,
        Math.max(
          inputState?.selectedAvailableCount ?? 0,
          connectionCounts[slot.id] ?? 0,
        ),
      ]
    }))
    return isAdaptiveGenerationNodeType(targetNode.type)
      ? isAdaptiveGenerationConnectionAdmissible({
          connectionCounts,
          ...getAdaptiveGenerationInlineValues(targetNode.data),
          itemCounts,
          model,
          nodeType: targetNode.type,
          settings: targetNode.data.settings ?? {},
          slotId: connection.targetHandle,
        })
      : isGenerationConnectionAdmissible({
          connectionCounts,
          model,
          operationId: String(targetNode.data.operationId ?? ''),
          settings: targetNode.data.settings ?? {},
          slotId: connection.targetHandle,
        })
  }, [edgesRef, getInputState])
  const reconcileNodes = useCallback((
    nodes: readonly CanvasNode[],
    edges: readonly CanvasEdge[],
  ) => reconcileAdaptiveOperations({
    edges,
    nodes,
    referenceData: referenceDataRef.current,
  }), [referenceDataRef])
  const reconcileNodeData = useCallback((
    node: CanvasNode,
    data: CanvasNode['data'],
  ) => isAdaptiveGenerationNodeType(node.type)
    ? {
        ...data,
        operationId: deriveAdaptiveOperation({
          data,
          edges: edgesRef.current,
          node,
          nodes: nodesRef.current,
          referenceData: referenceDataRef.current,
        }),
      }
    : data, [edgesRef, nodesRef, referenceDataRef])
  const updateGenerationConfiguration = useCallback((
    nodeId: string,
    configuration: GenerationConfigurationUpdate,
  ) => {
    captureHistory()
    const aliasedEdges = edgesRef.current.map(edge =>
      edge.target === nodeId
      && edge.targetHandle
      && configuration.inputHandleAliases?.[edge.targetHandle]
        ? {
            ...edge,
            targetHandle: configuration.inputHandleAliases[edge.targetHandle],
          }
        : edge,
    )
    const compatibleEdgeIds = getCompatibleGenerationEdgeIds(
      nodeId,
      configuration.activeInputContracts,
      aliasedEdges,
    )
    const nextEdges = aliasedEdges.filter(
      edge => edge.target !== nodeId || compatibleEdgeIds.has(edge.id),
    )
    setEdges(nextEdges)
    setNodes(current => reconcileNodes(
      current.map((node) => {
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
      nextEdges,
    ))
    markDirty()
  }, [
    captureHistory,
    edgesRef,
    getCompatibleGenerationEdgeIds,
    markDirty,
    reconcileNodes,
    setEdges,
    setNodes,
  ])

  return {
    getIncompatibleGenerationEdgeCount,
    getIncompatibleGenerationEdges,
    getInputState,
    isGenerationConnectionAdmissible: isCanvasGenerationConnectionAdmissible,
    reconcileNodeData,
    reconcileNodes,
    updateGenerationConfiguration,
  }
}
