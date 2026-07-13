import type { FlowEdge, FlowNode } from '@talelabs/sdk'
import type { CanvasEdge, CanvasNode, PersistedCanvasGraph } from './flow-canvas-types'

import { compareFlowEdgesByPriority } from '@talelabs/flows'

export function canvasNodeToGraphNode(node: CanvasNode) {
  return {
    assetId: node.assetId,
    data: node.data,
    elementId: node.elementId,
    id: node.id,
    positionX: node.position.x,
    positionY: node.position.y,
    schemaVersion: node.schemaVersion,
    type: node.type,
  }
}

export interface FlowGraphDiff {
  deleteEdgeIds: string[]
  deleteNodeIds: string[]
  upsertEdges: FlowEdge[]
  upsertNodes: FlowNode[]
}

export function countFlowGraphMutations(diff: FlowGraphDiff) {
  return diff.deleteEdgeIds.length
    + diff.deleteNodeIds.length
    + diff.upsertEdges.length
    + diff.upsertNodes.length
}

/**
 * Small diffs stay atomic. Larger diffs advance in dependency-safe graph order:
 * detach edges before deleting nodes, and persist nodes before attaching edges.
 */
export function takeFlowGraphMutationBatch(
  diff: FlowGraphDiff,
  maximum: number,
): FlowGraphDiff {
  if (!Number.isInteger(maximum) || maximum < 1)
    throw new Error('Flow graph mutation batch maximum must be positive')

  if (countFlowGraphMutations(diff) <= maximum) {
    return {
      deleteEdgeIds: [...diff.deleteEdgeIds],
      deleteNodeIds: [...diff.deleteNodeIds],
      upsertEdges: [...diff.upsertEdges],
      upsertNodes: [...diff.upsertNodes],
    }
  }

  if (diff.deleteEdgeIds.length) {
    return {
      deleteEdgeIds: diff.deleteEdgeIds.slice(0, maximum),
      deleteNodeIds: [],
      upsertEdges: [],
      upsertNodes: [],
    }
  }
  if (diff.deleteNodeIds.length) {
    return {
      deleteEdgeIds: [],
      deleteNodeIds: diff.deleteNodeIds.slice(0, maximum),
      upsertEdges: [],
      upsertNodes: [],
    }
  }
  if (diff.upsertNodes.length) {
    return {
      deleteEdgeIds: [],
      deleteNodeIds: [],
      upsertEdges: [],
      upsertNodes: diff.upsertNodes.slice(0, maximum),
    }
  }
  return {
    deleteEdgeIds: [],
    deleteNodeIds: [],
    upsertEdges: diff.upsertEdges.slice(0, maximum),
    upsertNodes: [],
  }
}

export function toCanvasNodes(nodes: FlowNode[]): CanvasNode[] {
  return nodes.map(node => ({
    id: node.id,
    type: node.type,
    draggable: node.data.locked !== true,
    position: { x: node.positionX, y: node.positionY },
    data: node.data,
    assetId: node.assetId,
    elementId: node.elementId,
    schemaVersion: node.schemaVersion,
  }))
}

export function toCanvasEdges(edges: FlowEdge[]): CanvasEdge[] {
  return edges.toSorted(compareFlowEdgesByPriority).map(edge => ({
    data: { createdAt: edge.createdAt },
    id: edge.id,
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    type: 'default',
  }))
}

export function toPersistedGraph(
  nodes: CanvasNode[],
  edges: CanvasEdge[],
): PersistedCanvasGraph {
  return {
    nodes: nodes.map(canvasNodeToGraphNode),
    edges: edges.toSorted(compareFlowEdgesByPriority).map(edge => ({
      createdAt: edge.data?.createdAt ?? '1970-01-01T00:00:00.000Z',
      id: edge.id,
      sourceNodeId: edge.source,
      targetNodeId: edge.target,
      sourceHandle: edge.sourceHandle ?? null,
      targetHandle: edge.targetHandle ?? null,
    })),
  }
}

function nodeFingerprint(node: FlowNode) {
  return JSON.stringify(node)
}

function edgeFingerprint(edge: FlowEdge) {
  return JSON.stringify(edge)
}

export function createFlowGraphDiff(
  baseline: PersistedCanvasGraph,
  current: PersistedCanvasGraph,
): FlowGraphDiff {
  const baselineNodes = new Map(baseline.nodes.map(node => [node.id, node]))
  const currentNodes = new Map(current.nodes.map(node => [node.id, node]))
  const baselineEdges = new Map(baseline.edges.map(edge => [edge.id, edge]))
  const currentEdges = new Map(current.edges.map(edge => [edge.id, edge]))

  return {
    deleteNodeIds: baseline.nodes
      .filter(node => !currentNodes.has(node.id))
      .map(node => node.id),
    deleteEdgeIds: baseline.edges
      .filter(edge => !currentEdges.has(edge.id))
      .map(edge => edge.id),
    upsertNodes: current.nodes.filter((node) => {
      const previous = baselineNodes.get(node.id)
      return !previous || nodeFingerprint(previous) !== nodeFingerprint(node)
    }),
    upsertEdges: current.edges.filter((edge) => {
      const previous = baselineEdges.get(edge.id)
      return !previous || edgeFingerprint(previous) !== edgeFingerprint(edge)
    }),
  }
}

export function hasFlowGraphMutations(diff: FlowGraphDiff) {
  return diff.deleteNodeIds.length > 0
    || diff.deleteEdgeIds.length > 0
    || diff.upsertNodes.length > 0
    || diff.upsertEdges.length > 0
}

export function replayFlowGraphDiff(
  server: PersistedCanvasGraph,
  diff: FlowGraphDiff,
): {
  droppedEdgeIds: string[]
  graph: PersistedCanvasGraph
} {
  const nodes = new Map(server.nodes.map(node => [node.id, node]))
  for (const id of diff.deleteNodeIds)
    nodes.delete(id)
  for (const node of diff.upsertNodes)
    nodes.set(node.id, node)

  const edges = new Map(server.edges.map(edge => [edge.id, edge]))
  for (const id of diff.deleteEdgeIds)
    edges.delete(id)
  for (const edge of diff.upsertEdges)
    edges.set(edge.id, edge)

  const droppedEdgeIds: string[] = []
  for (const [edgeId, edge] of edges) {
    if (nodes.has(edge.sourceNodeId) && nodes.has(edge.targetNodeId))
      continue
    edges.delete(edgeId)
    droppedEdgeIds.push(edgeId)
  }

  return {
    droppedEdgeIds,
    graph: {
      nodes: [...nodes.values()],
      edges: [...edges.values()].toSorted(compareFlowEdgesByPriority),
    },
  }
}
