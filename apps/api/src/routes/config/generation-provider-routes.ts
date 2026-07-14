import type {
  GenerationModelContractVersion,
  GenerationModelId,
  GenerationProviderLifecycle,
} from '@talelabs/flows'

import {
  GENERATION_MODEL_CONTRACT_VERSION,
  GENERATION_MODELS,
  isCurrentGenerationModelContract,
  validateGenerationProviderLifecycle,
} from '@talelabs/flows'

type GenerationProviderAdapter
  = | 'elevenlabs'
    | 'google-vertex'
    | 'ltx'
    | 'openai'
    | 'openrouter'
    | 'stability'

export interface GenerationProviderEvidence {
  reviewedAt: string
  sources: readonly [string, ...string[]]
}

export interface GenerationProviderRoute {
  adapter: GenerationProviderAdapter
  evidence: GenerationProviderEvidence
  lifecycle: GenerationProviderLifecycle
  /** Explicitly non-production pricing until a later provider-integration task. */
  mockPricing: {
    creditCost: 0
    providerCostUsd: 0
    source: 'mock'
  }
  modelContractVersion: GenerationModelContractVersion
  operationId: string
  productModelId: GenerationModelId
  /** Native provider details must never be returned by the public config route. */
  providerRoute: {
    endpoint: string
    nativeModelId: string
    policy: 'pinned'
    provider: GenerationProviderAdapter
    providerTag: string
    settingValueMappings?: Readonly<
      Record<string, Readonly<Record<string, string>>>
    >
    streamEndpoint?: string
    supportedParameters: readonly [string, ...string[]]
  }
  routeVersion: string
}

const REVIEWED_AT = '2026-07-13'
const ROUTE_VERSION = '2026-07-13.9'
// TODO(provider-integration): Replace only this server-side mock cost boundary.
const MOCK_ZERO_PRICING = {
  creditCost: 0,
  providerCostUsd: 0,
  source: 'mock',
} as const

const VEO_MODEL_URL
  = 'https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/veo/3-1-generate'
const VEO_TEXT_URL
  = 'https://cloud.google.com/vertex-ai/generative-ai/docs/video/generate-videos-from-text'
const VEO_FRAMES_URL
  = 'https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/video/generate-videos-from-first-and-last-frames'
const VEO_REFERENCES_URL
  = 'https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/video/use-reference-images-to-guide-video-generation'
const VEO_EXTEND_URL
  = 'https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/video/extend-a-veo-video'
const LTX_MODELS_URL = 'https://docs.ltx.video/models'
const LTX_TEXT_URL
  = 'https://docs.ltx.video/api-documentation/api-reference/async-video-generation/submit-text-to-video'
const LTX_AUDIO_URL
  = 'https://docs.ltx.video/api-documentation/api-reference/async-video-generation/submit-audio-to-video'
const LTX_STATUS_URL
  = 'https://docs.ltx.video/api-documentation/api-reference/async-video-generation/get-job-status'
const ELEVEN_TTS_URL
  = 'https://elevenlabs.io/docs/api-reference/text-to-speech/convert'
const ELEVEN_TTS_STREAM_URL
  = 'https://elevenlabs.io/docs/api-reference/text-to-speech/stream'
const ELEVEN_SOUND_URL
  = 'https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert'
const ELEVEN_MUSIC_URL
  = 'https://elevenlabs.io/docs/api-reference/music/compose'
const ELEVEN_VOICE_CHANGER_URL
  = 'https://elevenlabs.io/docs/api-reference/speech-to-speech/convert'
const ELEVEN_VOICE_ISOLATION_URL
  = 'https://elevenlabs.io/docs/api-reference/audio-isolation/convert'
const OPENAI_TTS_URL
  = 'https://platform.openai.com/docs/api-reference/audio/createSpeech'
const STABLE_AUDIO_URL = 'https://platform.stability.ai/docs/api-reference'
const OPENROUTER_VIDEO_GUIDE_URL
  = 'https://openrouter.ai/docs/guides/overview/multimodal/video-generation'
const OPENROUTER_CREATE_VIDEO_URL
  = 'https://openrouter.ai/docs/api/api-reference/video-generation/create-videos'
const OPENROUTER_IMAGE_GUIDE_URL
  = 'https://openrouter.ai/docs/guides/overview/multimodal/image-generation'
const OPENROUTER_GPT_IMAGE_2_URL = 'https://openrouter.ai/openai/gpt-image-2'
const OPENROUTER_NANO_BANANA_2_LITE_URL
  = 'https://openrouter.ai/google/gemini-3.1-flash-lite-image'
const OPENROUTER_NANO_BANANA_2_URL
  = 'https://openrouter.ai/google/gemini-3.1-flash-image'
const OPENROUTER_NANO_BANANA_PRO_URL
  = 'https://openrouter.ai/google/gemini-3-pro-image'
const OPENROUTER_SEEDREAM_URL
  = 'https://openrouter.ai/bytedance-seed/seedream-4.5'
const OPENROUTER_FLUX_URL
  = 'https://openrouter.ai/black-forest-labs/flux.2-pro'
