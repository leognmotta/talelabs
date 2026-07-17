/** Stable graph, viewport, save, and run commands for one Flow canvas. */

import type { ReactFlowInstance } from '@xyflow/react'
import type { RefObject } from 'react'
import type { CanvasStore } from './canvas-state/canvas-store'
import type {
  CanvasEdge,
  CanvasNode,
  FlowReferenceData,
} from './flow-canvas-types'
import type { FlowGenerationPreviewScope } from './flow-mock-runtime-planner'

import { useMemo } from 'react'
import {
  deleteCanvasNodes,
  duplicateCanvasNodes,
} from './canvas-state/canvas-node-collection-actions'
import {
  arrangeCanvasNodes,
  setCanvasSelection,
} from './canvas-state/canvas-ui-actions'
import {
  addFlowCanvasNode,
  focusFlowCanvas,
  runFlowCanvasGeneration,
} from './flow-canvas-command-actions'

/** Returns stable commands grouped by canvas editing and execution ownership. */
export function useFlowCanvasCommands(input: {
  /** Latest external references used when deletion reconciles generation nodes. */
  referenceData: FlowReferenceData
  /** React Flow viewport API used by insertion and focus commands. */
  reactFlow: ReactFlowInstance<CanvasNode, CanvasEdge>
  /** Retries a failed graph save. */
  retrySave: () => Promise<null | number>
  /** Executes every admissible generation node. */
  runAll: () => Promise<void>
  /** Executes one node with an optional graph scope. */
  runGeneration: (
    nodeId: string,
    scope?: FlowGenerationPreviewScope,
  ) => Promise<void>
  /** Executes the selected generation nodes. */
  runSelection: (nodeIds: readonly string[]) => Promise<void>
  /** Scoped client-owned canvas store. */
  store: CanvasStore
  /** Canvas element used to resolve centered node insertion. */
  wrapperRef: RefObject<HTMLDivElement | null>
}) {
  return useMemo(() => {
    const deletionContext = {
      referenceData: input.referenceData,
      store: input.store,
    }
    const viewportContext = {
      reactFlow: input.reactFlow,
      store: input.store,
    }
    const deleteNodes = deleteCanvasNodes.bind(null, deletionContext)
    return {
      addNode: addFlowCanvasNode.bind(null, {
        ...viewportContext,
        wrapperRef: input.wrapperRef,
      }),
      arrangeSelection: arrangeCanvasNodes.bind(null, input.store),
      deleteNodes,
      deleteSelection: deleteNodes,
      duplicateNodes: duplicateCanvasNodes.bind(null, input.store),
      fitView: focusFlowCanvas.bind(
        null,
        viewportContext,
        undefined,
        undefined,
      ),
      focusSelection: focusFlowCanvas.bind(null, viewportContext),
      retrySave: input.retrySave,
      runAll: input.runAll,
      runFromHere: runFlowCanvasGeneration.bind(
        null,
        input.runGeneration,
        'fromHere',
      ),
      runNode: input.runGeneration,
      runSelection: input.runSelection,
      runTillHere: runFlowCanvasGeneration.bind(
        null,
        input.runGeneration,
        'tillHere',
      ),
      selectAll: setCanvasSelection.bind(null, input.store, undefined),
    }
  }, [
    input.reactFlow,
    input.referenceData,
    input.retrySave,
    input.runAll,
    input.runGeneration,
    input.runSelection,
    input.store,
    input.wrapperRef,
  ])
}
