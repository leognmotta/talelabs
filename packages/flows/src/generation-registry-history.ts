import type {
  GenerationModelDefinition,
  HardenedGenerationModelDefinition,
} from './generation-registry-types.js'
import {
  ELEVEN_MULTILINGUAL_V2_MODEL,
  ELEVEN_SOUND_EFFECTS_V2_MODEL,
} from './generation-models/audio.js'
import {
  ADAPTIVE_GPT_IMAGE_2_MODEL,
  FLUX_2_PRO_MODEL,
  NANO_BANANA_2_LITE_MODEL,
  NANO_BANANA_2_MODEL,
  NANO_BANANA_PRO_MODEL,
  RECRAFT_41_MODEL,
  SEEDREAM_45_MODEL,
} from './generation-models/image-adaptive.js'
import {
  GPT_IMAGE_2_MODEL,
  GPT_IMAGE_15_MODEL,
} from './generation-models/image.js'
import {
  CLAUDE_SONNET_46_MODEL,
  DEEPSEEK_V32_MODEL,
  GEMINI_31_FLASH_LITE_MODEL,
  GEMINI_31_PRO_MODEL,
  GPT_54_MODEL,
  MISTRAL_LARGE_3_MODEL,
} from './generation-models/llm.js'
import {
  ADAPTIVE_LTX_23_PRO_MODEL,
  ADAPTIVE_VEO_31_MODEL,
  GROK_IMAGINE_VIDEO_MODEL,
  SEEDANCE_20_MODEL,
  VEO_31_LITE_MODEL,
} from './generation-models/video-adaptive.js'
import { LTX_23_PRO_MODEL, VEO_31_MODEL } from './generation-models/video.js'

export const GENERATION_MODEL_CONTRACT_VERSION_2026_07_12_2 = '2026-07-12.2'
export const GENERATION_MODEL_CONTRACT_VERSION_2026_07_12_3 = '2026-07-12.3'
export const GENERATION_MODEL_CONTRACT_VERSION_2026_07_12_4 = '2026-07-12.4'
export const GENERATION_MODEL_CONTRACT_VERSION_2026_07_12_5 = '2026-07-12.5'

const OPENAI = Object.freeze({ displayName: 'OpenAI', id: 'openai' })
const GOOGLE = Object.freeze({ displayName: 'Google', id: 'google' })
const LTX = Object.freeze({ displayName: 'LTX', id: 'ltx' })
const ELEVENLABS = Object.freeze({
  displayName: 'ElevenLabs',
  id: 'elevenlabs',
})

const PROMPT_INPUT = Object.freeze({
  accepts: ['Text'] as const,
  descriptionKey: 'flows.inputs.promptDescription',
  id: 'prompt',
  labelKey: 'flows.inputs.prompt',
  maxConnections: 32,
  maxItems: 32,
  minConnections: 0,
})

const CONTEXT_INPUT = Object.freeze({
  accepts: ['ElementContext'] as const,
  descriptionKey: 'flows.inputs.contextDescription',
  id: 'context',
  labelKey: 'flows.inputs.context',
  maxConnections: 32,
  maxItems: 32,
  minConnections: 0,
})

const IMAGE_REFERENCES_INPUT = Object.freeze({
  accepts: ['ImageSet'] as const,
  descriptionKey: 'flows.inputs.referencesDescription',
  id: 'references',
  labelKey: 'flows.inputs.references',
  maxConnections: 16,
  maxItems: 16,
  minConnections: 0,
})

const FIRST_FRAME_INPUT = Object.freeze({
  accepts: ['ImageSet'] as const,
  descriptionKey: 'flows.inputs.firstFrameDescription',
  id: 'firstFrame',
  labelKey: 'flows.inputs.firstFrame',
  maxConnections: 1,
  maxItems: 1,
  minConnections: 0,
})

