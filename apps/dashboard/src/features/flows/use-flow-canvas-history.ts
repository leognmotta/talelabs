import type { RefObject } from 'react'
import type { CanvasEdge, CanvasNode } from './flow-canvas-types'

import { useCallback, useRef, useState } from 'react'
import { toPersistedGraph } from './flow-canvas-serialization'

const HISTORY_LIMIT = 50

interface CanvasHistorySnapshot {
  edges: CanvasEdge[]
  fingerprint: string
  nodes: CanvasNode[]
}

function createSnapshot(
  nodes: readonly CanvasNode[],
  edges: readonly CanvasEdge[],
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

export function useFlowCanvasHistory(input: {
  clearSelection: () => void
  edgesRef: RefObject<CanvasEdge[]>
  nodesRef: RefObject<CanvasNode[]>
  replaceGraph: (nodes: CanvasNode[], edges: CanvasEdge[]) => void
}) {
  const { clearSelection, edgesRef, nodesRef, replaceGraph } = input
  const pastRef = useRef<CanvasHistorySnapshot[]>([])
  const futureRef = useRef<CanvasHistorySnapshot[]>([])
  const [availability, setAvailability] = useState({
    canRedo: false,
    canUndo: false,
  })

  const publishAvailability = useCallback(() => {
    const canUndo = pastRef.current.length > 0
    const canRedo = futureRef.current.length > 0
    setAvailability(current => (
      current.canUndo === canUndo && current.canRedo === canRedo
        ? current
        : { canRedo, canUndo }
    ))
  }, [])

  const capture = useCallback(() => {
    const snapshot = createSnapshot(nodesRef.current, edgesRef.current)
    const latest = pastRef.current.at(-1)
    if (latest?.fingerprint === snapshot.fingerprint)
      return

    pastRef.current.push(snapshot)
    if (pastRef.current.length > HISTORY_LIMIT)
      pastRef.current.shift()
    futureRef.current = []
    publishAvailability()
  }, [edgesRef, nodesRef, publishAvailability])

  const clear = useCallback(() => {
    pastRef.current = []
    futureRef.current = []
    publishAvailability()
  }, [publishAvailability])

  const undo = useCallback(() => {
    const previous = pastRef.current.pop()
    if (!previous)
      return false

    futureRef.current.push(createSnapshot(nodesRef.current, edgesRef.current))
    if (futureRef.current.length > HISTORY_LIMIT)
      futureRef.current.shift()
    clearSelection()
    replaceGraph(previous.nodes, previous.edges)
    publishAvailability()
    return true
  }, [clearSelection, edgesRef, nodesRef, publishAvailability, replaceGraph])

  const redo = useCallback(() => {
    const next = futureRef.current.pop()
    if (!next)
      return false

    pastRef.current.push(createSnapshot(nodesRef.current, edgesRef.current))
    if (pastRef.current.length > HISTORY_LIMIT)
      pastRef.current.shift()
    clearSelection()
    replaceGraph(next.nodes, next.edges)
    publishAvailability()
    return true
  }, [clearSelection, edgesRef, nodesRef, publishAvailability, replaceGraph])

  return {
    ...availability,
    capture,
    clear,
    redo,
    undo,
  }
}
