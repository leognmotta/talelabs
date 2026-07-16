import type { TriggerTaskId, TriggerTaskMap } from './task-contracts.js'

import { tasks } from '@trigger.dev/sdk'

export type TriggerTaskOptions = Parameters<typeof tasks.trigger>[2]
export type TriggerBatchOptions = Parameters<typeof tasks.batchTrigger>[2]

export function flowRunTaskOptions(
  organizationId: string,
  options: TriggerTaskOptions = {},
): TriggerTaskOptions {
  return {
    ...options,
    concurrencyKey: organizationId,
    queue: 'flow-runs',
  }
}

export function triggerTask<TTask extends TriggerTaskId>(
  id: TTask,
  payload: TriggerTaskMap[TTask],
  options?: TriggerTaskOptions,
) {
  return tasks.trigger(id, payload, options)
}

export function batchTriggerTask<TTask extends TriggerTaskId>(
  id: TTask,
  items: { payload: TriggerTaskMap[TTask] }[],
  options?: TriggerBatchOptions,
) {
  return tasks.batchTrigger(id, items, options)
}
