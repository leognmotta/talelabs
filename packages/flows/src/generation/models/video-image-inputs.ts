import type { GenerationInputSlotDefinition } from '../registry/types.js'

const IMAGE_MEDIA = {
  maxBytes: 20 * 1024 * 1024,
  mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
} as const

export function frameInput(
  id: 'firstFrame' | 'lastFrame',
): GenerationInputSlotDefinition {
  return {
    accepts: ['ImageSet'],
    acceptedMedia: IMAGE_MEDIA,
    descriptionKey: `flows.inputs.${id}Description`,
    id,
    labelKey: `flows.inputs.${id}`,
    maxConnections: 1,
    maxItems: 1,
    minConnections: 0,
    referenceProfile: {
      contactSheetPolicy: 'not-applicable',
      multipleSubjectSupport: 'not-applicable',
      purposes: [id],
    },
  }
}

export function imageReferencesInput(maxItems: number): GenerationInputSlotDefinition {
  return {
    accepts: ['ImageSet'],
    acceptedMedia: IMAGE_MEDIA,
    descriptionKey: 'flows.inputs.imageReferencesDescription',
    id: 'imageReferences',
    labelKey: 'flows.inputs.imageReferences',
    maxConnections: maxItems,
    maxItems,
    minConnections: 0,
    referenceProfile: {
      contactSheetPolicy: 'never',
      multipleSubjectSupport: 'unknown',
      purposes: ['composition', 'identity', 'style', 'subject'],
    },
  }
}
