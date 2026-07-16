import type { FlowRunSnapshotExecutionContract } from './contracts.js'

import { deepFreeze } from '../serialization/deep-freeze.js'
import {
  executionContractSchema,
  FlowRunSnapshotReadError,
} from './contracts.js'

/** Reads one bounded execution-contract object selected from a run snapshot. */
export function readFlowRunSnapshotExecutionContract(
  value: unknown,
): FlowRunSnapshotExecutionContract {
  const parsed = executionContractSchema.safeParse(value)
  if (!parsed.success)
    throw new FlowRunSnapshotReadError('snapshot_invalid')
  return deepFreeze(parsed.data)
}
