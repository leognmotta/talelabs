/** Scoped client-owned state for one editable Flow canvas. */

import type { FlowGraphResponse } from '@talelabs/sdk'
import type { StoreApi } from 'zustand'
import type { CanvasEdge, CanvasNode } from '../flow-canvas-types'

import { createStore } from 'zustand/vanilla'
import { toCanvasEdges } from '../persistence/flow-edge-serialization'
import { toCanvasNodes } from '../persistence/flow-node-serialization'

/** A graph snapshot retained by the bounded canvas undo history. */
export interface CanvasHistorySnapshot {
  /** Edges exactly as they should be restored, without transient selection. */
  edges: CanvasEdge[]
  /** Serialized graph identity used to avoid duplicate history entries. */
  fingerprint: string
  /** Nodes exactly as they should be restored, without drag or selection state. */
  nodes: CanvasNode[]
}

/** The context-menu target derived from the current canvas interaction. */
export interface CanvasContextTarget {
  /** Selected edge IDs available to the menu action. */
  edgeIds: string[]
  /** Menu presentation appropriate for the interaction target. */
  mode: 'nodeActions' | 'pane' | 'selection'
  /** Selected node IDs available to the menu action. */
  nodeIds: string[]
  /** Screen position used when a pane action inserts content. */
  screenPosition: null | { x: number, y: number }
}

/** Client-owned graph, history, selection, and transient canvas UI state. */
export interface CanvasState {
  /** Node whose Asset picker dialog is open, or null when closed. */
  assetPickerNodeId: null | string
  /** Current canvas context-menu target. */
  contextTarget: CanvasContextTarget
  /** Editable React Flow edges for this Flow. */
  edges: CanvasEdge[]
  /** Node whose image crop editor is active, or null when inactive. */
  editingImageCropNodeId: null | string
  /** Future snapshots used by redo, ordered from oldest to newest. */
  future: CanvasHistorySnapshot[]
  /** Local persistent-graph revision incremented by every graph mutation. */
  graphRevision: number
  /** Flow identity that owns this scoped store instance. */
  flowId: string
  /** Editable React Flow nodes for this Flow. */
  nodes: CanvasNode[]
  /** Organization identity that owns this scoped store instance. */
  organizationId: string
  /** Past snapshots used by undo, ordered from oldest to newest. */
  past: CanvasHistorySnapshot[]
  /** Whether the current drag gesture has already captured its history entry. */
  positionHistoryActive: boolean
  /** Last local graph revision fully acknowledged by autosave. */
  savedRevision: number
  /** Selected edge IDs stored separately from the frequently changing edge array. */
  selectedEdgeIds: string[]
  /** Selected node IDs stored separately from the frequently changing node array. */
  selectedNodeIds: string[]
}

/** Imperative vanilla store API shared by canvas actions and external services. */
export type CanvasStore = StoreApi<CanvasState>

/** Creates one non-persisted vanilla store initialized from the server graph. */
export function createCanvasStore(input: {
  /** Server graph used as the initial editable document. */
  graph: FlowGraphResponse
  /** Organization that owns the Flow. */
  organizationId: string
  /** Flow that owns the scoped store. */
  flowId: string
}): CanvasStore {
  const initialRevision = input.graph.revision
  return createStore<CanvasState>()(() => ({
    assetPickerNodeId: null,
    contextTarget: {
      edgeIds: [],
      mode: 'pane',
      nodeIds: [],
      screenPosition: null,
    },
    edges: toCanvasEdges(input.graph.edges),
    editingImageCropNodeId: null,
    flowId: input.flowId,
    future: [],
    graphRevision: initialRevision,
    nodes: toCanvasNodes(input.graph.nodes),
    organizationId: input.organizationId,
    past: [],
    positionHistoryActive: false,
    savedRevision: initialRevision,
    selectedEdgeIds: [],
    selectedNodeIds: [],
  }))
}

/** Reads one node from a scoped store without creating a React subscription. */
export function findCanvasNode(
  store: CanvasStore,
  /** Stable node identity to resolve. */
  nodeId: string,
): CanvasNode | undefined {
  return store.getState().nodes.find(node => node.id === nodeId)
}
