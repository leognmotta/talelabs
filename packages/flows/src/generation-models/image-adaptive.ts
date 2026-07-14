import type {
  GenerationInputSlotDefinition,
  GenerationModelLogoId,
  GenerationSettingDefinition,
  HardenedGenerationModelDefinition,
} from '../generation-registry-types.js'
import {
  configurableOutput,
  fixedOutput,
  PROMPT_INPUT,
  referenceLimit,
} from './common.js'

const IMAGE_MEDIA = {
  maxBytes: 50 * 1024 * 1024,
  mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
} as const

function imageReferencesInput(maxItems: number): GenerationInputSlotDefinition {
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

function enumSetting(
  id: 'aspectRatio' | 'resolution',
  values: readonly string[],
  defaultValue = values[0]!,
): GenerationSettingDefinition {
  return {
    default: defaultValue,
    id,
    kind: 'enum',
    labelKey: `flows.settings.${id}`,
    options: values.map(value => ({
      labelKey:
        id === 'resolution'
          ? `flows.settings.resolutions.${value.toLowerCase()}`
          : value === '1:1'
            ? 'flows.settings.aspectRatios.square'
            : 'flows.settings.aspectRatio',
      value,
    })),
  }
}

function outputCountSetting(max: number): GenerationSettingDefinition {
  return {
    default: 1,
    id: 'outputCount',
    kind: 'number',
    labelKey: 'flows.settings.outputCount',
    max,
    min: 1,
    step: 1,
  }
}

const QUALITY_SETTING = {
  default: 'auto',
  id: 'quality',
  kind: 'enum',
  labelKey: 'flows.settings.quality',
  options: ['auto', 'low', 'medium', 'high'].map(value => ({
    labelKey: `flows.settings.qualities.${value}`,
    value,
  })),
} as const satisfies GenerationSettingDefinition

const BACKGROUND_SETTING = {
  advanced: true,
  default: 'auto',
  id: 'background',
  kind: 'enum',
  labelKey: 'flows.settings.background',
  options: ['auto', 'opaque'].map(value => ({
    labelKey: `flows.settings.backgrounds.${value}`,
    value,
  })),
} as const satisfies GenerationSettingDefinition

const OUTPUT_FORMAT_SETTING = {
  advanced: true,
  default: 'png',
  id: 'outputFormat',
  kind: 'enum',
  labelKey: 'flows.settings.outputFormat',
  options: ['png', 'jpeg'].map(value => ({
    labelKey: `flows.settings.outputFormats.${value}`,
    value,
  })),
} as const satisfies GenerationSettingDefinition

function imageModel(input: {
  descriptionKey: string
  displayName: string
  id: string
  labelKey: string
  logoId: GenerationModelLogoId
  maxReferences: number | null
  recommended?: boolean
  settings: readonly GenerationSettingDefinition[]
}): HardenedGenerationModelDefinition {
  const outputCount = input.settings.find(
    setting => setting.id === 'outputCount',
  )
  const output
    = outputCount?.kind === 'number'
      ? configurableOutput('image', outputCount.max)
      : fixedOutput('image')
  const inputSlots
    = input.maxReferences === null
      ? [PROMPT_INPUT]
      : [PROMPT_INPUT, imageReferencesInput(input.maxReferences)]
  const settingIds = input.settings.map(setting => setting.id)

  return {
    capabilitySchemaVersion: 2,
    constraints: [],
    defaultOperationId: 'textToImage',
    displayName: input.displayName,
    enabled: true,
    id: input.id,
    inputSlots,
    labelKey: input.labelKey,
    mediaType: 'image',
    operations: [
      {
        descriptionKey: 'flows.operations.textToImageDescription',
        id: 'textToImage',
        inputs: { prompt: { required: true } },
        inputSlotIds: ['prompt'],
        labelKey: 'flows.operations.textToImage',
        output,
        referenceLimit: referenceLimit(0),
        settingIds,
      },
      ...(input.maxReferences === null
        ? []
        : [
            {
              descriptionKey: 'flows.operations.imageToImageDescription',
              id: 'imageToImage',
              inputs: {
                imageReferences: { required: true },
                prompt: { required: true },
              },
              inputSlotIds: ['prompt', 'imageReferences'],
              labelKey: 'flows.operations.imageToImage',
              output,
              referenceLimit: referenceLimit(
                input.maxReferences,
                'imageReferences',
              ),
              settingIds,
            },
          ]),
    ],
    presentation: {
      descriptionKey: input.descriptionKey,
      logoId: input.logoId,
    },
    recommended: input.recommended ?? false,
    settings: input.settings,
  }
}

const GEMINI_ASPECT_RATIOS = [
  '1:1',
  '1:4',
  '1:8',
  '2:3',
  '3:2',
  '3:4',
  '4:1',
  '4:3',
  '4:5',
  '5:4',
  '8:1',
  '9:16',
  '16:9',
  '21:9',
] as const

const GEMINI_PRO_ASPECT_RATIOS = [
  '1:1',
  '2:3',
  '3:2',
  '3:4',
  '4:3',
  '4:5',
  '5:4',
  '9:16',
  '16:9',
  '21:9',
] as const

const SEEDREAM_ASPECT_RATIOS = [
  '1:1',
  '1:2',
  '2:1',
  '2:3',
  '3:2',
  '3:4',
  '4:3',
  '4:5',
  '5:4',
  '9:16',
  '16:9',
  '9:19.5',
  '19.5:9',
  '9:20',
  '20:9',
  '9:21',
  '21:9',
] as const

export const NANO_BANANA_2_LITE_MODEL = imageModel({
  descriptionKey: 'flows.modelDescriptions.nanoBanana2Lite',
  displayName: 'Nano Banana 2 Lite',
  id: 'talelabs/nano-banana-2-lite',
  labelKey: 'flows.models.nanoBanana2Lite',
  logoId: 'google',
  maxReferences: 14,
  settings: [enumSetting('aspectRatio', GEMINI_ASPECT_RATIOS, '1:1')],
})

export const NANO_BANANA_2_MODEL = imageModel({
  descriptionKey: 'flows.modelDescriptions.nanoBanana2',
  displayName: 'Nano Banana 2',
  id: 'talelabs/nano-banana-2',
  labelKey: 'flows.models.nanoBanana2',
  logoId: 'google',
  maxReferences: 14,
  recommended: true,
  settings: [
    enumSetting('aspectRatio', GEMINI_ASPECT_RATIOS, '1:1'),
    enumSetting('resolution', ['512', '1K', '2K', '4K'], '1K'),
  ],
})

export const NANO_BANANA_PRO_MODEL = imageModel({
  descriptionKey: 'flows.modelDescriptions.nanoBananaPro',
  displayName: 'Nano Banana Pro',
  id: 'talelabs/nano-banana-pro',
  labelKey: 'flows.models.nanoBananaPro',
  logoId: 'google',
  maxReferences: 14,
  settings: [
    enumSetting('aspectRatio', GEMINI_PRO_ASPECT_RATIOS, '1:1'),
    enumSetting('resolution', ['1K', '2K'], '1K'),
  ],
})

export const ADAPTIVE_GPT_IMAGE_2_MODEL = imageModel({
  descriptionKey: 'flows.modelDescriptions.gptImage2',
  displayName: 'GPT Image 2',
  id: 'talelabs/gpt-image-2',
  labelKey: 'flows.models.gptImage2',
  logoId: 'openai',
  maxReferences: 16,
  settings: [QUALITY_SETTING, outputCountSetting(10), BACKGROUND_SETTING],
})

export const SEEDREAM_45_MODEL = imageModel({
  descriptionKey: 'flows.modelDescriptions.seedream45',
  displayName: 'Seedream 4.5',
  id: 'talelabs/seedream-4.5',
  labelKey: 'flows.models.seedream45',
  logoId: 'bytedance',
  maxReferences: 14,
  settings: [
    enumSetting('aspectRatio', SEEDREAM_ASPECT_RATIOS, '1:1'),
    enumSetting('resolution', ['1K', '2K', '4K'], '1K'),
    outputCountSetting(10),
  ],
})

export const FLUX_2_PRO_MODEL = imageModel({
  descriptionKey: 'flows.modelDescriptions.flux2Pro',
  displayName: 'FLUX.2 Pro',
  id: 'talelabs/flux-2-pro',
  labelKey: 'flows.models.flux2Pro',
  logoId: 'flux',
  maxReferences: 8,
  settings: [OUTPUT_FORMAT_SETTING],
})

export const RECRAFT_41_MODEL = imageModel({
  descriptionKey: 'flows.modelDescriptions.recraft41',
  displayName: 'Recraft 4.1',
  id: 'talelabs/recraft-4.1',
  labelKey: 'flows.models.recraft41',
  logoId: 'recraft',
  maxReferences: null,
  settings: [outputCountSetting(6)],
})
