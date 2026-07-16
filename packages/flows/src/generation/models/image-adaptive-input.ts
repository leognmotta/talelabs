import type { GenerationInputSlotDefinition } from '../registry/types.js'

const IMAGE_MEDIA = {
  maxBytes: 50 * 1024 * 1024,
  mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
} as const

export function imageReferencesInput(
  maxItems: number,
): GenerationInputSlotDefinition {
  return {
    accepts: ['ImageSet'],
    acceptedMedia: IMAGE_MEDIA,
    descriptionKey: 'flows.inputs.imageReferencesDescription',
    id: 'imageReferences',
    labelKey: 'flows.inputs.imageReferences',
    maxConnections: 32,
    maxItems,
    minConnections: 0,
    referenceProfile: {
      contactSheetPolicy: 'never',
      multipleSubjectSupport: 'supported',
      purposes: ['composition', 'identity', 'style', 'subject'],
    },
  }
}
