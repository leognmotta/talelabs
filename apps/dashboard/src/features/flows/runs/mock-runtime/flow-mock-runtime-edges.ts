/** Stable incoming-edge ordering for deterministic mock graph planning. */

import type { FlowMockRuntimeState } from './flow-mock-runtime-state'

import { compareFlowEdgesByPriority } from '@talelabs/flows'

/** Returns incoming edges for a target node/handle in deterministic graph order. */
export function incomingMockRuntimeEdges(
  state: FlowMockRuntimeState,
  nodeId: string,
) {
  return state.input.edges
    .filter(edge => edge.target === nodeId && edge.targetHandle)
    .toSorted(compareFlowEdgesByPriority)
}
