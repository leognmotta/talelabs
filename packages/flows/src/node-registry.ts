import type { GenerationOutputType } from './generation-registry.js'
import type {
  FlowGraphNode,
  FlowHandleDefinition,
  FlowNodeType,
  FlowNodeTypeDefinition,
  ParsedFlowNodeData,
} from './types.js'

import { z } from 'zod'
import {
  DEFAULT_GENERATION_MODEL_IDS,
  GENERATION_MODEL_CONTRACT_VERSION_2026_07_12_2,
  getDefaultGenerationData,
  getDefaultGenerationDataForNodeType,
  getGenerationMediaTypeForNode,
  getGenerationModel,
  getGenerationOperation,
  isGenerationModelContractVersion,
  isGenerationModelId,
  isGenerationNodeType,
  isGenerationSettingValueValid,
  matchesGenerationCondition,
} from './generation-registry.js'

const EmptyNodeDataSchema = z.strictObject({})
const LockedNodeDataSchema = z.strictObject({
  locked: z.boolean(),
})

const FlowImageCropSchema = z
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
const AssetNodeDataSchemaV3 = LockedNodeDataSchema.extend({
  crop: FlowImageCropSchema.optional(),
})

const TextNodeDataSchemaV1 = z.strictObject({
  text: z.string().max(16_000),
})
const TextNodeDataSchemaV2 = TextNodeDataSchemaV1.extend({
  locked: z.boolean(),
})

const InputSelectionSchema = z.discriminatedUnion('mode', [
  z.strictObject({ mode: z.literal('auto') }),
  z.strictObject({
    assetIds: z.array(z.string()).max(64),
    mode: z.literal('manual'),
  }),
])

const GenerationNodeDataLegacySchema = z.strictObject({
  inputSelections: z.record(z.string(), InputSelectionSchema),
  modelId: z.string(),
  settings: z.record(
    z.string(),
    z.union([z.boolean(), z.number(), z.string()]),
  ),
})
const ImageGenerationNodeDataSchemaV3Base
  = GenerationNodeDataLegacySchema.extend({
    locked: z.boolean(),
  })

const GenerationNodeDataSchemaV4Base
  = ImageGenerationNodeDataSchemaV3Base.extend({
    operationId: z.string(),
  })
const GenerationNodeDataSchemaBase = GenerationNodeDataSchemaV4Base.extend({
  modelContractVersion: z.string(),
})

const LEGACY_IMAGE_MODEL_IDS = new Set([
  'talelabs/image-draft',
  'talelabs/image-studio',
])

