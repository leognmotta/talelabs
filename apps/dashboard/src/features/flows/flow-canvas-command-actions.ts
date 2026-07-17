/** Viewport-aware canvas commands that remain outside graph state ownership. */

import type { FlowNodeType } from '@talelabs/flows'
import type { ReactFlowInstance } from '@xyflow/react'
import type { RefObject } from 'react'
import type { CanvasStore } from './canvas-state/canvas-store'
import type { CanvasEdge, CanvasNode } from './flow-canvas-types'
import type { FlowGenerationPreviewScope } from './flow-mock-runtime-planner'

import { addCanvasNode } from './canvas-state/canvas-node-collection-actions'

interface FlowCanvasViewportCommandContext {
  reactFlow: ReactFlowInstance<CanvasNode, CanvasEdge>
  store: CanvasStore
}

/** Adds a node at a requested screen position or the visible canvas center. */
export function addFlowCanvasNode(
  input: FlowCanvasViewportCommandContext & {
    wrapperRef: RefObject<HTMLDivElement | null>
  },
  /** Registered node type to insert. */
  type: FlowNodeType,
  /** Optional screen-space insertion position from a context menu. */
  screenPosition?: { x: number, y: number },
): void {
  const bounds = input.wrapperRef.current?.getBoundingClientRect()
  addCanvasNode({
    position: input.reactFlow.screenToFlowPosition(screenPosition ?? {
      x: bounds ? bounds.left + bounds.width / 2 : window.innerWidth / 2,
      y: bounds ? bounds.top + bounds.height / 2 : window.innerHeight / 2,
    }),
    store: input.store,
    type,
  })
}

/** Fits the complete canvas or focuses nodes implied by a graph selection. */
export function focusFlowCanvas(
  input: FlowCanvasViewportCommandContext,
  /** Explicit nodes to focus; omit with edgeIds to fit the complete graph. */
  nodeIds?: readonly string[],
  /** Edges whose endpoints should be included in the focused region. */
  edgeIds?: readonly string[],
): void {
  if (!nodeIds && !edgeIds) {
    void input.reactFlow.fitView({ duration: 300, padding: 0.2 })
    return
  }
  const state = input.store.getState()
  const focusNodeIds = new Set(nodeIds ?? [])
  const selectedEdgeIds = new Set(edgeIds ?? [])
  for (const edge of state.edges) {
    if (selectedEdgeIds.has(edge.id)) {
      focusNodeIds.add(edge.source)
      focusNodeIds.add(edge.target)
    }
  }
  const focusNodes = state.nodes.filter(node => focusNodeIds.has(node.id))
  if (focusNodes.length) {
    void input.reactFlow.fitView({
      duration: 300,
      nodes: focusNodes,
      padding: 0.2,
    })
  }
}

/** Runs one generation node with a fixed graph scope. */
export function runFlowCanvasGeneration(
  runGeneration: (
    nodeId: string,
    scope?: FlowGenerationPreviewScope,
  ) => Promise<void>,
  /** Explicit run scope represented by the invoking canvas command. */
  scope: FlowGenerationPreviewScope,
  /** Generation node to admit. */
  nodeId: string,
): void {
  void runGeneration(nodeId, scope)
}
