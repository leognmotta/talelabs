import type {
  GenerationModelContractVersion,
  GenerationModelId,
} from '@talelabs/flows'

import {
  GENERATION_MODEL_CONTRACT_VERSION,
  GENERATION_MODELS,
} from '@talelabs/flows'

export interface GenerationProviderRoute {
  adapter: 'elevenlabs' | 'google-vertex' | 'ltx' | 'openai'
  discovery: {
    endpoint: string
    modelId: string
    provider: string
    supportedParameters: readonly string[]
  }
  modelContractVersion: GenerationModelContractVersion
  operationId: string
  productModelId: GenerationModelId
  providerModelId: string
  providerTag: string
  routeVersion: string
}

/**
 * Server-only routing metadata. Product model IDs remain stable when a provider
 * route, model revision, or adapter changes.
 */
export const GENERATION_PROVIDER_ROUTES = Object.freeze([
  {
    adapter: 'openai',
    discovery: {
      endpoint: '/v1/images/generations',
      modelId: 'gpt-image-1.5',
      provider: 'openai',
      supportedParameters: ['model', 'n', 'prompt', 'quality', 'size'],
    },
    modelContractVersion: GENERATION_MODEL_CONTRACT_VERSION,
    operationId: 'textToImage',
    productModelId: 'talelabs/gpt-image-1.5',
    providerModelId: 'gpt-image-1.5',
    providerTag: 'openai-direct',
    routeVersion: '2026-07-12',
  },
  {
    adapter: 'openai',
    discovery: {
      endpoint: '/v1/images/edits',
      modelId: 'gpt-image-1.5',
      provider: 'openai',
      supportedParameters: ['image', 'model', 'n', 'prompt', 'quality', 'size'],
    },
    modelContractVersion: GENERATION_MODEL_CONTRACT_VERSION,
    operationId: 'imageToImage',
    productModelId: 'talelabs/gpt-image-1.5',
    providerModelId: 'gpt-image-1.5',
    providerTag: 'openai-direct',
    routeVersion: '2026-07-12',
  },
  {
    adapter: 'google-vertex',
    discovery: {
      endpoint: ':predictLongRunning',
      modelId: 'veo-3.1-generate-001',
      provider: 'google-vertex',
      supportedParameters: ['aspectRatio', 'durationSeconds', 'prompt', 'resolution'],
    },
    modelContractVersion: GENERATION_MODEL_CONTRACT_VERSION,
    operationId: 'textToVideo',
    productModelId: 'talelabs/veo-3.1',
    providerModelId: 'veo-3.1-generate-001',
    providerTag: 'google-vertex',
    routeVersion: '2026-07-12.2',
  },
  {
    adapter: 'google-vertex',
    discovery: {
      endpoint: ':predictLongRunning',
      modelId: 'veo-3.1-generate-001',
      provider: 'google-vertex',
      supportedParameters: [
        'aspectRatio',
        'durationSeconds',
        'image',
        'lastFrame',
        'prompt',
        'resolution',
      ],
    },
    modelContractVersion: GENERATION_MODEL_CONTRACT_VERSION,
    operationId: 'firstLastFrameToVideo',
    productModelId: 'talelabs/veo-3.1',
    providerModelId: 'veo-3.1-generate-001',
    providerTag: 'google-vertex',
    routeVersion: '2026-07-12.2',
  },
  {
    adapter: 'google-vertex',
    discovery: {
      endpoint: ':predictLongRunning',
      modelId: 'veo-3.1-generate-preview',
      provider: 'google-vertex',
      supportedParameters: [
        'aspectRatio',
        'durationSeconds',
        'prompt',
        'referenceImages',
        'resolution',
      ],
    },
    modelContractVersion: GENERATION_MODEL_CONTRACT_VERSION,
    operationId: 'referencesToVideo',
    productModelId: 'talelabs/veo-3.1',
    providerModelId: 'veo-3.1-generate-preview',
    providerTag: 'google-vertex',
    routeVersion: '2026-07-12.3',
  },
  {
    adapter: 'ltx',
    discovery: {
      endpoint: '/v2/text-to-video',
      modelId: 'ltx-2-3-pro',
      provider: 'ltx',
      supportedParameters: [
        'duration',
        'model',
        'prompt',
        'resolution',
      ],
    },
    modelContractVersion: GENERATION_MODEL_CONTRACT_VERSION,
    operationId: 'textToVideo',
    productModelId: 'talelabs/ltx-2.3-pro',
    providerModelId: 'ltx-2-3-pro',
    providerTag: 'ltx-direct',
    routeVersion: '2026-07-12',
  },
  {
    adapter: 'ltx',
    discovery: {
      endpoint: '/v2/image-to-video',
      modelId: 'ltx-2-3-pro',
      provider: 'ltx',
      supportedParameters: ['duration', 'image_uri', 'model', 'prompt', 'resolution'],
    },
    modelContractVersion: GENERATION_MODEL_CONTRACT_VERSION,
    operationId: 'imageToVideo',
    productModelId: 'talelabs/ltx-2.3-pro',
    providerModelId: 'ltx-2-3-pro',
    providerTag: 'ltx-direct',
    routeVersion: '2026-07-12',
  },
  {
    adapter: 'ltx',
    discovery: {
      endpoint: '/v2/audio-to-video',
      modelId: 'ltx-2-3-pro',
      provider: 'ltx',
      supportedParameters: ['audio_uri', 'image_uri', 'model', 'prompt', 'resolution'],
    },
    modelContractVersion: GENERATION_MODEL_CONTRACT_VERSION,
    operationId: 'audioToVideo',
    productModelId: 'talelabs/ltx-2.3-pro',
    providerModelId: 'ltx-2-3-pro',
    providerTag: 'ltx-direct',
    routeVersion: '2026-07-12',
  },
  {
    adapter: 'elevenlabs',
    discovery: {
      endpoint: '/v1/text-to-speech/:voice_id',
      modelId: 'eleven_multilingual_v2',
      provider: 'elevenlabs',
      supportedParameters: ['model_id', 'text', 'voice_id', 'voice_settings'],
    },
    modelContractVersion: GENERATION_MODEL_CONTRACT_VERSION,
    operationId: 'textToSpeech',
    productModelId: 'talelabs/eleven-multilingual-v2',
    providerModelId: 'eleven_multilingual_v2',
    providerTag: 'elevenlabs-direct',
    routeVersion: '2026-07-12',
  },
  {
    adapter: 'elevenlabs',
    discovery: {
      endpoint: '/v1/sound-generation',
      modelId: 'eleven_text_to_sound_v2',
      provider: 'elevenlabs',
      supportedParameters: [
        'duration_seconds',
        'loop',
        'prompt_influence',
        'text',
      ],
    },
    modelContractVersion: GENERATION_MODEL_CONTRACT_VERSION,
    operationId: 'textToSoundEffect',
    productModelId: 'talelabs/eleven-sound-effects-v2',
    providerModelId: 'eleven_text_to_sound_v2',
    providerTag: 'elevenlabs-direct',
    routeVersion: '2026-07-12',
  },
] as const satisfies readonly GenerationProviderRoute[])

