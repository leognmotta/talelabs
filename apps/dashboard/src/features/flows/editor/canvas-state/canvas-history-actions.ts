/** Bounded undo and redo operations for persistent canvas graph state. */

import type { CanvasHistorySnapshot, CanvasStore } from './canvas-store'

import { toPersistedGraph } from '../persistence/flow-graph-serialization'

const HISTORY_LIMIT = 50

function createCanvasHistorySnapshot(
  nodes: CanvasHistorySnapshot['nodes'],
  edges: CanvasHistorySnapshot['edges'],
): CanvasHistorySnapshot {
  const snapshotNodes = nodes.map(node => ({
    ...node,
    dragging: false,
    selected: false,
  }))
  const snapshotEdges = edges.map(edge => ({
    ...edge,
    selected: false,
  }))
  return {
    edges: snapshotEdges,
    fingerprint: JSON.stringify(toPersistedGraph(snapshotNodes, snapshotEdges)),
    nodes: snapshotNodes,
  }
}

/** Captures the current graph once unless it matches the latest past entry. */
export function captureCanvasHistory(store: CanvasStore): void {
  const state = store.getState()
  const snapshot = createCanvasHistorySnapshot(state.nodes, state.edges)
  if (state.past.at(-1)?.fingerprint === snapshot.fingerprint)
    return
  store.setState({
    future: [],
    past: [...state.past, snapshot].slice(-HISTORY_LIMIT),
  })
}

/** Restores one undo or redo snapshot and records it as a graph mutation. */
export function restoreCanvasHistory(
  store: CanvasStore,
  direction: 'redo' | 'undo',
): boolean {
  const state = store.getState()
  const source = direction === 'undo' ? state.past : state.future
  const target = source.at(-1)
  if (!target)
    return false
  const current = createCanvasHistorySnapshot(state.nodes, state.edges)
  const nextPast = direction === 'undo'
    ? state.past.slice(0, -1)
    : [...state.past, current].slice(-HISTORY_LIMIT)
  const nextFuture = direction === 'undo'
    ? [...state.future, current].slice(-HISTORY_LIMIT)
    : state.future.slice(0, -1)
  store.setState({
    edges: target.edges,
    editingImageCropNodeId: null,
    future: nextFuture,
    graphRevision: state.graphRevision + 1,
    nodes: target.nodes,
    past: nextPast,
    positionHistoryActive: false,
    selectedEdgeIds: [],
    selectedNodeIds: [],
  })
  return true
}
