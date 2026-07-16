import type {
  GenerationSettingDefinition,
  HardenedGenerationModelDefinition,
} from '../registry/types.js'
import { imageModel } from './image-adaptive.js'

function enumSetting(input: {
  advanced?: boolean
  defaultValue: string
  id: 'aspectRatio' | 'outputFormat' | 'resolution'
  values: readonly string[]
}): GenerationSettingDefinition {
  return {
    advanced: input.advanced,
    default: input.defaultValue,
    id: input.id,
    kind: 'enum',
    labelKey: `flows.settings.${input.id}`,
    options: input.values.map(value => ({
      labelKey:
        input.id === 'resolution'
          ? `flows.settings.resolutions.${value.toLowerCase()}`
          : input.id === 'outputFormat'
            ? `flows.settings.outputFormats.${value}`
            : value === '1:1'
              ? 'flows.settings.aspectRatios.square'
              : value === '16:9'
                ? 'flows.settings.aspectRatios.landscape'
                : value === '9:16'
                  ? 'flows.settings.aspectRatios.portrait'
                  : value === '21:9'
                    ? 'flows.settings.aspectRatios.ultrawide'
                    : 'flows.settings.aspectRatio',
      value,
    })),
  }
}

export const OPENROUTER_MAJOR_IMAGE_MODELS = [
  imageModel({
    descriptionKey: 'flows.modelDescriptions.gptImage2',
    displayName: 'GPT-5.4 Image 2',
    id: 'talelabs/gpt-5.4-image-2',
    labelKey: 'flows.models.gpt54Image2',
    logoId: 'openai',
    maxReferences: 16,
    settings: [
      {
        default: 'auto',
        id: 'quality',
        kind: 'enum',
        labelKey: 'flows.settings.quality',
        options: ['auto', 'low', 'medium', 'high'].map(value => ({
          labelKey: `flows.settings.qualities.${value}`,
          value,
        })),
      },
      {
        advanced: true,
        default: 'auto',
        id: 'background',
        kind: 'enum',
        labelKey: 'flows.settings.background',
        options: ['auto', 'opaque'].map(value => ({
          labelKey: `flows.settings.backgrounds.${value}`,
          value,
        })),
      },
    ],
  }),
  imageModel({
    descriptionKey: 'flows.modelDescriptions.gptImage2',
    displayName: 'MAI Image 2.5',
    id: 'talelabs/mai-image-2.5',
    labelKey: 'flows.models.maiImage25',
    logoId: 'microsoft',
    maxReferences: 1,
    settings: [
      enumSetting({
        defaultValue: 'auto',
        id: 'aspectRatio',
        values: ['auto', '1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3'],
      }),
    ],
  }),
  imageModel({
    descriptionKey: 'flows.modelDescriptions.gptImage2',
    displayName: 'Grok Imagine Image Quality',
    id: 'talelabs/grok-imagine-image-quality',
    labelKey: 'flows.models.grokImagineImageQuality',
    logoId: 'xai',
    maxReferences: 3,
    settings: [
      enumSetting({
        defaultValue: 'auto',
        id: 'aspectRatio',
        values: [
          'auto',
          '1:1',
          '3:4',
          '4:3',
          '9:16',
          '16:9',
          '2:3',
          '3:2',
          '9:19.5',
          '19.5:9',
          '9:20',
          '20:9',
          '1:2',
          '2:1',
        ],
      }),
      enumSetting({
        defaultValue: '1K',
        id: 'resolution',
        values: ['1K', '2K'],
      }),
    ],
  }),
  imageModel({
    descriptionKey: 'flows.modelDescriptions.flux2Pro',
    displayName: 'FLUX.2 Max',
    id: 'talelabs/flux-2-max',
    labelKey: 'flows.models.flux2Max',
    logoId: 'flux',
    maxReferences: 8,
    settings: [
      enumSetting({
        advanced: true,
        defaultValue: 'png',
        id: 'outputFormat',
        values: ['png', 'jpeg'],
      }),
    ],
  }),
  imageModel({
    descriptionKey: 'flows.modelDescriptions.recraft41',
    displayName: 'Recraft 4.1 Pro',
    id: 'talelabs/recraft-4.1-pro',
    labelKey: 'flows.models.recraft41Pro',
    logoId: 'recraft',
    maxReferences: 1,
    settings: [],
  }),
] as const satisfies readonly HardenedGenerationModelDefinition[]
