import type { FlowMockRuntimeState } from './flow-mock-runtime-state'

import { compareFlowEdgesByPriority } from '@talelabs/flows'

export function incomingMockRuntimeEdges(
  state: FlowMockRuntimeState,
  nodeId: string,
) {
  return state.input.edges
    .filter(edge => edge.target === nodeId && edge.targetHandle)
    .toSorted(compareFlowEdgesByPriority)
}
