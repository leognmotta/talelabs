import { FLOW_GRAPH_LIMITS } from '../limits.js'

export interface FlowRunLimits {
  dimensionsPerItem: number
  executableNodes: number
  organizationActiveRuns: number
  organizationGenerationJobConcurrency: number
  organizationRunConcurrency: number
  itemsPerNode: number
  jobsPerRun: number
  outputsPerRun: number
  selectionIds: number
  snapshotBytes: number
  topologicalDepth: number
}

export const FLOW_RUN_LIMITS = Object.freeze({
  dimensionsPerItem: 16,
  executableNodes: 256,
  organizationActiveRuns: 10,
  organizationGenerationJobConcurrency: 4,
  organizationRunConcurrency: 2,
  itemsPerNode: 100,
  jobsPerRun: 1_000,
  outputsPerRun: 1_000,
  selectionIds: Math.min(2_000, FLOW_GRAPH_LIMITS.nodes),
  snapshotBytes: 16 * 1024 * 1024,
  topologicalDepth: 256,
} satisfies FlowRunLimits)

/** Test/verifier overrides still pass through the same positive-integer policy. */
export function resolveFlowRunLimits(
  overrides: Partial<FlowRunLimits> = {},
): FlowRunLimits {
  const resolved = { ...FLOW_RUN_LIMITS, ...overrides }
  for (const [key, value] of Object.entries(resolved)) {
    if (!Number.isSafeInteger(value) || value < 1)
      throw new RangeError(`Invalid Flow run limit ${key}: ${value}`)
  }
  return resolved
}