function routeKey(
  productModelId: string,
  modelContractVersion: string,
  operationId: string,
) {
  return `${productModelId}:${modelContractVersion}:${operationId}`
}

const publicRouteKeys = new Set(GENERATION_MODELS.flatMap(model => (
  model.operations.map(operation => routeKey(
    model.id,
    GENERATION_MODEL_CONTRACT_VERSION,
    operation.id,
  ))
)))
const routeKeys = GENERATION_PROVIDER_ROUTES.map(route => (
  routeKey(
    route.productModelId,
    route.modelContractVersion,
    route.operationId,
  )
))
const routeKeySet = new Set(routeKeys)
const invalidRouteIds = routeKeys.filter(key => !publicRouteKeys.has(key))
const missingRouteIds = [...publicRouteKeys].filter(key => !routeKeySet.has(key))
if (
  routeKeySet.size !== routeKeys.length
  || invalidRouteIds.length
  || missingRouteIds.length
) {
  throw new Error([
    routeKeySet.size !== routeKeys.length ? 'Duplicate provider routes' : '',
    invalidRouteIds.length ? `Unknown provider routes: ${invalidRouteIds.join(', ')}` : '',
    missingRouteIds.length ? `Missing provider routes: ${missingRouteIds.join(', ')}` : '',
  ].filter(Boolean).join('\n'))
}

export function getGenerationProviderRoute(input: {
  modelContractVersion: GenerationModelContractVersion
  operationId: string
  productModelId: GenerationModelId
}) {
  return GENERATION_PROVIDER_ROUTES.find(route => (
    route.productModelId === input.productModelId
    && route.modelContractVersion === input.modelContractVersion
    && route.operationId === input.operationId
  ))
}