function refineGenerationNodeData(
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

function createGenerationNodeDataSchema(mediaType: GenerationOutputType) {
  return GenerationNodeDataSchemaBase.superRefine((data, context) => {
    refineGenerationNodeData(data, context, mediaType)
  })
}

function createIntentGenerationNodeDataSchema(
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

const ImageGenerationNodeDataSchemaV1 = GenerationNodeDataLegacySchema
const ImageGenerationNodeDataSchemaV2 = GenerationNodeDataLegacySchema
const ImageGenerationNodeDataSchemaV3
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
const ImageGenerationNodeDataSchemaV4
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
const ImageGenerationNodeDataSchemaV5 = createGenerationNodeDataSchema('image')
const ImageGenerationNodeDataSchemaV6Base = GenerationNodeDataSchemaBase.extend(
  {
    prompt: z.string().max(16_000),
  },
)
const ImageGenerationNodeDataSchemaV6
  = ImageGenerationNodeDataSchemaV6Base.superRefine((data, context) => {
    refineGenerationNodeData(data, context, 'image')
  })
const ImageGenerationNodeDataSchemaV7Base = ImageGenerationNodeDataSchemaV6Base.extend({
  crop: FlowImageCropSchema.optional(),
})
const ImageGenerationNodeDataSchemaV7
  = ImageGenerationNodeDataSchemaV7Base.superRefine((data, context) => {
    refineGenerationNodeData(data, context, 'image')
  })
const VideoGenerationNodeDataSchemaV1
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
const VideoGenerationNodeDataSchemaV2 = createGenerationNodeDataSchema('video')
const VideoGenerationNodeDataSchemaV3Base = GenerationNodeDataSchemaBase.extend(
  {
    prompt: z.string().max(16_000),
  },
)
const VideoGenerationNodeDataSchemaV3
  = VideoGenerationNodeDataSchemaV3Base.superRefine((data, context) => {
    refineGenerationNodeData(data, context, 'video')
  })
const AudioGenerationNodeDataSchemaV1
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
const AudioGenerationNodeDataSchemaV2 = createGenerationNodeDataSchema('audio')
const SpeechGenerationNodeDataSchemaV1 = createIntentGenerationNodeDataSchema(
  'speechGeneration',
  { prompt: z.string().max(16_000) },
)
const MusicGenerationNodeDataSchemaV1 = createIntentGenerationNodeDataSchema(
  'musicGeneration',
  {
    lyrics: z.string().max(16_000),
    prompt: z.string().max(16_000),
  },
)
const SoundEffectGenerationNodeDataSchemaV1
  = createIntentGenerationNodeDataSchema(
    'soundEffectGeneration',
    { prompt: z.string().max(16_000) },
  )
const VoiceChangerNodeDataSchemaV1 = createIntentGenerationNodeDataSchema(
  'voiceChanger',
)
const VoiceIsolationNodeDataSchemaV1 = createIntentGenerationNodeDataSchema(
  'voiceIsolation',
)
const LlmNodeDataSchemaV1Base = GenerationNodeDataSchemaBase.extend({
  instructions: z.string().max(16_000),
  locked: z.boolean(),
  prompt: z.string().max(16_000),
})
const LlmNodeDataSchemaV1 = LlmNodeDataSchemaV1Base.superRefine(
  (data, context) => {
    refineGenerationNodeData(data, context, 'text')
  },
)

function migrateImageGenerationNodeDataV1(data: unknown) {
  const parsed = GenerationNodeDataLegacySchema.parse(data)
  const { outputCount: _outputCount, ...settings } = parsed.settings
  return { ...parsed, settings }
}

function migrateImageGenerationNodeDataV3(data: unknown) {
  const parsed = ImageGenerationNodeDataSchemaV3Base.parse(data)
  const legacyModel = LEGACY_IMAGE_MODEL_IDS.has(parsed.modelId)
  const modelId = legacyModel
    ? DEFAULT_GENERATION_MODEL_IDS.image
    : parsed.modelId
  const model
    = getGenerationModel(modelId)
      ?? getGenerationModel(DEFAULT_GENERATION_MODEL_IDS.image)!
  return {
    ...parsed,
    inputSelections: Object.fromEntries(
      model.inputSlots.map(slot => [
        slot.id,
        parsed.inputSelections[slot.id] ?? { mode: 'auto' },
      ]),
    ),
    modelId: model.id,
    operationId: legacyModel ? 'imageToImage' : model.defaultOperationId,
    settings: Object.fromEntries(
      model.settings.map(setting => [
        setting.id,
        legacyModel
          ? setting.default
          : (parsed.settings[setting.id] ?? setting.default),
      ]),
    ),
  }
}

function addGenerationModelContractVersion(data: unknown) {
  return {
    ...(data as Record<string, unknown>),
    modelContractVersion: GENERATION_MODEL_CONTRACT_VERSION_2026_07_12_2,
  }
}

function addLockedState<T extends Record<string, unknown>>(data: T) {
  return { ...data, locked: false }
}

const textHandles = Object.freeze([
  {
    direction: 'output',
    id: 'text',
    maxConnections: null,
    minConnections: 0,
    valueTypes: ['Text'],
  },
] as const satisfies readonly FlowHandleDefinition[])

const llmOutputHandles = textHandles

const imageGenerationOutputHandles = Object.freeze([
  {
    direction: 'output',
    id: 'images',
    maxConnections: null,
    minConnections: 0,
    valueTypes: ['ImageSet'],
  },
] as const satisfies readonly FlowHandleDefinition[])

const videoGenerationOutputHandles = Object.freeze([
  {
    direction: 'output',
    id: 'videos',
    maxConnections: null,
    minConnections: 0,
    valueTypes: ['VideoSet'],
  },
] as const satisfies readonly FlowHandleDefinition[])

const audioGenerationOutputHandles = Object.freeze([
  {
    direction: 'output',
    id: 'audio',
    maxConnections: null,
    minConnections: 0,
    valueTypes: ['AudioSet'],
  },
] as const satisfies readonly FlowHandleDefinition[])

export const FLOW_NODE_TYPE_REGISTRY = Object.freeze({
  asset: {
    currentVersion: 3,
    id: 'asset',
    migrations: {
      1: (data: unknown) => addLockedState(EmptyNodeDataSchema.parse(data)),
      2: (data: unknown) => LockedNodeDataSchema.parse(data),
    },
    reference: 'asset',
    schemas: {
      1: EmptyNodeDataSchema,
      2: LockedNodeDataSchema,
      3: AssetNodeDataSchemaV3,
    },
    staticHandles: [],
  },
  audioGeneration: {
    currentVersion: 2,
    id: 'audioGeneration',
    migrations: { 1: addGenerationModelContractVersion },
    reference: 'none',
    schemas: {
      1: AudioGenerationNodeDataSchemaV1,
      2: AudioGenerationNodeDataSchemaV2,
    },
    staticHandles: audioGenerationOutputHandles,
  },
  imageGeneration: {
    currentVersion: 7,
    id: 'imageGeneration',
    migrations: {
      1: migrateImageGenerationNodeDataV1,
      2: (data: unknown) =>
        addLockedState(ImageGenerationNodeDataSchemaV2.parse(data)),
      3: migrateImageGenerationNodeDataV3,
      4: addGenerationModelContractVersion,
      5: (data: unknown) => ({
        ...GenerationNodeDataSchemaBase.parse(data),
        prompt: '',
      }),
      6: (data: unknown) => ImageGenerationNodeDataSchemaV6.parse(data),
    },
    reference: 'none',
    schemas: {
      1: ImageGenerationNodeDataSchemaV1,
      2: ImageGenerationNodeDataSchemaV2,
      3: ImageGenerationNodeDataSchemaV3,
      4: ImageGenerationNodeDataSchemaV4,
      5: ImageGenerationNodeDataSchemaV5,
      6: ImageGenerationNodeDataSchemaV6,
      7: ImageGenerationNodeDataSchemaV7,
    },
    staticHandles: imageGenerationOutputHandles,
  },
  llm: {
    currentVersion: 1,
    id: 'llm',
    migrations: {},
    reference: 'none',
    schemas: { 1: LlmNodeDataSchemaV1 },
    staticHandles: llmOutputHandles,
  },
  musicGeneration: {
    currentVersion: 1,
    id: 'musicGeneration',
    migrations: {},
    reference: 'none',
    schemas: { 1: MusicGenerationNodeDataSchemaV1 },
    staticHandles: audioGenerationOutputHandles,
  },
  soundEffectGeneration: {
    currentVersion: 1,
    id: 'soundEffectGeneration',
    migrations: {},
    reference: 'none',
    schemas: { 1: SoundEffectGenerationNodeDataSchemaV1 },
    staticHandles: audioGenerationOutputHandles,
  },
  speechGeneration: {
    currentVersion: 1,
    id: 'speechGeneration',
    migrations: {},
    reference: 'none',
    schemas: { 1: SpeechGenerationNodeDataSchemaV1 },
    staticHandles: audioGenerationOutputHandles,
  },
  text: {
    currentVersion: 2,
    id: 'text',
    migrations: {
      1: (data: unknown) => addLockedState(TextNodeDataSchemaV1.parse(data)),
    },
    reference: 'none',
    schemas: { 1: TextNodeDataSchemaV1, 2: TextNodeDataSchemaV2 },
    staticHandles: textHandles,
  },
  videoGeneration: {
    currentVersion: 3,
    id: 'videoGeneration',
    migrations: {
      1: addGenerationModelContractVersion,
      2: (data: unknown) => ({
        ...GenerationNodeDataSchemaBase.parse(data),
        prompt: '',
      }),
    },
    reference: 'none',
    schemas: {
      1: VideoGenerationNodeDataSchemaV1,
      2: VideoGenerationNodeDataSchemaV2,
      3: VideoGenerationNodeDataSchemaV3,
    },
    staticHandles: videoGenerationOutputHandles,
  },
  voiceChanger: {
    currentVersion: 1,
    id: 'voiceChanger',
    migrations: {},
    reference: 'none',
    schemas: { 1: VoiceChangerNodeDataSchemaV1 },
    staticHandles: audioGenerationOutputHandles,
  },
  voiceIsolation: {
    currentVersion: 1,
    id: 'voiceIsolation',
    migrations: {},
    reference: 'none',
    schemas: { 1: VoiceIsolationNodeDataSchemaV1 },
    staticHandles: audioGenerationOutputHandles,
  },
} as const satisfies Record<FlowNodeType, FlowNodeTypeDefinition>)

export const FLOW_NODE_TYPES = Object.freeze(
  Object.keys(FLOW_NODE_TYPE_REGISTRY) as FlowNodeType[],
)

export function isFlowNodeType(value: unknown): value is FlowNodeType {
  return typeof value === 'string' && value in FLOW_NODE_TYPE_REGISTRY
}

export function getFlowNodeTypeDefinition(type: FlowNodeType) {
  return FLOW_NODE_TYPE_REGISTRY[type] as FlowNodeTypeDefinition
}

function migrateLegacyAudioGenerationNode(
  parsed: ParsedFlowNodeData,
): ParsedFlowNodeData {
  if (parsed.type !== 'audioGeneration')
    return parsed

  const legacyData = parsed.data
  const targetType = legacyData.modelId === 'talelabs/eleven-multilingual-v2'
    && legacyData.operationId === 'textToSpeech'
    ? 'speechGeneration'
    : legacyData.modelId === 'talelabs/eleven-sound-effects-v2'
      && legacyData.operationId === 'textToSoundEffect'
      ? 'soundEffectGeneration'
      : null
  if (!targetType)
    return parsed

  const defaults = getDefaultGenerationDataForNodeType(targetType)
  const targetModel = getGenerationModel(
    defaults.modelId,
    defaults.modelContractVersion,
  )
  if (!targetModel)
    throw new Error(`Missing migration model for ${targetType}`)

  const legacySettings
    = legacyData.settings && typeof legacyData.settings === 'object'
      ? legacyData.settings as Record<string, boolean | number | string>
      : {}
  const settings = Object.fromEntries(
    targetModel.settings.map((setting) => {
      const legacyValue = legacySettings[setting.id]
      return [
        setting.id,
        legacyValue !== undefined
        && isGenerationSettingValueValid(setting, legacyValue)
          ? legacyValue
          : setting.default,
      ]
    }),
  )
  if (
    targetType === 'soundEffectGeneration'
    && legacySettings.durationMode === undefined
    && typeof legacySettings.durationSeconds === 'number'
  ) {
    settings.durationMode = 'custom'
  }

  const legacySelections
    = legacyData.inputSelections && typeof legacyData.inputSelections === 'object'
      ? legacyData.inputSelections as Record<string, unknown>
      : {}
  const inputSelections = Object.fromEntries(
    Object.entries(defaults.inputSelections).map(([slotId, fallback]) => [
      slotId,
      legacySelections[slotId] ?? fallback,
    ]),
  )
  const targetDefinition = getFlowNodeTypeDefinition(targetType)
  const targetData = targetDefinition.schemas[targetDefinition.currentVersion]
    ?.parse({
      ...defaults,
      inputSelections,
      locked: legacyData.locked === true,
      settings,
    })
  if (!targetData)
    throw new Error(`Missing ${targetType} migration schema`)

  return {
    data: targetData as Record<string, unknown>,
    schemaVersion: targetDefinition.currentVersion,
    type: targetType,
  }
}

export function parseAndUpcastFlowNodeData(input: {
  data: unknown
  schemaVersion: number
  type: string
}): ParsedFlowNodeData {
  if (!isFlowNodeType(input.type))
    throw new Error(`Unknown Flow node type: ${input.type}`)

  const definition = getFlowNodeTypeDefinition(input.type)
  if (
    !Number.isInteger(input.schemaVersion)
    || input.schemaVersion < 1
    || input.schemaVersion > definition.currentVersion
  ) {
    throw new Error(
      `Unsupported ${input.type} node schema version: ${input.schemaVersion}`,
    )
  }

  let version = input.schemaVersion
  let data = definition.schemas[version]?.parse(input.data)
  if (data === undefined)
    throw new Error(`Missing ${input.type} node schema version: ${version}`)

  while (version < definition.currentVersion) {
    const migration = definition.migrations[version]
    if (!migration) {
      throw new Error(
        `Missing ${input.type} node migration: ${version} -> ${version + 1}`,
      )
    }
    data = migration(data)
    version += 1
    const schema = definition.schemas[version]
    if (!schema)
      throw new Error(`Missing ${input.type} node schema version: ${version}`)
    data = schema.parse(data)
  }

  return migrateLegacyAudioGenerationNode({
    data: data as Record<string, unknown>,
    schemaVersion: definition.currentVersion,
    type: input.type,
  })
}

export function getDefaultNodeData(type: FlowNodeType) {
  if (type === 'text')
    return { locked: false, text: '' }
  if (isGenerationNodeType(type)) {
    return {
      ...(type === 'audioGeneration'
        ? getDefaultGenerationData(getGenerationMediaTypeForNode(type))
        : getDefaultGenerationDataForNodeType(type)),
      locked: false,
    }
  }
  return { locked: false }
}

function validateDefaultFlowNodeData() {
  const errors: string[] = []

  for (const type of FLOW_NODE_TYPES) {
    const definition = getFlowNodeTypeDefinition(type)
    try {
      parseAndUpcastFlowNodeData({
        data: getDefaultNodeData(type),
        schemaVersion: definition.currentVersion,
        type,
      })
    }
    catch {
      errors.push(`${type}: default node data must parse its current schema`)
    }
  }

  return errors
}

export function validateFlowNodeRegistry(
  registry: Record<string, FlowNodeTypeDefinition> = FLOW_NODE_TYPE_REGISTRY,
) {
  const errors: string[] = []

  for (const [key, definition] of Object.entries(registry)) {
    if (definition.id !== key)
      errors.push(`${key}: definition id must match its registry key`)
    if (
      !Number.isInteger(definition.currentVersion)
      || definition.currentVersion < 1
    ) {
      errors.push(`${key}: currentVersion must be a positive integer`)
    }

    for (let version = 1; version <= definition.currentVersion; version += 1) {
      if (!definition.schemas[version])
        errors.push(`${key}: missing schema version ${version}`)
      if (
        version < definition.currentVersion
        && !definition.migrations[version]
      ) {
        errors.push(`${key}: missing migration ${version} -> ${version + 1}`)
      }
    }

    const handles = definition.staticHandles
    const handleKeys = handles.map(
      handle => `${handle.direction}:${handle.id}`,
    )
    if (new Set(handleKeys).size !== handleKeys.length)
      errors.push(`${key}: static handle ids must be unique per direction`)
  }

  if (registry === FLOW_NODE_TYPE_REGISTRY)
    errors.push(...validateDefaultFlowNodeData())

  return errors
}

export function validateNodeReferences(node: FlowGraphNode) {
  if (!isFlowNodeType(node.type))
    return false
  const reference = getFlowNodeTypeDefinition(node.type).reference
  if (reference === 'asset')
    return true
  return node.assetId === null
}
