import type { HardenedGenerationModelDefinition } from '../types.js'

import {
  ELEVEN_MULTILINGUAL_V2_MODEL,
  ELEVEN_MULTILINGUAL_V2_SPEECH_MODEL,
  ELEVEN_MUSIC_V2_MODEL,
  ELEVEN_SOUND_EFFECTS_V2_ADAPTIVE_MODEL,
  ELEVEN_SOUND_EFFECTS_V2_MODEL,
  ELEVEN_VOICE_CHANGER_MODEL,
  ELEVEN_VOICE_ISOLATOR_MODEL,
  GPT_4O_MINI_TTS_MODEL,
  STABLE_AUDIO_25_MODEL,
} from '../../models/audio.js'
import {
  ADAPTIVE_GPT_IMAGE_2_MODEL,
  FLUX_2_PRO_MODEL,
  NANO_BANANA_2_LITE_MODEL,
  NANO_BANANA_2_MODEL,
  NANO_BANANA_PRO_MODEL,
  RECRAFT_41_MODEL,
  SEEDREAM_45_MODEL,
} from '../../models/image-adaptive.js'
import {
  CLAUDE_SONNET_46_MODEL,
  DEEPSEEK_V32_MODEL,
  GEMINI_31_FLASH_LITE_MODEL,
  GEMINI_31_PRO_MODEL,
  GPT_54_MODEL,
  MISTRAL_LARGE_3_MODEL,
} from '../../models/llm.js'
import {
  ADAPTIVE_LTX_23_PRO_MODEL,
  ADAPTIVE_VEO_31_MODEL,
  GROK_IMAGINE_VIDEO_MODEL,
  SEEDANCE_20_MODEL,
  VEO_31_LITE_MODEL,
} from '../../models/video-adaptive.js'

function fixedSingleImageOutput(
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

function withSeedreamAutoAspectRatio(
  model: HardenedGenerationModelDefinition,
): HardenedGenerationModelDefinition {
  return {
    ...model,
    settings: model.settings.map(setting =>
      setting.id === 'aspectRatio' && setting.kind === 'enum'
        ? {
            ...setting,
            options: [
              ...setting.options,
              {
                labelKey: 'flows.settings.qualities.auto',
                value: 'auto',
              },
            ],
          }
        : setting,
    ),
  }
}

export function withGenerationNodeType(
  model: HardenedGenerationModelDefinition,
  nodeType: 'imageGeneration' | 'llm' | 'videoGeneration',
): HardenedGenerationModelDefinition {
  return {
    ...model,
    capabilitySchemaVersion: 3,
    operations: model.operations.map(operation => ({
      ...operation,
      nodeType,
    })),
  }
}

export const CURRENT_NANO_BANANA_2_LITE_MODEL = fixedSingleImageOutput(
  NANO_BANANA_2_LITE_MODEL,
)
export const CURRENT_NANO_BANANA_2_MODEL = fixedSingleImageOutput(
  NANO_BANANA_2_MODEL,
)
export const CURRENT_NANO_BANANA_PRO_MODEL = fixedSingleImageOutput(
  NANO_BANANA_PRO_MODEL,
)
export const CURRENT_GPT_IMAGE_2_MODEL = fixedSingleImageOutput(
  ADAPTIVE_GPT_IMAGE_2_MODEL,
)
export const CURRENT_SEEDREAM_45_MODEL = withSeedreamAutoAspectRatio(
  fixedSingleImageOutput(SEEDREAM_45_MODEL),
)
export const CURRENT_FLUX_2_PRO_MODEL = fixedSingleImageOutput(FLUX_2_PRO_MODEL)
export const CURRENT_RECRAFT_41_MODEL = fixedSingleImageOutput(RECRAFT_41_MODEL)

export const CURRENT_IMAGE_MODELS = [
  CURRENT_NANO_BANANA_2_LITE_MODEL,
  CURRENT_NANO_BANANA_2_MODEL,
  CURRENT_NANO_BANANA_PRO_MODEL,
  CURRENT_GPT_IMAGE_2_MODEL,
  CURRENT_SEEDREAM_45_MODEL,
  CURRENT_FLUX_2_PRO_MODEL,
  CURRENT_RECRAFT_41_MODEL,
].map(model => withGenerationNodeType(model, 'imageGeneration'))

export const CURRENT_LLM_MODELS = [
  GEMINI_31_FLASH_LITE_MODEL,
  CLAUDE_SONNET_46_MODEL,
  GPT_54_MODEL,
  GEMINI_31_PRO_MODEL,
  DEEPSEEK_V32_MODEL,
  MISTRAL_LARGE_3_MODEL,
].map(model => withGenerationNodeType(model, 'llm'))

export const CURRENT_VIDEO_MODELS = [
  ADAPTIVE_VEO_31_MODEL,
  VEO_31_LITE_MODEL,
  GROK_IMAGINE_VIDEO_MODEL,
  SEEDANCE_20_MODEL,
  ADAPTIVE_LTX_23_PRO_MODEL,
].map(model => withGenerationNodeType(model, 'videoGeneration'))

/** Released capability-v2 catalog. Keep byte-for-byte semantics for its hash. */
export const GENERATION_MODEL_REGISTRY_2026_07_13_7 = {
  [CURRENT_NANO_BANANA_2_LITE_MODEL.id]: CURRENT_NANO_BANANA_2_LITE_MODEL,
  [CURRENT_NANO_BANANA_2_MODEL.id]: CURRENT_NANO_BANANA_2_MODEL,
  [CURRENT_NANO_BANANA_PRO_MODEL.id]: CURRENT_NANO_BANANA_PRO_MODEL,
  [CURRENT_GPT_IMAGE_2_MODEL.id]: CURRENT_GPT_IMAGE_2_MODEL,
  [CURRENT_SEEDREAM_45_MODEL.id]: CURRENT_SEEDREAM_45_MODEL,
  [CURRENT_FLUX_2_PRO_MODEL.id]: CURRENT_FLUX_2_PRO_MODEL,
  [CURRENT_RECRAFT_41_MODEL.id]: CURRENT_RECRAFT_41_MODEL,
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
>

/** Released intent-tagged catalog retained for immutable historical Flows. */
export const GENERATION_MODEL_REGISTRY_2026_07_13_8 = Object.fromEntries(
  [
    ...CURRENT_IMAGE_MODELS,
    ...CURRENT_LLM_MODELS,
    ...CURRENT_VIDEO_MODELS,
    ELEVEN_MULTILINGUAL_V2_SPEECH_MODEL,
    GPT_4O_MINI_TTS_MODEL,
    ELEVEN_MUSIC_V2_MODEL,
    ELEVEN_SOUND_EFFECTS_V2_ADAPTIVE_MODEL,
    ELEVEN_VOICE_CHANGER_MODEL,
    ELEVEN_VOICE_ISOLATOR_MODEL,
    STABLE_AUDIO_25_MODEL,
  ].map(model => [model.id, model]),
) as Readonly<Record<string, HardenedGenerationModelDefinition>>
