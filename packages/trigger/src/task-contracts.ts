import type { AssetTaskPayload } from './tasks/asset-processing/asset-task.js'
import type { FlowRunTaskPayload, GenerationJobTaskPayload } from './tasks/flow-runs/index.js'

/** Logical task/snapshot contract. This is not a Trigger deployment selector. */
export const FLOW_RUN_EXECUTOR_CONTRACT_VERSION = 'm5.2-durable-mock.1'

export interface TriggerTaskMap {
  'asset-ingest': AssetTaskPayload
  'asset-purge': AssetTaskPayload
  'flow-run-orchestrator': FlowRunTaskPayload
  'generation-job': GenerationJobTaskPayload
}

export type TriggerTaskId = keyof TriggerTaskMap
