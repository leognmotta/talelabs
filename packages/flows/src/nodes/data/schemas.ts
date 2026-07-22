/** Runtime schemas for versioned provider-neutral Flow node data. */

import type { GenerationOutputType } from '../../generation/registry/index.js'
import type { FlowNodeType } from '../../graph/types.js'

import { z } from 'zod'
import {
  GENERATION_MODEL_CONTRACT_VERSION,
  getGenerationMediaTypeForNode,
  getGenerationModel,
  getGenerationOperation,
  isGenerationModelContractVersion,
  isGenerationModelId,
  isGenerationSettingValueValid,
  matchesGenerationCondition,
} from '../../generation/registry/index.js'
import { PromptTemplateSchema } from '../../prompts/schema.js'

/** Strict schema for node types with no persisted configuration. */
export const EmptyNodeDataSchema = z.strictObject({})
/** Shared lock state persisted by editable canvas nodes. */
export const LockedNodeDataSchema = z.strictObject({
  locked: z.boolean(),
})

/** Normalized crop rectangle persisted for Asset image presentation. */
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
/** Current persisted data schema for Asset source nodes. */
export const AssetNodeDataSchemaV3 = LockedNodeDataSchema.extend({
  crop: FlowImageCropSchema.optional(),
})

/** Mirrors MAX_ELEMENT_REFERENCES in @talelabs/assets (not a dependency here). */
const MAX_ELEMENT_NODE_REFERENCES = 8

/**
 * Persisted data schema for Element source nodes. The node stores the
 * referenced Element ID plus the explicit ordered subset of its references
 * the node emits; picking an Element always chooses what to use, and the
 * choice is never silently repaired when the Element changes later.
 */
export const ElementNodeDataSchema = LockedNodeDataSchema.extend({
  elementId: z.string().nullable(),
  selectedAssetIds: z.array(z.string()).max(MAX_ELEMENT_NODE_REFERENCES),
})

/** Legacy text-node data accepted during deterministic migration. */
export const TextNodeDataSchemaV1 = z.strictObject({
  text: z.string().max(16_000),
})
/** Current persisted data schema for Text source nodes. */
export const TextNodeDataSchemaV2 = TextNodeDataSchemaV1.extend({
  locked: z.boolean(),
})

/** Manual or automatic Asset-selection policy for one input slot. */
export const InputSelectionSchema = z.discriminatedUnion('mode', [
  z.strictObject({ mode: z.literal('auto') }),
  z.strictObject({
    assetIds: z.array(z.string()).max(64),
    mode: z.literal('manual'),
  }),
])

/** Legacy shared generation-node fields accepted only for migration. */
export const GenerationNodeDataLegacySchema = z.strictObject({
  inputSelections: z.record(z.string(), InputSelectionSchema),
  modelId: z.string(),
  settings: z.record(
    z.string(),
    z.union([z.boolean(), z.number(), z.string()]),
  ),
})
/** Legacy image-node base retained for deterministic upcasting. */
export const ImageGenerationNodeDataSchemaV3Base
  = GenerationNodeDataLegacySchema.extend({
    locked: z.boolean(),
  })

/** Catalog-era generation fields introduced before current contract pinning. */
export const GenerationNodeDataSchemaV4Base
  = ImageGenerationNodeDataSchemaV3Base.extend({
    operationId: z.string(),
  })
/** Current shared base for all model-adaptive generation node schemas. */
export const GenerationNodeDataSchemaBase = GenerationNodeDataSchemaV4Base.extend({
  modelContractVersion: z.string(),
})

/** Adds model, operation, setting, and selection consistency checks. */
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

/** Creates a current model-adaptive schema for one output family. */
export function createGenerationNodeDataSchema(mediaType: GenerationOutputType) {
  return GenerationNodeDataSchemaBase.superRefine((data, context) => {
    refineGenerationNodeData(data, context, mediaType)
  })
}

