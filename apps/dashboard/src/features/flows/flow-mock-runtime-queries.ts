import type { FlowMockRuntimeState } from './flow-mock-runtime-state'

import { fingerprintGenerationMockRequest } from './flow-generation-preview'
import { executableMockRuntimeInputCount } from './flow-mock-runtime-inputs'
import { generationInputSlots } from './flow-mock-runtime-node-scope'
import { createMockRuntimeRequest } from './flow-mock-runtime-request'

export function getMockRuntimeExecutableInputCount(
  state: FlowMockRuntimeState,
  nodeId: string,
  slotId: string,
) {
  const node = state.nodesById.get(nodeId)
  const slot = node
    ? generationInputSlots(node).find(item => item.id === slotId)
    : undefined
  return slot
    ? executableMockRuntimeInputCount(
        state,
        nodeId,
        slot,
        new Set([nodeId]),
        createMockRuntimeRequest.bind(null, state),
      )
    : 0
}

export function getMockRuntimeFingerprint(
  state: FlowMockRuntimeState,
  nodeId: string,
) {
  const request = createMockRuntimeRequest(state, nodeId)
  return request ? fingerprintGenerationMockRequest(request) : null
}
