import type { GenerationModelContractVersion } from '@talelabs/flows'

import type {
  GenerationProviderRoute,
  OpenRouterAdapterVersion,
  OpenRouterImageSetting,
  OpenRouterVideoRequestProfile,
} from '../contracts.js'
import {
  ASYNC_VIDEO_LIFECYCLE,
  ASYNC_VIDEO_STREAM_LIFECYCLE,
  IMMEDIATE_BYTES_LIFECYCLE,
  OPENROUTER_IMAGE_ADAPTER_VERSION,
  OPENROUTER_IMAGE_GUIDE_URL,
  OPENROUTER_PROVIDER,
  OPENROUTER_VIDEO_ADAPTER_VERSION,
  OPENROUTER_VIDEO_GUIDE_URL,
  OPENROUTER_VIDEO_MODELS_URL,
  PROVIDER_RESULT_COST_CAPTURE,
  REVIEWED_AT,
} from '../contracts.js'

export function providerRoute(input: Omit<
  GenerationProviderRoute,
  | 'costCapture'
  | 'evidence'
  | 'provider'
  | 'requiresDurableSubmissionBoundary'
  | 'routingStatus'
> & { sources: readonly [string, ...string[]] }): GenerationProviderRoute {
  const { sources, ...definition } = input
  return {
    ...definition,
    costCapture: PROVIDER_RESULT_COST_CAPTURE,
    evidence: { reviewedAt: REVIEWED_AT, sources },
    provider: OPENROUTER_PROVIDER,
    requiresDurableSubmissionBoundary: true,
    routingStatus: 'current',
  }
}

export function imageRoute(input: {
  adapterVersion?: OpenRouterAdapterVersion
  maxReferences: number
  modelContractVersion: GenerationModelContractVersion
  nativeModelId: string
  operationId: 'imageToImage' | 'textToImage'
  productModelId: string
  providerTag: string
  routeVersion: string
  settingIds: readonly OpenRouterImageSetting[]
}): GenerationProviderRoute {
  const referenceParameters = input.maxReferences > 0
    ? ['input_references']
    : []
  const providerParameters = input.settingIds.map(settingId => ({
    aspectRatio: 'aspect_ratio',
    background: 'background',
    outputFormat: 'output_format',
    quality: 'quality',
    resolution: 'resolution',
  } as const)[settingId])
  return providerRoute({
    adapterVersion: input.adapterVersion ?? OPENROUTER_IMAGE_ADAPTER_VERSION,
    lifecycle: IMMEDIATE_BYTES_LIFECYCLE,
    modelContractVersion: input.modelContractVersion,
    operationId: input.operationId,
    outputType: 'image',
    productModelId: input.productModelId,
    providerRoute: {
      endpoint: '/api/v1/images',
      nativeModelId: input.nativeModelId,
      policy: 'pinned',
      provider: OPENROUTER_PROVIDER,
      providerTag: input.providerTag,
      supportedParameters: [
        'model',
        'n',
        'prompt',
        'provider',
        ...referenceParameters,
        ...providerParameters,
      ],
    },
    requestProfile: {
      kind: 'image',
      maxReferences: input.maxReferences,
      settingIds: input.settingIds,
    },
    routeVersion: input.routeVersion,
    sources: [
      OPENROUTER_IMAGE_GUIDE_URL,
      `https://openrouter.ai/${input.nativeModelId}`,
      `https://openrouter.ai/api/v1/images/models/${input.nativeModelId}/endpoints`,
    ],
  })
}

export function videoRoute(input: {
  adapterVersion?: OpenRouterAdapterVersion
  frameMode: OpenRouterVideoRequestProfile['frameMode']
  generateAudio: boolean
  modelContractVersion: GenerationModelContractVersion
  nativeModelId: string
  operationId: string
  productModelId: string
  providerTag: string
  referenceLimits?: Partial<OpenRouterVideoRequestProfile['referenceLimits']>
  referenceValidationPolicy?: OpenRouterVideoRequestProfile['referenceValidationPolicy']
  routeVersion: string
  settingIds: readonly string[]
  streamDelivery?: boolean
}): GenerationProviderRoute {
  const referenceLimits = {
    audio: input.referenceLimits?.audio ?? 0,
    image: input.referenceLimits?.image ?? 0,
    video: input.referenceLimits?.video ?? 0,
  }
  return providerRoute({
    adapterVersion: input.adapterVersion ?? OPENROUTER_VIDEO_ADAPTER_VERSION,
    lifecycle: input.streamDelivery
      ? ASYNC_VIDEO_STREAM_LIFECYCLE
      : ASYNC_VIDEO_LIFECYCLE,
    modelContractVersion: input.modelContractVersion,
    operationId: input.operationId,
    outputType: 'video',
    productModelId: input.productModelId,
    providerRoute: {
      endpoint: '/api/v1/videos',
      nativeModelId: input.nativeModelId,
      policy: 'pinned',
      provider: OPENROUTER_PROVIDER,
      providerTag: input.providerTag,
      supportedParameters: [
        'aspect_ratio',
        'callback_url',
        'duration',
        'model',
        'prompt',
        'provider',
        'resolution',
        ...(input.generateAudio ? ['generate_audio'] : []),
        ...(input.frameMode === 'none' ? [] : ['frame_images']),
        ...(Object.values(referenceLimits).some(Boolean)
          ? ['input_references']
          : []),
      ],
    },
    requestProfile: {
      frameMode: input.frameMode,
      generateAudio: input.generateAudio,
      kind: 'video',
      referenceLimits,
      referenceValidationPolicy: input.referenceValidationPolicy ?? 'none',
      settingIds: input.settingIds,
    },
    routeVersion: input.routeVersion,
    sources: [
      OPENROUTER_VIDEO_GUIDE_URL,
      OPENROUTER_VIDEO_MODELS_URL,
      `https://openrouter.ai/${input.nativeModelId}`,
    ],
  })
}