const OPENROUTER_RECRAFT_URL = 'https://openrouter.ai/recraft/recraft-v4.1'
const OPENROUTER_VEO_LITE_URL = 'https://openrouter.ai/google/veo-3.1-lite'
const OPENROUTER_GROK_VIDEO_URL
  = 'https://openrouter.ai/x-ai/grok-imagine-video'
const OPENROUTER_SEEDANCE_URL = 'https://openrouter.ai/bytedance/seedance-2.0'
const OPENROUTER_MODELS_URL
  = 'https://openrouter.ai/docs/guides/overview/models'
const OPENROUTER_MULTIMODAL_URL
  = 'https://openrouter.ai/docs/guides/overview/multimodal/overview'
const OPENROUTER_REASONING_URL
  = 'https://openrouter.ai/docs/guides/best-practices/reasoning-tokens'
const OPENROUTER_GEMINI_FLASH_LITE_URL
  = 'https://openrouter.ai/google/gemini-3.1-flash-lite'
const OPENROUTER_CLAUDE_SONNET_URL
  = 'https://openrouter.ai/anthropic/claude-sonnet-4.6'
const OPENROUTER_GPT_54_URL = 'https://openrouter.ai/openai/gpt-5.4'
const OPENROUTER_GEMINI_PRO_URL
  = 'https://openrouter.ai/google/gemini-3.1-pro-preview'
const OPENROUTER_DEEPSEEK_URL = 'https://openrouter.ai/deepseek/deepseek-v3.2'
const OPENROUTER_MISTRAL_URL
  = 'https://openrouter.ai/mistralai/mistral-large-2512'

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const item of Object.values(value)) deepFreeze(item)
  }
  return value
}

function openRouterVideoRoute(input: {
  nativeModelId: string
  operationId: string
  productModelId: GenerationModelId
  sources: readonly [string, ...string[]]
  supportedParameters: readonly [string, ...string[]]
}): GenerationProviderRoute {
  return {
    adapter: 'openrouter',
    evidence: { reviewedAt: REVIEWED_AT, sources: input.sources },
    lifecycle: {
      cancellation: 'best-effort',
      completions: ['poll'],
      deliveries: ['url'],
      submission: 'asynchronous',
    },
    mockPricing: MOCK_ZERO_PRICING,
    modelContractVersion: GENERATION_MODEL_CONTRACT_VERSION,
    operationId: input.operationId,
    productModelId: input.productModelId,
    providerRoute: {
      endpoint: '/api/v1/videos',
      nativeModelId: input.nativeModelId,
      policy: 'pinned',
      provider: 'openrouter',
      providerTag: 'openrouter-video',
      supportedParameters: input.supportedParameters,
    },
    routeVersion: ROUTE_VERSION,
  }
}

function openRouterImageRoute(input: {
  nativeModelId: string
  operationId: 'imageToImage' | 'textToImage'
  productModelId: GenerationModelId
  providerTag: string
  sources: readonly [string, ...string[]]
  supportedParameters: readonly [string, ...string[]]
}): GenerationProviderRoute {
  return {
    adapter: 'openrouter',
    evidence: { reviewedAt: REVIEWED_AT, sources: input.sources },
    lifecycle: {
      cancellation: 'unsupported',
      completions: ['response'],
      deliveries: ['bytes'],
      submission: 'immediate',
    },
    mockPricing: MOCK_ZERO_PRICING,
    modelContractVersion: GENERATION_MODEL_CONTRACT_VERSION,
    operationId: input.operationId,
    productModelId: input.productModelId,
    providerRoute: {
      endpoint: '/api/v1/images',
      nativeModelId: input.nativeModelId,
      policy: 'pinned',
      provider: 'openrouter',
      providerTag: input.providerTag,
      supportedParameters: input.supportedParameters,
    },
    routeVersion: ROUTE_VERSION,
  }
}

function openRouterLlmRoutes(input: {
  nativeModelId: string
  productModelId: GenerationModelId
  reasoning: boolean
  source: string
  vision: boolean
}): readonly GenerationProviderRoute[] {
  const supportedParameters = [
    'max_tokens',
    'messages',
    'model',
    ...(input.reasoning ? ['reasoning'] : []),
  ] as [string, ...string[]]
  const operations = input.vision
    ? (['textToText', 'visionToText'] as const)
    : (['textToText'] as const)
  return operations.map(operationId => ({
    adapter: 'openrouter',
    evidence: {
      reviewedAt: REVIEWED_AT,
      sources: [
        OPENROUTER_MODELS_URL,
        ...(input.vision ? [OPENROUTER_MULTIMODAL_URL] : []),
        ...(input.reasoning ? [OPENROUTER_REASONING_URL] : []),
        input.source,
      ] as [string, ...string[]],
    },
    lifecycle: {
      cancellation: 'unsupported',
      completions: ['response'],
      deliveries: ['text'],
      submission: 'immediate',
    },
    mockPricing: MOCK_ZERO_PRICING,
    modelContractVersion: GENERATION_MODEL_CONTRACT_VERSION,
    operationId,
    productModelId: input.productModelId,
    providerRoute: {
      endpoint: '/api/v1/chat/completions',
      nativeModelId: input.nativeModelId,
      policy: 'pinned',
      provider: 'openrouter',
      providerTag: 'openrouter-chat',
      supportedParameters,
    },
    routeVersion: ROUTE_VERSION,
  }))
}

