/** Materialization of immutable planned inputs into normalized provider requests. */

import type {
  NormalizedGenerationRequest,
} from '../../generation/contracts/provider.js'
import type { PlannedJobRequestPayload } from '../planning/planner-contracts.js'

import { hashFlowRunJob } from '../serialization/execution-hashes.js'
import { selectedProviderRequestInputs } from './provider-input-selections.js'
import { normalizedInputItem } from './provider-inputs.js'
import { normalizedTextSlots } from './provider-text-slots.js'

/**
 * Builds the single adapter-facing request exclusively from one validated,
 * immutable job payload. Same-run placeholders must be materialized first.
 */
export function materializeGenerationProviderRequest(input: {
  requestId: string
  requestPayload: PlannedJobRequestPayload
}): NormalizedGenerationRequest {
  return Object.freeze({
    adapterRequestVersion: 3 as const,
    catalogRevision: input.requestPayload.catalogRevision,
    catalogVersion: input.requestPayload.catalogVersion,
    itemKey: input.requestPayload.itemKey,
    modelContractVersion: input.requestPayload.modelContractVersion,
    nodeId: input.requestPayload.nodeId,
    operationId: input.requestPayload.operationId,
    orderedInputs: Object.freeze(selectedProviderRequestInputs(input.requestPayload).map(
      (plannedInput, order) => Object.freeze({
        edgeId: plannedInput.edgeId,
        items: Object.freeze(plannedInput.items.map(normalizedInputItem)),
        order,
        sourceHandleId: plannedInput.sourceHandleId,
        sourceNodeId: plannedInput.sourceNodeId,
        targetSlotId: plannedInput.targetHandleId,
      }),
    )),
    outputCount: input.requestPayload.outputCount,
    productModelId: input.requestPayload.modelId,
    modelRevision: input.requestPayload.modelRevision,
    requestId: input.requestId,
    requestIndex: input.requestPayload.requestIndex,
    requestPayloadHash: hashFlowRunJob(input.requestPayload),
    settings: input.requestPayload.settings,
    textSlots: normalizedTextSlots(input.requestPayload),
  })
}
