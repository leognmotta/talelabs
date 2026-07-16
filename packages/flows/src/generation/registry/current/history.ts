import type { HardenedGenerationModelDefinition } from '../types.js'

import {
  GEMINI_31_FLASH_TTS_MODEL,
  GPT_4O_MINI_TTS_MODEL,
} from '../../models/audio.js'
import {
  CURRENT_IMAGE_MODELS,
  CURRENT_LLM_MODELS,
  GENERATION_MODEL_REGISTRY_2026_07_13_8,
} from './base.js'
import {
  withMp3SpeechOutput,
  withReviewedSeedanceLimits,
  withReviewedSeedreamOutputSizes,
} from './overrides.js'
import {
  CURRENT_SELECTABLE_VIDEO_MODELS,
} from './selectable.js'

function withExecutionAvailability(
  registry: Readonly<Record<string, HardenedGenerationModelDefinition>>,
  executableModelIds: ReadonlySet<string>,
) {
  return Object.freeze(Object.fromEntries(
    Object.values(registry).map(model => [
      model.id,
      { ...model, executionAvailable: executableModelIds.has(model.id) },
    ]),
  )) as Readonly<Record<string, HardenedGenerationModelDefinition>>
}

function withCurrentExecutionAvailability(
  model: HardenedGenerationModelDefinition,
): HardenedGenerationModelDefinition {
  return { ...model, executionAvailable: true }
}

/** Released route-intersection catalog retained for immutable historical Flows. */
export const GENERATION_MODEL_REGISTRY_2026_07_15_9 = Object.freeze({
  ...GENERATION_MODEL_REGISTRY_2026_07_13_8,
  [GPT_4O_MINI_TTS_MODEL.id]: withMp3SpeechOutput(GPT_4O_MINI_TTS_MODEL),
}) as Readonly<Record<string, HardenedGenerationModelDefinition>>

const EXECUTABLE_GENERATION_MODEL_IDS_2026_07_15_10 = new Set([
  'talelabs/gpt-image-2',
  'talelabs/veo-3.1-lite',
])

/** Released execution catalog retained for immutable historical Flows. */
export const GENERATION_MODEL_REGISTRY_2026_07_15_10
  = withExecutionAvailability(
    GENERATION_MODEL_REGISTRY_2026_07_15_9,
    EXECUTABLE_GENERATION_MODEL_IDS_2026_07_15_10,
  )

const EXECUTABLE_GENERATION_MODEL_IDS = new Set([
  ...EXECUTABLE_GENERATION_MODEL_IDS_2026_07_15_10,
  'talelabs/seedance-2.0',
])

/** Released Seedance execution catalog retained for immutable historical Flows. */
export const GENERATION_MODEL_REGISTRY_2026_07_15_11
  = withExecutionAvailability(
    GENERATION_MODEL_REGISTRY_2026_07_15_9,
    EXECUTABLE_GENERATION_MODEL_IDS,
  )

const historicalSeedance = GENERATION_MODEL_REGISTRY_2026_07_15_11[
  'talelabs/seedance-2.0'
]!

/** Released reviewed Seedance catalog retained for immutable historical Flows. */
export const GENERATION_MODEL_REGISTRY_2026_07_15_12 = Object.freeze({
  ...GENERATION_MODEL_REGISTRY_2026_07_15_11,
  [historicalSeedance.id]: withReviewedSeedanceLimits(historicalSeedance),
}) as Readonly<Record<string, HardenedGenerationModelDefinition>>

const historicalSeedream = GENERATION_MODEL_REGISTRY_2026_07_15_12[
  'talelabs/seedream-4.5'
]!

/** Released Seedream execution catalog retained for immutable historical Flows. */
export const GENERATION_MODEL_REGISTRY_2026_07_15_13 = Object.freeze({
  ...GENERATION_MODEL_REGISTRY_2026_07_15_12,
  [historicalSeedream.id]: {
    ...historicalSeedream,
    executionAvailable: true,
  },
}) as Readonly<Record<string, HardenedGenerationModelDefinition>>

const executableSeedream = GENERATION_MODEL_REGISTRY_2026_07_15_13[
  'talelabs/seedream-4.5'
]!

/** Released Seedream-safe catalog retained for immutable historical Flows. */
export const GENERATION_MODEL_REGISTRY_2026_07_15_14 = Object.freeze({
  ...GENERATION_MODEL_REGISTRY_2026_07_15_13,
  [executableSeedream.id]: withReviewedSeedreamOutputSizes(executableSeedream),
}) as Readonly<Record<string, HardenedGenerationModelDefinition>>

/** Last field-based availability catalog retained for immutable historical Flows. */
export const GENERATION_MODEL_REGISTRY_2026_07_15_15 = Object.freeze(
  Object.fromEntries([
    ...CURRENT_IMAGE_MODELS.filter(model =>
      model.id !== 'talelabs/seedream-4.5'),
    withReviewedSeedreamOutputSizes(executableSeedream),
    ...CURRENT_LLM_MODELS,
    ...CURRENT_SELECTABLE_VIDEO_MODELS,
    GEMINI_31_FLASH_TTS_MODEL,
  ].map(withCurrentExecutionAvailability).map(model => [model.id, model])),
) as Readonly<Record<string, HardenedGenerationModelDefinition>>

const releasedCurrentSeedream = CURRENT_IMAGE_MODELS.find(
  model => model.id === 'talelabs/seedream-4.5',
)!

/** Released OpenRouter-only catalog retained for immutable historical Flows. */
export const GENERATION_MODEL_REGISTRY_2026_07_15_16 = Object.freeze(
  Object.fromEntries([
    ...CURRENT_IMAGE_MODELS.filter(model =>
      model.id !== 'talelabs/seedream-4.5'),
    withReviewedSeedreamOutputSizes(releasedCurrentSeedream),
    ...CURRENT_LLM_MODELS,
    ...CURRENT_SELECTABLE_VIDEO_MODELS,
    GEMINI_31_FLASH_TTS_MODEL,
  ].map(model => [model.id, model])),
) as Readonly<Record<string, HardenedGenerationModelDefinition>>