const LAST_FRAME_INPUT = Object.freeze({
  accepts: ['ImageSet'] as const,
  descriptionKey: 'flows.inputs.lastFrameDescription',
  id: 'lastFrame',
  labelKey: 'flows.inputs.lastFrame',
  maxConnections: 1,
  maxItems: 1,
  minConnections: 0,
})

const REFERENCE_AUDIO_INPUT = Object.freeze({
  accepts: ['AudioSet'] as const,
  descriptionKey: 'flows.inputs.referenceAudioDescription',
  id: 'referenceAudio',
  labelKey: 'flows.inputs.referenceAudio',
  maxConnections: 1,
  maxItems: 1,
  minConnections: 0,
})

const IMAGE_ASPECT_RATIOS = Object.freeze([
  { labelKey: 'flows.settings.aspectRatios.square', value: '1:1' },
  { labelKey: 'flows.settings.aspectRatios.portraitPhoto', value: '2:3' },
  { labelKey: 'flows.settings.aspectRatios.photo', value: '3:2' },
])

const VIDEO_ASPECT_RATIOS = Object.freeze([
  { labelKey: 'flows.settings.aspectRatios.landscape', value: '16:9' },
  { labelKey: 'flows.settings.aspectRatios.portrait', value: '9:16' },
])

const GPT_IMAGE_SETTINGS = Object.freeze([
  {
    default: '1:1',
    id: 'aspectRatio',
    kind: 'enum' as const,
    labelKey: 'flows.settings.aspectRatio',
    options: IMAGE_ASPECT_RATIOS,
  },
  {
    default: 1,
    id: 'outputCount',
    kind: 'number' as const,
    labelKey: 'flows.settings.outputCount',
    max: 4,
    min: 1,
    step: 1,
  },
  {
    default: 'auto',
    id: 'quality',
    kind: 'enum' as const,
    labelKey: 'flows.settings.quality',
    options: [
      { labelKey: 'flows.settings.qualities.auto', value: 'auto' },
      { labelKey: 'flows.settings.qualities.low', value: 'low' },
      { labelKey: 'flows.settings.qualities.medium', value: 'medium' },
      { labelKey: 'flows.settings.qualities.high', value: 'high' },
    ],
  },
])

const VEO_SETTINGS_2026_07_12_2 = Object.freeze([
  {
    default: '16:9',
    id: 'aspectRatio',
    kind: 'enum' as const,
    labelKey: 'flows.settings.aspectRatio',
    options: VIDEO_ASPECT_RATIOS,
  },
  {
    default: '8',
    id: 'durationSeconds',
    kind: 'enum' as const,
    labelKey: 'flows.settings.duration',
    options: [4, 6, 8].map(value => ({
      labelKey: `flows.settings.durations.seconds${value}`,
      value: String(value),
    })),
  },
  {
    default: '720p',
    id: 'resolution',
    kind: 'enum' as const,
    labelKey: 'flows.settings.resolution',
    options: ['720p', '1080p', '4k'].map(value => ({
      labelKey: `flows.settings.resolutions.${value}`,
      value,
    })),
  },
])

const LTX_SETTINGS_2026_07_12_2 = Object.freeze([
  {
    default: '16:9',
    id: 'aspectRatio',
    kind: 'enum' as const,
    labelKey: 'flows.settings.aspectRatio',
    options: VIDEO_ASPECT_RATIOS,
  },
  {
    default: '8',
    id: 'durationSeconds',
    kind: 'enum' as const,
    labelKey: 'flows.settings.duration',
    options: [6, 8, 10].map(value => ({
      labelKey: `flows.settings.durations.seconds${value}`,
      value: String(value),
    })),
  },
  {
    default: '1080p',
    id: 'resolution',
    kind: 'enum' as const,
    labelKey: 'flows.settings.resolution',
    options: ['1080p', '1440p', '4k'].map(value => ({
      labelKey: `flows.settings.resolutions.${value}`,
      value,
    })),
  },
])

