/**
 * Exact-binding eligibility rules for browser-executed provider work.
 *
 * A binding marked `browser`-eligible must be executable by the browser
 * driver without server mediation. Structural protocol checks are necessary
 * but insufficient: every eligible binding also carries a dated verification
 * token hashed over its endpoint, model, operation, lifecycle, request profile,
 * and adapter facts. Catalog CI rejects stale tokens before admission can spend.
 *
 * Each provider owns one reviewed browser profile keyed by `binding.provider`.
 * Adding a browser-capable provider adds one profile here; it does not change
 * the structural checks below.
 */

import type { CatalogProviderBinding } from './schema.js'

import {
  FAL_QUEUE_ADAPTER_VERSION,
  FAL_QUEUE_BASE,
} from './fal/index.js'

/** Output delivery forms the browser output transfer can materialize. */
const BROWSER_TRANSFERABLE_DELIVERIES = new Set<string>([
  'bytes',
  'stream',
  'text',
  'url',
])

/** One reviewed protocol's browser-relevant transport and lifecycle facts. */
interface ReviewedBrowserProtocol {
  adapterVersion: string
  cancellation: string
  completions: readonly string[]
  deliveries: readonly string[]
  endpoint: string
}

/** Reviewed OpenRouter browser policy and its first-party evidence. */
export const OPENROUTER_BROWSER_VERIFICATION_PROFILE = Object.freeze({
  id: 'openrouter-browser-v1' as const,
  origin: 'https://openrouter.ai',
  protocols: Object.freeze({
    chat: Object.freeze({
      adapterVersion: 'openrouter-chat-v1',
      cancellation: 'unsupported',
      completions: Object.freeze(['response']),
      deliveries: Object.freeze(['text']),
      endpoint: '/api/v1/chat/completions',
      submission: 'immediate',
    }),
    image: Object.freeze({
      adapterVersion: 'openrouter-image-v1',
      cancellation: 'unsupported',
      completions: Object.freeze(['response']),
      deliveries: Object.freeze(['bytes']),
      endpoint: '/api/v1/images',
      submission: 'immediate',
    }),
    speech: Object.freeze({
      adapterVersion: 'openrouter-speech-v1',
      cancellation: 'unsupported',
      completions: Object.freeze(['response']),
      deliveries: Object.freeze(['bytes']),
      endpoint: '/api/v1/audio/speech',
      submission: 'immediate',
    }),
    video: Object.freeze({
      adapterVersion: 'openrouter-video-v1',
      cancellation: 'unsupported',
      completions: Object.freeze(['poll']),
      deliveries: Object.freeze(['stream']),
      endpoint: '/api/v1/videos',
      submission: 'asynchronous',
    }),
  }),
  sources: Object.freeze([
    'https://openrouter.ai/docs/api/reference/authentication',
    'https://openrouter.ai/docs/api/reference/errors-and-debugging',
    'https://openrouter.ai/docs/guides/overview/multimodal/image-generation',
    'https://openrouter.ai/docs/guides/overview/multimodal/text-to-speech',
    'https://openrouter.ai/docs/guides/overview/multimodal/video-generation',
  ]),
  transport: Object.freeze({
    authentication: 'authorization-bearer',
    corsPreflightReviewedAt: '2026-07-17',
  }),
})

/**
 * Reviewed fal browser policy. fal's queue transport reflects arbitrary origins,
 * permits the `authorization` header, and returns browser-readable output
 * locations. fal CDN URLs expose wildcard CORS; the bounded transport rewrites
 * only fal's public Google bucket paths to Google's CORS-enabled JSON media API.
 */
export const FAL_BROWSER_VERIFICATION_PROFILE = Object.freeze({
  id: 'fal-browser-v1' as const,
  origin: FAL_QUEUE_BASE,
  protocols: Object.freeze({
    queue: Object.freeze({
      adapterVersion: FAL_QUEUE_ADAPTER_VERSION,
      cancellation: 'best-effort',
      completions: Object.freeze(['poll']),
      deliveries: Object.freeze(['stream']),
      endpoint: FAL_QUEUE_BASE,
      submission: 'asynchronous',
    }),
  }),
  sources: Object.freeze([
    'https://fal.ai/docs/documentation/model-apis/inference/queue',
    'https://cloud.google.com/storage/docs/json_api/v1/objects/get',
  ]),
  transport: Object.freeze({
    authentication: 'authorization-key',
    corsPreflightReviewedAt: '2026-07-20',
  }),
})

/** Reviewed browser profiles keyed by the provider they cover. */
const BROWSER_VERIFICATION_PROFILES: Readonly<Record<
  CatalogProviderBinding['provider'],
  {
    id: 'fal-browser-v1' | 'openrouter-browser-v1'
    protocols: Readonly<Record<string, ReviewedBrowserProtocol & { submission: string }>>
  }
>> = Object.freeze({
  fal: FAL_BROWSER_VERIFICATION_PROFILE,
  openrouter: OPENROUTER_BROWSER_VERIFICATION_PROFILE,
})

function sameOrderedValues(
  actual: readonly string[],
  expected: readonly string[],
) {
  return actual.length === expected.length
    && actual.every((value, index) => value === expected[index])
}

/** Returns protocol-level reasons one binding cannot run in a browser. */
export function browserBindingIncompatibilities(
  binding: CatalogProviderBinding,
): string[] {
  const reasons: string[] = []
  const profile = BROWSER_VERIFICATION_PROFILES[binding.provider]
  if (!binding.browserVerification) {
    reasons.push('exact binding has no browser verification token')
  }
  else {
    if (binding.browserVerification.profile !== profile.id)
      reasons.push('browser verification profile is unsupported')
    if (binding.browserVerification.reviewedAt < binding.evidence.reviewedAt)
      reasons.push('browser verification predates the binding review')
  }
  const reviewed = profile.protocols[binding.protocol]
  if (!reviewed) {
    reasons.push(`protocol "${binding.protocol}" has no browser adapter`)
    return reasons
  }
  if (binding.adapterVersion !== reviewed.adapterVersion)
    reasons.push('adapter version is not covered by the browser profile')
  if (binding.endpoint !== reviewed.endpoint)
    reasons.push('endpoint is not covered by the browser profile')
  if (binding.lifecycle.cancellation !== reviewed.cancellation)
    reasons.push('cancellation behavior is not covered by the browser profile')
  if (binding.lifecycle.submission !== reviewed.submission)
    reasons.push('submission behavior is not covered by the browser profile')
  if (!sameOrderedValues(binding.lifecycle.completions, reviewed.completions))
    reasons.push('completion behavior is not covered by the browser profile')
  if (!sameOrderedValues(binding.lifecycle.deliveries, reviewed.deliveries))
    reasons.push('output delivery is not covered by the browser profile')
  if (
    binding.lifecycle.submission === 'asynchronous'
    && !(binding.lifecycle.completions as readonly string[]).includes('poll')
  ) {
    reasons.push('asynchronous completion is not pollable from a browser')
  }
  for (const delivery of binding.lifecycle.deliveries) {
    if (!BROWSER_TRANSFERABLE_DELIVERIES.has(delivery))
      reasons.push(`delivery "${delivery}" is not transferable from a browser`)
  }
  return reasons
}

/** Whether the browser driver can execute this binding's reviewed protocol. */
export function isBrowserExecutableProviderBinding(
  binding: CatalogProviderBinding,
) {
  return browserBindingIncompatibilities(binding).length === 0
}