/** Creates a current schema constrained to one generation-node intent. */
export function createIntentGenerationNodeDataSchema(
  nodeType: Exclude<
    FlowNodeType,
    'asset' | 'audioGeneration' | 'element' | 'text'
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

/** Version 1 image-node schema retained for saved draft migration. */
export const ImageGenerationNodeDataSchemaV1 = GenerationNodeDataLegacySchema
/** Version 2 image-node schema retained for saved draft migration. */
export const ImageGenerationNodeDataSchemaV2 = GenerationNodeDataLegacySchema
/** Version 3 image-node schema retained for saved draft migration. */
export const ImageGenerationNodeDataSchemaV3
  = ImageGenerationNodeDataSchemaV3Base.superRefine((data, context) => {
    if (!isGenerationModelId(data.modelId)) {
      context.addIssue({
        code: 'custom',
        message: 'unknown_model',
        path: ['modelId'],
      })
    }
  })
/** Version 4 image-node schema retained for saved draft migration. */
export const ImageGenerationNodeDataSchemaV4
  = GenerationNodeDataSchemaV4Base.superRefine((data, context) => {
    refineGenerationNodeData(
      {
        ...data,
        modelContractVersion: GENERATION_MODEL_CONTRACT_VERSION,
      },
      context,
      'image',
    )
  })
/** Version 5 image-node schema retained for saved draft migration. */
export const ImageGenerationNodeDataSchemaV5 = createGenerationNodeDataSchema('image')
/** Version 6 image base retained for catalog identity migration. */
export const ImageGenerationNodeDataSchemaV6Base = GenerationNodeDataSchemaBase.extend(
  {
    prompt: z.string().max(16_000),
  },
)
/** Version 6 image-node schema retained for saved draft migration. */
export const ImageGenerationNodeDataSchemaV6
  = ImageGenerationNodeDataSchemaV6Base.superRefine((data, context) => {
    refineGenerationNodeData(data, context, 'image')
  })
/** Version 7 image base with canonical provider-neutral identity and crop. */
export const ImageGenerationNodeDataSchemaV7Base = ImageGenerationNodeDataSchemaV6Base.extend({
  crop: FlowImageCropSchema.optional(),
})
/** Version 7 image schema retained for structured-prompt migration. */
export const ImageGenerationNodeDataSchemaV7
  = ImageGenerationNodeDataSchemaV7Base.superRefine((data, context) => {
    refineGenerationNodeData(data, context, 'image')
  })
/** Current image base with a structured provider-neutral prompt. */
export const ImageGenerationNodeDataSchemaV8Base = GenerationNodeDataSchemaBase.extend({
  crop: FlowImageCropSchema.optional(),
  prompt: PromptTemplateSchema,
})
/** Current canonical image generation node data schema. */
export const ImageGenerationNodeDataSchemaV8
  = ImageGenerationNodeDataSchemaV8Base.superRefine((data, context) => {
    refineGenerationNodeData(data, context, 'image')
  })
/** Version 1 video-node schema retained for saved draft migration. */
export const VideoGenerationNodeDataSchemaV1
  = GenerationNodeDataSchemaV4Base.superRefine((data, context) => {
    refineGenerationNodeData(
      {
        ...data,
        modelContractVersion: GENERATION_MODEL_CONTRACT_VERSION,
      },
      context,
      'video',
    )
  })
/** Version 2 video-node schema retained for saved draft migration. */
export const VideoGenerationNodeDataSchemaV2 = createGenerationNodeDataSchema('video')
/** Version 3 video base with canonical provider-neutral model identity. */
export const VideoGenerationNodeDataSchemaV3Base = GenerationNodeDataSchemaBase.extend(
  {
    prompt: z.string().max(16_000),
  },
)
/** Version 3 video schema retained for structured-prompt migration. */
export const VideoGenerationNodeDataSchemaV3
  = VideoGenerationNodeDataSchemaV3Base.superRefine((data, context) => {
    refineGenerationNodeData(data, context, 'video')
  })
/** Current video base with a structured provider-neutral prompt. */
export const VideoGenerationNodeDataSchemaV4Base = GenerationNodeDataSchemaBase.extend({
  prompt: PromptTemplateSchema,
})
/** Current canonical video generation node data schema. */
export const VideoGenerationNodeDataSchemaV4
  = VideoGenerationNodeDataSchemaV4Base.superRefine((data, context) => {
    refineGenerationNodeData(data, context, 'video')
  })
/** Version 1 generic audio-node schema retained for saved draft migration. */
export const AudioGenerationNodeDataSchemaV1
  = GenerationNodeDataSchemaV4Base.superRefine((data, context) => {
    refineGenerationNodeData(
      {
        ...data,
        modelContractVersion: GENERATION_MODEL_CONTRACT_VERSION,
      },
      context,
      'audio',
    )
  })
/** Current canonical generic audio generation node data schema. */
export const AudioGenerationNodeDataSchemaV2 = createGenerationNodeDataSchema('audio')
/** Version 1 speech schema retained for structured-prompt migration. */
export const SpeechGenerationNodeDataSchemaV1 = createIntentGenerationNodeDataSchema(
  'speechGeneration',
  { prompt: z.string().max(16_000) },
)
/** Current canonical speech data with a structured prompt. */
export const SpeechGenerationNodeDataSchemaV2 = createIntentGenerationNodeDataSchema(
  'speechGeneration',
  { prompt: PromptTemplateSchema },
)
/** Version 1 music schema retained for structured-prompt migration. */
export const MusicGenerationNodeDataSchemaV1 = createIntentGenerationNodeDataSchema(
  'musicGeneration',
  {
    lyrics: z.string().max(16_000),
    prompt: z.string().max(16_000),
  },
)
/** Current canonical music data with structured prompt and plain lyrics. */
export const MusicGenerationNodeDataSchemaV2 = createIntentGenerationNodeDataSchema(
  'musicGeneration',
  {
    lyrics: z.string().max(16_000),
    prompt: PromptTemplateSchema,
  },
)
/** Version 1 sound-effect schema retained for structured-prompt migration. */
export const SoundEffectGenerationNodeDataSchemaV1
  = createIntentGenerationNodeDataSchema(
    'soundEffectGeneration',
    { prompt: z.string().max(16_000) },
  )
/** Current canonical sound-effect data with a structured prompt. */
export const SoundEffectGenerationNodeDataSchemaV2
  = createIntentGenerationNodeDataSchema(
    'soundEffectGeneration',
    { prompt: PromptTemplateSchema },
  )
/** Current canonical voice-changer node data schema. */
export const VoiceChangerNodeDataSchemaV1 = createIntentGenerationNodeDataSchema(
  'voiceChanger',
)
/** Legacy voice-isolation data with the former union sourceMedia selection. */
export const VoiceIsolationNodeDataSchemaV1
  = GenerationNodeDataSchemaBase.superRefine((data, context) => {
    const legacySelection = data.inputSelections.sourceMedia ?? { mode: 'auto' }
    refineGenerationNodeData(
      {
        ...data,
        inputSelections: {
          sourceAudio: data.inputSelections.sourceAudio ?? legacySelection,
          sourceVideo: data.inputSelections.sourceVideo ?? legacySelection,
        },
      },
      context,
      'audio',
      'voiceIsolation',
    )
  })
/** Current voice-isolation data with exclusive typed source selections. */
export const VoiceIsolationNodeDataSchemaV2 = createIntentGenerationNodeDataSchema(
  'voiceIsolation',
)
/** Version 1 LLM base retained for structured-prompt migration. */
export const LlmNodeDataSchemaV1Base = GenerationNodeDataSchemaBase.extend({
  instructions: z.string().max(16_000),
  locked: z.boolean(),
  prompt: z.string().max(16_000),
})
/** Version 1 LLM schema retained for structured-prompt migration. */
export const LlmNodeDataSchemaV1 = LlmNodeDataSchemaV1Base.superRefine(
  (data, context) => {
    refineGenerationNodeData(data, context, 'text')
  },
)
/** Current LLM base with plain instructions and a structured prompt. */
export const LlmNodeDataSchemaV2Base = GenerationNodeDataSchemaBase.extend({
  instructions: z.string().max(16_000),
  locked: z.boolean(),
  prompt: PromptTemplateSchema,
})
/** Current canonical LLM node data schema. */
export const LlmNodeDataSchemaV2 = LlmNodeDataSchemaV2Base.superRefine(
  (data, context) => {
    refineGenerationNodeData(data, context, 'text')
  },
)