export const GENERATION_MODEL_REGISTRY_2026_07_12_2 = Object.freeze({
  'talelabs/gpt-image-1.5': {
    constraints: [],
    defaultOperationId: 'textToImage',
    displayName: 'GPT Image 1.5',
    enabled: true,
    id: 'talelabs/gpt-image-1.5',
    inputSlots: [PROMPT_INPUT, CONTEXT_INPUT, IMAGE_REFERENCES_INPUT],
    labelKey: 'flows.models.gptImage15',
    mediaType: 'image',
    operations: [
      {
        descriptionKey: 'flows.operations.textToImageDescription',
        id: 'textToImage',
        inputs: { prompt: { required: true } },
        inputSlotIds: ['prompt', 'context'],
        labelKey: 'flows.operations.textToImage',
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
        settingIds: ['aspectRatio', 'outputCount', 'quality'],
      },
    ],
    provider: OPENAI,
    recommended: true,
    settings: GPT_IMAGE_SETTINGS,
  },
  'talelabs/veo-3.1': {
    constraints: [
      {
        id: 'last-frame-requires-first-frame',
        messageKey: 'flows.constraints.lastFrameRequiresFirstFrame',
        require: [{ field: 'slot', id: 'firstFrame', operator: 'connected' }],
        when: [{ field: 'slot', id: 'lastFrame', operator: 'connected' }],
      },
      {
        id: 'references-require-eight-seconds',
        messageKey: 'flows.constraints.referencesRequireEightSeconds',
        require: [
          {
            field: 'setting',
            id: 'durationSeconds',
            operator: 'equals',
            value: '8',
          },
        ],
        when: [{ field: 'slot', id: 'references', operator: 'connected' }],
      },
      {
        id: 'high-resolution-requires-eight-seconds',
        messageKey: 'flows.constraints.highResolutionRequiresEightSeconds',
        require: [
          {
            field: 'setting',
            id: 'durationSeconds',
            operator: 'equals',
            value: '8',
          },
        ],
        when: [
          {
            field: 'setting',
            id: 'resolution',
            operator: 'in',
            values: ['1080p', '4k'],
          },
        ],
      },
    ],
    defaultOperationId: 'textToVideo',
    displayName: 'Veo 3.1',
    enabled: true,
    id: 'talelabs/veo-3.1',
    inputSlots: [
      PROMPT_INPUT,
      CONTEXT_INPUT,
      FIRST_FRAME_INPUT,
      LAST_FRAME_INPUT,
      {
        ...IMAGE_REFERENCES_INPUT,
        maxItems: 3,
      },
    ],
    labelKey: 'flows.models.veo31',
    mediaType: 'video',
    operations: [
      {
        descriptionKey: 'flows.operations.textToVideoDescription',
        id: 'textToVideo',
        inputs: { prompt: { required: true } },
        inputSlotIds: ['prompt', 'context'],
        labelKey: 'flows.operations.textToVideo',
        settingIds: ['aspectRatio', 'durationSeconds', 'resolution'],
      },
      {
        descriptionKey: 'flows.operations.firstLastFrameToVideoDescription',
        id: 'firstLastFrameToVideo',
        inputs: {
          firstFrame: { required: true },
          prompt: { required: true },
        },
        inputSlotIds: ['prompt', 'context', 'firstFrame', 'lastFrame'],
        labelKey: 'flows.operations.firstLastFrameToVideo',
        settingIds: ['aspectRatio', 'durationSeconds', 'resolution'],
      },
      {
        descriptionKey: 'flows.operations.referencesToVideoDescription',
        id: 'referencesToVideo',
        inputs: {
          prompt: { required: true },
          references: { required: true },
        },
        inputSlotIds: ['prompt', 'context', 'references'],
        labelKey: 'flows.operations.referencesToVideo',
        settingIds: ['aspectRatio', 'durationSeconds', 'resolution'],
      },
    ],
    provider: GOOGLE,
    recommended: true,
    settings: VEO_SETTINGS_2026_07_12_2,
  },
  'talelabs/ltx-2.3-pro': {
    constraints: [],
    defaultOperationId: 'textToVideo',
    displayName: 'LTX 2.3 Pro',
    enabled: true,
    id: 'talelabs/ltx-2.3-pro',
    inputSlots: [
      PROMPT_INPUT,
      CONTEXT_INPUT,
      FIRST_FRAME_INPUT,
      REFERENCE_AUDIO_INPUT,
    ],
    labelKey: 'flows.models.ltx23Pro',
    mediaType: 'video',
    operations: [
      {
        descriptionKey: 'flows.operations.textToVideoDescription',
        id: 'textToVideo',
        inputs: { prompt: { required: true } },
        inputSlotIds: ['prompt', 'context'],
        labelKey: 'flows.operations.textToVideo',
        settingIds: ['aspectRatio', 'durationSeconds', 'resolution'],
      },
      {
        descriptionKey: 'flows.operations.imageToVideoDescription',
        id: 'imageToVideo',
        inputs: {
          firstFrame: { required: true },
          prompt: { required: true },
        },
        inputSlotIds: ['prompt', 'context', 'firstFrame'],
        labelKey: 'flows.operations.imageToVideo',
        settingIds: ['aspectRatio', 'durationSeconds', 'resolution'],
      },
      {
        descriptionKey: 'flows.operations.audioToVideoDescription',
        id: 'audioToVideo',
        inputs: {
          referenceAudio: { required: true },
          source: { oneOf: ['prompt', 'firstFrame'] },
        },
        inputSlotIds: ['prompt', 'context', 'referenceAudio', 'firstFrame'],
        labelKey: 'flows.operations.audioToVideo',
        settingIds: ['aspectRatio', 'resolution'],
      },
    ],
    provider: LTX,
    recommended: false,
    settings: LTX_SETTINGS_2026_07_12_2,
  },
  'talelabs/eleven-multilingual-v2': {
    constraints: [],
    defaultOperationId: 'textToSpeech',
    displayName: 'Eleven Multilingual v2',
    enabled: true,
    id: 'talelabs/eleven-multilingual-v2',
    inputSlots: [PROMPT_INPUT, CONTEXT_INPUT],
    labelKey: 'flows.models.elevenMultilingualV2',
    mediaType: 'audio',
    operations: [
      {
        descriptionKey: 'flows.operations.textToSpeechDescription',
        id: 'textToSpeech',
        inputs: { prompt: { required: true } },
        inputSlotIds: ['prompt', 'context'],
        labelKey: 'flows.operations.textToSpeech',
        requiredSettingIds: ['voiceId'],
        settingIds: ['voiceId', 'stability'],
      },
    ],
    provider: ELEVENLABS,
    recommended: true,
    settings: [
      {
        default: '',
        id: 'voiceId',
        kind: 'string',
        labelKey: 'flows.settings.voiceId',
        maxLength: 128,
      },
      {
        default: 0.5,
        id: 'stability',
        kind: 'number',
        labelKey: 'flows.settings.stability',
        max: 1,
        min: 0,
        step: 0.1,
      },
    ],
  },
  'talelabs/eleven-sound-effects-v2': {
    constraints: [],
    defaultOperationId: 'textToSoundEffect',
    displayName: 'Eleven Sound Effects v2',
    enabled: true,
    id: 'talelabs/eleven-sound-effects-v2',
    inputSlots: [PROMPT_INPUT, CONTEXT_INPUT],
    labelKey: 'flows.models.elevenSoundEffectsV2',
    mediaType: 'audio',
    operations: [
      {
        descriptionKey: 'flows.operations.textToSoundEffectDescription',
        id: 'textToSoundEffect',
        inputs: { prompt: { required: true } },
        inputSlotIds: ['prompt', 'context'],
        labelKey: 'flows.operations.textToSoundEffect',
        settingIds: ['durationSeconds', 'loop', 'promptInfluence'],
      },
    ],
    provider: ELEVENLABS,
    recommended: false,
    settings: [
      {
        default: 5,
        id: 'durationSeconds',
        kind: 'number',
        labelKey: 'flows.settings.duration',
        max: 30,
        min: 0.5,
        step: 0.5,
      },
      {
        default: false,
        id: 'loop',
        kind: 'boolean',
        labelKey: 'flows.settings.loop',
      },
      {
        advanced: true,
        default: 0.3,
        id: 'promptInfluence',
        kind: 'number',
        labelKey: 'flows.settings.promptInfluence',
        max: 1,
        min: 0,
        step: 0.1,
      },
    ],
  },
} as const satisfies Record<string, GenerationModelDefinition>)

