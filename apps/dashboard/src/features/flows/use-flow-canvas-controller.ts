import type { FlowNodeType } from '@talelabs/flows'
import type {
  Connection,
  EdgeChange,
  NodeChange,
  OnReconnect,
  ReactFlowInstance,
} from '@xyflow/react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { GenerationInputContract } from './flow-canvas-context'
import type {
  CanvasEdge,
  CanvasNode,
  FlowReferenceData,
} from './flow-canvas-types'

import { createId } from '@paralleldrive/cuid2'
import {
  areHandlesCompatible,
  compareFlowEdgesByPriority,
  getDefaultNodeData,
  getFlowNodeHandles,
  getFlowNodeTypeDefinition,
  getGenerationModel,
  isGenerationConnectionAdmissible,
  isGenerationNodeType,
} from '@talelabs/flows'
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  reconnectEdge,
} from '@xyflow/react'
import { useCallback } from 'react'
import { getAutoLayoutedNodes } from './flow-auto-layout'
import { canvasNodeToGraphNode } from './flow-canvas-serialization'
import { getFlowInputState } from './flow-input-state'

let latestEdgeCreatedAt = 0

function createEdgeCreatedAt() {
  latestEdgeCreatedAt = Math.max(Date.now(), latestEdgeCreatedAt + 1)
  return new Date(latestEdgeCreatedAt).toISOString()
}

