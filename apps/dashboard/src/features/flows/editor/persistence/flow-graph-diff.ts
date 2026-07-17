/** Dependency-safe diffs between persisted Flow graph revisions. */

import type { FlowEdge, FlowNode } from '@talelabs/sdk'
import type { PersistedCanvasGraph } from '../flow-canvas-types'

import {
  edgeFingerprint,
  nodeFingerprint,
} from './flow-graph-fingerprint'

/** Mutations required to advance one persisted Flow graph to another. */
export interface FlowGraphDiff {
  /** Edge ids removed before any referenced nodes are deleted. */
  deleteEdgeIds: string[]
  /** Node ids removed after their incident edges have been detached. */
  deleteNodeIds: string[]
  /** New or changed edges attached after their nodes are present. */
  upsertEdges: FlowEdge[]
  /** New or changed nodes persisted before dependent edges. */
  upsertNodes: FlowNode[]
}

/** Counts all delete and upsert operations contained in a graph diff. */
export function countFlowGraphMutations(diff: FlowGraphDiff) {
  return diff.deleteEdgeIds.length
    + diff.deleteNodeIds.length
    + diff.upsertEdges.length
    + diff.upsertNodes.length
}

/**
 * Takes one bounded batch in dependency-safe order: detach edges, delete nodes,
 * upsert nodes, then attach edges. Diffs within the limit remain atomic.
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

/** Computes node/edge deletes and changed-value upserts from two graph snapshots. */
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
