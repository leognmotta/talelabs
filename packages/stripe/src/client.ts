import type { Buffer } from 'node:buffer'

import process from 'node:process'
import Stripe from 'stripe'

import './env.js'

export {
  Stripe,
}

export type StripeClient = Stripe
export type StripeClientConfig = Omit<
  Stripe.StripeConfig,
  'apiVersion'
> & {
  apiVersion?: Stripe.LatestApiVersion
}

export const STRIPE_SECRET_KEY_ENV = 'STRIPE_SECRET_KEY'
export const STRIPE_PUBLISHABLE_KEY_ENV = 'STRIPE_PUBLISHABLE_KEY'
export const STRIPE_API_VERSION = '2026-06-24.dahlia' satisfies Stripe.LatestApiVersion
export const STRIPE_APP_NAME = 'TaleLabs'
export const STRIPE_APP_VERSION = '0.0.0'

export type StripeEnv = Partial<
  Record<
    | typeof STRIPE_SECRET_KEY_ENV
    | typeof STRIPE_PUBLISHABLE_KEY_ENV,
    string
  >
>

export interface StripeClientOptions extends StripeClientConfig {
  env?: StripeEnv
  secretKey?: string
}

export interface ConstructStripeWebhookEventInput {
  payload: Buffer | string
  secret: string
  signature: string
  stripe?: StripeClient
}

function requireEnvValue(
  env: StripeEnv,
  name: typeof STRIPE_PUBLISHABLE_KEY_ENV | typeof STRIPE_SECRET_KEY_ENV,
) {
  const value = env[name]

  if (!value)
    throw new Error(`${name} is required to use Stripe.`)

  return value
}

export function getStripeSecretKey(env: StripeEnv = process.env) {
  return requireEnvValue(env, STRIPE_SECRET_KEY_ENV)
}

export function getStripePublishableKey(env: StripeEnv = process.env) {
  return requireEnvValue(env, STRIPE_PUBLISHABLE_KEY_ENV)
}

export function createStripeClient(options: StripeClientOptions = {}) {
  const {
    env = process.env,
    secretKey,
    ...stripeConfig
  } = options

  return new Stripe(secretKey ?? getStripeSecretKey(env), {
    apiVersion: STRIPE_API_VERSION,
    appInfo: {
      name: STRIPE_APP_NAME,
      version: STRIPE_APP_VERSION,
    },
    ...stripeConfig,
  })
}

export const stripeClient = createStripeClient()

export function constructStripeWebhookEvent({
  payload,
  secret,
  signature,
  stripe = stripeClient,
}: ConstructStripeWebhookEventInput) {
  return stripe.webhooks.constructEvent(payload, signature, secret)
}