const veo31Contract202607123 = Object.freeze({
  ...GENERATION_MODEL_REGISTRY_2026_07_12_2['talelabs/veo-3.1'],
  constraints: GENERATION_MODEL_REGISTRY_2026_07_12_2[
    'talelabs/veo-3.1'
  ].constraints.map(constraint =>
    constraint.id === 'high-resolution-requires-eight-seconds'
      ? {
          ...constraint,
          when: [
            {
              field: 'setting' as const,
              id: 'resolution',
              operator: 'in' as const,
              values: ['1080p'],
            },
          ],
        }
      : constraint,
  ),
  settings: GENERATION_MODEL_REGISTRY_2026_07_12_2[
    'talelabs/veo-3.1'
  ].settings.map(setting =>
    setting.id === 'resolution'
      ? {
          ...setting,
          options: setting.options.filter(option => option.value !== '4k'),
        }
      : setting,
  ),
} satisfies GenerationModelDefinition)

export const GENERATION_MODEL_REGISTRY_2026_07_12_3 = Object.freeze({
  ...GENERATION_MODEL_REGISTRY_2026_07_12_2,
  'talelabs/veo-3.1': veo31Contract202607123,
} satisfies Record<string, GenerationModelDefinition>)

const ltx23ProContract202607124 = Object.freeze({
  ...GENERATION_MODEL_REGISTRY_2026_07_12_3['talelabs/ltx-2.3-pro'],
  settings: GENERATION_MODEL_REGISTRY_2026_07_12_3[
    'talelabs/ltx-2.3-pro'
  ].settings.map(setting =>
    setting.id === 'resolution'
      ? {
          ...setting,
          options: setting.options.filter(option => option.value === '1080p'),
        }
      : setting,
  ),
} satisfies GenerationModelDefinition)

