/** Test-mode-only Stripe SDK, environment, and webhook-signature boundary. */

import type { Buffer } from 'node:buffer'

import process from 'node:process'
import Stripe from 'stripe'

import './env.js'

export {
  Stripe,
}

/** Pinned server-side Stripe SDK client. */
export type StripeClient = Stripe
/** Stripe client configuration with the pinned API version retained optional. */
export type StripeClientConfig = Omit<
  Stripe.StripeConfig,
  'apiVersion'
> & {
  apiVersion?: Stripe.LatestApiVersion
}

/** Secret server credential environment-variable name. */
export const STRIPE_SECRET_KEY_ENV = 'STRIPE_SECRET_KEY'
/** Public browser credential environment-variable name. */
export const STRIPE_PUBLISHABLE_KEY_ENV = 'STRIPE_PUBLISHABLE_KEY'
/** Signed-webhook endpoint secret environment-variable name. */
export const STRIPE_WEBHOOK_SECRET_ENV = 'STRIPE_WEBHOOK_SECRET'
/** API version pinned for every TaleLabs Stripe request and webhook contract. */
export const STRIPE_API_VERSION = '2026-06-24.dahlia' satisfies Stripe.LatestApiVersion
/** Integration name reported through Stripe SDK telemetry. */
export const STRIPE_APP_NAME = 'TaleLabs'
/** Integration version reported through Stripe SDK telemetry. */
export const STRIPE_APP_VERSION = '0.0.0'
/** Eight-letter Checkout integration identity supported by the pinned API. */
export const STRIPE_INTEGRATION_IDENTIFIER = 'talelabs'

/** Narrow environment surface accepted by the Stripe boundary. */
export type StripeEnv = Partial<
  Record<
    | typeof STRIPE_SECRET_KEY_ENV
    | typeof STRIPE_PUBLISHABLE_KEY_ENV
    | typeof STRIPE_WEBHOOK_SECRET_ENV,
    string
  >
>

/** Testable Stripe client composition inputs. */
export interface StripeClientOptions extends StripeClientConfig {
  /** Injectable secret environment used by verification and runtime composition. */
  env?: StripeEnv
  /** Explicit secret-key override for isolated composition. */
  secretKey?: string
}

/** Raw signed-webhook inputs required before JSON parsing. */
export interface ConstructStripeWebhookEventInput {
  /** Exact request body bytes or string received from Stripe. */
  payload: Buffer | string
  /** Endpoint-specific webhook signing secret. */
  secret: string
  /** Stripe-Signature request header. */
  signature: string
  /** Injectable Stripe client used by deterministic verification. */
  stripe?: StripeClient
}

function requireEnvValue(
  env: StripeEnv,
  name: typeof STRIPE_PUBLISHABLE_KEY_ENV
    | typeof STRIPE_SECRET_KEY_ENV
    | typeof STRIPE_WEBHOOK_SECRET_ENV,
) {
  const value = env[name]

  if (!value)
    throw new Error(`${name} is required to use Stripe.`)

  return value
}

/** Returns the configured server-only Stripe secret key. */
export function getStripeSecretKey(env: StripeEnv = process.env) {
  return requireEnvValue(env, STRIPE_SECRET_KEY_ENV)
}

/** Returns the intentionally public Stripe publishable key. */
export function getStripePublishableKey(env: StripeEnv = process.env) {
  return requireEnvValue(env, STRIPE_PUBLISHABLE_KEY_ENV)
}

/** Returns the configured signed-webhook endpoint secret. */
export function getStripeWebhookSecret(env: StripeEnv = process.env) {
  return requireEnvValue(env, STRIPE_WEBHOOK_SECRET_ENV)
}

/** Refuses every Stripe mutation unless the configured credential is test mode. */
export function assertStripeTestMode(env: StripeEnv = process.env) {
  const key = getStripeSecretKey(env)
  if (!/^[sr]k_test_/.test(key))
    throw new Error('TaleLabs billing operations require a Stripe test-mode key.')
}

/** Creates a Stripe client pinned to TaleLabs integration metadata and API. */
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

/** Shared process-local immutable Stripe SDK client. */
export const stripeClient = createStripeClient()

/** Verifies and constructs a Stripe Event from the exact signed request body. */
export function constructStripeWebhookEvent({
  payload,
  secret,
  signature,
  stripe = stripeClient,
}: ConstructStripeWebhookEventInput) {
  return stripe.webhooks.constructEvent(payload, signature, secret)
}
