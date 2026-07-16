import type { HardenedGenerationModelDefinition } from '../types.js'

import {
  ELEVEN_MULTILINGUAL_V2_MODEL,
  ELEVEN_SOUND_EFFECTS_V2_MODEL,
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
import { GPT_IMAGE_2_MODEL, GPT_IMAGE_15_MODEL } from '../../models/image.js'
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
import { LTX_23_PRO_MODEL, VEO_31_MODEL } from '../../models/video.js'

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
