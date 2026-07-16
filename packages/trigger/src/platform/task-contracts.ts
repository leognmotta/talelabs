/** Stable Trigger.dev task identities and executor compatibility version. */

import type { AssetTaskPayload } from '../tasks/assets/contracts.js'
import type {
  FlowRunTaskPayload,
  GenerationJobTaskPayload,
} from '../tasks/flow-runs/contracts.js'

/** Logical task/snapshot contract. This is not a Trigger deployment selector. */
export const FLOW_RUN_EXECUTOR_CONTRACT_VERSION = 'm6.catalog-revision.1'

/** Maps stable Trigger.dev task IDs to their validated payload contracts. */
export interface TriggerTaskMap {
  'asset-ingest': AssetTaskPayload
  'asset-purge': AssetTaskPayload
  'flow-run-orchestrator': FlowRunTaskPayload
  'generation-job': GenerationJobTaskPayload
}

/** Stable Trigger.dev task identity accepted by the platform adapter. */
export type TriggerTaskId = keyof TriggerTaskMap
