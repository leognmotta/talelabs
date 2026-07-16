/** Executable snapshot aliases and worker-contract compatibility policy. */

import type {
  FlowRunSnapshot,
  ReadableFlowRunPlanSnapshot,
} from '@talelabs/flows'

import { FLOW_RUN_EXECUTOR_CONTRACT_VERSION } from '../../platform/task-contracts.js'

const LEGACY_LOCAL_EXECUTOR_VERSION = 'development'

/** Strictly readable plan snapshot accepted by the current durable worker. */
export type ExecutableFlowRunSnapshot = FlowRunSnapshot<ReadableFlowRunPlanSnapshot>

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