const routes = [
  ...openRouterLlmRoutes({
    nativeModelId: 'google/gemini-3.1-flash-lite',
    productModelId: 'talelabs/gemini-3.1-flash-lite',
    reasoning: true,
    source: OPENROUTER_GEMINI_FLASH_LITE_URL,
    vision: true,
  }),
  ...openRouterLlmRoutes({
    nativeModelId: 'anthropic/claude-sonnet-4.6',
    productModelId: 'talelabs/claude-sonnet-4.6',
    reasoning: true,
    source: OPENROUTER_CLAUDE_SONNET_URL,
    vision: true,
  }),
  ...openRouterLlmRoutes({
    nativeModelId: 'openai/gpt-5.4',
    productModelId: 'talelabs/gpt-5.4',
    reasoning: true,
    source: OPENROUTER_GPT_54_URL,
    vision: true,
  }),
  ...openRouterLlmRoutes({
    nativeModelId: 'google/gemini-3.1-pro-preview',
    productModelId: 'talelabs/gemini-3.1-pro',
    reasoning: true,
    source: OPENROUTER_GEMINI_PRO_URL,
    vision: true,
  }),
  ...openRouterLlmRoutes({
    nativeModelId: 'deepseek/deepseek-v3.2',
    productModelId: 'talelabs/deepseek-v3.2',
    reasoning: true,
    source: OPENROUTER_DEEPSEEK_URL,
    vision: false,
  }),
  ...openRouterLlmRoutes({
    nativeModelId: 'mistralai/mistral-large-2512',
    productModelId: 'talelabs/mistral-large-3',
    reasoning: false,
    source: OPENROUTER_MISTRAL_URL,
    vision: true,
  }),
  openRouterImageRoute({
    nativeModelId: 'google/gemini-3.1-flash-lite-image',
    operationId: 'textToImage',
    productModelId: 'talelabs/nano-banana-2-lite',
    providerTag: 'google-ai-studio',
    sources: [OPENROUTER_IMAGE_GUIDE_URL, OPENROUTER_NANO_BANANA_2_LITE_URL],
    supportedParameters: ['aspect_ratio', 'model', 'prompt'],
  }),
  openRouterImageRoute({
    nativeModelId: 'google/gemini-3.1-flash-lite-image',
    operationId: 'imageToImage',
    productModelId: 'talelabs/nano-banana-2-lite',
    providerTag: 'google-ai-studio',
    sources: [OPENROUTER_IMAGE_GUIDE_URL, OPENROUTER_NANO_BANANA_2_LITE_URL],
    supportedParameters: [
      'aspect_ratio',
      'input_references',
      'model',
      'prompt',
    ],
  }),
  openRouterImageRoute({
    nativeModelId: 'google/gemini-3.1-flash-image',
    operationId: 'textToImage',
    productModelId: 'talelabs/nano-banana-2',
    providerTag: 'google-ai-studio',
    sources: [OPENROUTER_IMAGE_GUIDE_URL, OPENROUTER_NANO_BANANA_2_URL],
    supportedParameters: ['aspect_ratio', 'model', 'prompt', 'resolution'],
  }),
  openRouterImageRoute({
    nativeModelId: 'google/gemini-3.1-flash-image',
    operationId: 'imageToImage',
    productModelId: 'talelabs/nano-banana-2',
    providerTag: 'google-ai-studio',
    sources: [OPENROUTER_IMAGE_GUIDE_URL, OPENROUTER_NANO_BANANA_2_URL],
    supportedParameters: [
      'aspect_ratio',
      'input_references',
      'model',
      'prompt',
      'resolution',
    ],
  }),
  openRouterImageRoute({
    nativeModelId: 'google/gemini-3-pro-image',
    operationId: 'textToImage',
    productModelId: 'talelabs/nano-banana-pro',
    providerTag: 'google-ai-studio',
    sources: [OPENROUTER_IMAGE_GUIDE_URL, OPENROUTER_NANO_BANANA_PRO_URL],
    supportedParameters: ['aspect_ratio', 'model', 'prompt', 'resolution'],
  }),
  openRouterImageRoute({
    nativeModelId: 'google/gemini-3-pro-image',
    operationId: 'imageToImage',
    productModelId: 'talelabs/nano-banana-pro',
    providerTag: 'google-ai-studio',
    sources: [OPENROUTER_IMAGE_GUIDE_URL, OPENROUTER_NANO_BANANA_PRO_URL],
    supportedParameters: [
      'aspect_ratio',
      'input_references',
      'model',
      'prompt',
      'resolution',
    ],
  }),
  openRouterImageRoute({
    nativeModelId: 'bytedance-seed/seedream-4.5',
    operationId: 'textToImage',
    productModelId: 'talelabs/seedream-4.5',
    providerTag: 'bytedance',
    sources: [OPENROUTER_IMAGE_GUIDE_URL, OPENROUTER_SEEDREAM_URL],
    supportedParameters: ['aspect_ratio', 'model', 'n', 'prompt', 'resolution'],
  }),
  openRouterImageRoute({
    nativeModelId: 'bytedance-seed/seedream-4.5',
    operationId: 'imageToImage',
    productModelId: 'talelabs/seedream-4.5',
    providerTag: 'bytedance',
    sources: [OPENROUTER_IMAGE_GUIDE_URL, OPENROUTER_SEEDREAM_URL],
    supportedParameters: [
      'aspect_ratio',
      'input_references',
      'model',
      'n',
      'prompt',
      'resolution',
    ],
  }),
  openRouterImageRoute({
    nativeModelId: 'black-forest-labs/flux.2-pro',
    operationId: 'textToImage',
    productModelId: 'talelabs/flux-2-pro',
    providerTag: 'black-forest-labs',
    sources: [OPENROUTER_IMAGE_GUIDE_URL, OPENROUTER_FLUX_URL],
    supportedParameters: ['model', 'output_format', 'prompt'],
  }),
  openRouterImageRoute({
    nativeModelId: 'black-forest-labs/flux.2-pro',
    operationId: 'imageToImage',
    productModelId: 'talelabs/flux-2-pro',
    providerTag: 'black-forest-labs',
    sources: [OPENROUTER_IMAGE_GUIDE_URL, OPENROUTER_FLUX_URL],
    supportedParameters: [
      'input_references',
      'model',
      'output_format',
      'prompt',
    ],
  }),
  openRouterImageRoute({
    nativeModelId: 'recraft/recraft-v4.1',
    operationId: 'textToImage',
    productModelId: 'talelabs/recraft-4.1',
    providerTag: 'recraft',
    sources: [OPENROUTER_IMAGE_GUIDE_URL, OPENROUTER_RECRAFT_URL],
    supportedParameters: ['model', 'n', 'prompt'],
  }),
  openRouterImageRoute({
    nativeModelId: 'openai/gpt-image-2',
    operationId: 'textToImage',
    productModelId: 'talelabs/gpt-image-2',
    providerTag: 'openai',
    sources: [OPENROUTER_IMAGE_GUIDE_URL, OPENROUTER_GPT_IMAGE_2_URL],
    supportedParameters: ['background', 'model', 'n', 'prompt', 'quality'],
  }),
  openRouterImageRoute({
    nativeModelId: 'openai/gpt-image-2',
    operationId: 'imageToImage',
    productModelId: 'talelabs/gpt-image-2',
    providerTag: 'openai',
    sources: [OPENROUTER_IMAGE_GUIDE_URL, OPENROUTER_GPT_IMAGE_2_URL],
    supportedParameters: [
      'background',
      'input_references',
      'model',
      'n',
      'prompt',
      'quality',
    ],
  }),
  {
    adapter: 'google-vertex',
    evidence: {
      reviewedAt: REVIEWED_AT,
      sources: [VEO_MODEL_URL, VEO_TEXT_URL],
    },
    lifecycle: {
      cancellation: 'unsupported',
      completions: ['poll'],
      deliveries: ['url'],
      submission: 'asynchronous',
    },
    mockPricing: MOCK_ZERO_PRICING,
    modelContractVersion: GENERATION_MODEL_CONTRACT_VERSION,
    operationId: 'textToVideo',
    productModelId: 'talelabs/veo-3.1',
    providerRoute: {
      endpoint: ':predictLongRunning',
      nativeModelId: 'veo-3.1-generate-001',
      policy: 'pinned',
      provider: 'google-vertex',
      providerTag: 'google-vertex',
      supportedParameters: [
        'aspectRatio',
        'durationSeconds',
        'prompt',
        'resolution',
        'sampleCount',
        'storageUri',
      ],
    },
    routeVersion: ROUTE_VERSION,
  },
  {
    adapter: 'google-vertex',
    evidence: {
      reviewedAt: REVIEWED_AT,
      sources: [VEO_MODEL_URL, VEO_FRAMES_URL],
    },
    lifecycle: {
      cancellation: 'unsupported',
      completions: ['poll'],
      deliveries: ['url'],
      submission: 'asynchronous',
    },
    mockPricing: MOCK_ZERO_PRICING,
    modelContractVersion: GENERATION_MODEL_CONTRACT_VERSION,
    operationId: 'firstLastFrameToVideo',
    productModelId: 'talelabs/veo-3.1',
    providerRoute: {
      endpoint: ':predictLongRunning',
      nativeModelId: 'veo-3.1-generate-001',
      policy: 'pinned',
      provider: 'google-vertex',
      providerTag: 'google-vertex',
      supportedParameters: [
        'aspectRatio',
        'durationSeconds',
        'image',
        'lastFrame',
        'prompt',
        'resolution',
        'sampleCount',
        'storageUri',
      ],
    },
    routeVersion: ROUTE_VERSION,
  },
  {
    adapter: 'google-vertex',
    evidence: {
      reviewedAt: REVIEWED_AT,
      sources: [VEO_MODEL_URL, VEO_REFERENCES_URL],
    },
    lifecycle: {
      cancellation: 'unsupported',
      completions: ['poll'],
      deliveries: ['url'],
      submission: 'asynchronous',
    },
    mockPricing: MOCK_ZERO_PRICING,
    modelContractVersion: GENERATION_MODEL_CONTRACT_VERSION,
    operationId: 'referencesToVideo',
    productModelId: 'talelabs/veo-3.1',
    providerRoute: {
      endpoint: ':predictLongRunning',
      nativeModelId: 'veo-3.1-generate-001',
      policy: 'pinned',
      provider: 'google-vertex',
      providerTag: 'google-vertex',
      supportedParameters: [
        'aspectRatio',
        'durationSeconds',
        'prompt',
        'referenceImages',
        'resolution',
        'sampleCount',
        'storageUri',
      ],
    },
    routeVersion: ROUTE_VERSION,
  },
  {
    adapter: 'google-vertex',
    evidence: {
      reviewedAt: REVIEWED_AT,
      sources: [VEO_MODEL_URL, VEO_EXTEND_URL],
    },
    lifecycle: {
      cancellation: 'unsupported',
      completions: ['poll'],
      deliveries: ['url'],
      submission: 'asynchronous',
    },
    mockPricing: MOCK_ZERO_PRICING,
    modelContractVersion: GENERATION_MODEL_CONTRACT_VERSION,
    operationId: 'extendVideo',
    productModelId: 'talelabs/veo-3.1',
    providerRoute: {
      endpoint: ':predictLongRunning',
      nativeModelId: 'veo-3.1-generate-001',
      policy: 'pinned',
      provider: 'google-vertex',
      providerTag: 'google-vertex',
      supportedParameters: ['prompt', 'sampleCount', 'storageUri', 'video'],
    },
    routeVersion: ROUTE_VERSION,
  },
  {
    adapter: 'ltx',
    evidence: {
      reviewedAt: REVIEWED_AT,
      sources: [LTX_MODELS_URL, LTX_TEXT_URL, LTX_STATUS_URL],
    },
    lifecycle: {
      cancellation: 'unsupported',
      completions: ['poll'],
      deliveries: ['url'],
      submission: 'asynchronous',
    },
    mockPricing: MOCK_ZERO_PRICING,
    modelContractVersion: GENERATION_MODEL_CONTRACT_VERSION,
    operationId: 'textToVideo',
    productModelId: 'talelabs/ltx-2.3-pro',
    providerRoute: {
      endpoint: '/v2/text-to-video',
      nativeModelId: 'ltx-2-3-pro',
      policy: 'pinned',
      provider: 'ltx',
      providerTag: 'ltx-direct',
      supportedParameters: [
        'camera_motion',
        'duration',
        'fps',
        'generate_audio',
        'model',
        'prompt',
        'resolution',
      ],
    },
    routeVersion: ROUTE_VERSION,
  },
  {
    adapter: 'ltx',
    evidence: {
      reviewedAt: REVIEWED_AT,
      sources: [LTX_MODELS_URL, LTX_AUDIO_URL, LTX_STATUS_URL],
    },
    lifecycle: {
      cancellation: 'unsupported',
      completions: ['poll'],
      deliveries: ['url'],
      submission: 'asynchronous',
    },
    mockPricing: MOCK_ZERO_PRICING,
    modelContractVersion: GENERATION_MODEL_CONTRACT_VERSION,
    operationId: 'audioToVideo',
    productModelId: 'talelabs/ltx-2.3-pro',
    providerRoute: {
      endpoint: '/v2/audio-to-video',
      nativeModelId: 'ltx-2-3-pro',
      policy: 'pinned',
      provider: 'ltx',
      providerTag: 'ltx-direct',
      supportedParameters: [
        'audio_uri',
        'image_uri',
        'model',
        'prompt',
        'resolution',
      ],
    },
    routeVersion: ROUTE_VERSION,
  },
  openRouterVideoRoute({
    nativeModelId: 'google/veo-3.1-lite',
    operationId: 'textToVideo',
    productModelId: 'talelabs/veo-3.1-lite',
    sources: [
      OPENROUTER_VIDEO_GUIDE_URL,
      OPENROUTER_CREATE_VIDEO_URL,
      OPENROUTER_VEO_LITE_URL,
    ],
    supportedParameters: [
      'aspect_ratio',
      'audio',
      'duration',
      'model',
      'prompt',
      'resolution',
    ],
  }),
  openRouterVideoRoute({
    nativeModelId: 'google/veo-3.1-lite',
    operationId: 'firstLastFrameToVideo',
    productModelId: 'talelabs/veo-3.1-lite',
    sources: [
      OPENROUTER_VIDEO_GUIDE_URL,
      OPENROUTER_CREATE_VIDEO_URL,
      OPENROUTER_VEO_LITE_URL,
    ],
    supportedParameters: [
      'aspect_ratio',
      'audio',
      'duration',
      'frame_images',
      'model',
      'prompt',
      'resolution',
    ],
  }),
  openRouterVideoRoute({
    nativeModelId: 'x-ai/grok-imagine-video',
    operationId: 'textToVideo',
    productModelId: 'talelabs/grok-imagine-video',
    sources: [
      OPENROUTER_VIDEO_GUIDE_URL,
      OPENROUTER_CREATE_VIDEO_URL,
      OPENROUTER_GROK_VIDEO_URL,
    ],
    supportedParameters: [
      'aspect_ratio',
      'duration',
      'model',
      'prompt',
      'resolution',
    ],
  }),
  openRouterVideoRoute({
    nativeModelId: 'x-ai/grok-imagine-video',
    operationId: 'imageToVideo',
    productModelId: 'talelabs/grok-imagine-video',
    sources: [
      OPENROUTER_VIDEO_GUIDE_URL,
      OPENROUTER_CREATE_VIDEO_URL,
      OPENROUTER_GROK_VIDEO_URL,
    ],
    supportedParameters: [
      'aspect_ratio',
      'duration',
      'frame_images',
      'model',
      'prompt',
      'resolution',
    ],
  }),
  openRouterVideoRoute({
    nativeModelId: 'x-ai/grok-imagine-video',
    operationId: 'referencesToVideo',
    productModelId: 'talelabs/grok-imagine-video',
    sources: [
      OPENROUTER_VIDEO_GUIDE_URL,
      OPENROUTER_CREATE_VIDEO_URL,
      OPENROUTER_GROK_VIDEO_URL,
    ],
    supportedParameters: [
      'aspect_ratio',
      'duration',
      'input_references',
      'model',
      'prompt',
      'resolution',
    ],
  }),
  openRouterVideoRoute({
    nativeModelId: 'bytedance/seedance-2.0',
    operationId: 'textToVideo',
    productModelId: 'talelabs/seedance-2.0',
    sources: [
      OPENROUTER_VIDEO_GUIDE_URL,
      OPENROUTER_CREATE_VIDEO_URL,
      OPENROUTER_SEEDANCE_URL,
    ],
    supportedParameters: [
      'aspect_ratio',
      'audio',
      'duration',
      'model',
      'prompt',
      'resolution',
    ],
  }),
  openRouterVideoRoute({
    nativeModelId: 'bytedance/seedance-2.0',
    operationId: 'firstLastFrameToVideo',
    productModelId: 'talelabs/seedance-2.0',
    sources: [
      OPENROUTER_VIDEO_GUIDE_URL,
      OPENROUTER_CREATE_VIDEO_URL,
      OPENROUTER_SEEDANCE_URL,
    ],
    supportedParameters: [
      'aspect_ratio',
      'audio',
      'duration',
      'frame_images',
      'model',
      'prompt',
      'resolution',
    ],
  }),
  openRouterVideoRoute({
    nativeModelId: 'bytedance/seedance-2.0',
    operationId: 'referencesToVideo',
    productModelId: 'talelabs/seedance-2.0',
    sources: [
      OPENROUTER_VIDEO_GUIDE_URL,
      OPENROUTER_CREATE_VIDEO_URL,
      OPENROUTER_SEEDANCE_URL,
    ],
    supportedParameters: [
      'aspect_ratio',
      'audio',
      'duration',
      'input_references',
      'model',
      'prompt',
      'resolution',
    ],
  }),
  {
    adapter: 'elevenlabs',
    evidence: {
      reviewedAt: REVIEWED_AT,
      sources: [ELEVEN_TTS_URL, ELEVEN_TTS_STREAM_URL],
    },
    lifecycle: {
      cancellation: 'unsupported',
      completions: ['response'],
      deliveries: ['bytes', 'stream'],
      submission: 'immediate',
    },
    mockPricing: MOCK_ZERO_PRICING,
    modelContractVersion: GENERATION_MODEL_CONTRACT_VERSION,
    operationId: 'textToSpeech',
    productModelId: 'talelabs/eleven-multilingual-v2',
    providerRoute: {
      endpoint: '/v1/text-to-speech/:voice_id',
      nativeModelId: 'eleven_multilingual_v2',
      policy: 'pinned',
      provider: 'elevenlabs',
      providerTag: 'elevenlabs-direct',
      streamEndpoint: '/v1/text-to-speech/:voice_id/stream',
      settingValueMappings: {
        voice: {
          'eleven-antoni': 'ErXwobaYiN019PkySvjV',
          'eleven-domi': 'AZnzlk1XvdvUeBnXmlld',
          'eleven-josh': 'TxGEqnHWrfWFTfGW9XjX',
          'eleven-rachel': '21m00Tcm4TlvDq8ikWAM',
        },
      },
      supportedParameters: [
        'model_id',
        'output_format',
        'text',
        'voice_id',
        'voice_settings',
      ],
    },
    routeVersion: ROUTE_VERSION,
  },
  {
    adapter: 'elevenlabs',
    evidence: {
      reviewedAt: REVIEWED_AT,
      sources: [ELEVEN_SOUND_URL],
    },
    lifecycle: {
      cancellation: 'unsupported',
      completions: ['response'],
      deliveries: ['bytes'],
      submission: 'immediate',
    },
    mockPricing: MOCK_ZERO_PRICING,
    modelContractVersion: GENERATION_MODEL_CONTRACT_VERSION,
    operationId: 'textToSoundEffect',
    productModelId: 'talelabs/eleven-sound-effects-v2',
    providerRoute: {
      endpoint: '/v1/sound-generation',
      nativeModelId: 'eleven_text_to_sound_v2',
      policy: 'pinned',
      provider: 'elevenlabs',
      providerTag: 'elevenlabs-direct',
      supportedParameters: [
        'duration_seconds',
        'loop',
        'model_id',
        'output_format',
        'prompt_influence',
        'text',
      ],
    },
    routeVersion: ROUTE_VERSION,
  },
  ...(['textToMusic', 'textToSoundEffect'] as const).map<GenerationProviderRoute>(operationId => ({
    adapter: 'stability' as const,
    evidence: {
      reviewedAt: REVIEWED_AT,
      sources: [STABLE_AUDIO_URL] as [string],
    },
    lifecycle: {
      cancellation: 'unsupported' as const,
      completions: ['response'] as ['response'],
      deliveries: ['bytes'] as ['bytes'],
      submission: 'immediate' as const,
    },
    mockPricing: MOCK_ZERO_PRICING,
    modelContractVersion: GENERATION_MODEL_CONTRACT_VERSION,
    operationId,
    productModelId: 'talelabs/stable-audio-2.5',
    providerRoute: {
      endpoint: '/v2beta/audio/stable-audio-2/text-to-audio',
      nativeModelId: 'stable-audio-2.5',
      policy: 'pinned' as const,
      provider: 'stability' as const,
      providerTag: 'stability-direct',
      supportedParameters: [
        'cfg_scale',
        'duration',
        'model',
        'output_format',
        'prompt',
        'seed',
      ] as [string, ...string[]],
    },
    routeVersion: ROUTE_VERSION,
  })),
  {
    adapter: 'openai',
    evidence: {
      reviewedAt: REVIEWED_AT,
      sources: [OPENAI_TTS_URL],
    },
    lifecycle: {
      cancellation: 'unsupported',
      completions: ['response'],
      deliveries: ['bytes'],
      submission: 'immediate',
    },
    mockPricing: MOCK_ZERO_PRICING,
    modelContractVersion: GENERATION_MODEL_CONTRACT_VERSION,
    operationId: 'textToSpeech',
    productModelId: 'talelabs/gpt-4o-mini-tts',
    providerRoute: {
      endpoint: '/v1/audio/speech',
      nativeModelId: 'gpt-4o-mini-tts-2025-12-15',
      policy: 'pinned',
      provider: 'openai',
      providerTag: 'openai-direct',
      settingValueMappings: {
        voice: {
          'openai-cedar': 'cedar',
          'openai-coral': 'coral',
          'openai-marin': 'marin',
          'openai-verse': 'verse',
        },
      },
      supportedParameters: [
        'input',
        'instructions',
        'model',
        'response_format',
        'speed',
        'voice',
      ],
    },
    routeVersion: ROUTE_VERSION,
  },
  {
    adapter: 'elevenlabs',
    evidence: {
      reviewedAt: REVIEWED_AT,
      sources: [ELEVEN_MUSIC_URL],
    },
    lifecycle: {
      cancellation: 'unsupported',
      completions: ['response'],
      deliveries: ['bytes'],
      submission: 'immediate',
    },
    mockPricing: MOCK_ZERO_PRICING,
    modelContractVersion: GENERATION_MODEL_CONTRACT_VERSION,
    operationId: 'textToMusic',
    productModelId: 'talelabs/eleven-music-v2',
    providerRoute: {
      endpoint: '/v1/music',
      nativeModelId: 'music_v2',
      policy: 'pinned',
      provider: 'elevenlabs',
      providerTag: 'elevenlabs-direct',
      supportedParameters: [
        'force_instrumental',
        'model_id',
        'music_length_ms',
        'output_format',
        'prompt',
      ],
    },
    routeVersion: ROUTE_VERSION,
  },
  {
    adapter: 'elevenlabs',
    evidence: {
      reviewedAt: REVIEWED_AT,
      sources: [ELEVEN_VOICE_CHANGER_URL],
    },
    lifecycle: {
      cancellation: 'unsupported',
      completions: ['response'],
      deliveries: ['bytes'],
      submission: 'immediate',
    },
    mockPricing: MOCK_ZERO_PRICING,
    modelContractVersion: GENERATION_MODEL_CONTRACT_VERSION,
    operationId: 'changeVoice',
    productModelId: 'talelabs/eleven-voice-changer',
    providerRoute: {
      endpoint: '/v1/speech-to-speech/:voice_id',
      nativeModelId: 'eleven_multilingual_sts_v2',
      policy: 'pinned',
      provider: 'elevenlabs',
      providerTag: 'elevenlabs-direct',
      settingValueMappings: {
        voice: {
          'eleven-antoni': 'ErXwobaYiN019PkySvjV',
          'eleven-domi': 'AZnzlk1XvdvUeBnXmlld',
          'eleven-josh': 'TxGEqnHWrfWFTfGW9XjX',
          'eleven-rachel': '21m00Tcm4TlvDq8ikWAM',
        },
      },
      supportedParameters: [
        'audio',
        'model_id',
        'output_format',
        'remove_background_noise',
        'voice_id',
      ],
    },
    routeVersion: ROUTE_VERSION,
  },
  {
    adapter: 'elevenlabs',
    evidence: {
      reviewedAt: REVIEWED_AT,
      sources: [ELEVEN_VOICE_ISOLATION_URL],
    },
    lifecycle: {
      cancellation: 'unsupported',
      completions: ['response'],
      deliveries: ['bytes'],
      submission: 'immediate',
    },
    mockPricing: MOCK_ZERO_PRICING,
    modelContractVersion: GENERATION_MODEL_CONTRACT_VERSION,
    operationId: 'isolateVoice',
    productModelId: 'talelabs/eleven-voice-isolator',
    providerRoute: {
      endpoint: '/v1/audio-isolation',
      nativeModelId: 'eleven_voice_isolator',
      policy: 'pinned',
      provider: 'elevenlabs',
      providerTag: 'elevenlabs-direct',
      supportedParameters: ['audio'],
    },
    routeVersion: ROUTE_VERSION,
  },
] as const satisfies readonly GenerationProviderRoute[]

