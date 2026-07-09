import process from 'node:process'
import {
  batch,
  idempotencyKeys,
  logger,
  metadata,
  queue,
  schedules,
  schemaTask,
  tags,
  task,
  tasks,
  wait,
} from '@trigger.dev/sdk'

import './env.js'

export {
  batch,
  idempotencyKeys,
  logger,
  metadata,
  queue,
  schedules,
  schemaTask,
  tags,
  task,
  tasks,
  wait,
}

export const TRIGGER_SECRET_KEY_ENV = 'TRIGGER_SECRET_KEY'
export const TRIGGER_PROJECT_REF_ENV = 'TRIGGER_PROJECT_REF'

export type TriggerEnv = Partial<
  Record<
    | typeof TRIGGER_PROJECT_REF_ENV
    | typeof TRIGGER_SECRET_KEY_ENV,
    string
  >
>

export type TriggerTaskOptions = Parameters<typeof tasks.trigger>[2]
export type TriggerBatchOptions = Parameters<typeof tasks.batchTrigger>[2]

function requireEnvValue(
  env: TriggerEnv,
  name: typeof TRIGGER_PROJECT_REF_ENV | typeof TRIGGER_SECRET_KEY_ENV,
) {
  const value = env[name]

  if (!value)
    throw new Error(`${name} is required to use Trigger.dev.`)

  return value
}

export function getTriggerSecretKey(env: TriggerEnv = process.env) {
  return requireEnvValue(env, TRIGGER_SECRET_KEY_ENV)
}

export function getTriggerProjectRef(env: TriggerEnv = process.env) {
  return requireEnvValue(env, TRIGGER_PROJECT_REF_ENV)
}

export function getTriggerEnvironment(env: TriggerEnv = process.env) {
  return {
    projectRef: getTriggerProjectRef(env),
    secretKey: getTriggerSecretKey(env),
  }
}

export async function triggerTask<TTask extends string>(
  id: TTask,
  payload: unknown,
  options?: TriggerTaskOptions,
) {
  return tasks.trigger(id, payload, options)
}

export async function batchTriggerTask<TTask extends string>(
  id: TTask,
  items: {
    payload: unknown
  }[],
  options?: TriggerBatchOptions,
) {
  return tasks.batchTrigger(id, items, options)
}
