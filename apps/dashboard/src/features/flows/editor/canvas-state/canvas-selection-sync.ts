/** Narrow selection projection from React Flow into the scoped canvas store. */

import type { CanvasEdge, CanvasNode } from '../flow-canvas-types'
import type { CanvasStore } from './canvas-store'

/**
 * Synchronizes selected IDs without rewriting the controlled graph collections.
 *
 * React Flow selection flags remain owned by `onNodesChange` and
 * `onEdgesChange`; keeping this listener ID-only prevents controlled-prop
 * feedback while preserving narrow subscriptions for canvas chrome.
 */
export function syncCanvasSelectionIds(
  /** Scoped store that owns the current editing-session selection. */
  store: CanvasStore,
  /** React Flow's current selected node and edge projections. */
  selection: {
    edges: readonly CanvasEdge[]
    nodes: readonly CanvasNode[]
  },
): void {
  const state = store.getState()
  const selectedNodeIds = selection.nodes.map(node => node.id)
  const selectedEdgeIds = selection.edges.map(edge => edge.id)
  const nodeIds = new Set(selectedNodeIds)
  const edgeIds = new Set(selectedEdgeIds)
  const sameNodeIds = state.selectedNodeIds.length === selectedNodeIds.length
    && state.selectedNodeIds.every(id => nodeIds.has(id))
  const sameEdgeIds = state.selectedEdgeIds.length === selectedEdgeIds.length
    && state.selectedEdgeIds.every(id => edgeIds.has(id))
  const editingImageCropNodeId = state.editingImageCropNodeId
    && nodeIds.has(state.editingImageCropNodeId)
    ? state.editingImageCropNodeId
    : null
  const sameEditingImageCropNode = editingImageCropNodeId
    === state.editingImageCropNodeId
  if (sameNodeIds && sameEdgeIds && sameEditingImageCropNode)
    return
  store.setState({
    ...(!sameEditingImageCropNode ? { editingImageCropNodeId } : {}),
    ...(!sameEdgeIds ? { selectedEdgeIds } : {}),
    ...(!sameNodeIds ? { selectedNodeIds } : {}),
  })
}
