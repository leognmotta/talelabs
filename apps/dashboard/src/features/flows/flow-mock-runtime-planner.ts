import type { GenerationMockRequest } from './flow-generation-preview'
import type { FlowMockRuntimePlannerInput } from './flow-mock-runtime-state'

import { getMockRuntimePreviewNodeIds } from './flow-mock-runtime-node-scope'
import {
  getMockRuntimeExecutableInputCount,
  getMockRuntimeFingerprint,
} from './flow-mock-runtime-queries'
import { createMockRuntimeRequest } from './flow-mock-runtime-request'
import { createFlowMockRuntimeState } from './flow-mock-runtime-state'

export type FlowGenerationPreviewScope = 'fromHere' | 'node' | 'tillHere'

export interface FlowMockRuntimePlanner {
  createRequest: (nodeId: string) => GenerationMockRequest | null
  getExecutableInputCount: (nodeId: string, slotId: string) => number
  getFingerprint: (nodeId: string) => null | string
  getPreviewNodeIds: (
    nodeId: string,
    scope: FlowGenerationPreviewScope,
  ) => string[]
}

export function createFlowMockRuntimePlanner(
  input: FlowMockRuntimePlannerInput,
): FlowMockRuntimePlanner {
  const state = createFlowMockRuntimeState(input)
  return {
    createRequest: createMockRuntimeRequest.bind(null, state),
    getExecutableInputCount: getMockRuntimeExecutableInputCount.bind(null, state),
    getFingerprint: getMockRuntimeFingerprint.bind(null, state),
    getPreviewNodeIds: getMockRuntimePreviewNodeIds.bind(null, input),
  }
}
