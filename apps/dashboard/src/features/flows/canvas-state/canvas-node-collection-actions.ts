/** Add, delete, and duplicate commands for canvas node collections. */

import type { FlowNodeType } from '@talelabs/flows'
import type { FlowReferenceData } from '../flow-canvas-types'
import type { CanvasStore } from './canvas-store'

import { createId } from '@paralleldrive/cuid2'
import { createCanvasNode } from '../flow-canvas-node-factory'
import { reconcileCanvasGenerationNodes } from './canvas-generation-actions'
import { captureCanvasHistory } from './canvas-history-actions'

let latestEdgeCreatedAt = 0

/** Adds one selected node at an already resolved Flow-space position. */
export function addCanvasNode(input: {
  /** Flow-space insertion position. */
  position: { x: number, y: number }
  /** Scoped store that owns the editable graph. */
  store: CanvasStore
  /** Registered TaleLabs node type to create. */
  type: FlowNodeType
}): void {
  const state = input.store.getState()
  captureCanvasHistory(input.store)
  const node = createCanvasNode({ position: input.position, type: input.type })
  input.store.setState({
    edges: state.edges.map(edge => edge.selected ? { ...edge, selected: false } : edge),
    graphRevision: state.graphRevision + 1,
    nodes: [
      ...state.nodes.map(item => item.selected ? { ...item, selected: false } : item),
      node,
    ],
    selectedEdgeIds: [],
    selectedNodeIds: [node.id],
  })
}

/** Deletes nodes and incident edges while reconciling downstream operations. */
export function deleteCanvasNodes(
  input: {
    /** External references used by downstream operation reconciliation. */
    referenceData: FlowReferenceData
    /** Scoped store that owns the editable graph. */
    store: CanvasStore
  },
  /** Node IDs to delete, defaulting to the current selection. */
  nodeIds?: readonly string[],
  /** Edge IDs to delete, defaulting to the current selection. */
  selectedEdgeIds?: readonly string[],
): void {
  const state = input.store.getState()
  const ids = new Set(nodeIds ?? state.selectedNodeIds)
  const edgeIds = new Set(
    selectedEdgeIds ?? (nodeIds ? [] : state.selectedEdgeIds),
  )
  if (
    !state.nodes.some(node => ids.has(node.id))
    && !state.edges.some(edge => edgeIds.has(edge.id))
  ) {
    return
  }
  captureCanvasHistory(input.store)
  const edges = state.edges.filter(
    edge => !edgeIds.has(edge.id)
      && !ids.has(edge.source)
      && !ids.has(edge.target),
  )
  const nodes = reconcileCanvasGenerationNodes({
    edges,
    nodes: state.nodes.filter(node => !ids.has(node.id)),
    referenceData: input.referenceData,
  })
  const retainedEdgeIds = new Set(edges.map(edge => edge.id))
  input.store.setState({
    edges,
    editingImageCropNodeId: state.editingImageCropNodeId
      && ids.has(state.editingImageCropNodeId)
      ? null
      : state.editingImageCropNodeId,
    graphRevision: state.graphRevision + 1,
    nodes,
    selectedEdgeIds: state.selectedEdgeIds.filter(id => retainedEdgeIds.has(id)),
    selectedNodeIds: state.selectedNodeIds.filter(id => !ids.has(id)),
  })
}

/** Duplicates selected nodes and their internal edges with fresh stable IDs. */
export function duplicateCanvasNodes(
  /** Scoped store that owns the editable graph. */
  store: CanvasStore,
  /** Node IDs to duplicate, defaulting to the current selection. */
  nodeIds?: readonly string[],
): void {
  const state = store.getState()
  const ids = new Set(nodeIds ?? state.selectedNodeIds)
  const idMap = new Map<string, string>()
  const copies = state.nodes.filter(node => ids.has(node.id)).map((node) => {
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
  captureCanvasHistory(store)
  const copiedEdges = state.edges.flatMap((edge) => {
    const source = idMap.get(edge.source)
    const target = idMap.get(edge.target)
    if (!source || !target)
      return []
    latestEdgeCreatedAt = Math.max(Date.now(), latestEdgeCreatedAt + 1)
    return [{
      ...edge,
      data: { createdAt: new Date(latestEdgeCreatedAt).toISOString() },
      id: createId(),
      selected: false,
      source,
      target,
    }]
  })
  store.setState({
    edges: [
      ...state.edges.map(edge => edge.selected ? { ...edge, selected: false } : edge),
      ...copiedEdges,
    ],
    graphRevision: state.graphRevision + 1,
    nodes: [
      ...state.nodes.map(node => node.selected ? { ...node, selected: false } : node),
      ...copies,
    ],
    selectedEdgeIds: [],
    selectedNodeIds: copies.map(node => node.id),
  })
}
