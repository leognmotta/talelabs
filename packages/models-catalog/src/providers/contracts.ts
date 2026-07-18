/**
 * Provider-independent fields shared by private catalog binding schemas.
 */

import { z } from 'zod'

interface CatalogProviderLifecycleBase {
  /** Whether the provider supports remote cancellation. */
  cancellation: 'supported' | 'unsupported'
  /** Output delivery forms returned by the adapter. */
  deliveries: readonly [
    'bytes' | 'stream' | 'text' | 'url',
    ...('bytes' | 'stream' | 'text' | 'url')[],
  ]
}

/** Provider call that completes in its initial response. */
export interface CatalogImmediateProviderLifecycle
  extends CatalogProviderLifecycleBase {
  /** Immediate routes complete only in the response. */
  completions: readonly ['response']
  /** Immediate submission discriminator. */
  submission: 'immediate'
}

/** Provider call that completes after asynchronous submission. */
export interface CatalogAsyncProviderLifecycle
  extends CatalogProviderLifecycleBase {
  /** Durable completion signals accepted by the asynchronous adapter. */
  completions:
    | readonly ['poll']
    | readonly ['poll', 'webhook']
    | readonly ['webhook']
    | readonly ['webhook', 'poll']
  /** Asynchronous submission discriminator. */
  submission: 'asynchronous'
}

/** Immutable provider lifecycle captured in an admitted run binding. */
export type CatalogProviderLifecycle
  = | CatalogAsyncProviderLifecycle
    | CatalogImmediateProviderLifecycle

/** Reviewed evidence for a private provider binding. */
export interface CatalogBindingEvidence {
  /** ISO date on which the binding facts were reviewed. */
  reviewedAt: string
  /** Non-empty HTTPS sources used during the review. */
  sources: readonly [string, ...string[]]
}

/** Explicit review token tying browser eligibility to exact binding facts. */
export interface CatalogBrowserBindingVerification {
  /** SHA-256 of the browser-relevant binding fields checked by catalog CI. */
  bindingHash: string
  /** Versioned provider policy whose transport checks were reviewed. */
  profile: 'openrouter-browser-v1'
  /** ISO date on which this exact binding was reviewed for browser execution. */
  reviewedAt: string
}

/** Cost fields recorded by the current provider result boundary. */
export interface CatalogCostCapture {
  /** Pre-billing credit estimate behavior while balances remain deferred. */
  creditCost: 'unknown'
  /** Source and nullability policy for provider cost. */
  providerCostUsd: 'response-or-unknown'
  /** Provider result as the authoritative cost source. */
  source: 'provider-result'
}

/** Fields shared by every provider-specific private binding. */
export interface CatalogProviderBindingCommon {
  /** Shared protocol adapter version executed by a worker. */
  adapterVersion: string
  /** Exact-binding browser review; required whenever `browser` is enabled. */
  browserVerification?: CatalogBrowserBindingVerification
  /** Provider-cost capture policy preserved from the reviewed route. */
  costCapture: CatalogCostCapture
  /** Execution drivers allowed to use this exact reviewed binding. */
  executionRuntimes: readonly [
    'browser' | 'managed',
    ...('browser' | 'managed')[],
  ]
  /** Reviewed sources for route and capability facts. */
  evidence: CatalogBindingEvidence
  /** Provider lifecycle shape captured for either admitted execution driver. */
  lifecycle: CatalogProviderLifecycle
  /** Provider-native model identity sent over the wire. */
  nativeModelId: string
  /** Model operation executed by this binding. */
  operationId: string
  /** Ordered fallback priority; higher values are preferred. */
  priority: number
  /** Whether admission must persist before a paid network submission. */
  requiresDurableSubmissionBoundary: true
  /** Immutable provider route revision captured for retries and diagnostics. */
  routeVersion: string
}

const deliverySchema = z.enum(['bytes', 'stream', 'text', 'url'])
function toNonEmptyArray<Value>(values: Value[]): [Value, ...Value[]] {
  const [first, ...rest] = values
  if (first === undefined)
    throw new Error('Expected a non-empty catalog array.')
  return [first, ...rest]
}

const nonEmptyDeliveriesSchema = z
  .array(deliverySchema)
  .min(1)
  .transform(toNonEmptyArray)
const nonEmptyExecutionRuntimesSchema = z
  .array(z.enum(['browser', 'managed']))
  .min(1)
  .refine(values => new Set(values).size === values.length)
  .transform(toNonEmptyArray)
const nonEmptyEvidenceSourcesSchema = z
  .array(z.url({ protocol: /^https$/ }))
  .min(1)
  .transform(toNonEmptyArray)
/** Strict schema for the provider lifecycle captured in reviewed bindings. */
export const CatalogProviderLifecycleSchema = z.discriminatedUnion('submission', [
  z.object({
    cancellation: z.enum(['supported', 'unsupported']),
    completions: z.tuple([z.literal('response')]),
    deliveries: nonEmptyDeliveriesSchema,
    submission: z.literal('immediate'),
  }).strict(),
  z.object({
    cancellation: z.enum(['supported', 'unsupported']),
    completions: z.union([
      z.tuple([z.literal('poll')]),
      z.tuple([z.literal('webhook')]),
      z.tuple([z.literal('poll'), z.literal('webhook')]),
      z.tuple([z.literal('webhook'), z.literal('poll')]),
    ]),
    deliveries: nonEmptyDeliveriesSchema,
    submission: z.literal('asynchronous'),
  }).strict(),
])

/** Zod fields extended by each isolated provider binding schema. */
export const CatalogProviderBindingCommonSchema = z.object({
  adapterVersion: z.string().min(1),
  browserVerification: z.object({
    bindingHash: z.string().regex(/^sha256:[0-9a-f]{64}$/),
    profile: z.literal('openrouter-browser-v1'),
    reviewedAt: z.iso.date(),
  }).strict().optional(),
  costCapture: z.object({
    creditCost: z.literal('unknown'),
    providerCostUsd: z.literal('response-or-unknown'),
    source: z.literal('provider-result'),
  }).strict(),
  executionRuntimes: nonEmptyExecutionRuntimesSchema.default(['managed']),
  evidence: z.object({
    reviewedAt: z.iso.date(),
    sources: nonEmptyEvidenceSourcesSchema,
  }).strict(),
  lifecycle: CatalogProviderLifecycleSchema,
  nativeModelId: z.string().regex(/^[^/]+\/.+$/),
  operationId: z.string().min(1),
  priority: z.number().int(),
  requiresDurableSubmissionBoundary: z.literal(true),
  routeVersion: z.string().min(1),
}) satisfies z.ZodType<CatalogProviderBindingCommon>
