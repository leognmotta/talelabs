import type {
  GenerationModelContractVersion,
  GenerationOutputType,
  GenerationProviderLifecycle,
} from '@talelabs/flows'

export const OPENROUTER_PROVIDER = 'openrouter'
export const OPENROUTER_IMAGE_ADAPTER_VERSION = 'openrouter-image-v1'
export const OPENROUTER_VIDEO_ADAPTER_VERSION = 'openrouter-video-v1'
export const OPENROUTER_SPEECH_ADAPTER_VERSION = 'openrouter-speech-v1'
export const OPENROUTER_CHAT_ADAPTER_VERSION = 'openrouter-chat-v1'

/** Compatibility reader for jobs admitted before protocol-specific adapters. */
export const LEGACY_OPENROUTER_MEDIA_ADAPTER_VERSION = 'openrouter-media-v1'

export type OpenRouterAdapterVersion
  = | typeof OPENROUTER_CHAT_ADAPTER_VERSION
    | typeof OPENROUTER_IMAGE_ADAPTER_VERSION
    | typeof OPENROUTER_SPEECH_ADAPTER_VERSION
    | typeof OPENROUTER_VIDEO_ADAPTER_VERSION
    | typeof LEGACY_OPENROUTER_MEDIA_ADAPTER_VERSION

export type OpenRouterEndpoint
  = | '/api/v1/audio/speech'
    | '/api/v1/chat/completions'
    | '/api/v1/images'
    | '/api/v1/videos'

export type OpenRouterImageSetting
  = | 'aspectRatio'
    | 'background'
    | 'outputFormat'
    | 'quality'
    | 'resolution'

export interface OpenRouterImageRequestProfile {
  kind: 'image'
  maxReferences: number
  settingIds: readonly OpenRouterImageSetting[]
}

export type OpenRouterVideoReferenceValidationPolicy
  = | 'none'
    | 'seedance-2-reference-v1'

export interface OpenRouterVideoRequestProfile {
  frameMode: 'first' | 'first-last' | 'none'
  generateAudio: boolean
  kind: 'video'
  referenceLimits: Readonly<{
    audio: number
    image: number
    video: number
  }>
  referenceValidationPolicy: OpenRouterVideoReferenceValidationPolicy
  settingIds: readonly string[]
}

export interface OpenRouterSpeechRequestProfile {
  kind: 'speech'
  outputFormats: readonly ['mp3']
  settingIds: readonly string[]
  voiceValues: Readonly<Record<string, string>>
}

export interface OpenRouterChatRequestProfile {
  kind: 'chat'
  maxImageReferences: number
  maxTokensParameter: 'max_completion_tokens' | 'max_tokens'
  reasoning: boolean
  settingIds: readonly string[]
}

export type OpenRouterRequestProfile
  = | OpenRouterChatRequestProfile
    | OpenRouterImageRequestProfile
    | OpenRouterSpeechRequestProfile
    | OpenRouterVideoRequestProfile

export interface GenerationProviderEvidence {
  reviewedAt: string
  sources: readonly [string, ...string[]]
}

export interface GenerationProviderRoute {
  adapterVersion: OpenRouterAdapterVersion
  costCapture: {
    creditCost: 'unknown'
    providerCostUsd: 'response-or-unknown'
    source: 'provider-result'
  }
  evidence: GenerationProviderEvidence
  lifecycle: GenerationProviderLifecycle
  modelContractVersion: GenerationModelContractVersion
  operationId: string
  outputType: GenerationOutputType
  productModelId: string
  provider: typeof OPENROUTER_PROVIDER
  providerRoute: {
    endpoint: OpenRouterEndpoint
    nativeModelId: string
    policy: 'pinned'
    provider: typeof OPENROUTER_PROVIDER
    providerTag: string
    supportedParameters: readonly [string, ...string[]]
  }
  requestProfile: OpenRouterRequestProfile
  requiresDurableSubmissionBoundary: true
  routingStatus: 'current' | 'historical'
  routeVersion: string
}

export const REVIEWED_AT = '2026-07-15'
export const PROVIDER_RESULT_COST_CAPTURE = {
  creditCost: 'unknown',
  providerCostUsd: 'response-or-unknown',
  source: 'provider-result',
} as const

export const OPENROUTER_IMAGE_GUIDE_URL
  = 'https://openrouter.ai/docs/guides/overview/multimodal/image-generation'
export const OPENROUTER_VIDEO_GUIDE_URL
  = 'https://openrouter.ai/docs/guides/overview/multimodal/video-generation'
export const OPENROUTER_VIDEO_MODELS_URL
  = 'https://openrouter.ai/api/v1/videos/models'
export const OPENROUTER_SPEECH_GUIDE_URL
  = 'https://openrouter.ai/docs/guides/overview/multimodal/tts'
export const OPENROUTER_CHAT_GUIDE_URL
  = 'https://openrouter.ai/docs/api/reference/overview'
export const OPENROUTER_REASONING_URL
  = 'https://openrouter.ai/docs/guides/best-practices/reasoning-tokens'

export const IMMEDIATE_BYTES_LIFECYCLE = {
  cancellation: 'unsupported',
  completions: ['response'],
  deliveries: ['bytes'],
  submission: 'immediate',
} as const satisfies GenerationProviderLifecycle

export const IMMEDIATE_TEXT_LIFECYCLE = {
  cancellation: 'unsupported',
  completions: ['response'],
  deliveries: ['text'],
  submission: 'immediate',
} as const satisfies GenerationProviderLifecycle

export const ASYNC_VIDEO_LIFECYCLE = {
  cancellation: 'unsupported',
  completions: ['poll'],
  deliveries: ['bytes'],
  submission: 'asynchronous',
} as const satisfies GenerationProviderLifecycle

export const ASYNC_VIDEO_STREAM_LIFECYCLE = {
  cancellation: 'unsupported',
  completions: ['poll'],
  deliveries: ['stream'],
  submission: 'asynchronous',
} as const satisfies GenerationProviderLifecycle
