import type { HardenedGenerationModelDefinition } from '../types.js'

import {
  GEMINI_31_FLASH_TTS_MODEL,
} from '../../models/audio.js'
import { OPENROUTER_MAJOR_IMAGE_MODELS } from '../../models/image-openrouter-major.js'
import { OPENROUTER_MAJOR_LLM_MODELS } from '../../models/llm-openrouter-major.js'
import {
  ADAPTIVE_VEO_31_MODEL,
  GROK_IMAGINE_VIDEO_MODEL,
  SEEDANCE_20_MODEL,
  VEO_31_LITE_MODEL,
} from '../../models/video-adaptive.js'
import { OPENROUTER_MAJOR_VIDEO_MODELS } from '../../models/video-openrouter-major.js'
import {
  withReviewedImageReferenceOperation,
  withReviewedSettingOptions,
} from '../provider-capabilities.js'
import {
  CURRENT_IMAGE_MODELS,
  CURRENT_LLM_MODELS,
  withGenerationNodeType,
} from './base.js'
import {
  withReviewedSeedanceLimits,
  withReviewedSeedreamOutputSizes,
} from './overrides.js'

function withOpenRouterVeoOperations(
  model: HardenedGenerationModelDefinition,
): HardenedGenerationModelDefinition {
  const operationIds = new Set(['textToVideo', 'firstLastFrameToVideo'])
  const operations = model.operations.filter(operation =>
    operationIds.has(operation.id),
  )
  const slotIds = new Set(operations.flatMap(operation => operation.inputSlotIds))
  const operationIdsInUse = new Set(operations.map(operation => operation.id))
  return {
    ...model,
    constraints: model.constraints.filter(constraint =>
      constraint.when.every(condition =>
        condition.field !== 'operation'
        || operationIdsInUse.has(condition.value),
      ),
    ),
    defaultOperationId: 'textToVideo',
    inputSlots: model.inputSlots.filter(slot => slotIds.has(slot.id)),
    operations,
  }
}

function withoutLlmInstructionsConnector(
  model: HardenedGenerationModelDefinition,
): HardenedGenerationModelDefinition {
  if (model.mediaType !== 'text')
    return model
  return {
    ...model,
    inputSlots: model.inputSlots.filter(slot => slot.id !== 'instructions'),
    operations: model.operations.map(operation => ({
      ...operation,
      inputSlotIds: operation.inputSlotIds.filter(
        slotId => slotId !== 'instructions',
      ),
    })),
  }
}

export const CURRENT_SELECTABLE_VIDEO_MODELS = [
  withOpenRouterVeoOperations(
    withGenerationNodeType(ADAPTIVE_VEO_31_MODEL, 'videoGeneration'),
  ),
  withGenerationNodeType(VEO_31_LITE_MODEL, 'videoGeneration'),
  withGenerationNodeType(GROK_IMAGINE_VIDEO_MODEL, 'videoGeneration'),
  withReviewedSeedanceLimits(
    withGenerationNodeType(SEEDANCE_20_MODEL, 'videoGeneration'),
  ),
]

const CURRENT_REVIEWED_VIDEO_MODELS = CURRENT_SELECTABLE_VIDEO_MODELS.map(
  (model) => {
    if (model.id === 'talelabs/veo-3.1') {
      return withReviewedSettingOptions(model, {
        resolution: ['720p', '1080p', '4K'],
      })
    }
    if (model.id === 'talelabs/grok-imagine-video') {
      return withReviewedSettingOptions(model, {
        aspectRatio: ['16:9', '9:16', '1:1', '4:3', '3:4', '3:2', '2:3'],
        durationSeconds: [
          '1',
          '2',
          '3',
          '4',
          '5',
          '6',
          '7',
          '8',
          '9',
          '10',
          '11',
          '12',
          '13',
          '14',
          '15',
        ],
      })
    }
    return model.id === 'talelabs/seedance-2.0'
      ? withReviewedSettingOptions(model, {
          resolution: ['480p', '720p', '1080p', '4K'],
        })
      : model
  },
)

const currentImageReferenceTemplate = CURRENT_IMAGE_MODELS.find(
  model => model.id === 'talelabs/nano-banana-2',
)!

const CURRENT_REVIEWED_IMAGE_MODELS = CURRENT_IMAGE_MODELS.map((model) => {
  if (model.id === 'talelabs/nano-banana-pro') {
    return withReviewedSettingOptions(model, {
      resolution: ['1K', '2K', '4K'],
    })
  }
  if (model.id === 'talelabs/recraft-4.1') {
    return withReviewedImageReferenceOperation(
      model,
      currentImageReferenceTemplate,
      1,
    )
  }
  return model.id === 'talelabs/seedream-4.5'
    ? withReviewedSeedreamOutputSizes(model)
    : model
})

/** Released catalog retained as the immutable 2026-07-15.17 contract. */
export const GENERATION_MODEL_REGISTRY_2026_07_15_17 = Object.freeze(
  Object.fromEntries([
    ...CURRENT_REVIEWED_IMAGE_MODELS,
    ...CURRENT_LLM_MODELS,
    ...CURRENT_REVIEWED_VIDEO_MODELS,
    GEMINI_31_FLASH_TTS_MODEL,
  ].map(model => [model.id, model])),
) as Readonly<Record<string, HardenedGenerationModelDefinition>>

/** Released catalog retained as the immutable 2026-07-15.18 contract. */
export const GENERATION_MODEL_REGISTRY_2026_07_15_18 = Object.freeze(
  Object.fromEntries([
    ...Object.values(GENERATION_MODEL_REGISTRY_2026_07_15_17),
    ...OPENROUTER_MAJOR_IMAGE_MODELS.map(model =>
      withGenerationNodeType(model, 'imageGeneration'),
    ),
    ...OPENROUTER_MAJOR_LLM_MODELS.map(model =>
      withGenerationNodeType(model, 'llm'),
    ),
    ...OPENROUTER_MAJOR_VIDEO_MODELS.map(model =>
      withGenerationNodeType(model, 'videoGeneration'),
    ),
  ].map(model => [model.id, model])),
) as Readonly<Record<string, HardenedGenerationModelDefinition>>

/** Current catalog. Active membership is the provider-neutral availability fact. */
export const CURRENT_GENERATION_MODEL_REGISTRY = Object.freeze(
  Object.fromEntries(
    Object.values(GENERATION_MODEL_REGISTRY_2026_07_15_18).map((model) => {
      const currentModel = withoutLlmInstructionsConnector(model)
      return [currentModel.id, currentModel]
    }),
  ),
) as Readonly<Record<string, HardenedGenerationModelDefinition>>
