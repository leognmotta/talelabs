/**
 * OpenRouter-specific private binding types and runtime schema.
 */

import type { CatalogModelRecord } from '../schema.js'
import type { CatalogProviderBindingCommon } from './contracts.js'

import { z } from 'zod'
import { CatalogProviderBindingCommonSchema } from './contracts.js'

/** Wire protocols implemented by the OpenRouter provider boundary. */
export type CatalogOpenRouterProtocol = 'chat' | 'image' | 'speech' | 'video'

/** Request shaping policy for the shared image protocol. */
export interface CatalogImageRequestProfile {
  /** Protocol discriminator. */
  kind: 'image'
  /** Maximum image references sent in one request. */
  maxReferences: number
  /** Ordered TaleLabs setting IDs mapped into the request. */
  settingIds: readonly string[]
}

/** Request shaping policy for the shared chat protocol. */
export interface CatalogChatRequestProfile {
  /** Protocol discriminator. */
  kind: 'chat'
  /** Maximum image references sent in one request. */
  maxImageReferences: number
  /** Provider parameter used for the output token bound. */
  maxTokensParameter: 'max_completion_tokens' | 'max_tokens'
  /** Whether the adapter may send reasoning controls. */
  reasoning: boolean
  /** Ordered TaleLabs setting IDs mapped into the request. */
  settingIds: readonly string[]
}

/** Request shaping policy for the shared speech protocol. */
export interface CatalogSpeechRequestProfile {
  /** Protocol discriminator. */
  kind: 'speech'
  /** Output formats supported by the reviewed route. */
  outputFormats: readonly ['mp3']
  /** Ordered TaleLabs setting IDs mapped into the request. */
  settingIds: readonly string[]
  /** TaleLabs voice values mapped to provider-native voice IDs. */
  voiceValues: Readonly<Record<string, string>>
}

/** Additional non-frame reference limits for a video request. */
export interface CatalogVideoReferenceLimits {
  /** Maximum audio guidance items. */
  audio: number
  /** Maximum image reference items outside frame inputs. */
  image: number
  /** Maximum video reference items. */
  video: number
}

/** Request shaping policy for the shared video protocol. */
export interface CatalogVideoRequestProfile {
  /** Whether the protocol sends no frame, a first frame, or two frames. */
  frameMode: 'first' | 'first-last' | 'none'
  /** Whether the reviewed operation can request native audio. */
  generateAudio: boolean
  /** Protocol discriminator. */
  kind: 'video'
  /** Additional reference limits by media family. */
  referenceLimits: CatalogVideoReferenceLimits
  /** Named provider-specific input validator, or `none`. */
  referenceValidationPolicy: 'none' | 'seedance-2-reference-v1'
  /** Ordered TaleLabs setting IDs mapped into the request. */
  settingIds: readonly string[]
}

interface CatalogOpenRouterBindingCommon extends CatalogProviderBindingCommon {
  /** OpenRouter provider discriminator. */
  provider: 'openrouter'
  /** Reviewed OpenRouter endpoint slug pinned with fallback disabled. */
  providerTag: string
  /** OpenRouter routing policy for the captured request. */
  routingPolicy: 'pinned'
  /** Parameters verified on the reviewed OpenRouter endpoint. */
  supportedParameters: readonly [string, ...string[]]
}

/** Immutable OpenRouter image binding captured at run admission. */
export interface CatalogOpenRouterImageBinding
  extends CatalogOpenRouterBindingCommon {
  /** Pinned OpenRouter image endpoint. */
  endpoint: '/api/v1/images'
  /** OpenRouter image protocol discriminator. */
  protocol: 'image'
  /** Image request-shaping policy. */
  requestProfile: CatalogImageRequestProfile
}

/** Immutable OpenRouter video binding captured at run admission. */
export interface CatalogOpenRouterVideoBinding
  extends CatalogOpenRouterBindingCommon {
  /** Pinned OpenRouter video endpoint. */
  endpoint: '/api/v1/videos'
  /** OpenRouter video protocol discriminator. */
  protocol: 'video'
  /** Video request-shaping policy. */
  requestProfile: CatalogVideoRequestProfile
}

/** Immutable OpenRouter speech binding captured at run admission. */
export interface CatalogOpenRouterSpeechBinding
  extends CatalogOpenRouterBindingCommon {
  /** Pinned OpenRouter speech endpoint. */
  endpoint: '/api/v1/audio/speech'
  /** OpenRouter speech protocol discriminator. */
  protocol: 'speech'
  /** Speech request-shaping policy. */
  requestProfile: CatalogSpeechRequestProfile
}

/** Immutable OpenRouter chat binding captured at run admission. */
export interface CatalogOpenRouterChatBinding
  extends CatalogOpenRouterBindingCommon {
  /** Pinned OpenRouter chat endpoint. */
  endpoint: '/api/v1/chat/completions'
  /** OpenRouter chat protocol discriminator. */
  protocol: 'chat'
  /** Chat request-shaping policy. */
  requestProfile: CatalogChatRequestProfile
}

/** Every OpenRouter binding variant accepted by the current catalog. */
export type CatalogOpenRouterProviderBinding
  = | CatalogOpenRouterChatBinding
    | CatalogOpenRouterImageBinding
    | CatalogOpenRouterSpeechBinding
    | CatalogOpenRouterVideoBinding