export const GENERATION_MODEL_REGISTRY_2026_07_12_4 = Object.freeze({
  ...GENERATION_MODEL_REGISTRY_2026_07_12_3,
  'talelabs/ltx-2.3-pro': ltx23ProContract202607124,
} satisfies Record<string, GenerationModelDefinition>)

const veo31Contract202607125 = Object.freeze({
  ...GENERATION_MODEL_REGISTRY_2026_07_12_4['talelabs/veo-3.1'],
  constraints: [
    ...GENERATION_MODEL_REGISTRY_2026_07_12_4[
      'talelabs/veo-3.1'
    ].constraints.filter(
      constraint => constraint.id !== 'references-require-eight-seconds',
    ),
    {
      id: 'references-require-eight-seconds',
      messageKey: 'flows.constraints.referencesRequireEightSeconds',
      require: [
        {
          field: 'setting' as const,
          id: 'durationSeconds',
          operator: 'equals' as const,
          value: '8',
        },
      ],
      when: [
        {
          field: 'operation' as const,
          operator: 'equals' as const,
          value: 'referencesToVideo',
        },
      ],
    },
    {
      id: 'references-require-landscape',
      messageKey: 'flows.constraints.referencesRequireLandscape',
      require: [
        {
          field: 'setting' as const,
          id: 'aspectRatio',
          operator: 'equals' as const,
          value: '16:9',
        },
      ],
      when: [
        {
          field: 'operation' as const,
          operator: 'equals' as const,
          value: 'referencesToVideo',
        },
      ],
    },
  ],
} satisfies GenerationModelDefinition)