export function useFlowCanvasController(input: {
  edgesRef: RefObject<CanvasEdge[]>
  markDirty: () => void
  nodesRef: RefObject<CanvasNode[]>
  onConnectionRejected: () => void
  reactFlow: ReactFlowInstance<CanvasNode, CanvasEdge>
  referenceDataRef: RefObject<FlowReferenceData>
  selectedEdgeIds: string[]
  selectedNodeIds: string[]
  setEdges: Dispatch<SetStateAction<CanvasEdge[]>>
  setEditingImageCropNodeId: Dispatch<SetStateAction<null | string>>
  setNodes: Dispatch<SetStateAction<CanvasNode[]>>
  setSelectedIds: (nodeIds: string[], edgeIds?: string[]) => void
  clearSelection: () => void
  wrapperRef: RefObject<HTMLDivElement | null>
}) {
  const {
    clearSelection,
    edgesRef,
    markDirty,
    nodesRef,
    onConnectionRejected,
    reactFlow,
    referenceDataRef,
    selectedEdgeIds,
    selectedNodeIds,
    setEdges,
    setEditingImageCropNodeId,
    setNodes,
    setSelectedIds,
    wrapperRef,
  } = input
  const getNode = useCallback((nodeId: string) => (
    nodesRef.current.find(node => node.id === nodeId)
  ), [nodesRef])
  const getInputState = useCallback((nodeId: string, slotId: string) => (
    getFlowInputState({
      edges: edgesRef.current,
      nodeId,
      nodes: nodesRef.current,
      referenceData: referenceDataRef.current,
      slotId,
    })
  ), [edgesRef, nodesRef, referenceDataRef])
  const getCompatibleGenerationEdgeIds = useCallback((
    nodeId: string,
    inputContracts: readonly GenerationInputContract[],
  ) => {
    const contractsById = new Map(inputContracts.map(contract => [contract.id, contract]))
    const connectionCounts = new Map<string, number>()
    const exclusiveGroupSlots = new Map<string, string>()
    const compatibleEdgeIds = new Set<string>()
    const incomingEdges = edgesRef.current
      .filter(edge => edge.target === nodeId)
      .toSorted(compareFlowEdgesByPriority)

    for (const edge of incomingEdges) {
      const contract = edge.targetHandle
        ? contractsById.get(edge.targetHandle)
        : undefined
      const sourceNode = nodesRef.current.find(node => node.id === edge.source)
      if (!contract || !sourceNode || !edge.sourceHandle)
        continue
      const sourceHandle = getFlowNodeHandles(
        canvasNodeToGraphNode(sourceNode),
        referenceDataRef.current,
      ).find(handle => (
        handle.direction === 'output' && handle.id === edge.sourceHandle
      ))
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
      connectionCounts.set(contract.id, connectionCount + 1)
      compatibleEdgeIds.add(edge.id)
    }

    return compatibleEdgeIds
  }, [edgesRef, nodesRef, referenceDataRef])
  const getIncompatibleGenerationEdgeCount = useCallback((
    nodeId: string,
    inputContracts: readonly GenerationInputContract[],
  ) => {
    const compatibleEdgeIds = getCompatibleGenerationEdgeIds(
      nodeId,
      inputContracts,
    )
    return edgesRef.current.filter(edge => (
      edge.target === nodeId && !compatibleEdgeIds.has(edge.id)
    )).length
  }, [edgesRef, getCompatibleGenerationEdgeIds])
  const isValidConnection = useCallback((connection: Connection | CanvasEdge) => {
    if (
      !connection.sourceHandle
      || !connection.targetHandle
      || connection.source === connection.target
    ) {
      return false
    }
    const sourceNode = getNode(connection.source)
    const targetNode = getNode(connection.target)
    if (!sourceNode || !targetNode)
      return false
    const sourceHandle = getFlowNodeHandles(
      canvasNodeToGraphNode(sourceNode),
      referenceDataRef.current,
    ).find(handle => handle.direction === 'output' && handle.id === connection.sourceHandle)
    const targetHandle = getFlowNodeHandles(
      canvasNodeToGraphNode(targetNode),
      referenceDataRef.current,
    ).find(handle => handle.direction === 'input' && handle.id === connection.targetHandle)
    if (!sourceHandle || !targetHandle || !areHandlesCompatible(sourceHandle, targetHandle))
      return false
    const connections = edgesRef.current.filter(edge => (
      edge.id !== ('id' in connection ? connection.id : undefined)
      && edge.target === connection.target
      && edge.targetHandle === connection.targetHandle
    ))
    if (targetHandle.maxConnections !== null && connections.length >= targetHandle.maxConnections)
      return false
    if (isGenerationNodeType(targetNode.type)) {
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
      if (!isGenerationConnectionAdmissible({
        connectionCounts,
        model,
        operationId: String(targetNode.data.operationId ?? ''),
        settings: targetNode.data.settings ?? {},
        slotId: connection.targetHandle,
      })) {
        return false
      }
    }
    return !edgesRef.current.some(edge => (
      edge.id !== ('id' in connection ? connection.id : undefined)
      && edge.source === connection.source
      && edge.sourceHandle === connection.sourceHandle
      && edge.target === connection.target
      && edge.targetHandle === connection.targetHandle
    ))
  }, [edgesRef, getNode, referenceDataRef])

  const updateNodeData = useCallback((
    nodeId: string,
    update: (data: Record<string, any>) => Record<string, any>,
  ) => {
    setNodes(current => current.map((node) => {
      if (node.id !== nodeId)
        return node
      const data = update(node.data)
      return { ...node, data, draggable: data.locked !== true }
    }))
    markDirty()
  }, [markDirty, setNodes])
  const updateGenerationConfiguration = useCallback((
    nodeId: string,
    configuration: {
      activeInputContracts: readonly GenerationInputContract[]
      inputSlotIds: readonly string[]
      modelContractVersion: string
      modelId: string
      operationId: string
      settings: Readonly<Record<string, boolean | number | string>>
    },
  ) => {
    const compatibleEdgeIds = getCompatibleGenerationEdgeIds(
      nodeId,
      configuration.activeInputContracts,
    )
    setEdges(current => current.filter(edge => (
      edge.target !== nodeId
      || compatibleEdgeIds.has(edge.id)
    )))
    setNodes(current => current.map((node) => {
      if (node.id !== nodeId)
        return node
      return {
        ...node,
        data: {
          ...node.data,
          inputSelections: Object.fromEntries(configuration.inputSlotIds.map(slotId => [
            slotId,
            node.data.inputSelections?.[slotId] ?? { mode: 'auto' },
          ])),
          modelContractVersion: configuration.modelContractVersion,
          modelId: configuration.modelId,
          operationId: configuration.operationId,
          settings: configuration.settings,
        },
      }
    }))
    markDirty()
  }, [getCompatibleGenerationEdgeIds, markDirty, setEdges, setNodes])
  const updateNodeReference = useCallback((
    nodeId: string,
    reference: { assetId?: null | string, elementId?: null | string },
  ) => {
    setNodes(current => current.map((node) => {
      if (node.id !== nodeId)
        return node
      if (reference.assetId === undefined || reference.assetId === node.assetId)
        return { ...node, ...reference }
      const { crop: _crop, ...data } = node.data
      return { ...node, ...reference, data }
    }))
    if (reference.assetId !== undefined) {
      setEditingImageCropNodeId(current => (
        current === nodeId ? null : current
      ))
    }
    markDirty()
  }, [markDirty, setEditingImageCropNodeId, setNodes])
  const setInputSelection = useCallback((
    nodeId: string,
    slotId: string,
    selection: { mode: 'auto' } | { assetIds: string[], mode: 'manual' },
  ) => updateNodeData(nodeId, current => ({
    ...current,
    inputSelections: {
      ...current.inputSelections,
      [slotId]: selection,
    },
  })), [updateNodeData])

  const deleteNodes = useCallback((nodeIds: string[]) => {
    const ids = new Set(nodeIds)
    setNodes(current => current.filter(node => !ids.has(node.id)))
    setEdges(current => current.filter(edge => (
      !ids.has(edge.source) && !ids.has(edge.target)
    )))
    setEditingImageCropNodeId(current => (
      current && ids.has(current) ? null : current
    ))
    markDirty()
  }, [markDirty, setEdges, setEditingImageCropNodeId, setNodes])
  const deleteSelection = useCallback(() => {
    const nodeIds = new Set(selectedNodeIds)
    const edgeIds = new Set(selectedEdgeIds)
    setNodes(current => current.filter(node => !nodeIds.has(node.id)))
    setEdges(current => current.filter(edge => (
      !edgeIds.has(edge.id)
      && !nodeIds.has(edge.source)
      && !nodeIds.has(edge.target)
    )))
    clearSelection()
    setEditingImageCropNodeId(current => (
      current && nodeIds.has(current) ? null : current
    ))
    markDirty()
  }, [
    clearSelection,
    markDirty,
    selectedEdgeIds,
    selectedNodeIds,
    setEdges,
    setEditingImageCropNodeId,
    setNodes,
  ])
  const duplicateNodes = useCallback((nodeIds: string[]) => {
    const ids = new Set(nodeIds)
    const idMap = new Map<string, string>()
    const copies = nodesRef.current
      .filter(node => ids.has(node.id))
      .map((node) => {
        const id = createId()
        idMap.set(node.id, id)
        return {
          ...node,
          id,
          position: { x: node.position.x + 48, y: node.position.y + 48 },
          selected: true,
        }
      })
    const copiedEdges = edgesRef.current.flatMap((edge) => {
      const source = idMap.get(edge.source)
      const target = idMap.get(edge.target)
      return source && target
        ? [{
            ...edge,
            data: { createdAt: createEdgeCreatedAt() },
            id: createId(),
            source,
            target,
          }]
        : []
    })
    setNodes(current => [
      ...current.map(node => ({ ...node, selected: false })),
      ...copies,
    ])
    setEdges(current => [...current, ...copiedEdges])
    setSelectedIds(copies.map(node => node.id))
    markDirty()
  }, [edgesRef, markDirty, nodesRef, setEdges, setNodes, setSelectedIds])
  const addNode = useCallback((type: FlowNodeType) => {
    const bounds = wrapperRef.current?.getBoundingClientRect()
    const position = reactFlow.screenToFlowPosition({
      x: bounds ? bounds.left + bounds.width / 2 : window.innerWidth / 2,
      y: bounds ? bounds.top + bounds.height / 2 : window.innerHeight / 2,
    })
    const reference = getFlowNodeTypeDefinition(type).reference
    setNodes(current => [
      ...current.map(node => ({ ...node, selected: false })),
      {
        assetId: null,
        data: getDefaultNodeData(type),
        elementId: null,
        id: createId(),
        position,
        schemaVersion: getFlowNodeTypeDefinition(type).currentVersion,
        selected: true,
        type,
        ...(reference === 'asset' ? { assetId: null } : {}),
        ...(reference === 'element' ? { elementId: null } : {}),
      },
    ])
    markDirty()
  }, [markDirty, reactFlow, setNodes, wrapperRef])
  const autoFormatSelection = useCallback((nodeIds: string[]) => {
    const ids = new Set(nodeIds)
    const selectedNodes = nodesRef.current.filter(node => (
      ids.has(node.id) && node.data.locked !== true
    ))
    if (selectedNodes.length < 2)
      return

    const movableIds = new Set(selectedNodes.map(node => node.id))
    const selectedEdges = edgesRef.current.filter(edge => (
      movableIds.has(edge.source) && movableIds.has(edge.target)
    ))
    const layoutedNodes = getAutoLayoutedNodes(selectedNodes, selectedEdges)
    const currentOrigin = {
      x: Math.min(...selectedNodes.map(node => node.position.x)),
      y: Math.min(...selectedNodes.map(node => node.position.y)),
    }
    const layoutOrigin = {
      x: Math.min(...layoutedNodes.map(node => node.position.x)),
      y: Math.min(...layoutedNodes.map(node => node.position.y)),
    }
    const positions = new Map(layoutedNodes.map(node => [
      node.id,
      {
        x: node.position.x + currentOrigin.x - layoutOrigin.x,
        y: node.position.y + currentOrigin.y - layoutOrigin.y,
      },
    ]))

    setNodes(current => current.map((node) => {
      const position = positions.get(node.id)
      return position ? { ...node, position } : node
    }))
    markDirty()
  }, [edgesRef, markDirty, nodesRef, setNodes])

  const onNodesChange = useCallback((changes: NodeChange<CanvasNode>[]) => {
    const removedNodeIds = new Set(changes.flatMap(change => (
      change.type === 'remove' ? [change.id] : []
    )))
    setNodes(current => applyNodeChanges(changes, current))
    const positionChanged = changes.some(change => change.type === 'position')
    if (removedNodeIds.size) {
      setEdges(current => current.filter(edge => (
        !removedNodeIds.has(edge.source) && !removedNodeIds.has(edge.target)
      )))
    }
    if (removedNodeIds.size || positionChanged)
      markDirty()
  }, [markDirty, setEdges, setNodes])
  const onEdgesChange = useCallback((changes: EdgeChange<CanvasEdge>[]) => {
    setEdges(current => applyEdgeChanges(changes, current))
    if (changes.some(change => change.type === 'remove'))
      markDirty()
  }, [markDirty, setEdges])
  const onConnect = useCallback((connection: Connection) => {
    if (!isValidConnection(connection)) {
      onConnectionRejected()
      return
    }
    setEdges(current => addEdge({
      ...connection,
      data: { createdAt: createEdgeCreatedAt() },
      id: createId(),
    }, current))
    markDirty()
  }, [isValidConnection, markDirty, onConnectionRejected, setEdges])
  const onReconnect: OnReconnect<CanvasEdge> = useCallback((oldEdge, connection) => {
    if (!isValidConnection({ ...oldEdge, ...connection })) {
      onConnectionRejected()
      return
    }
    setEdges(current => reconnectEdge(
      oldEdge,
      connection,
      current,
      { shouldReplaceId: false },
    ))
    markDirty()
  }, [isValidConnection, markDirty, onConnectionRejected, setEdges])

  return {
    addNode,
    autoFormatSelection,
    deleteNodes,
    deleteSelection,
    duplicateNodes,
    getIncompatibleGenerationEdgeCount,
    getInputState,
    getNode,
    isValidConnection,
    onConnect,
    onEdgesChange,
    onNodesChange,
    onReconnect,
    setInputSelection,
    updateGenerationConfiguration,
    updateNodeData,
    updateNodeReference,
  }
}
