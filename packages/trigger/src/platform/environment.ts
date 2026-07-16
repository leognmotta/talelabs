import process from 'node:process'

export const TRIGGER_PROJECT_REF_ENV = 'TRIGGER_PROJECT_REF'
export const TRIGGER_SECRET_KEY_ENV = 'TRIGGER_SECRET_KEY'

export type TriggerEnv = Partial<Record<
  | typeof TRIGGER_PROJECT_REF_ENV
  | typeof TRIGGER_SECRET_KEY_ENV,
  string
>>

export function getTriggerSecretKey(env: TriggerEnv = process.env) {
  const value = env[TRIGGER_SECRET_KEY_ENV]
  if (!value)
    throw new Error(`${TRIGGER_SECRET_KEY_ENV} is required to use Trigger.dev.`)
  return value
}

export function getTriggerProjectRef(env: TriggerEnv = process.env) {
  const value = env[TRIGGER_PROJECT_REF_ENV]
  if (!value)
    throw new Error(`${TRIGGER_PROJECT_REF_ENV} is required to use Trigger.dev.`)
  return value
}

export function getTriggerEnvironment(env: TriggerEnv = process.env) {
  return {
    projectRef: getTriggerProjectRef(env),
    secretKey: getTriggerSecretKey(env),
  }
}