export const GENERATION_MODEL_REGISTRY_2026_07_12_5 = Object.freeze({
  ...GENERATION_MODEL_REGISTRY_2026_07_12_4,
  'talelabs/veo-3.1': veo31Contract202607125,
} satisfies Record<string, GenerationModelDefinition>)

/** Released E-040 contract retained for Flows that already pinned it. */
export const GENERATION_MODEL_REGISTRY_2026_07_13_1 = Object.freeze({
  [GPT_IMAGE_15_MODEL.id]: GPT_IMAGE_15_MODEL,
  [GPT_IMAGE_2_MODEL.id]: GPT_IMAGE_2_MODEL,
  [VEO_31_MODEL.id]: VEO_31_MODEL,
  [LTX_23_PRO_MODEL.id]: LTX_23_PRO_MODEL,
  [ELEVEN_MULTILINGUAL_V2_MODEL.id]: ELEVEN_MULTILINGUAL_V2_MODEL,
  [ELEVEN_SOUND_EFFECTS_V2_MODEL.id]: ELEVEN_SOUND_EFFECTS_V2_MODEL,
} as const satisfies Readonly<
  Record<string, HardenedGenerationModelDefinition>
>)

/** Released provider-independent E-040 catalog retained without mutation. */
export const GENERATION_MODEL_REGISTRY_2026_07_13_2 = Object.freeze({
  [GPT_IMAGE_2_MODEL.id]: GPT_IMAGE_2_MODEL,
  [VEO_31_MODEL.id]: VEO_31_MODEL,
  [LTX_23_PRO_MODEL.id]: LTX_23_PRO_MODEL,
  [ELEVEN_MULTILINGUAL_V2_MODEL.id]: ELEVEN_MULTILINGUAL_V2_MODEL,
  [ELEVEN_SOUND_EFFECTS_V2_MODEL.id]: ELEVEN_SOUND_EFFECTS_V2_MODEL,
} as const satisfies Readonly<
  Record<string, HardenedGenerationModelDefinition>
>)

/** Released model-adaptive Video catalog retained without mutation. */
export const GENERATION_MODEL_REGISTRY_2026_07_13_3 = Object.freeze({
  [GPT_IMAGE_2_MODEL.id]: GPT_IMAGE_2_MODEL,
  [ADAPTIVE_VEO_31_MODEL.id]: ADAPTIVE_VEO_31_MODEL,
  [VEO_31_LITE_MODEL.id]: VEO_31_LITE_MODEL,
  [GROK_IMAGINE_VIDEO_MODEL.id]: GROK_IMAGINE_VIDEO_MODEL,
  [SEEDANCE_20_MODEL.id]: SEEDANCE_20_MODEL,
  [ADAPTIVE_LTX_23_PRO_MODEL.id]: ADAPTIVE_LTX_23_PRO_MODEL,
  [ELEVEN_MULTILINGUAL_V2_MODEL.id]: ELEVEN_MULTILINGUAL_V2_MODEL,
  [ELEVEN_SOUND_EFFECTS_V2_MODEL.id]: ELEVEN_SOUND_EFFECTS_V2_MODEL,
} as const satisfies Readonly<
  Record<string, HardenedGenerationModelDefinition>
>)

