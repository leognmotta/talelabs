import type { HardenedGenerationModelDefinition } from '../types.js'

const MEBIBYTE = 1024 * 1024
const SEEDANCE_IMAGE_MEDIA = {
  maxBytes: 30 * MEBIBYTE,
  mimeTypes: [
    'image/bmp',
    'image/gif',
    'image/heic',
    'image/heif',
    'image/jpeg',
    'image/png',
    'image/tiff',
    'image/webp',
  ],
} as const
const SEEDANCE_VIDEO_MEDIA = {
  durationSeconds: { max: 15, min: 2 },
  maxBytes: 200 * MEBIBYTE,
  mimeTypes: ['video/mp4', 'video/quicktime'],
} as const
const SEEDANCE_AUDIO_MEDIA = {
  durationSeconds: { max: 15, min: 2 },
  maxBytes: 15 * MEBIBYTE,
  mimeTypes: ['audio/mpeg', 'audio/wav', 'audio/x-wav'],
} as const
const SEEDANCE_ASPECT_RATIOS = [
  { labelKey: 'flows.settings.aspectRatios.square', value: '1:1' },
  { labelKey: 'flows.settings.aspectRatios.portraitPhoto', value: '3:4' },
  { labelKey: 'flows.settings.aspectRatios.portrait', value: '9:16' },
  { labelKey: 'flows.settings.aspectRatios.photo', value: '4:3' },
  { labelKey: 'flows.settings.aspectRatios.landscape', value: '16:9' },
  { labelKey: 'flows.settings.aspectRatios.ultrawide', value: '21:9' },
  { labelKey: 'flows.settings.aspectRatios.portrait', value: '9:21' },
] as const
const SEEDANCE_DURATIONS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]

export function withMp3SpeechOutput(
  model: HardenedGenerationModelDefinition,
): HardenedGenerationModelDefinition {
  return {
    ...model,
    settings: model.settings.map(setting =>
      setting.id === 'outputFormat' && setting.kind === 'enum'
        ? {
            ...setting,
            default: 'mp3',
            options: setting.options.filter(option => option.value === 'mp3'),
          }
        : setting,
    ),
  }
}

export function withReviewedSeedanceLimits(
  model: HardenedGenerationModelDefinition,
): HardenedGenerationModelDefinition {
  return {
    ...model,
    inputSlots: model.inputSlots.map((slot) => {
      if (slot.id === 'firstFrame' || slot.id === 'lastFrame')
        return { ...slot, acceptedMedia: SEEDANCE_IMAGE_MEDIA }
      if (slot.id === 'imageReferences') {
        return {
          ...slot,
          acceptedMedia: SEEDANCE_IMAGE_MEDIA,
          maxConnections: 9,
          maxItems: 9,
        }
      }
      if (slot.id === 'videoReferences') {
        return {
          ...slot,
          acceptedMedia: SEEDANCE_VIDEO_MEDIA,
          maxConnections: 3,
          maxItems: 3,
        }
      }
      if (slot.id === 'audioReferences') {
        return {
          ...slot,
          acceptedMedia: SEEDANCE_AUDIO_MEDIA,
          maxConnections: 3,
          maxItems: 3,
        }
      }
      return slot
    }),
    operations: model.operations.map(operation =>
      operation.id === 'referencesToVideo'
        ? {
            ...operation,
            inputs: {
              prompt: { required: true },
              visualReference: {
                atLeastOne: ['imageReferences', 'videoReferences'],
              },
            },
            referenceLimit: {
              maxItems: 15,
              slotIds: ['imageReferences', 'videoReferences', 'audioReferences'],
            },
          }
        : operation,
    ),
    settings: model.settings.map((setting) => {
      if (setting.id === 'aspectRatio' && setting.kind === 'enum')
        return { ...setting, options: SEEDANCE_ASPECT_RATIOS }
      if (setting.id === 'durationSeconds' && setting.kind === 'enum') {
        return {
          ...setting,
          options: SEEDANCE_DURATIONS.map(value => ({
            labelKey: `flows.settings.durations.seconds${value}`,
            value: String(value),
          })),
        }
      }
      return setting
    }),
  }
}

export function withReviewedSeedreamOutputSizes(
  model: HardenedGenerationModelDefinition,
): HardenedGenerationModelDefinition {
  return {
    ...model,
    settings: model.settings.map((setting) => {
      if (setting.id === 'aspectRatio' && setting.kind === 'enum') {
        return {
          ...setting,
          options: setting.options.filter(option => option.value !== 'auto'),
        }
      }
      if (setting.id === 'resolution' && setting.kind === 'enum') {
        return {
          ...setting,
          default: '2K',
          options: setting.options.filter(option => option.value !== '1K'),
        }
      }
      return setting
    }),
  }
}
