/** Memoized planner over one immutable canvas and reference-data snapshot. */

import type { GenerationMockRequest } from '../../generation/flow-generation-preview-request'
import type { FlowGenerationPreviewScope } from './flow-mock-runtime-node-scope'
import type { FlowMockRuntimePlannerInput } from './flow-mock-runtime-state'

import { getMockRuntimePreviewNodeIds } from './flow-mock-runtime-node-scope'
import {
  getMockRuntimeExecutableInputCount,
  getMockRuntimeFingerprint,
} from './flow-mock-runtime-queries'
import { createMockRuntimeRequest } from './flow-mock-runtime-request'
import { createFlowMockRuntimeState } from './flow-mock-runtime-state'

/** Read-only request, count, fingerprint, and scope queries for one canvas snapshot. */
export interface FlowMockRuntimePlanner {
  createRequest: (nodeId: string) => GenerationMockRequest | null
  getExecutableInputCount: (nodeId: string, slotId: string) => number
  getFingerprint: (nodeId: string) => null | string
  getPreviewNodeIds: (
    nodeId: string,
    scope: FlowGenerationPreviewScope,
  ) => string[]
}

/** Creates a memoized deterministic planner over one immutable canvas snapshot. */
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
