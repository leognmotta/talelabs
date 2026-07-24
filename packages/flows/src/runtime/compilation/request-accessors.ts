/**
 * Compatibility accessors for immutable generation-job request versions.
 *
 * Current requests use source-neutral step and binding names. Historical Flow
 * requests retain their graph field names and are read through this boundary.
 */

import type {
  CompiledGenerationJobInput,
  PlannedJobRequestInput,
  PlannedJobRequestPayload,
} from '../planning/planner-contracts.js'

/** Input binding shape shared by current and historical request readers. */
export type GenerationJobRequestInput
  = | CompiledGenerationJobInput
    | PlannedJobRequestInput

/** Returns the execution-step identity for any supported request version. */
export function generationJobExecutionStepId(
  request: PlannedJobRequestPayload,
): string {
  return request.requestPayloadVersion === 6
    ? request.executionStepId
    : request.nodeId
}

/** Returns one stable input-occurrence identity across request versions. */
export function generationJobInputBindingId(
  input: GenerationJobRequestInput,
): string {
  return 'bindingId' in input ? input.bindingId : input.edgeId
}

/** Returns the source identity for one request input. */
export function generationJobInputSourceId(
  input: GenerationJobRequestInput,
): string {
  return 'sourceId' in input ? input.sourceId : input.sourceNodeId
}

/** Returns the source output identity for one request input. */
export function generationJobInputSourceOutputId(
  input: GenerationJobRequestInput,
): string {
  return 'sourceOutputId' in input
    ? input.sourceOutputId
    : input.sourceHandleId
}

/** Returns the semantic target slot for one request input. */
export function generationJobInputTargetSlotId(
  input: GenerationJobRequestInput,
): string {
  return 'targetSlotId' in input ? input.targetSlotId : input.targetHandleId
}
