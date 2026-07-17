/** Immutable lookup indexes used throughout deterministic mock planning. */

import type {
  CanvasEdge,
  CanvasNode,
  FlowGenerationPreview,
  FlowReferenceData,
} from '../../editor/flow-canvas-types'
import type { GenerationMockRequest } from '../../generation/flow-generation-preview-request'

/** Immutable canvas/reference snapshot consumed by one mock planning pass. */
export interface FlowMockRuntimePlannerInput {
  edges: readonly CanvasEdge[]
  locale: string
  nodes: readonly CanvasNode[]
  previews: Readonly<Record<string, FlowGenerationPreview>>
  referenceData: FlowReferenceData
}

/** Indexed planning state and request memoization scoped to one canvas snapshot. */
export interface FlowMockRuntimeState {
  input: FlowMockRuntimePlannerInput
  nodesById: ReadonlyMap<string, CanvasNode>
  requestCache: Map<string, GenerationMockRequest | null>
}

/** Indexes nodes and initializes request memoization for one planning pass. */
export function createFlowMockRuntimeState(
  input: FlowMockRuntimePlannerInput,
): FlowMockRuntimeState {
  return {
    input,
    nodesById: new Map(input.nodes.map(node => [node.id, node])),
    requestCache: new Map(),
  }
}
