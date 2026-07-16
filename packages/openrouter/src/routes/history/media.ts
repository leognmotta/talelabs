import type { GenerationModelContractVersion } from '@talelabs/flows'

import { imageRoute, videoRoute } from '../builders/media.js'
import { LEGACY_OPENROUTER_MEDIA_ADAPTER_VERSION } from '../contracts.js'

const VIDEO_AUDIO_SETTING_IDS = [
  'aspectRatio',
  'durationSeconds',
  'resolution',
  'generateAudio',
] as const

export function historicalMediaRoutes() {
  const versions = [
    '2026-07-15.9',
    '2026-07-15.10',
    '2026-07-15.11',
    '2026-07-15.12',
    '2026-07-15.13',
    '2026-07-15.14',
  ] as const satisfies readonly GenerationModelContractVersion[]
  const seedanceVersions = new Set<GenerationModelContractVersion>([
    '2026-07-15.11',
    '2026-07-15.12',
    '2026-07-15.13',
    '2026-07-15.14',
  ])
  const seedreamVersions = new Set<GenerationModelContractVersion>([
    '2026-07-15.13',
    '2026-07-15.14',
  ])
  return versions.flatMap(modelContractVersion => [
    imageRoute({
      adapterVersion: LEGACY_OPENROUTER_MEDIA_ADAPTER_VERSION,
      maxReferences: 0,
      modelContractVersion,
      nativeModelId: 'openai/gpt-image-2',
      operationId: 'textToImage',
      productModelId: 'talelabs/gpt-image-2',
      providerTag: 'openai',
      routeVersion: '2026-07-15.10',
      settingIds: ['quality', 'background'],
    }),
    imageRoute({
      adapterVersion: LEGACY_OPENROUTER_MEDIA_ADAPTER_VERSION,
      maxReferences: 16,
      modelContractVersion,
      nativeModelId: 'openai/gpt-image-2',
      operationId: 'imageToImage',
      productModelId: 'talelabs/gpt-image-2',
      providerTag: 'openai',
      routeVersion: '2026-07-15.10',
      settingIds: ['quality', 'background'],
    }),
    videoRoute({
      adapterVersion: LEGACY_OPENROUTER_MEDIA_ADAPTER_VERSION,
      frameMode: 'none',
      generateAudio: true,
      modelContractVersion,
      nativeModelId: 'google/veo-3.1-lite',
      providerTag: 'google',
      operationId: 'textToVideo',
      productModelId: 'talelabs/veo-3.1-lite',
      routeVersion: '2026-07-15.10',
      settingIds: VIDEO_AUDIO_SETTING_IDS,
    }),
    videoRoute({
      adapterVersion: LEGACY_OPENROUTER_MEDIA_ADAPTER_VERSION,
      frameMode: 'first-last',
      generateAudio: true,
      modelContractVersion,
      nativeModelId: 'google/veo-3.1-lite',
      providerTag: 'google',
      operationId: 'firstLastFrameToVideo',
      productModelId: 'talelabs/veo-3.1-lite',
      routeVersion: '2026-07-15.10',
      settingIds: VIDEO_AUDIO_SETTING_IDS,
    }),
    ...(seedanceVersions.has(modelContractVersion)
      ? [
          videoRoute({
            adapterVersion: LEGACY_OPENROUTER_MEDIA_ADAPTER_VERSION,
            frameMode: 'none',
            generateAudio: true,
            modelContractVersion,
            nativeModelId: 'bytedance/seedance-2.0',
            providerTag: 'bytedance',
            operationId: 'textToVideo',
            productModelId: 'talelabs/seedance-2.0',
            routeVersion: '2026-07-15.11',
            settingIds: VIDEO_AUDIO_SETTING_IDS,
          }),
          videoRoute({
            adapterVersion: LEGACY_OPENROUTER_MEDIA_ADAPTER_VERSION,
            frameMode: 'first-last',
            generateAudio: true,
            modelContractVersion,
            nativeModelId: 'bytedance/seedance-2.0',
            providerTag: 'bytedance',
            operationId: 'firstLastFrameToVideo',
            productModelId: 'talelabs/seedance-2.0',
            routeVersion: '2026-07-15.11',
            settingIds: VIDEO_AUDIO_SETTING_IDS,
          }),
          videoRoute({
            adapterVersion: LEGACY_OPENROUTER_MEDIA_ADAPTER_VERSION,
            frameMode: 'none',
            generateAudio: true,
            modelContractVersion,
            nativeModelId: 'bytedance/seedance-2.0',
            providerTag: 'bytedance',
            operationId: 'referencesToVideo',
            productModelId: 'talelabs/seedance-2.0',
            referenceValidationPolicy: 'seedance-2-reference-v1',
            referenceLimits: modelContractVersion === '2026-07-15.11'
              ? { audio: 1, image: 1, video: 1 }
              : { audio: 3, image: 9, video: 3 },
            routeVersion: '2026-07-15.11',
            settingIds: VIDEO_AUDIO_SETTING_IDS,
          }),
        ]
      : []),
    ...(seedreamVersions.has(modelContractVersion)
      ? [
          imageRoute({
            adapterVersion: LEGACY_OPENROUTER_MEDIA_ADAPTER_VERSION,
            maxReferences: 0,
            modelContractVersion,
            nativeModelId: 'bytedance-seed/seedream-4.5',
            operationId: 'textToImage',
            productModelId: 'talelabs/seedream-4.5',
            providerTag: 'seed',
            routeVersion: modelContractVersion,
            settingIds: ['aspectRatio', 'resolution'],
          }),
          imageRoute({
            adapterVersion: LEGACY_OPENROUTER_MEDIA_ADAPTER_VERSION,
            maxReferences: 14,
            modelContractVersion,
            nativeModelId: 'bytedance-seed/seedream-4.5',
            operationId: 'imageToImage',
            productModelId: 'talelabs/seedream-4.5',
            providerTag: 'seed',
            routeVersion: modelContractVersion,
            settingIds: ['aspectRatio', 'resolution'],
          }),
        ]
      : []),
  ])
}
