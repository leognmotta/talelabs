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
  /** Provider-cost capture policy preserved from the reviewed route. */
  costCapture: CatalogCostCapture
  /** Reviewed sources for route and capability facts. */
  evidence: CatalogBindingEvidence
  /** Durable provider lifecycle executed by Trigger.dev. */
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
const lifecycleSchema = z.discriminatedUnion('submission', [
  z.object({
    cancellation: z.enum(['supported', 'unsupported']),
    completions: z.tuple([z.literal('response')]),
    deliveries: z.tuple([deliverySchema], deliverySchema),
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
    deliveries: z.tuple([deliverySchema], deliverySchema),
    submission: z.literal('asynchronous'),
  }).strict(),
])

/** Zod fields extended by each isolated provider binding schema. */
export const CatalogProviderBindingCommonSchema = z.object({
  adapterVersion: z.string().min(1),
  costCapture: z.object({
    creditCost: z.literal('unknown'),
    providerCostUsd: z.literal('response-or-unknown'),
    source: z.literal('provider-result'),
  }).strict(),
  evidence: z.object({
    reviewedAt: z.iso.date(),
    sources: z.tuple(
      [z.url({ protocol: /^https$/ })],
      z.url({ protocol: /^https$/ }),
    ),
  }).strict(),
  lifecycle: lifecycleSchema,
  nativeModelId: z.string().regex(/^[^/]+\/.+$/),
  operationId: z.string().min(1),
  priority: z.number().int(),
  requiresDurableSubmissionBoundary: z.literal(true),
  routeVersion: z.string().min(1),
}) satisfies z.ZodType<CatalogProviderBindingCommon>
