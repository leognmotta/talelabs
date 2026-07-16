import type { GenerationOutputType } from '../../generation/registry/index.js'
import type { FlowNodeType } from '../../graph/types.js'

import { z } from 'zod'
import {
  GENERATION_MODEL_CONTRACT_VERSION_2026_07_12_2,
  getGenerationMediaTypeForNode,
  getGenerationModel,
  getGenerationOperation,
  isGenerationModelContractVersion,
  isGenerationModelId,
  isGenerationSettingValueValid,
  matchesGenerationCondition,
} from '../../generation/registry/index.js'

export const EmptyNodeDataSchema = z.strictObject({})
export const LockedNodeDataSchema = z.strictObject({
  locked: z.boolean(),
})

export const FlowImageCropSchema = z
  .strictObject({
    height: z.number().positive().max(1),
    width: z.number().positive().max(1),
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
  })
  .superRefine((crop, context) => {
    if (crop.x + crop.width > 1) {
      context.addIssue({
        code: 'custom',
        message: 'crop_exceeds_width',
        path: ['width'],
      })
    }
    if (crop.y + crop.height > 1) {
      context.addIssue({
        code: 'custom',
        message: 'crop_exceeds_height',
        path: ['height'],
      })
    }
  })
export const AssetNodeDataSchemaV3 = LockedNodeDataSchema.extend({
  crop: FlowImageCropSchema.optional(),
})

export const TextNodeDataSchemaV1 = z.strictObject({
  text: z.string().max(16_000),
})
export const TextNodeDataSchemaV2 = TextNodeDataSchemaV1.extend({
  locked: z.boolean(),
})

export const InputSelectionSchema = z.discriminatedUnion('mode', [
  z.strictObject({ mode: z.literal('auto') }),
  z.strictObject({
    assetIds: z.array(z.string()).max(64),
    mode: z.literal('manual'),
  }),
])

export const GenerationNodeDataLegacySchema = z.strictObject({
  inputSelections: z.record(z.string(), InputSelectionSchema),
  modelId: z.string(),
  settings: z.record(
    z.string(),
    z.union([z.boolean(), z.number(), z.string()]),
  ),
})
export const ImageGenerationNodeDataSchemaV3Base
  = GenerationNodeDataLegacySchema.extend({
    locked: z.boolean(),
  })

export const GenerationNodeDataSchemaV4Base
  = ImageGenerationNodeDataSchemaV3Base.extend({
    operationId: z.string(),
  })
export const GenerationNodeDataSchemaBase = GenerationNodeDataSchemaV4Base.extend({
  modelContractVersion: z.string(),
})

export const LEGACY_IMAGE_MODEL_IDS = new Set([
  'talelabs/image-draft',
  'talelabs/image-studio',
])

export function refineGenerationNodeData(
  data: z.infer<typeof GenerationNodeDataSchemaBase>,
  context: z.RefinementCtx,
  mediaType: GenerationOutputType,
  nodeType?: Exclude<FlowNodeType, 'asset' | 'audioGeneration' | 'text'>,
) {
  if (!isGenerationModelContractVersion(data.modelContractVersion)) {
    context.addIssue({
      code: 'custom',
      message: 'unknown_model_contract_version',
      path: ['modelContractVersion'],
    })
    return
  }
  const model = getGenerationModel(data.modelId, data.modelContractVersion)
  if (!model) {
    context.addIssue({
      code: 'custom',
      message: 'unknown_model',
      path: ['modelId'],
    })
    return
  }
  if (model.mediaType !== mediaType) {
    context.addIssue({
      code: 'custom',
      message: 'invalid_model_media_type',
      path: ['modelId'],
    })
    return
  }

  const operation = getGenerationOperation(model, data.operationId)
  if (!operation) {
    context.addIssue({
      code: 'custom',
      message: 'unknown_operation',
      path: ['operationId'],
    })
    return
  }
  if (nodeType && operation.nodeType !== nodeType) {
    context.addIssue({
      code: 'custom',
      message: 'invalid_operation_node_type',
      path: ['operationId'],
    })
    return
  }

  const settingIds = new Set(model.settings.map(setting => setting.id))
  for (const settingId of Object.keys(data.settings)) {
    if (!settingIds.has(settingId)) {
      context.addIssue({
        code: 'custom',
        message: 'unknown_setting',
        path: ['settings', settingId],
      })
    }
  }

  const inputSlotIds = new Set(model.inputSlots.map(slot => slot.id))
  for (const slotId of Object.keys(data.inputSelections)) {
    if (!inputSlotIds.has(slotId)) {
      context.addIssue({
        code: 'custom',
        message: 'unknown_input_selection',
        path: ['inputSelections', slotId],
      })
    }
  }
  for (const slot of model.inputSlots) {
    if (!data.inputSelections[slot.id]) {
      context.addIssue({
        code: 'custom',
        message: 'missing_input_selection',
        path: ['inputSelections', slot.id],
      })
    }
  }

  for (const setting of model.settings) {
    const value = data.settings[setting.id]
    if (value === undefined) {
      context.addIssue({
        code: 'custom',
        message: 'missing_setting',
        path: ['settings', setting.id],
      })
      continue
    }

    if (!isGenerationSettingValueValid(setting, value)) {
      context.addIssue({
        code: 'custom',
        message: 'invalid_setting',
        path: ['settings', setting.id],
      })
    }
  }

  for (const constraint of model.constraints) {
    if (constraint.when.some(condition => condition.field === 'slot'))
      continue
    const conditionContext = {
      operationId: operation.id,
      settings: data.settings,
    }
    if (
      !constraint.when.every(condition =>
        matchesGenerationCondition(condition, conditionContext),
      )
    ) {
      continue
    }
    if (
      constraint.require?.some(
        condition =>
          condition.field !== 'slot'
          && !matchesGenerationCondition(condition, conditionContext),
      )
    ) {
      context.addIssue({
        code: 'custom',
        message: constraint.id,
        path: ['settings'],
      })
    }
    if (
      constraint.forbid?.every(
        condition =>
          condition.field !== 'slot'
          && matchesGenerationCondition(condition, conditionContext),
      )
    ) {
      context.addIssue({
        code: 'custom',
        message: constraint.id,
        path: ['settings'],
      })
    }
  }
}