export const GENERATION_PROVIDER_ROUTES: readonly GenerationProviderRoute[]
  = deepFreeze(routes)

function routeKey(
  productModelId: string | number,
  modelContractVersion: string,
  operationId: string,
) {
  return `${productModelId}:${modelContractVersion}:${operationId}`
}

const enabledRouteKeys = new Set(
  GENERATION_MODELS.filter(model => model.enabled).flatMap(model =>
    model.operations.map(operation =>
      routeKey(model.id, GENERATION_MODEL_CONTRACT_VERSION, operation.id),
    ),
  ),
)
const routeKeys = GENERATION_PROVIDER_ROUTES.map(route =>
  routeKey(route.productModelId, route.modelContractVersion, route.operationId),
)
const routeKeySet = new Set(routeKeys)
const invalidRouteIds = routeKeys.filter(key => !enabledRouteKeys.has(key))
const missingRouteIds = [...enabledRouteKeys].filter(
  key => !routeKeySet.has(key),
)
const routeConfigurationErrors = GENERATION_PROVIDER_ROUTES.flatMap((route) => {
  const errors = validateGenerationProviderLifecycle(route.lifecycle).map(
    error => `${route.productModelId}/${route.operationId}: ${error}`,
  )
  const supportedParameters: readonly string[]
    = route.providerRoute.supportedParameters
  if (route.providerRoute.provider !== route.adapter) {
    errors.push(
      `${route.productModelId}/${route.operationId}: adapter and provider must match`,
    )
  }
  if (route.evidence.reviewedAt !== REVIEWED_AT) {
    errors.push(
      `${route.productModelId}/${route.operationId}: evidence review date is invalid`,
    )
  }
  if (
    !route.evidence.sources.length
    || route.evidence.sources.some(
      source => new URL(source).protocol !== 'https:',
    )
  ) {
    errors.push(
      `${route.productModelId}/${route.operationId}: official HTTPS evidence is required`,
    )
  }
  if (
    !supportedParameters.length
    || new Set(supportedParameters).size !== supportedParameters.length
  ) {
    errors.push(
      `${route.productModelId}/${route.operationId}: provider parameters must be non-empty and unique`,
    )
  }
  if (
    route.adapter === 'google-vertex'
    && route.lifecycle.deliveries.includes('url')
    && !supportedParameters.includes('storageUri')
  ) {
    errors.push(
      `${route.productModelId}/${route.operationId}: Veo URL delivery requires storageUri`,
    )
  }
  if (route.adapter === 'ltx' && !supportedParameters.includes('model')) {
    errors.push(
      `${route.productModelId}/${route.operationId}: pinned LTX routes must send model`,
    )
  }
  if (
    route.mockPricing.source !== 'mock'
    || route.mockPricing.creditCost !== 0
    || route.mockPricing.providerCostUsd !== 0
  ) {
    errors.push(
      `${route.productModelId}/${route.operationId}: E-040 pricing must remain explicit mock zero pricing`,
    )
  }
  return errors
})

