import type {
  GenerationInputSlotDefinition,
  GenerationSettingDefinition,
  HardenedGenerationModelDefinition,
  LlmReasoningCapability,
} from '../registry/types.js'
import { fixedOutput, referenceLimit } from './common.js'

const INSTRUCTIONS_INPUT = {
  accepts: ['Text'],
  descriptionKey: 'flows.inputs.instructionsDescription',
  id: 'instructions',
  labelKey: 'flows.inputs.instructions',
  maxConnections: 1,
  maxItems: 1,
  minConnections: 0,
} as const satisfies GenerationInputSlotDefinition

const PROMPT_INPUT = {
  accepts: ['Text'],
  descriptionKey: 'flows.inputs.promptDescription',
  id: 'prompt',
  labelKey: 'flows.inputs.prompt',
  maxConnections: 1,
  maxItems: 1,
  minConnections: 0,
} as const satisfies GenerationInputSlotDefinition

const IMAGE_REFERENCES_INPUT = {
  acceptedMedia: {
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  },
  accepts: ['ImageSet'],
  descriptionKey: 'flows.inputs.llmImageReferencesDescription',
  id: 'imageReferences',
  labelKey: 'flows.inputs.imageReferences',
  maxConnections: 1,
  maxItems: 8,
  minConnections: 0,
  referenceProfile: {
    contactSheetPolicy: 'never',
    multipleSubjectSupport: 'supported',
    purposes: ['composition', 'identity', 'style', 'subject'],
  },
} as const satisfies GenerationInputSlotDefinition

const RESPONSE_LENGTH = {
  default: 'auto',
  descriptionKey: 'flows.settings.responseLengthDescription',
  id: 'responseLength',
  kind: 'enum',
  labelKey: 'flows.settings.responseLength',
  options: [
    { labelKey: 'flows.settings.responseLengths.auto', value: 'auto' },
    { labelKey: 'flows.settings.responseLengths.short', value: 'short' },
    { labelKey: 'flows.settings.responseLengths.medium', value: 'medium' },
    { labelKey: 'flows.settings.responseLengths.long', value: 'long' },
  ],
} as const satisfies GenerationSettingDefinition

const REASONING_LABELS = {
  auto: 'flows.settings.reasoningModes.auto',
  high: 'flows.settings.reasoningModes.high',
  low: 'flows.settings.reasoningModes.low',
  max: 'flows.settings.reasoningModes.max',
  medium: 'flows.settings.reasoningModes.medium',
  minimal: 'flows.settings.reasoningModes.minimal',
  off: 'flows.settings.reasoningModes.off',
  xhigh: 'flows.settings.reasoningModes.xhigh',
} as const

function reasoningSetting(
  capability: LlmReasoningCapability,
): GenerationSettingDefinition {
  return {
    default: capability.default,
    descriptionKey: capability.mandatory
      ? 'flows.settings.reasoningMandatoryDescription'
      : 'flows.settings.reasoningDescription',
    id: 'reasoningMode',
    kind: 'enum',
    labelKey: 'flows.settings.reasoning',
    options: capability.options.map(value => ({
      labelKey: REASONING_LABELS[value],
      value,
    })),
  }
}

const TEXT_TO_TEXT_OPERATION = {
  descriptionKey: 'flows.operations.textToTextDescription',
  id: 'textToText',
  inputs: { prompt: { required: true } },
  inputSlotIds: ['instructions', 'prompt'],
  labelKey: 'flows.operations.textToText',
  output: fixedOutput('text'),
  referenceLimit: referenceLimit(0),
} as const

const VISION_TO_TEXT_OPERATION = {
  descriptionKey: 'flows.operations.visionToTextDescription',
  id: 'visionToText',
  inputs: { prompt: { required: true } },
  inputSlotIds: ['instructions', 'prompt', 'imageReferences'],
  labelKey: 'flows.operations.visionToText',
  output: fixedOutput('text'),
  referenceLimit: referenceLimit(8, 'imageReferences'),
} as const

