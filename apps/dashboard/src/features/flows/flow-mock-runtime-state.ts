import type {
  CanvasEdge,
  CanvasNode,
  FlowGenerationPreview,
  FlowReferenceData,
} from './flow-canvas-types'
import type { GenerationMockRequest } from './flow-generation-preview'

export interface FlowMockRuntimePlannerInput {
  edges: readonly CanvasEdge[]
  locale: string
  nodes: readonly CanvasNode[]
  previews: Readonly<Record<string, FlowGenerationPreview>>
  referenceData: FlowReferenceData
}

export interface FlowMockRuntimeState {
  input: FlowMockRuntimePlannerInput
  nodesById: ReadonlyMap<string, CanvasNode>
  requestCache: Map<string, GenerationMockRequest | null>
}

export function createFlowMockRuntimeState(
  input: FlowMockRuntimePlannerInput,
): FlowMockRuntimeState {
  return {
    input,
    nodesById: new Map(input.nodes.map(node => [node.id, node])),
    requestCache: new Map(),
  }
}
