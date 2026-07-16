import type {
  GenerationInputSlotDefinition,
  GenerationSettingDefinition,
  HardenedGenerationModelDefinition,
} from '../registry/types.js'
import {
  configurableOutput,
  CONTEXT_INPUT,
  IMAGE_ASPECT_RATIOS,
  PROMPT_INPUT,
  referenceLimit,
} from './common.js'

function imageReferences(maxItems: number): GenerationInputSlotDefinition {
  return {
    accepts: ['ImageSet'],
    acceptedMedia: {
      maxBytes: 50 * 1024 * 1024,
      mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    },
    descriptionKey: 'flows.inputs.referencesDescription',
    id: 'references',
    labelKey: 'flows.inputs.references',
    maxConnections: maxItems,
    maxItems,
    minConnections: 0,
    referenceProfile: {
      contactSheetPolicy: 'never',
      multipleSubjectSupport: 'supported',
      purposes: ['composition', 'identity', 'style', 'subject'],
    },
  }
}

function imageSettings(
  maxOutputs: number,
): readonly GenerationSettingDefinition[] {
  return [
    {
      default: '1:1',
      id: 'aspectRatio',
      kind: 'enum',
      labelKey: 'flows.settings.aspectRatio',
      options: IMAGE_ASPECT_RATIOS,
    },
    {
      default: 1,
      id: 'outputCount',
      kind: 'number',
      labelKey: 'flows.settings.outputCount',
      max: maxOutputs,
      min: 1,
      step: 1,
    },
    {
      default: 'auto',
      id: 'quality',
      kind: 'enum',
      labelKey: 'flows.settings.quality',
      options: [
        { labelKey: 'flows.settings.qualities.auto', value: 'auto' },
        { labelKey: 'flows.settings.qualities.low', value: 'low' },
        { labelKey: 'flows.settings.qualities.medium', value: 'medium' },
        { labelKey: 'flows.settings.qualities.high', value: 'high' },
      ],
    },
  ]
}

function imageModel(input: {
  displayName: string
  enabled: boolean
  id: string
  labelKey: string
  maxOutputs: number
  recommended: boolean
}): HardenedGenerationModelDefinition {
  const references = imageReferences(16)
  return {
    capabilitySchemaVersion: 2,
    constraints: [],
    defaultOperationId: 'textToImage',
    displayName: input.displayName,
    enabled: input.enabled,
    id: input.id,
    inputSlots: [PROMPT_INPUT, CONTEXT_INPUT, references],
    labelKey: input.labelKey,
    mediaType: 'image',
    operations: [
      {
        descriptionKey: 'flows.operations.textToImageDescription',
        id: 'textToImage',
        inputs: { prompt: { required: true } },
        inputSlotIds: ['prompt', 'context'],
        labelKey: 'flows.operations.textToImage',
        output: configurableOutput('image', input.maxOutputs),
        referenceLimit: referenceLimit(0),
        settingIds: ['aspectRatio', 'outputCount', 'quality'],
      },
      {
        descriptionKey: 'flows.operations.imageToImageDescription',
        id: 'imageToImage',
        inputs: {
          prompt: { required: true },
          references: { required: true },
        },
        inputSlotIds: ['prompt', 'context', 'references'],
        labelKey: 'flows.operations.imageToImage',
        output: configurableOutput('image', input.maxOutputs),
        referenceLimit: referenceLimit(16, 'references'),
        settingIds: ['aspectRatio', 'outputCount', 'quality'],
      },
    ],
    recommended: input.recommended,
    settings: imageSettings(input.maxOutputs),
  }
}

/** Retained for saved nodes, but unavailable for new selection after deprecation. */
export const GPT_IMAGE_15_MODEL = imageModel({
  displayName: 'GPT Image 1.5',
  enabled: false,
  id: 'talelabs/gpt-image-1.5',
  labelKey: 'flows.models.gptImage15',
  maxOutputs: 4,
  recommended: false,
})

export const GPT_IMAGE_2_MODEL = imageModel({
  displayName: 'GPT Image 2',
  enabled: true,
  id: 'talelabs/gpt-image-2',
  labelKey: 'flows.models.gptImage2',
  maxOutputs: 10,
  recommended: true,
})