export function createLlmModel(input: {
  descriptionKey?: string
  displayName: string
  id: string
  labelKey: string
  reasoning?: LlmReasoningCapability
  recommended?: boolean
  vision: boolean
}): HardenedGenerationModelDefinition {
  const settings = input.reasoning
    ? [RESPONSE_LENGTH, reasoningSetting(input.reasoning)]
    : [RESPONSE_LENGTH]
  const settingIds = settings.map(setting => setting.id)
  return {
    capabilitySchemaVersion: 2,
    constraints: [],
    defaultOperationId: 'textToText',
    displayName: input.displayName,
    enabled: true,
    id: input.id,
    inputSlots: input.vision
      ? [INSTRUCTIONS_INPUT, PROMPT_INPUT, IMAGE_REFERENCES_INPUT]
      : [INSTRUCTIONS_INPUT, PROMPT_INPUT],
    labelKey: input.labelKey,
    llm: input.reasoning ? { reasoning: input.reasoning } : {},
    mediaType: 'text',
    operations: input.vision
      ? [
          { ...TEXT_TO_TEXT_OPERATION, settingIds },
          { ...VISION_TO_TEXT_OPERATION, settingIds },
        ]
      : [{ ...TEXT_TO_TEXT_OPERATION, settingIds }],
    presentation: {
      descriptionKey: input.descriptionKey ?? input.labelKey.replace(
        'flows.models.',
        'flows.modelDescriptions.',
      ),
      logoId: 'llm',
    },
    recommended: input.recommended ?? false,
    settings,
  }
}

export const GEMINI_31_FLASH_LITE_MODEL = createLlmModel({
  displayName: 'Gemini 3.1 Flash Lite',
  id: 'talelabs/gemini-3.1-flash-lite',
  labelKey: 'flows.models.gemini31FlashLite',
  reasoning: {
    default: 'minimal',
    mandatory: false,
    options: ['off', 'auto', 'minimal', 'low', 'medium', 'high'],
  },
  recommended: true,
  vision: true,
})

export const CLAUDE_SONNET_46_MODEL = createLlmModel({
  displayName: 'Claude Sonnet 4.6',
  id: 'talelabs/claude-sonnet-4.6',
  labelKey: 'flows.models.claudeSonnet46',
  reasoning: {
    default: 'medium',
    mandatory: false,
    options: ['off', 'auto', 'low', 'medium', 'high', 'max'],
  },
  vision: true,
})

export const GPT_54_MODEL = createLlmModel({
  displayName: 'GPT-5.4',
  id: 'talelabs/gpt-5.4',
  labelKey: 'flows.models.gpt54',
  reasoning: {
    default: 'off',
    mandatory: false,
    options: ['off', 'auto', 'low', 'medium', 'high', 'xhigh'],
  },
  vision: true,
})

export const GEMINI_31_PRO_MODEL = createLlmModel({
  displayName: 'Gemini 3.1 Pro',
  id: 'talelabs/gemini-3.1-pro',
  labelKey: 'flows.models.gemini31Pro',
  reasoning: {
    default: 'medium',
    mandatory: true,
    options: ['auto', 'low', 'medium', 'high'],
  },
  vision: true,
})

export const DEEPSEEK_V32_MODEL = createLlmModel({
  displayName: 'DeepSeek V3.2',
  id: 'talelabs/deepseek-v3.2',
  labelKey: 'flows.models.deepseekV32',
  reasoning: {
    default: 'off',
    mandatory: false,
    options: ['off', 'auto'],
  },
  vision: false,
})

export const MISTRAL_LARGE_3_MODEL = createLlmModel({
  displayName: 'Mistral Large 3',
  id: 'talelabs/mistral-large-3',
  labelKey: 'flows.models.mistralLarge3',
  vision: true,
})
