import type {
  FlowRunSnapshotV1,
  ReadableFlowRunPlanSnapshot,
} from '@talelabs/flows'

import { FLOW_RUN_EXECUTOR_CONTRACT_VERSION } from '../../task-contracts.js'

const LEGACY_LOCAL_EXECUTOR_VERSION = 'development'

export type ExecutableFlowRunSnapshot = FlowRunSnapshotV1<ReadableFlowRunPlanSnapshot>

/** Keeps pre-contract M5 development snapshots readable without weakening new runs. */
export function expectedSnapshotExecutorVersion(input: {
  executorVersion: string
  isDevelopment: boolean
  triggerDeploymentVersion: string | null
}) {
  if (input.executorVersion === FLOW_RUN_EXECUTOR_CONTRACT_VERSION)
    return FLOW_RUN_EXECUTOR_CONTRACT_VERSION
  if (
    input.executorVersion === input.triggerDeploymentVersion
    || (input.isDevelopment && input.executorVersion === LEGACY_LOCAL_EXECUTOR_VERSION)
  ) {
    return input.executorVersion
  }
  return FLOW_RUN_EXECUTOR_CONTRACT_VERSION
}
