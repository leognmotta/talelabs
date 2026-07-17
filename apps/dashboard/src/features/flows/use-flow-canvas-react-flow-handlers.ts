/** Stable React Flow event adapters for the scoped canvas action modules. */

import type { OnMoveEnd } from '@xyflow/react'
import type { CanvasStore } from './canvas-state/canvas-store'
import type { FlowReferenceData } from './flow-canvas-types'

import { useMemo } from 'react'
import { toast } from 'sonner'
import {
  applyCanvasEdgeChanges,
  connectCanvasEdge,
  isCanvasConnectionValid,
} from './canvas-state/canvas-graph-actions'
import { applyCanvasNodeChanges } from './canvas-state/canvas-node-actions'
import {
  openCanvasContextMenu,
  setCanvasSelection,
} from './canvas-state/canvas-ui-actions'

/** Returns stable callbacks for React Flow graph and interaction events. */
export function useFlowCanvasReactFlowHandlers(input: {
  /** Localized error shown when a proposed connection is invalid. */
  connectionRejectedMessage: string
  /** Persists viewport changes outside the scoped canvas store. */
  persistViewport: OnMoveEnd
  /** Latest external references used by graph validation. */
  referenceDataRef: { current: FlowReferenceData }
  /** Scoped client-owned canvas store. */
  store: CanvasStore
}) {
  return useMemo(() => {
    const graphContext = {
      onConnectionRejected: toast.error.bind(
        null,
        input.connectionRejectedMessage,
      ),
      referenceDataRef: input.referenceDataRef,
      store: input.store,
    }
    return {
      isValidConnection: isCanvasConnectionValid.bind(null, graphContext),
      onConnect: connectCanvasEdge.bind(null, graphContext),
      onEdgeContextMenu: openCanvasContextMenu.bind(
        null,
        input.store,
        'edge',
      ),
      onEdgesChange: applyCanvasEdgeChanges.bind(null, graphContext),
      onMoveEnd: input.persistViewport,
      onNodeContextMenu: openCanvasContextMenu.bind(
        null,
        input.store,
        'node',
      ),
      onNodeDoubleClick: openCanvasContextMenu.bind(
        null,
        input.store,
        'nodeDoubleClick',
      ),
      onNodesChange: applyCanvasNodeChanges.bind(null, {
        referenceDataRef: input.referenceDataRef,
        store: input.store,
      }),
      onPaneContextMenu: openCanvasContextMenu.bind(
        null,
        input.store,
        'pane',
      ),
      onReconnect: connectCanvasEdge.bind(null, graphContext),
      onSelectionChange: setCanvasSelection.bind(null, input.store),
      onSelectionContextMenu: openCanvasContextMenu.bind(
        null,
        input.store,
        'selection',
      ),
    }
  }, [
    input.connectionRejectedMessage,
    input.persistViewport,
    input.referenceDataRef,
    input.store,
  ])
}
