import type { GenerationInputSlotDefinition } from '../registry/types.js'

const VIDEO_MEDIA = {
  durationSeconds: { max: 30, min: 1 },
  maxBytes: 100 * 1024 * 1024,
  mimeTypes: ['video/mp4', 'video/quicktime'],
} as const

const AUDIO_MEDIA = {
  durationSeconds: { max: 30, min: 1 },
  maxBytes: 32 * 1024 * 1024,
  mimeTypes: ['audio/aac', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav'],
} as const

export function videoReferencesInput(maxItems = 1): GenerationInputSlotDefinition {
  return {
    accepts: ['VideoSet'],
    acceptedMedia: VIDEO_MEDIA,
    descriptionKey: 'flows.inputs.videoReferencesDescription',
    id: 'videoReferences',
    labelKey: 'flows.inputs.videoReferences',
    maxConnections: maxItems,
    maxItems,
    minConnections: 0,
    referenceProfile: {
      contactSheetPolicy: 'not-applicable',
      multipleSubjectSupport: 'not-applicable',
      purposes: ['motion', 'videoExtension'],
    },
  }
}

export function audioReferencesInput(maxItems = 1): GenerationInputSlotDefinition {
  return {
    accepts: ['AudioSet'],
    acceptedMedia: AUDIO_MEDIA,
    descriptionKey: 'flows.inputs.audioReferencesDescription',
    id: 'audioReferences',
    labelKey: 'flows.inputs.audioReferences',
    maxConnections: maxItems,
    maxItems,
    minConnections: 0,
    referenceProfile: {
      contactSheetPolicy: 'not-applicable',
      multipleSubjectSupport: 'not-applicable',
      purposes: ['audioGuidance'],
    },
  }
}
