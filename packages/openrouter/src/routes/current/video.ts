import type { GenerationModelContractVersion } from '@talelabs/flows'

import { videoRoute } from '../builders/media.js'

const VIDEO_SETTING_IDS = [
  'aspectRatio',
  'durationSeconds',
  'resolution',
] as const
const VIDEO_AUDIO_SETTING_IDS = [...VIDEO_SETTING_IDS, 'generateAudio'] as const

export interface CurrentVideoProviderTags {
  grok: string
  seedance: string
  veo: string
}

export function currentVideoRoutes(input: {
  modelContractVersion: GenerationModelContractVersion
  providerTags: CurrentVideoProviderTags
  routeVersion: string
  streamDelivery?: boolean
}) {
  const common: {
    modelContractVersion: GenerationModelContractVersion
    routeVersion: string
  } = {
    modelContractVersion: input.modelContractVersion,
    routeVersion: input.routeVersion,
  }
  return [
    videoRoute({
      ...common,
      frameMode: 'none',
      generateAudio: true,
      nativeModelId: 'google/veo-3.1',
      operationId: 'textToVideo',
      productModelId: 'talelabs/veo-3.1',
      providerTag: input.providerTags.veo,
      settingIds: VIDEO_AUDIO_SETTING_IDS,
      streamDelivery: input.streamDelivery,
    }),
    videoRoute({
      ...common,
      frameMode: 'first-last',
      generateAudio: true,
      nativeModelId: 'google/veo-3.1',
      operationId: 'firstLastFrameToVideo',
      productModelId: 'talelabs/veo-3.1',
      providerTag: input.providerTags.veo,
      settingIds: VIDEO_AUDIO_SETTING_IDS,
      streamDelivery: input.streamDelivery,
    }),
    videoRoute({
      ...common,
      frameMode: 'none',
      generateAudio: true,
      nativeModelId: 'google/veo-3.1-lite',
      operationId: 'textToVideo',
      productModelId: 'talelabs/veo-3.1-lite',
      providerTag: input.providerTags.veo,
      settingIds: VIDEO_AUDIO_SETTING_IDS,
      streamDelivery: input.streamDelivery,
    }),
    videoRoute({
      ...common,
      frameMode: 'first-last',
      generateAudio: true,
      nativeModelId: 'google/veo-3.1-lite',
      operationId: 'firstLastFrameToVideo',
      productModelId: 'talelabs/veo-3.1-lite',
      providerTag: input.providerTags.veo,
      settingIds: VIDEO_AUDIO_SETTING_IDS,
      streamDelivery: input.streamDelivery,
    }),
    videoRoute({
      ...common,
      frameMode: 'none',
      generateAudio: false,
      nativeModelId: 'x-ai/grok-imagine-video',
      operationId: 'textToVideo',
      productModelId: 'talelabs/grok-imagine-video',
      providerTag: input.providerTags.grok,
      settingIds: VIDEO_SETTING_IDS,
      streamDelivery: input.streamDelivery,
    }),
    videoRoute({
      ...common,
      frameMode: 'first',
      generateAudio: false,
      nativeModelId: 'x-ai/grok-imagine-video',
      operationId: 'imageToVideo',
      productModelId: 'talelabs/grok-imagine-video',
      providerTag: input.providerTags.grok,
      settingIds: VIDEO_SETTING_IDS,
      streamDelivery: input.streamDelivery,
    }),
    videoRoute({
      ...common,
      frameMode: 'none',
      generateAudio: false,
      nativeModelId: 'x-ai/grok-imagine-video',
      operationId: 'referencesToVideo',
      productModelId: 'talelabs/grok-imagine-video',
      providerTag: input.providerTags.grok,
      referenceLimits: { image: 7 },
      settingIds: VIDEO_SETTING_IDS,
      streamDelivery: input.streamDelivery,
    }),
    videoRoute({
      ...common,
      frameMode: 'none',
      generateAudio: true,
      nativeModelId: 'bytedance/seedance-2.0',
      operationId: 'textToVideo',
      productModelId: 'talelabs/seedance-2.0',
      providerTag: input.providerTags.seedance,
      settingIds: VIDEO_AUDIO_SETTING_IDS,
      streamDelivery: input.streamDelivery,
    }),
    videoRoute({
      ...common,
      frameMode: 'first-last',
      generateAudio: true,
      nativeModelId: 'bytedance/seedance-2.0',
      operationId: 'firstLastFrameToVideo',
      productModelId: 'talelabs/seedance-2.0',
      providerTag: input.providerTags.seedance,
      settingIds: VIDEO_AUDIO_SETTING_IDS,
      streamDelivery: input.streamDelivery,
    }),
    videoRoute({
      ...common,
      frameMode: 'none',
      generateAudio: true,
      nativeModelId: 'bytedance/seedance-2.0',
      operationId: 'referencesToVideo',
      productModelId: 'talelabs/seedance-2.0',
      providerTag: input.providerTags.seedance,
      referenceLimits: { audio: 3, image: 9, video: 3 },
      referenceValidationPolicy: 'seedance-2-reference-v1',
      settingIds: VIDEO_AUDIO_SETTING_IDS,
      streamDelivery: input.streamDelivery,
    }),
  ]
}
