/** Read-only readiness and fingerprint queries over mock runtime state. */

import type { FlowMockRuntimeState } from './flow-mock-runtime-state'

import { fingerprintGenerationMockRequest } from '../../generation/flow-generation-preview-fingerprint'
import { executableMockRuntimeInputCount } from './flow-mock-runtime-inputs'
import { generationInputSlots } from './flow-mock-runtime-node-scope'
import { createMockRuntimeRequest } from './flow-mock-runtime-request'

/** Resolves one slot and counts its executable runtime items without mutating state. */
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

/** Fingerprints the fully resolved request for one runnable generation node. */
export function getMockRuntimeFingerprint(
  state: FlowMockRuntimeState,
  nodeId: string,
) {
  const request = createMockRuntimeRequest(state, nodeId)
  return request ? fingerprintGenerationMockRequest(request) : null
}
