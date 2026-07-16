import type {
  FlowGraphEdge,
  FlowGraphNode,
  FlowGraphValidationContext,
} from './types.js'

export interface ValidateGraphInput {
  context: FlowGraphValidationContext
  edges: readonly FlowGraphEdge[]
  nodes: readonly FlowGraphNode[]
}
