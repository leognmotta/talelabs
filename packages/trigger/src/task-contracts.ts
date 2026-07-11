import type { AssetTaskPayload } from './tasks/asset-processing/asset-task.js'

export interface TriggerTaskMap {
  'asset-ingest': AssetTaskPayload
  'asset-purge': AssetTaskPayload
}

export type TriggerTaskId = keyof TriggerTaskMap
