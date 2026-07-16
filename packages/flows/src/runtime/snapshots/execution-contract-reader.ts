/** Bounded extraction and validation of execution contracts from run snapshots. */

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
  const contract = parsed.data
  const binding = contract.providerBinding
  if (
    contract.adapterVersion !== binding.adapterVersion
    || contract.operationId !== binding.operationId
    || contract.provider !== binding.provider
    || contract.providerEndpoint !== binding.endpoint
    || contract.providerEndpointTag !== binding.providerTag
    || contract.providerModel !== binding.nativeModelId
    || contract.providerRouteVersion !== binding.routeVersion
    || JSON.stringify(contract.providerLifecycle) !== JSON.stringify(binding.lifecycle)
  ) {
    throw new FlowRunSnapshotReadError('snapshot_invalid')
  }
  return deepFreeze(parsed.data)
}
