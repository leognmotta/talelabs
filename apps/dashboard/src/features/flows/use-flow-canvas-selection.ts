import type {
  EdgeMouseHandler,
  NodeMouseHandler,
} from '@xyflow/react'
import type {
  Dispatch,
  MouseEvent as ReactMouseEvent,
  RefObject,
  SetStateAction,
} from 'react'
import type { CanvasEdge, CanvasNode } from './flow-canvas-types'

import { useCallback, useState } from 'react'

export interface FlowCanvasContextTarget {
  edgeIds: string[]
  mode: 'nodeActions' | 'pane' | 'selection'
  nodeIds: string[]
}

export function useFlowCanvasSelection(input: {
  edgesRef: RefObject<CanvasEdge[]>
  nodesRef: RefObject<CanvasNode[]>
  setEdges: Dispatch<SetStateAction<CanvasEdge[]>>
  setEditingImageCropNodeId: Dispatch<SetStateAction<null | string>>
  setNodes: Dispatch<SetStateAction<CanvasNode[]>>
}) {
  const {
    edgesRef,
    nodesRef,
    setEdges,
    setEditingImageCropNodeId,
    setNodes,
  } = input
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([])
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([])
  const [contextTarget, setContextTarget] = useState<FlowCanvasContextTarget>({
    edgeIds: [],
    mode: 'pane',
    nodeIds: [],
  })

  const clearSelection = useCallback(() => {
    setSelectedNodeIds([])
    setSelectedEdgeIds([])
  }, [])
  const setSelectedIds = useCallback((nodeIds: string[], edgeIds: string[] = []) => {
    setSelectedNodeIds(nodeIds)
    setSelectedEdgeIds(edgeIds)
  }, [])
  const handleSelectionChange = useCallback((selection: {
    edges: CanvasEdge[]
    nodes: CanvasNode[]
  }) => {
    setSelectedIds(
      selection.nodes.map(node => node.id),
      selection.edges.map(edge => edge.id),
    )
    setEditingImageCropNodeId(current => (
      current && selection.nodes.some(node => node.id === current)
        ? current
        : null
    ))
  }, [setEditingImageCropNodeId, setSelectedIds])
  const handleNodeContextMenu = useCallback<NodeMouseHandler<CanvasNode>>((
    event,
    node,
  ) => {
    const opensNodeActions = event.detail === 2
    const nodeIds = opensNodeActions
      ? [node.id]
      : node.selected
        ? nodesRef.current.filter(item => item.selected).map(item => item.id)
        : [node.id]
    const edgeIds = opensNodeActions
      ? []
      : node.selected
        ? edgesRef.current.filter(item => item.selected).map(item => item.id)
        : []

    if (!node.selected) {
      setNodes(current => current.map(item => ({
        ...item,
        selected: item.id === node.id,
      })))
      setEdges(current => current.map(item => ({ ...item, selected: false })))
      setSelectedIds(nodeIds)
    }
    setContextTarget({
      edgeIds,
      mode: opensNodeActions ? 'nodeActions' : 'selection',
      nodeIds,
    })
  }, [edgesRef, nodesRef, setEdges, setNodes, setSelectedIds])
  const handleNodeDoubleClick = useCallback<NodeMouseHandler<CanvasNode>>((event) => {
    const target = event.target
    if (!(target instanceof Element))
      return
    if (target.closest('button, input, textarea, select, a, video, audio'))
      return

    event.preventDefault()
    target.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true,
      button: 2,
      cancelable: true,
      clientX: event.clientX,
      clientY: event.clientY,
      detail: 2,
      view: window,
    }))
  }, [])
  const handleEdgeContextMenu = useCallback<EdgeMouseHandler<CanvasEdge>>((
    _event,
    edge,
  ) => {
    const nodeIds = edge.selected
      ? nodesRef.current.filter(item => item.selected).map(item => item.id)
      : []
    const edgeIds = edge.selected
      ? edgesRef.current.filter(item => item.selected).map(item => item.id)
      : [edge.id]

    if (!edge.selected) {
      setNodes(current => current.map(item => ({ ...item, selected: false })))
      setEdges(current => current.map(item => ({
        ...item,
        selected: item.id === edge.id,
      })))
      setSelectedIds([], edgeIds)
    }
    setContextTarget({ edgeIds, mode: 'selection', nodeIds })
  }, [edgesRef, nodesRef, setEdges, setNodes, setSelectedIds])
  const handleSelectionContextMenu = useCallback((
    _event: ReactMouseEvent<Element>,
    selectionNodes: CanvasNode[],
  ) => {
    setContextTarget({
      edgeIds: edgesRef.current.filter(edge => edge.selected).map(edge => edge.id),
      mode: 'selection',
      nodeIds: selectionNodes.map(node => node.id),
    })
  }, [edgesRef])
  const handlePaneContextMenu = useCallback(() => {
    setContextTarget({ edgeIds: [], mode: 'pane', nodeIds: [] })
  }, [])
  const selectAll = useCallback(() => {
    const nodeIds = nodesRef.current.map(node => node.id)
    const edgeIds = edgesRef.current.map(edge => edge.id)
    setNodes(current => current.map(node => ({ ...node, selected: true })))
    setEdges(current => current.map(edge => ({ ...edge, selected: true })))
    setSelectedIds(nodeIds, edgeIds)
    setContextTarget({ edgeIds, mode: 'selection', nodeIds })
  }, [edgesRef, nodesRef, setEdges, setNodes, setSelectedIds])

  return {
    clearSelection,
    contextTarget,
    handleEdgeContextMenu,
    handleNodeContextMenu,
    handleNodeDoubleClick,
    handlePaneContextMenu,
    handleSelectionChange,
    handleSelectionContextMenu,
    selectAll,
    selectedEdgeIds,
    selectedNodeIds,
    setSelectedIds,
  }
}