/** Released model-adaptive Image catalog retained without mutation. */
export const GENERATION_MODEL_REGISTRY_2026_07_13_4 = Object.freeze({
  [NANO_BANANA_2_LITE_MODEL.id]: NANO_BANANA_2_LITE_MODEL,
  [NANO_BANANA_2_MODEL.id]: NANO_BANANA_2_MODEL,
  [NANO_BANANA_PRO_MODEL.id]: NANO_BANANA_PRO_MODEL,
  [ADAPTIVE_GPT_IMAGE_2_MODEL.id]: ADAPTIVE_GPT_IMAGE_2_MODEL,
  [SEEDREAM_45_MODEL.id]: SEEDREAM_45_MODEL,
  [FLUX_2_PRO_MODEL.id]: FLUX_2_PRO_MODEL,
  [RECRAFT_41_MODEL.id]: RECRAFT_41_MODEL,
  [ADAPTIVE_VEO_31_MODEL.id]: ADAPTIVE_VEO_31_MODEL,
  [VEO_31_LITE_MODEL.id]: VEO_31_LITE_MODEL,
  [GROK_IMAGINE_VIDEO_MODEL.id]: GROK_IMAGINE_VIDEO_MODEL,
  [SEEDANCE_20_MODEL.id]: SEEDANCE_20_MODEL,
  [ADAPTIVE_LTX_23_PRO_MODEL.id]: ADAPTIVE_LTX_23_PRO_MODEL,
  [ELEVEN_MULTILINGUAL_V2_MODEL.id]: ELEVEN_MULTILINGUAL_V2_MODEL,
  [ELEVEN_SOUND_EFFECTS_V2_MODEL.id]: ELEVEN_SOUND_EFFECTS_V2_MODEL,
} as const satisfies Readonly<
  Record<string, HardenedGenerationModelDefinition>
>)

function llmContract202607135(
  model: HardenedGenerationModelDefinition,
): HardenedGenerationModelDefinition {
  return Object.freeze({
    ...model,
    presentation: model.presentation
      ? {
          ...model.presentation,
          descriptionKey: `${model.labelKey}Description`,
        }
      : undefined,
  })
}

/** Released model-adaptive Image and LLM catalog retained without mutation. */
export const GENERATION_MODEL_REGISTRY_2026_07_13_5 = Object.freeze({
  [NANO_BANANA_2_LITE_MODEL.id]: NANO_BANANA_2_LITE_MODEL,
  [NANO_BANANA_2_MODEL.id]: NANO_BANANA_2_MODEL,
  [NANO_BANANA_PRO_MODEL.id]: NANO_BANANA_PRO_MODEL,
  [ADAPTIVE_GPT_IMAGE_2_MODEL.id]: ADAPTIVE_GPT_IMAGE_2_MODEL,
  [SEEDREAM_45_MODEL.id]: SEEDREAM_45_MODEL,
  [FLUX_2_PRO_MODEL.id]: FLUX_2_PRO_MODEL,
  [RECRAFT_41_MODEL.id]: RECRAFT_41_MODEL,
  [GEMINI_31_FLASH_LITE_MODEL.id]: llmContract202607135(GEMINI_31_FLASH_LITE_MODEL),
  [CLAUDE_SONNET_46_MODEL.id]: llmContract202607135(CLAUDE_SONNET_46_MODEL),
  [GPT_54_MODEL.id]: llmContract202607135(GPT_54_MODEL),
  [GEMINI_31_PRO_MODEL.id]: llmContract202607135(GEMINI_31_PRO_MODEL),
  [DEEPSEEK_V32_MODEL.id]: llmContract202607135(DEEPSEEK_V32_MODEL),
  [MISTRAL_LARGE_3_MODEL.id]: llmContract202607135(MISTRAL_LARGE_3_MODEL),
  [ADAPTIVE_VEO_31_MODEL.id]: ADAPTIVE_VEO_31_MODEL,
  [VEO_31_LITE_MODEL.id]: VEO_31_LITE_MODEL,
  [GROK_IMAGINE_VIDEO_MODEL.id]: GROK_IMAGINE_VIDEO_MODEL,
  [SEEDANCE_20_MODEL.id]: SEEDANCE_20_MODEL,
  [ADAPTIVE_LTX_23_PRO_MODEL.id]: ADAPTIVE_LTX_23_PRO_MODEL,
  [ELEVEN_MULTILINGUAL_V2_MODEL.id]: ELEVEN_MULTILINGUAL_V2_MODEL,
  [ELEVEN_SOUND_EFFECTS_V2_MODEL.id]: ELEVEN_SOUND_EFFECTS_V2_MODEL,
} as const satisfies Readonly<
  Record<string, HardenedGenerationModelDefinition>
>)

