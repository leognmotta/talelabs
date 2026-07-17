/** Direct node mutations and React Flow node-change handling. */

import type { NodeChange } from '@xyflow/react'
import type { CanvasNode, FlowReferenceData } from '../flow-canvas-types'
import type { CanvasStore } from './canvas-store'

import { applyNodeChanges } from '@xyflow/react'
import { deriveCanvasAdaptiveOperation, reconcileCanvasGenerationNodes } from './canvas-generation-actions'
import { captureCanvasHistory } from './canvas-history-actions'

/** Applies React Flow node changes while isolating selection from graph revisions. */
export function applyCanvasNodeChanges(
  input: {
    /** Latest external references used when removals change adaptive operations. */
    referenceDataRef: { current: FlowReferenceData }
    /** Scoped canvas store receiving React Flow changes. */
    store: CanvasStore
  },
  /** React Flow changes emitted for the current interaction frame. */
  changes: NodeChange<CanvasNode>[],
): void {
  const state = input.store.getState()
  const removedNodeIds = new Set(changes.flatMap(change =>
    change.type === 'remove' ? [change.id] : [],
  ))
  const positionChanges = changes.filter(
    change => change.type === 'position',
  )
  const positionChanged = positionChanges.length > 0
  const structureChanged = removedNodeIds.size > 0 || changes.some(
    change => change.type === 'add' || change.type === 'replace',
  )
  if (structureChanged || (positionChanged && !state.positionHistoryActive))
    captureCanvasHistory(input.store)

  const nextEdges = removedNodeIds.size
    ? state.edges.filter(edge =>
        !removedNodeIds.has(edge.source) && !removedNodeIds.has(edge.target),
      )
    : state.edges
  const changedNodes = applyNodeChanges(changes, state.nodes)
  const nextNodes = removedNodeIds.size
    ? reconcileCanvasGenerationNodes({
        edges: nextEdges,
        nodes: changedNodes,
        referenceData: input.referenceDataRef.current,
      })
    : changedNodes
  const dragging = positionChanges.some(change => change.dragging === true)
  const dragFinished = positionChanges.some(change => change.dragging === false)
  input.store.setState({
    ...(removedNodeIds.size ? { edges: nextEdges } : {}),
    ...(structureChanged || positionChanged
      ? { graphRevision: state.graphRevision + 1 }
      : {}),
    nodes: nextNodes,
    positionHistoryActive: dragFinished ? false : dragging || state.positionHistoryActive,
    ...(removedNodeIds.size
      ? {
          editingImageCropNodeId: state.editingImageCropNodeId
            && removedNodeIds.has(state.editingImageCropNodeId)
            ? null
            : state.editingImageCropNodeId,
          selectedEdgeIds: state.selectedEdgeIds.filter(id =>
            nextEdges.some(edge => edge.id === id),
          ),
          selectedNodeIds: state.selectedNodeIds.filter(id =>
            !removedNodeIds.has(id),
          ),
        }
      : {}),
  })
}

/** Updates one node's persisted data and rederives its adaptive operation. */
export function updateCanvasNodeData(
  input: {
  /** External references used by adaptive operation resolution. */
    referenceData: FlowReferenceData
    /** Scoped canvas store receiving the node-data mutation. */
    store: CanvasStore
  },
  /** Node receiving the data update. */
  nodeId: string,
  /** Immutable update applied to the current node data. */
  update: (data: Record<string, any>) => Record<string, any>,
): void {
  const state = input.store.getState()
  const node = state.nodes.find(item => item.id === nodeId)
  if (!node)
    return
  captureCanvasHistory(input.store)
  const candidateData = update(node.data)
  const operationId = deriveCanvasAdaptiveOperation({
    data: candidateData,
    edges: state.edges,
    node,
    nodes: state.nodes,
    referenceData: input.referenceData,
  })
  const data = operationId === candidateData.operationId
    ? candidateData
    : { ...candidateData, operationId }
  input.store.setState({
    graphRevision: state.graphRevision + 1,
    nodes: state.nodes.map(item => item.id === nodeId
      ? { ...item, data, draggable: data.locked !== true }
      : item),
  })
}

/** Replaces one Asset-node reference and clears stale image crop state. */
export function updateCanvasNodeReference(input: {
  /** Node receiving the canonical Asset reference. */
  nodeId: string
  /** Canonical Asset ID, or null to clear the reference. */
  assetId: null | string
  /** Scoped canvas store receiving the Asset-reference mutation. */
  store: CanvasStore
}): void {
  const state = input.store.getState()
  const node = state.nodes.find(item => item.id === input.nodeId)
  if (!node)
    return
  captureCanvasHistory(input.store)
  const nodes = state.nodes.map((item) => {
    if (item.id !== input.nodeId)
      return item
    if (item.assetId === input.assetId)
      return { ...item, assetId: input.assetId }
    const { crop: _crop, ...data } = item.data
    return { ...item, assetId: input.assetId, data }
  })
  input.store.setState({
    editingImageCropNodeId: state.editingImageCropNodeId === input.nodeId
      ? null
      : state.editingImageCropNodeId,
    graphRevision: state.graphRevision + 1,
    nodes,
  })
}
