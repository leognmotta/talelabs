import type { GenerationModelContractVersion } from '@talelabs/flows'

import { videoRoute } from '../builders/media.js'

const VIDEO_SETTING_IDS = [
  'aspectRatio',
  'durationSeconds',
  'resolution',
] as const
const VIDEO_AUDIO_SETTING_IDS = [...VIDEO_SETTING_IDS, 'generateAudio'] as const

export function majorVideoRoutes(input: {
  modelContractVersion: GenerationModelContractVersion
  routeVersion: string
  streamDelivery?: boolean
}) {
  const definitions = [
    {
      audio: true,
      frameMode: 'first-last',
      nativeModelId: 'kwaivgi/kling-v3.0-pro',
      productModelId: 'talelabs/kling-3.0-pro',
      providerTag: 'atlas-cloud',
    },
    {
      audio: true,
      frameMode: 'first-last',
      nativeModelId: 'kwaivgi/kling-v3.0-std',
      productModelId: 'talelabs/kling-3.0-standard',
      providerTag: 'atlas-cloud',
    },
    {
      audio: true,
      frameMode: 'first-last',
      nativeModelId: 'kwaivgi/kling-video-o1',
      productModelId: 'talelabs/kling-video-o1',
      providerTag: 'atlas-cloud',
    },
    {
      audio: true,
      frameMode: 'first-last',
      nativeModelId: 'alibaba/wan-2.7',
      productModelId: 'talelabs/wan-2.7',
      providerTag: 'atlas-cloud',
    },
    {
      audio: true,
      frameMode: 'first',
      nativeModelId: 'alibaba/wan-2.6',
      productModelId: 'talelabs/wan-2.6',
      providerTag: 'atlas-cloud',
    },
    {
      audio: false,
      frameMode: 'first',
      nativeModelId: 'minimax/hailuo-2.3',
      productModelId: 'talelabs/hailuo-2.3',
      providerTag: 'minimax',
    },
    {
      audio: true,
      frameMode: 'none',
      nativeModelId: 'openai/sora-2-pro',
      productModelId: 'talelabs/sora-2-pro',
      providerTag: 'openai',
    },
    {
      audio: true,
      frameMode: 'first-last',
      nativeModelId: 'google/veo-3.1-fast',
      productModelId: 'talelabs/veo-3.1-fast',
      providerTag: 'google-vertex',
    },
    {
      audio: true,
      frameMode: 'first-last',
      nativeModelId: 'bytedance/seedance-2.0-fast',
      productModelId: 'talelabs/seedance-2.0-fast',
      providerTag: 'seed',
    },
    {
      audio: false,
      frameMode: 'first',
      nativeModelId: 'alibaba/happyhorse-1.1',
      productModelId: 'talelabs/happyhorse-1.1',
      providerTag: 'alibaba',
    },
  ] as const
  return definitions.flatMap((definition) => {
    const settingIds = definition.audio
      ? VIDEO_AUDIO_SETTING_IDS
      : VIDEO_SETTING_IDS
    const frameOperationId = definition.frameMode === 'first-last'
      ? 'firstLastFrameToVideo'
      : 'imageToVideo'
    return [
      videoRoute({
        ...input,
        frameMode: 'none',
        generateAudio: definition.audio,
        nativeModelId: definition.nativeModelId,
        operationId: 'textToVideo',
        productModelId: definition.productModelId,
        providerTag: definition.providerTag,
        settingIds,
      }),
      ...(definition.frameMode === 'none'
        ? []
        : [videoRoute({
            ...input,
            frameMode: definition.frameMode,
            generateAudio: definition.audio,
            nativeModelId: definition.nativeModelId,
            operationId: frameOperationId,
            productModelId: definition.productModelId,
            providerTag: definition.providerTag,
            settingIds,
          })]),
    ]
  })
}