if (
  routeKeySet.size !== routeKeys.length
  || invalidRouteIds.length
  || missingRouteIds.length
  || routeConfigurationErrors.length
) {
  throw new Error(
    [
      routeKeySet.size !== routeKeys.length ? 'Duplicate provider routes' : '',
      invalidRouteIds.length
        ? `Unknown or disabled provider routes: ${invalidRouteIds.join(', ')}`
        : '',
      missingRouteIds.length
        ? `Missing provider routes: ${missingRouteIds.join(', ')}`
        : '',
      ...routeConfigurationErrors,
    ]
      .filter(Boolean)
      .join('\n'),
  )
}

export function getGenerationProviderRoute(input: {
  modelContractVersion: GenerationModelContractVersion
  operationId: string
  productModelId: GenerationModelId
}) {
  const exactRoute = GENERATION_PROVIDER_ROUTES.find(
    route =>
      route.productModelId === input.productModelId
      && route.modelContractVersion === input.modelContractVersion
      && route.operationId === input.operationId,
  )
  if (exactRoute)
    return exactRoute
  if (
    !isCurrentGenerationModelContract(
      String(input.productModelId),
      input.modelContractVersion,
    )
  ) {
    return undefined
  }
  return GENERATION_PROVIDER_ROUTES.find(
    route =>
      route.productModelId === input.productModelId
      && route.modelContractVersion === GENERATION_MODEL_CONTRACT_VERSION
      && route.operationId === input.operationId,
  )
}
