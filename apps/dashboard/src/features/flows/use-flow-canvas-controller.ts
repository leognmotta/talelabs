import type { FlowNodeType } from '@talelabs/flows'
import type {
  Connection,
  EdgeChange,
  NodeChange,
  OnReconnect,
  ReactFlowInstance,
} from '@xyflow/react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import type {
  CanvasEdge,
  CanvasNode,
  FlowReferenceData,
} from './flow-canvas-types'

import { createId } from '@paralleldrive/cuid2'
import {
  areHandlesCompatible,
  getFlowNodeHandles,
} from '@talelabs/flows'
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  reconnectEdge,
} from '@xyflow/react'
import { useCallback, useRef } from 'react'
import { getAutoLayoutedNodes } from './flow-auto-layout'
import { createCanvasNode } from './flow-canvas-node-factory'
import { canvasNodeToGraphNode } from './flow-canvas-serialization'
import { useFlowGenerationCompatibility } from './use-flow-generation-compatibility'

let latestEdgeCreatedAt = 0

function createEdgeCreatedAt() {
  latestEdgeCreatedAt = Math.max(Date.now(), latestEdgeCreatedAt + 1)
  return new Date(latestEdgeCreatedAt).toISOString()
}

export function useFlowCanvasController(input: {
  captureHistory: () => void
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
    captureHistory,
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
  const positionHistoryActiveRef = useRef(false)
  const getNode = useCallback(
    (nodeId: string) => nodesRef.current.find(node => node.id === nodeId),
    [nodesRef],
  )
  const {
    getIncompatibleGenerationEdgeCount,
    getIncompatibleGenerationEdges,
    getInputState,
    isGenerationConnectionAdmissible,
    reconcileNodeData,
    reconcileNodes,
    updateGenerationConfiguration,
  } = useFlowGenerationCompatibility({
    captureHistory,
    edgesRef,
    markDirty,
    nodesRef,
    referenceDataRef,
    setEdges,
    setNodes,
  })
  const isValidConnection = useCallback(
    (connection: Connection | CanvasEdge) => {
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
      ).find(
        handle =>
          handle.direction === 'output'
          && handle.id === connection.sourceHandle,
      )
      const targetHandle = getFlowNodeHandles(
        canvasNodeToGraphNode(targetNode),
        referenceDataRef.current,
      ).find(
        handle =>
          handle.direction === 'input' && handle.id === connection.targetHandle,
      )
      if (
        !sourceHandle
        || !targetHandle
        || !areHandlesCompatible(sourceHandle, targetHandle)
      ) {
        return false
      }
      const connections = edgesRef.current.filter(
        edge =>
          edge.id !== ('id' in connection ? connection.id : undefined)
          && edge.target === connection.target
          && edge.targetHandle === connection.targetHandle,
      )
      if (
        targetHandle.maxConnections !== null
        && connections.length >= targetHandle.maxConnections
      ) {
        return false
      }
      if (!isGenerationConnectionAdmissible(connection, targetNode))
        return false
      return !edgesRef.current.some(
        edge =>
          edge.id !== ('id' in connection ? connection.id : undefined)
          && edge.source === connection.source
          && edge.sourceHandle === connection.sourceHandle
          && edge.target === connection.target
          && edge.targetHandle === connection.targetHandle,
      )
    },
    [edgesRef, getNode, isGenerationConnectionAdmissible, referenceDataRef],
  )

  const updateNodeData = useCallback(
    (
      nodeId: string,
      update: (data: Record<string, any>) => Record<string, any>,
    ) => {
      captureHistory()
      setNodes(current =>
        current.map((node) => {
          if (node.id !== nodeId)
            return node
          const data = reconcileNodeData(node, update(node.data))
          return { ...node, data, draggable: data.locked !== true }
        }),
      )
      markDirty()
    },
    [captureHistory, markDirty, reconcileNodeData, setNodes],
  )
  const updateNodeReference = useCallback(
    (
      nodeId: string,
      reference: { assetId: null | string },
    ) => {
      captureHistory()
      setNodes(current =>
        current.map((node) => {
          if (node.id !== nodeId)
            return node
          if (reference.assetId === node.assetId) {
            return { ...node, ...reference }
          }
          const { crop: _crop, ...data } = node.data
          return { ...node, ...reference, data }
        }),
      )
      setEditingImageCropNodeId(current =>
        current === nodeId ? null : current,
      )
      markDirty()
    },
    [captureHistory, markDirty, setEditingImageCropNodeId, setNodes],
  )
  const setInputSelection = useCallback(
    (
      nodeId: string,
      slotId: string,
      selection: { mode: 'auto' } | { assetIds: string[], mode: 'manual' },
    ) =>
      updateNodeData(nodeId, current => ({
        ...current,
        inputSelections: {
          ...current.inputSelections,
          [slotId]: selection,
        },
      })),
    [updateNodeData],
  )

  const deleteNodes = useCallback(
    (nodeIds: string[]) => {
      const ids = new Set(nodeIds)
      if (!nodesRef.current.some(node => ids.has(node.id)))
        return
      captureHistory()
      const nextEdges = edgesRef.current.filter(
        edge => !ids.has(edge.source) && !ids.has(edge.target),
      )
      setEdges(nextEdges)
      setNodes(current =>
        reconcileNodes(
          current.filter(node => !ids.has(node.id)),
          nextEdges,
        ),
      )
      setEditingImageCropNodeId(current =>
        current && ids.has(current) ? null : current,
      )
      markDirty()
    },
    [
      captureHistory,
      edgesRef,
      markDirty,
      nodesRef,
      reconcileNodes,
      setEdges,
      setEditingImageCropNodeId,
      setNodes,
    ],
  )
  const deleteSelection = useCallback(() => {
    const nodeIds = new Set(selectedNodeIds)
    const edgeIds = new Set(selectedEdgeIds)
    if (nodeIds.size === 0 && edgeIds.size === 0)
      return
    captureHistory()
    const nextEdges = edgesRef.current.filter(
      edge =>
        !edgeIds.has(edge.id)
        && !nodeIds.has(edge.source)
        && !nodeIds.has(edge.target),
    )
    setEdges(nextEdges)
    setNodes(current =>
      reconcileNodes(
        current.filter(node => !nodeIds.has(node.id)),
        nextEdges,
      ),
    )
    clearSelection()
    setEditingImageCropNodeId(current =>
      current && nodeIds.has(current) ? null : current,
    )
    markDirty()
  }, [
    clearSelection,
    captureHistory,
    edgesRef,
    markDirty,
    selectedEdgeIds,
    selectedNodeIds,
    reconcileNodes,
    setEdges,
    setEditingImageCropNodeId,
    setNodes,
  ])
  const duplicateNodes = useCallback(
    (nodeIds: string[]) => {
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
      if (copies.length === 0)
        return
      captureHistory()
      const copiedEdges = edgesRef.current.flatMap((edge) => {
        const source = idMap.get(edge.source)
        const target = idMap.get(edge.target)
        return source && target
          ? [
              {
                ...edge,
                data: { createdAt: createEdgeCreatedAt() },
                id: createId(),
                source,
                target,
              },
            ]
          : []
      })
      setNodes(current => [
        ...current.map(node => ({ ...node, selected: false })),
        ...copies,
      ])
      setEdges(current => [...current, ...copiedEdges])
      setSelectedIds(copies.map(node => node.id))
      markDirty()
    },
    [
      captureHistory,
      edgesRef,
      markDirty,
      nodesRef,
      setEdges,
      setNodes,
      setSelectedIds,
    ],
  )
  const addNode = useCallback(
    (type: FlowNodeType, screenPosition?: { x: number, y: number }) => {
      const bounds = wrapperRef.current?.getBoundingClientRect()
      const position = reactFlow.screenToFlowPosition(screenPosition ?? {
        x: bounds ? bounds.left + bounds.width / 2 : window.innerWidth / 2,
        y: bounds ? bounds.top + bounds.height / 2 : window.innerHeight / 2,
      })
      captureHistory()
      setNodes(current => [
        ...current.map(node => ({ ...node, selected: false })),
        createCanvasNode({
          position,
          type,
        }),
      ])
      markDirty()
    },
    [captureHistory, markDirty, reactFlow, setNodes, wrapperRef],
  )
  const autoFormatSelection = useCallback(
    (nodeIds: string[]) => {
      const ids = new Set(nodeIds)
      const selectedNodes = nodesRef.current.filter(
        node => ids.has(node.id) && node.data.locked !== true,
      )
      if (selectedNodes.length < 2)
        return

      const movableIds = new Set(selectedNodes.map(node => node.id))
      const selectedEdges = edgesRef.current.filter(
        edge => movableIds.has(edge.source) && movableIds.has(edge.target),
      )
      const layoutedNodes = getAutoLayoutedNodes(selectedNodes, selectedEdges)
      const currentOrigin = {
        x: Math.min(...selectedNodes.map(node => node.position.x)),
        y: Math.min(...selectedNodes.map(node => node.position.y)),
      }
      const layoutOrigin = {
        x: Math.min(...layoutedNodes.map(node => node.position.x)),
        y: Math.min(...layoutedNodes.map(node => node.position.y)),
      }
      const positions = new Map(
        layoutedNodes.map(node => [
          node.id,
          {
            x: node.position.x + currentOrigin.x - layoutOrigin.x,
            y: node.position.y + currentOrigin.y - layoutOrigin.y,
          },
        ]),
      )

      captureHistory()
      setNodes(current =>
        current.map((node) => {
          const position = positions.get(node.id)
          return position ? { ...node, position } : node
        }),
      )
      markDirty()
    },
    [captureHistory, edgesRef, markDirty, nodesRef, setNodes],
  )

  const onNodesChange = useCallback(
    (changes: NodeChange<CanvasNode>[]) => {
      const removedNodeIds = new Set(
        changes.flatMap(change =>
          change.type === 'remove' ? [change.id] : [],
        ),
      )
      const positionChanges = changes.filter(
        change => change.type === 'position',
      )
      const positionChanged = positionChanges.length > 0
      if (
        removedNodeIds.size
        || changes.some(
          change => change.type === 'add' || change.type === 'replace',
        )
      ) {
        captureHistory()
      }
      if (positionChanged) {
        const dragging = positionChanges.some(
          change => change.dragging === true,
        )
        if (!positionHistoryActiveRef.current)
          captureHistory()
        if (dragging)
          positionHistoryActiveRef.current = true
        if (positionChanges.some(change => change.dragging === false))
          positionHistoryActiveRef.current = false
      }
      if (removedNodeIds.size) {
        const nextEdges = edgesRef.current.filter(
          edge =>
            !removedNodeIds.has(edge.source)
            && !removedNodeIds.has(edge.target),
        )
        setEdges(nextEdges)
        setNodes(current =>
          reconcileNodes(
            applyNodeChanges(changes, current),
            nextEdges,
          ),
        )
      }
      else {
        setNodes(current => applyNodeChanges(changes, current))
      }
      if (removedNodeIds.size || positionChanged)
        markDirty()
    },
    [captureHistory, edgesRef, markDirty, reconcileNodes, setEdges, setNodes],
  )
  const onEdgesChange = useCallback(
    (changes: EdgeChange<CanvasEdge>[]) => {
      const graphChanged = changes.some(change => change.type !== 'select')
      if (graphChanged)
        captureHistory()
      const nextEdges = applyEdgeChanges(changes, edgesRef.current)
      setEdges(nextEdges)
      if (changes.some(change => change.type === 'remove')) {
        setNodes(current =>
          reconcileNodes(
            current,
            nextEdges,
          ),
        )
      }
      if (changes.some(change => change.type === 'remove'))
        markDirty()
    },
    [captureHistory, edgesRef, markDirty, reconcileNodes, setEdges, setNodes],
  )
  const onConnect = useCallback(
    (connection: Connection) => {
      if (!isValidConnection(connection)) {
        onConnectionRejected()
        return
      }
      captureHistory()
      const nextEdges = addEdge(
        {
          ...connection,
          data: { createdAt: createEdgeCreatedAt() },
          id: createId(),
        },
        edgesRef.current,
      )
      setEdges(nextEdges)
      setNodes(current =>
        reconcileNodes(
          current,
          nextEdges,
        ),
      )
      markDirty()
    },
    [
      captureHistory,
      edgesRef,
      isValidConnection,
      markDirty,
      onConnectionRejected,
      reconcileNodes,
      setEdges,
      setNodes,
    ],
  )
  const onReconnect: OnReconnect<CanvasEdge> = useCallback(
    (oldEdge, connection) => {
      if (!isValidConnection({ ...oldEdge, ...connection })) {
        onConnectionRejected()
        return
      }
      captureHistory()
      const nextEdges = reconnectEdge(oldEdge, connection, edgesRef.current, {
        shouldReplaceId: false,
      })
      setEdges(nextEdges)
      setNodes(current =>
        reconcileNodes(
          current,
          nextEdges,
        ),
      )
      markDirty()
    },
    [
      captureHistory,
      edgesRef,
      isValidConnection,
      markDirty,
      onConnectionRejected,
      reconcileNodes,
      setEdges,
      setNodes,
    ],
  )

  return {
    addNode,
    autoFormatSelection,
    deleteNodes,
    deleteSelection,
    duplicateNodes,
    getIncompatibleGenerationEdgeCount,
    getIncompatibleGenerationEdges,
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