function fixedSingleImageOutput202607136(
  model: HardenedGenerationModelDefinition,
): HardenedGenerationModelDefinition {
  return {
    ...model,
    operations: model.operations.map(operation => ({
      ...operation,
      output: {
        count: { default: 1, max: 1, min: 1 },
        mediaType: 'image',
      },
      settingIds: operation.settingIds.filter(
        settingId => settingId !== 'outputCount',
      ),
    })),
    settings: model.settings.filter(setting => setting.id !== 'outputCount'),
  }
}

/** Released fixed-single-output Image catalog retained without mutation. */
export const GENERATION_MODEL_REGISTRY_2026_07_13_6 = Object.freeze({
  [NANO_BANANA_2_LITE_MODEL.id]: fixedSingleImageOutput202607136(
    NANO_BANANA_2_LITE_MODEL,
  ),
  [NANO_BANANA_2_MODEL.id]: fixedSingleImageOutput202607136(
    NANO_BANANA_2_MODEL,
  ),
  [NANO_BANANA_PRO_MODEL.id]: fixedSingleImageOutput202607136(
    NANO_BANANA_PRO_MODEL,
  ),
  [ADAPTIVE_GPT_IMAGE_2_MODEL.id]: fixedSingleImageOutput202607136(
    ADAPTIVE_GPT_IMAGE_2_MODEL,
  ),
  [SEEDREAM_45_MODEL.id]: fixedSingleImageOutput202607136(SEEDREAM_45_MODEL),
  [FLUX_2_PRO_MODEL.id]: fixedSingleImageOutput202607136(FLUX_2_PRO_MODEL),
  [RECRAFT_41_MODEL.id]: fixedSingleImageOutput202607136(RECRAFT_41_MODEL),
  [GEMINI_31_FLASH_LITE_MODEL.id]: GEMINI_31_FLASH_LITE_MODEL,
  [CLAUDE_SONNET_46_MODEL.id]: CLAUDE_SONNET_46_MODEL,
  [GPT_54_MODEL.id]: GPT_54_MODEL,
  [GEMINI_31_PRO_MODEL.id]: GEMINI_31_PRO_MODEL,
  [DEEPSEEK_V32_MODEL.id]: DEEPSEEK_V32_MODEL,
  [MISTRAL_LARGE_3_MODEL.id]: MISTRAL_LARGE_3_MODEL,
  [ADAPTIVE_VEO_31_MODEL.id]: ADAPTIVE_VEO_31_MODEL,
  [VEO_31_LITE_MODEL.id]: VEO_31_LITE_MODEL,
  [GROK_IMAGINE_VIDEO_MODEL.id]: GROK_IMAGINE_VIDEO_MODEL,
  [SEEDANCE_20_MODEL.id]: SEEDANCE_20_MODEL,
  [ADAPTIVE_LTX_23_PRO_MODEL.id]: ADAPTIVE_LTX_23_PRO_MODEL,
  [ELEVEN_MULTILINGUAL_V2_MODEL.id]: ELEVEN_MULTILINGUAL_V2_MODEL,
  [ELEVEN_SOUND_EFFECTS_V2_MODEL.id]: ELEVEN_SOUND_EFFECTS_V2_MODEL,
} as const satisfies Readonly<
  Record<string, HardenedGenerationModelDefinition>
>)