const requestProfileSchemas = {
  chat: z.object({
    kind: z.literal('chat'),
    maxImageReferences: z.number().int().nonnegative(),
    maxTokensParameter: z.enum(['max_completion_tokens', 'max_tokens']),
    reasoning: z.boolean(),
    settingIds: z.array(z.string().min(1)),
  }).strict(),
  image: z.object({
    kind: z.literal('image'),
    maxReferences: z.number().int().nonnegative(),
    settingIds: z.array(z.string().min(1)),
  }).strict(),
  speech: z.object({
    kind: z.literal('speech'),
    outputFormats: z.tuple([z.literal('mp3')]),
    settingIds: z.array(z.string().min(1)),
    voiceValues: z.record(z.string(), z.string().min(1)),
  }).strict(),
  video: z.object({
    frameMode: z.enum(['first', 'first-last', 'none']),
    generateAudio: z.boolean(),
    kind: z.literal('video'),
    referenceLimits: z.object({
      audio: z.number().int().nonnegative(),
      image: z.number().int().nonnegative(),
      video: z.number().int().nonnegative(),
    }).strict(),
    referenceValidationPolicy: z.enum(['none', 'seedance-2-reference-v1']),
    settingIds: z.array(z.string().min(1)),
  }).strict(),
} as const

const openRouterBindingBaseSchema = CatalogProviderBindingCommonSchema.extend({
  provider: z.literal('openrouter'),
  providerTag: z.string().min(1),
  routingPolicy: z.literal('pinned'),
  supportedParameters: z.tuple(
    [z.string().min(1)],
    z.string().min(1),
  ),
})

/** Strict provider-specific schema for every OpenRouter protocol binding. */
export const CatalogOpenRouterProviderBindingSchema = z.discriminatedUnion(
  'protocol',
  [
    openRouterBindingBaseSchema.extend({
      endpoint: z.literal('/api/v1/chat/completions'),
      protocol: z.literal('chat'),
      requestProfile: requestProfileSchemas.chat,
    }).strict(),
    openRouterBindingBaseSchema.extend({
      endpoint: z.literal('/api/v1/images'),
      protocol: z.literal('image'),
      requestProfile: requestProfileSchemas.image,
    }).strict(),
    openRouterBindingBaseSchema.extend({
      endpoint: z.literal('/api/v1/audio/speech'),
      protocol: z.literal('speech'),
      requestProfile: requestProfileSchemas.speech,
    }).strict(),
    openRouterBindingBaseSchema.extend({
      endpoint: z.literal('/api/v1/videos'),
      protocol: z.literal('video'),
      requestProfile: requestProfileSchemas.video,
    }).strict(),
  ],
) satisfies z.ZodType<CatalogOpenRouterProviderBinding>

/** Validates OpenRouter protocol policy against one catalog operation. */
export function validateOpenRouterBindingCompatibility(
  model: CatalogModelRecord,
  binding: CatalogOpenRouterProviderBinding,
): string[] {
  const operation = model.operations.find(item => item.id === binding.operationId)
  const prefix = `${model.id}/${binding.operationId}`
  if (!operation)
    return [`${prefix}: binding does not resolve to an operation`]

  const errors: string[] = []
  const profile = binding.requestProfile
  const expectedProtocol = model.mediaType === 'text'
    ? 'chat'
    : model.mediaType === 'audio'
      ? 'speech'
      : model.mediaType
  const expectedEndpoint = {
    chat: '/api/v1/chat/completions',
    image: '/api/v1/images',
    speech: '/api/v1/audio/speech',
    video: '/api/v1/videos',
  }[binding.protocol]
  if (
    binding.protocol !== expectedProtocol
    || profile.kind !== binding.protocol
    || binding.endpoint !== expectedEndpoint
  ) {
    errors.push(`${prefix}: protocol, endpoint, or media type is incompatible`)
  }

  if (binding.adapterVersion !== `openrouter-${binding.protocol}-v1`)
    errors.push(`${prefix}: adapter version is incompatible`)

  const profileSettingIds = [...profile.settingIds].toSorted()
  const operationSettingIds = [...operation.settingIds].toSorted()
  if (JSON.stringify(profileSettingIds) !== JSON.stringify(operationSettingIds))
    errors.push(`${prefix}: request profile settings do not match the operation`)

  const profileReferences = profile.kind === 'image'
    ? profile.maxReferences
    : profile.kind === 'chat'
      ? profile.maxImageReferences
      : profile.kind === 'video'
        ? Object.values(profile.referenceLimits).reduce((sum, value) => sum + value, 0)
        + (profile.frameMode === 'first' ? 1 : profile.frameMode === 'first-last' ? 2 : 0)
        : 0
  if (profileReferences !== operation.referenceLimit.maxItems)
    errors.push(`${prefix}: request profile reference limit does not match the operation`)

  const lifecycle = binding.lifecycle
  const lifecycleCompatible = binding.protocol === 'video'
    ? lifecycle.submission === 'asynchronous'
    && (
      lifecycle.completions[0] === 'poll'
      || lifecycle.completions[1] === 'poll'
    )
    && lifecycle.deliveries.includes('stream')
    : lifecycle.submission === 'immediate'
      && lifecycle.completions[0] === 'response'
  if (!lifecycleCompatible)
    errors.push(`${prefix}: lifecycle is incompatible with the protocol`)
  return errors
}
