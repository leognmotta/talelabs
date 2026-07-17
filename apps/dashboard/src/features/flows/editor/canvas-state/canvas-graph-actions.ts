/** Edge validation and mutation operations for the scoped canvas graph. */

import type { Connection, EdgeChange } from '@xyflow/react'
import type { CanvasEdge, FlowReferenceData } from '../flow-canvas-types'
import type { CanvasStore } from './canvas-store'

import { createId } from '@paralleldrive/cuid2'
import { areHandlesCompatible, getFlowNodeHandles } from '@talelabs/flows'
import { addEdge, applyEdgeChanges, reconnectEdge } from '@xyflow/react'
import { isCanvasGenerationConnectionAdmissible } from '../../generation/flow-generation-compatibility'
import { canvasNodeToGraphNode } from '../persistence/flow-node-serialization'
import { reconcileCanvasGenerationNodes } from './canvas-generation-actions'
import { captureCanvasHistory } from './canvas-history-actions'

let latestEdgeCreatedAt = 0

/** Stable dependencies shared by React Flow graph event handlers. */
export interface CanvasGraphActionContext {
  /** Reports a rejected connection after validation fails. */
  onConnectionRejected: () => void
  /** Latest external references used by validation and adaptive operations. */
  referenceDataRef: { current: FlowReferenceData }
  /** Scoped canvas store receiving validated graph mutations. */
  store: CanvasStore
}

/** Validates one proposed edge against handles, limits, and generation contracts. */
export function isCanvasConnectionValid(
  input: CanvasGraphActionContext,
  /** Proposed new or reconnected edge. */
  connection: CanvasEdge | Connection,
): boolean {
  if (
    !connection.sourceHandle
    || !connection.targetHandle
    || connection.source === connection.target
  ) {
    return false
  }
  const state = input.store.getState()
  const sourceNode = state.nodes.find(node => node.id === connection.source)
  const targetNode = state.nodes.find(node => node.id === connection.target)
  if (!sourceNode || !targetNode)
    return false
  const sourceHandle = getFlowNodeHandles(
    canvasNodeToGraphNode(sourceNode),
    input.referenceDataRef.current,
  ).find(handle =>
    handle.direction === 'output' && handle.id === connection.sourceHandle,
  )
  const targetHandle = getFlowNodeHandles(
    canvasNodeToGraphNode(targetNode),
    input.referenceDataRef.current,
  ).find(handle =>
    handle.direction === 'input' && handle.id === connection.targetHandle,
  )
  if (!sourceHandle || !targetHandle || !areHandlesCompatible(sourceHandle, targetHandle))
    return false
  const currentEdgeId = 'id' in connection ? connection.id : undefined
  const connections = state.edges.filter(edge =>
    edge.id !== currentEdgeId
    && edge.target === connection.target
    && edge.targetHandle === connection.targetHandle,
  )
  if (
    targetHandle.maxConnections !== null
    && connections.length >= targetHandle.maxConnections
  ) {
    return false
  }
  if (!isCanvasGenerationConnectionAdmissible({
    connection,
    edges: state.edges,
    nodes: state.nodes,
    referenceData: input.referenceDataRef.current,
    targetNode,
  })) {
    return false
  }
  return !state.edges.some(edge =>
    edge.id !== currentEdgeId
    && edge.source === connection.source
    && edge.sourceHandle === connection.sourceHandle
    && edge.target === connection.target
    && edge.targetHandle === connection.targetHandle,
  )
}

/** Applies React Flow edge changes without marking selection as persistent. */
export function applyCanvasEdgeChanges(
  input: CanvasGraphActionContext,
  /** React Flow changes emitted for the current interaction frame. */
  changes: EdgeChange<CanvasEdge>[],
): void {
  const state = input.store.getState()
  const graphChanged = changes.some(change => (
    change.type === 'add'
    || (change.type !== 'select'
      && state.edges.some(edge => edge.id === change.id))
  ))
  if (graphChanged)
    captureCanvasHistory(input.store)
  const edges = applyEdgeChanges(changes, state.edges)
  const removed = changes.some(change => change.type === 'remove')
  input.store.setState({
    edges,
    ...(graphChanged ? { graphRevision: state.graphRevision + 1 } : {}),
    ...(removed
      ? {
          nodes: reconcileCanvasGenerationNodes({
            edges,
            nodes: state.nodes,
            referenceData: input.referenceDataRef.current,
          }),
          selectedEdgeIds: state.selectedEdgeIds.filter(id =>
            edges.some(edge => edge.id === id),
          ),
        }
      : {}),
  })
}

/** Adds or reconnects one edge and atomically reconciles adaptive nodes. */
export function connectCanvasEdge(
  input: CanvasGraphActionContext,
  /** Proposed connection, or the existing edge during reconnection. */
  connectionOrEdge: CanvasEdge | Connection,
  /** Replacement endpoints supplied by React Flow during reconnection. */
  reconnectedEndpoints?: Connection,
): boolean {
  const edge: CanvasEdge | undefined = 'id' in connectionOrEdge
    ? connectionOrEdge
    : undefined
  const connection: Connection | undefined = edge
    ? reconnectedEndpoints
    : connectionOrEdge as Connection
  if (!connection)
    return false
  const validationConnection = edge
    ? { ...edge, ...connection }
    : connection
  if (!isCanvasConnectionValid(input, validationConnection)) {
    input.onConnectionRejected()
    return false
  }
  const state = input.store.getState()
  captureCanvasHistory(input.store)
  latestEdgeCreatedAt = Math.max(Date.now(), latestEdgeCreatedAt + 1)
  const edges = edge
    ? reconnectEdge(edge, connection, state.edges, {
        shouldReplaceId: false,
      })
    : addEdge({
        ...connection,
        data: { createdAt: new Date(latestEdgeCreatedAt).toISOString() },
        id: createId(),
      }, state.edges)
  input.store.setState({
    edges,
    graphRevision: state.graphRevision + 1,
    nodes: reconcileCanvasGenerationNodes({
      edges,
      nodes: state.nodes,
      referenceData: input.referenceDataRef.current,
    }),
  })
  return true
}
