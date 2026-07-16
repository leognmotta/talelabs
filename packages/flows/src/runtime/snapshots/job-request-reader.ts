import type { PlannedJobRequestPayload } from '../planning/planner-contracts.js'

import { FLOW_RUN_LIMITS } from '../planning/limits.js'
import { canonicalByteLength } from '../serialization/canonical-hash.js'
import { deepFreeze } from '../serialization/deep-freeze.js'
import { hashFlowRunJob } from '../serialization/execution-hashes.js'
import {
  FlowRunJobRequestReadError,
  requestPayloadSchema,
} from './contracts.js'

/**
 * Validates one persisted immutable provider-neutral request without loading
 * or reparsing the complete Flow snapshot in a generation child.
 */
export function readFlowRunJobRequestPayload(input: {
  requestHash: string
  requestPayload: unknown
}): PlannedJobRequestPayload {
  const parsed = requestPayloadSchema.safeParse(input.requestPayload)
  if (!parsed.success)
    throw new FlowRunJobRequestReadError('job_request_invalid')

  let bytes: number
  try {
    bytes = canonicalByteLength(parsed.data)
  }
  catch {
    throw new FlowRunJobRequestReadError('job_request_invalid')
  }
  if (bytes > FLOW_RUN_LIMITS.snapshotBytes)
    throw new FlowRunJobRequestReadError('job_request_too_large')
  if (hashFlowRunJob(parsed.data) !== input.requestHash)
    throw new FlowRunJobRequestReadError('job_request_hash_mismatch')

  return deepFreeze(parsed.data) as PlannedJobRequestPayload
}
