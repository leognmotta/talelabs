/** Selection, context-menu, and layout actions for transient canvas UI. */

import type { MouseEvent as ReactMouseEvent } from 'react'
import type { CanvasEdge, CanvasNode } from '../flow-canvas-types'
import type { CanvasStore } from './canvas-store'

import { getAutoLayoutedNodes } from '../interactions/flow-auto-layout'
import { captureCanvasHistory } from './canvas-history-actions'

/** Sets selection IDs and updates only node or edge objects whose flag changed. */
export function setCanvasSelection(
  /** Scoped store that owns selection and graph presentation state. */
  store: CanvasStore,
  /** Explicit IDs, React Flow selection objects, or undefined to select all. */
  selection?: {
    edgeIds?: readonly string[]
    edges?: readonly CanvasEdge[]
    nodeIds?: readonly string[]
    nodes?: readonly CanvasNode[]
  },
): void {
  const state = store.getState()
  const selectedNodeIds = selection
    ? [...(selection.nodeIds ?? selection.nodes?.map(node => node.id) ?? [])]
    : state.nodes.map(node => node.id)
  const selectedEdgeIds = selection
    ? [...(selection.edgeIds ?? selection.edges?.map(edge => edge.id) ?? [])]
    : state.edges.map(edge => edge.id)
  const nodeIds = new Set(selectedNodeIds)
  const edgeIds = new Set(selectedEdgeIds)
  const sameNodeIds = state.selectedNodeIds.length === selectedNodeIds.length
    && state.selectedNodeIds.every(id => nodeIds.has(id))
  const sameEdgeIds = state.selectedEdgeIds.length === selectedEdgeIds.length
    && state.selectedEdgeIds.every(id => edgeIds.has(id))
  const sameNodeFlags = state.nodes.every(
    node => Boolean(node.selected) === nodeIds.has(node.id),
  )
  const sameEdgeFlags = state.edges.every(
    edge => Boolean(edge.selected) === edgeIds.has(edge.id),
  )
  const editingImageCropNodeId = state.editingImageCropNodeId
    && nodeIds.has(state.editingImageCropNodeId)
    ? state.editingImageCropNodeId
    : null
  const sameEditingImageCropNode = editingImageCropNodeId
    === state.editingImageCropNodeId
  if (
    sameNodeIds
    && sameEdgeIds
    && sameNodeFlags
    && sameEdgeFlags
    && sameEditingImageCropNode
  ) {
    return
  }
  store.setState({
    ...(!sameEdgeFlags
      ? {
          edges: state.edges.map((edge) => {
            const selected = edgeIds.has(edge.id)
            return edge.selected === selected ? edge : { ...edge, selected }
          }),
        }
      : {}),
    ...(!sameEditingImageCropNode ? { editingImageCropNodeId } : {}),
    ...(!sameNodeFlags
      ? {
          nodes: state.nodes.map((node) => {
            const selected = nodeIds.has(node.id)
            return node.selected === selected ? node : { ...node, selected }
          }),
        }
      : {}),
    ...(!sameEdgeIds ? { selectedEdgeIds } : {}),
    ...(!sameNodeIds ? { selectedNodeIds } : {}),
  })
}

/** Updates the context-menu target for a node, edge, selection, or pane event. */
export function openCanvasContextMenu(
  /** Scoped store that owns the menu and selection state. */
  store: CanvasStore,
  /** Interaction source used to derive the menu mode. */
  kind: 'edge' | 'node' | 'nodeDoubleClick' | 'pane' | 'selection',
  /** Mouse event that opened the context menu. */
  event: MouseEvent | ReactMouseEvent,
  /** Edge, node, or selection nodes associated with the interaction. */
  subject?: CanvasEdge | CanvasNode | CanvasNode[],
): void {
  if (kind === 'nodeDoubleClick') {
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
    return
  }
  const state = store.getState()
  let nodeIds = state.selectedNodeIds
  let edgeIds = state.selectedEdgeIds
  let mode: 'nodeActions' | 'pane' | 'selection' = 'selection'
  let screenPosition: null | { x: number, y: number } = null

  if (kind === 'node' && subject && !Array.isArray(subject) && 'position' in subject) {
    const opensNodeActions = event.detail === 2
    nodeIds = opensNodeActions
      ? [subject.id]
      : subject.selected ? state.selectedNodeIds : [subject.id]
    edgeIds = opensNodeActions
      ? []
      : subject.selected ? state.selectedEdgeIds : []
    mode = opensNodeActions ? 'nodeActions' : 'selection'
    if (!subject.selected) {
      setCanvasSelection(store, { nodeIds })
    }
  }
  else if (kind === 'edge' && subject && !Array.isArray(subject) && !('position' in subject)) {
    nodeIds = subject.selected ? state.selectedNodeIds : []
    edgeIds = subject.selected ? state.selectedEdgeIds : [subject.id]
    if (!subject.selected) {
      setCanvasSelection(store, { edgeIds, nodeIds: [] })
    }
  }
  else if (kind === 'selection') {
    nodeIds = Array.isArray(subject)
      ? subject.map(node => node.id)
      : state.selectedNodeIds
  }
  else if (kind === 'pane') {
    const hasSelection = nodeIds.length > 0 || edgeIds.length > 0
    mode = hasSelection ? 'selection' : 'pane'
    screenPosition = hasSelection
      ? null
      : { x: event.clientX, y: event.clientY }
  }
  store.setState({
    contextTarget: { edgeIds: [...edgeIds], mode, nodeIds: [...nodeIds], screenPosition },
  })
}

/** Auto-layouts unlocked selected nodes without moving the selection origin. */
export function arrangeCanvasNodes(
/** Selection, context-menu, and arrangement actions for ephemeral canvas UI state. */
  store: CanvasStore,
  /** Node IDs included in the layout operation, defaulting to selection. */
  nodeIds?: readonly string[],
): void {
  const state = store.getState()
  const ids = new Set(nodeIds ?? state.selectedNodeIds)
  const selectedNodes = state.nodes.filter(
    node => ids.has(node.id) && node.data.locked !== true,
  )
  if (selectedNodes.length < 2)
    return
  const movableIds = new Set(selectedNodes.map(node => node.id))
  const selectedEdges = state.edges.filter(
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
  const positions = new Map(layoutedNodes.map(node => [
    node.id,
    {
      x: node.position.x + currentOrigin.x - layoutOrigin.x,
      y: node.position.y + currentOrigin.y - layoutOrigin.y,
    },
  ]))
  captureCanvasHistory(store)
  store.setState({
    graphRevision: state.graphRevision + 1,
    nodes: state.nodes.map((node) => {
      const position = positions.get(node.id)
      return position ? { ...node, position } : node
    }),
  })
}
