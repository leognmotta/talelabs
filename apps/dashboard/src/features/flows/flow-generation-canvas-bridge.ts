/** Narrow store and reference-data bridge shared by generation canvas consumers. */

import type {
  GenerationConfigurationUpdate,
  GenerationInputContract,
} from './canvas-state/canvas-generation-actions'
import type { CanvasStore } from './canvas-state/canvas-store'
import type {
  CanvasEdge,
  CanvasNode,
  FlowInputState,
  FlowReferenceData,
} from './flow-canvas-types'

import { updateCanvasGenerationConfiguration } from './canvas-state/canvas-generation-actions'
import { updateCanvasNodeData } from './canvas-state/canvas-node-actions'
import { findCanvasNode } from './canvas-state/canvas-store'
import {
  getCanvasInputState,
  getCompatibleCanvasGenerationEdgeIds,
} from './flow-generation-compatibility'

interface FlowGenerationCanvasBridgeContext {
  referenceData: FlowReferenceData
  store: CanvasStore
}

function readGenerationCanvasInput(
  input: FlowGenerationCanvasBridgeContext,
  nodeId: string,
  slotId: string,
): FlowInputState | null {
  const state = input.store.getState()
  return getCanvasInputState({
    edges: state.edges,
    nodeId,
    nodes: state.nodes,
    referenceData: input.referenceData,
    slotId,
  })
}

function readIncompatibleGenerationEdges(
  input: FlowGenerationCanvasBridgeContext,
  nodeId: string,
  inputContracts: readonly GenerationInputContract[],
): readonly CanvasEdge[] {
  const state = input.store.getState()
  const compatibleIds = getCompatibleCanvasGenerationEdgeIds({
    candidateEdges: state.edges,
    inputContracts,
    nodeId,
    nodes: state.nodes,
    referenceData: input.referenceData,
  })
  return state.edges.filter(edge => (
    edge.target === nodeId && !compatibleIds.has(edge.id)
  ))
}

/** Store-backed generation queries and mutations without a React context. */
export interface FlowGenerationCanvasBridge {
  /** Finds incoming edges rejected by a proposed generation contract. */
  getIncompatibleGenerationEdges: (
    nodeId: string,
    inputContracts: readonly GenerationInputContract[],
  ) => readonly CanvasEdge[]
  /** Resolves current input selection and availability for one semantic slot. */
  getInputState: (nodeId: string, slotId: string) => FlowInputState | null
  /** Reads one node imperatively without observing the complete node array. */
  getNode: (nodeId: string) => CanvasNode | undefined
  /** External server-owned references used for graph value resolution. */
  referenceData: FlowReferenceData
  /** Applies one atomic generation-model configuration transition. */
  updateGenerationConfiguration: (
    nodeId: string,
    configuration: GenerationConfigurationUpdate,
  ) => void
  /** Applies one persistent node-data mutation. */
  updateNodeData: (
    nodeId: string,
    update: (data: Record<string, any>) => Record<string, any>,
  ) => void
}

/** Creates the shared imperative bridge for one store/reference-data pair. */
export function createFlowGenerationCanvasBridge(
  input: FlowGenerationCanvasBridgeContext,
): FlowGenerationCanvasBridge {
  return {
    getIncompatibleGenerationEdges: readIncompatibleGenerationEdges.bind(
      null,
      input,
    ),
    getInputState: readGenerationCanvasInput.bind(null, input),
    getNode: findCanvasNode.bind(null, input.store),
    referenceData: input.referenceData,
    updateGenerationConfiguration: updateCanvasGenerationConfiguration.bind(
      null,
      input,
    ),
    updateNodeData: updateCanvasNodeData.bind(null, input),
  }
}
