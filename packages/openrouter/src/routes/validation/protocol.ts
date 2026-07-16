import type { GenerationProviderRoute } from '../contracts.js'

import {
  ASYNC_VIDEO_LIFECYCLE,
  ASYNC_VIDEO_STREAM_LIFECYCLE,
  IMMEDIATE_BYTES_LIFECYCLE,
  IMMEDIATE_TEXT_LIFECYCLE,
  LEGACY_OPENROUTER_MEDIA_ADAPTER_VERSION,
  OPENROUTER_CHAT_ADAPTER_VERSION,
  OPENROUTER_IMAGE_ADAPTER_VERSION,
  OPENROUTER_SPEECH_ADAPTER_VERSION,
  OPENROUTER_VIDEO_ADAPTER_VERSION,
} from '../contracts.js'

const ADAPTER_PROTOCOLS = {
  [OPENROUTER_CHAT_ADAPTER_VERSION]: {
    endpoint: '/api/v1/chat/completions',
    kind: 'chat',
    lifecycles: [IMMEDIATE_TEXT_LIFECYCLE],
    outputType: 'text',
  },
  [OPENROUTER_IMAGE_ADAPTER_VERSION]: {
    endpoint: '/api/v1/images',
    kind: 'image',
    lifecycles: [IMMEDIATE_BYTES_LIFECYCLE],
    outputType: 'image',
  },
  [OPENROUTER_SPEECH_ADAPTER_VERSION]: {
    endpoint: '/api/v1/audio/speech',
    kind: 'speech',
    lifecycles: [IMMEDIATE_BYTES_LIFECYCLE],
    outputType: 'audio',
  },
  [OPENROUTER_VIDEO_ADAPTER_VERSION]: {
    endpoint: '/api/v1/videos',
    kind: 'video',
    lifecycles: [ASYNC_VIDEO_LIFECYCLE, ASYNC_VIDEO_STREAM_LIFECYCLE],
    outputType: 'video',
  },
} as const

export function protocolForGenerationProviderRoute(
  route: GenerationProviderRoute,
) {
  if (route.adapterVersion !== LEGACY_OPENROUTER_MEDIA_ADAPTER_VERSION)
    return ADAPTER_PROTOCOLS[route.adapterVersion]
  return route.requestProfile.kind === 'image'
    ? ADAPTER_PROTOCOLS[OPENROUTER_IMAGE_ADAPTER_VERSION]
    : route.requestProfile.kind === 'video'
      ? ADAPTER_PROTOCOLS[OPENROUTER_VIDEO_ADAPTER_VERSION]
      : undefined
}

export function requestProfileReferenceMaximum(
  route: GenerationProviderRoute,
) {
  const profile = route.requestProfile
  if (profile.kind === 'image')
    return profile.maxReferences
  if (profile.kind === 'chat')
    return profile.maxImageReferences
  if (profile.kind !== 'video')
    return 0
  if (profile.frameMode === 'first')
    return 1
  if (profile.frameMode === 'first-last')
    return 2
  return Object.values(profile.referenceLimits).reduce(
    (total, maximum) => total + maximum,
    0,
  )
}