export function createGenerationNodeDataSchema(mediaType: GenerationOutputType) {
  return GenerationNodeDataSchemaBase.superRefine((data, context) => {
    refineGenerationNodeData(data, context, mediaType)
  })
}

export function createIntentGenerationNodeDataSchema(
  nodeType: Exclude<
    FlowNodeType,
    'asset' | 'audioGeneration' | 'text'
  >,
  fields: Record<string, z.ZodType> = {},
) {
  return GenerationNodeDataSchemaBase.extend(fields).superRefine(
    (data, context) => {
      refineGenerationNodeData(
        data as z.infer<typeof GenerationNodeDataSchemaBase>,
        context,
        getGenerationMediaTypeForNode(nodeType),
        nodeType,
      )
    },
  )
}

export const ImageGenerationNodeDataSchemaV1 = GenerationNodeDataLegacySchema
export const ImageGenerationNodeDataSchemaV2 = GenerationNodeDataLegacySchema
export const ImageGenerationNodeDataSchemaV3
  = ImageGenerationNodeDataSchemaV3Base.superRefine((data, context) => {
    if (
      !isGenerationModelId(data.modelId)
      && !LEGACY_IMAGE_MODEL_IDS.has(data.modelId)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'unknown_model',
        path: ['modelId'],
      })
    }
  })
export const ImageGenerationNodeDataSchemaV4
  = GenerationNodeDataSchemaV4Base.superRefine((data, context) => {
    refineGenerationNodeData(
      {
        ...data,
        modelContractVersion: GENERATION_MODEL_CONTRACT_VERSION_2026_07_12_2,
      },
      context,
      'image',
    )
  })
export const ImageGenerationNodeDataSchemaV5 = createGenerationNodeDataSchema('image')
export const ImageGenerationNodeDataSchemaV6Base = GenerationNodeDataSchemaBase.extend(
  {
    prompt: z.string().max(16_000),
  },
)
export const ImageGenerationNodeDataSchemaV6
  = ImageGenerationNodeDataSchemaV6Base.superRefine((data, context) => {
    refineGenerationNodeData(data, context, 'image')
  })
export const ImageGenerationNodeDataSchemaV7Base = ImageGenerationNodeDataSchemaV6Base.extend({
  crop: FlowImageCropSchema.optional(),
})
export const ImageGenerationNodeDataSchemaV7
  = ImageGenerationNodeDataSchemaV7Base.superRefine((data, context) => {
    refineGenerationNodeData(data, context, 'image')
  })
export const VideoGenerationNodeDataSchemaV1
  = GenerationNodeDataSchemaV4Base.superRefine((data, context) => {
    refineGenerationNodeData(
      {
        ...data,
        modelContractVersion: GENERATION_MODEL_CONTRACT_VERSION_2026_07_12_2,
      },
      context,
      'video',
    )
  })
export const VideoGenerationNodeDataSchemaV2 = createGenerationNodeDataSchema('video')
export const VideoGenerationNodeDataSchemaV3Base = GenerationNodeDataSchemaBase.extend(
  {
    prompt: z.string().max(16_000),
  },
)
export const VideoGenerationNodeDataSchemaV3
  = VideoGenerationNodeDataSchemaV3Base.superRefine((data, context) => {
    refineGenerationNodeData(data, context, 'video')
  })
export const AudioGenerationNodeDataSchemaV1
  = GenerationNodeDataSchemaV4Base.superRefine((data, context) => {
    refineGenerationNodeData(
      {
        ...data,
        modelContractVersion: GENERATION_MODEL_CONTRACT_VERSION_2026_07_12_2,
      },
      context,
      'audio',
    )
  })
export const AudioGenerationNodeDataSchemaV2 = createGenerationNodeDataSchema('audio')
export const SpeechGenerationNodeDataSchemaV1 = createIntentGenerationNodeDataSchema(
  'speechGeneration',
  { prompt: z.string().max(16_000) },
)
export const MusicGenerationNodeDataSchemaV1 = createIntentGenerationNodeDataSchema(
  'musicGeneration',
  {
    lyrics: z.string().max(16_000),
    prompt: z.string().max(16_000),
  },
)
export const SoundEffectGenerationNodeDataSchemaV1
  = createIntentGenerationNodeDataSchema(
    'soundEffectGeneration',
    { prompt: z.string().max(16_000) },
  )
export const VoiceChangerNodeDataSchemaV1 = createIntentGenerationNodeDataSchema(
  'voiceChanger',
)
export const VoiceIsolationNodeDataSchemaV1 = createIntentGenerationNodeDataSchema(
  'voiceIsolation',
)
export const LlmNodeDataSchemaV1Base = GenerationNodeDataSchemaBase.extend({
  instructions: z.string().max(16_000),
  locked: z.boolean(),
  prompt: z.string().max(16_000),
})
export const LlmNodeDataSchemaV1 = LlmNodeDataSchemaV1Base.superRefine(
  (data, context) => {
    refineGenerationNodeData(data, context, 'text')
  },
)
