/**
 * Exact-binding eligibility rules for browser-executed provider work.
 *
 * A binding marked `browser`-eligible must be executable by the browser
 * driver without server mediation. Structural protocol checks are necessary
 * but insufficient: every eligible binding also carries a dated verification
 * token hashed over its endpoint, model, operation, lifecycle, request profile,
 * and adapter facts. Catalog CI rejects stale tokens before admission can spend.
 */

import type { CatalogProviderBinding } from './schema.js'

/** Protocols implemented by the browser provider adapter dispatcher. */
const BROWSER_EXECUTABLE_PROTOCOLS = new Set<string>([
  'chat',
  'image',
  'speech',
  'video',
])

/** Output delivery forms the browser output transfer can materialize. */
const BROWSER_TRANSFERABLE_DELIVERIES = new Set<string>([
  'bytes',
  'stream',
  'text',
  'url',
])

/** Reviewed OpenRouter browser policy and its first-party evidence. */
export const OPENROUTER_BROWSER_VERIFICATION_PROFILE = Object.freeze({
  id: 'openrouter-browser-v1' as const,
  origin: 'https://openrouter.ai',
  transport: Object.freeze({
    authentication: 'authorization-bearer',
    corsPreflightReviewedAt: '2026-07-17',
  }),
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
      outputPath: '/api/v1/videos/:id/content',
      pollPath: '/api/v1/videos/:id',
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
  if (!binding.browserVerification) {
    reasons.push('exact binding has no browser verification token')
  }
  else {
    if (
      binding.browserVerification.profile
      !== OPENROUTER_BROWSER_VERIFICATION_PROFILE.id
    ) {
      reasons.push('browser verification profile is unsupported')
    }
    if (binding.browserVerification.reviewedAt < binding.evidence.reviewedAt)
      reasons.push('browser verification predates the binding review')
  }
  if (binding.provider !== 'openrouter')
    reasons.push(`provider "${binding.provider}" has no browser profile`)
  if (!BROWSER_EXECUTABLE_PROTOCOLS.has(binding.protocol)) {
    reasons.push(`protocol "${binding.protocol}" has no browser adapter`)
  }
  else {
    const reviewed = OPENROUTER_BROWSER_VERIFICATION_PROFILE.protocols[
      binding.protocol
    ]
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
      if (!BROWSER_TRANSFERABLE_DELIVERIES.has(delivery)) {
        reasons.push(
          `delivery "${delivery}" is not transferable from a browser`,
        )
      }
    }
  }
  return reasons
}

/** Whether the browser driver can execute this binding's reviewed protocol. */
export function isBrowserExecutableProviderBinding(
  binding: CatalogProviderBinding,
) {
  return browserBindingIncompatibilities(binding).length === 0
}
