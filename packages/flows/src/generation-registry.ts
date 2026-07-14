import type {
  GenerationCandidateOrigin,
  GenerationCandidateSelectionSnapshot,
  GenerationConditionDefinition,
  GenerationModelDefinition,
  GenerationNodeType,
  GenerationOutputType,
  GenerationReferenceCandidate,
  GenerationSettingDefinition,
  GenerationSettingValue,
} from './generation-registry-types.js'
import {
  CURRENT_GENERATION_MODEL_REGISTRY,
  GENERATION_MODEL_REGISTRY_2026_07_13_7,
} from './generation-registry-current.js'
import {
  GENERATION_MODEL_CONTRACT_VERSION_2026_07_12_2,
  GENERATION_MODEL_CONTRACT_VERSION_2026_07_12_3,
  GENERATION_MODEL_CONTRACT_VERSION_2026_07_12_4,
  GENERATION_MODEL_CONTRACT_VERSION_2026_07_12_5,
  GENERATION_MODEL_REGISTRY_2026_07_12_2,
  GENERATION_MODEL_REGISTRY_2026_07_12_3,
  GENERATION_MODEL_REGISTRY_2026_07_12_4,
  GENERATION_MODEL_REGISTRY_2026_07_12_5,
  GENERATION_MODEL_REGISTRY_2026_07_13_1,
  GENERATION_MODEL_REGISTRY_2026_07_13_2,
  GENERATION_MODEL_REGISTRY_2026_07_13_3,
  GENERATION_MODEL_REGISTRY_2026_07_13_4,
  GENERATION_MODEL_REGISTRY_2026_07_13_5,
  GENERATION_MODEL_REGISTRY_2026_07_13_6,
} from './generation-registry-history.js'

export * from './generation-provider-contracts.js'
export * from './generation-registry-types.js'
export {
  GENERATION_MODEL_CONTRACT_VERSION_2026_07_12_2,
  GENERATION_MODEL_CONTRACT_VERSION_2026_07_12_3,
  GENERATION_MODEL_CONTRACT_VERSION_2026_07_12_4,
  GENERATION_MODEL_CONTRACT_VERSION_2026_07_12_5,
  GENERATION_MODEL_REGISTRY_2026_07_12_2,
  GENERATION_MODEL_REGISTRY_2026_07_12_3,
  GENERATION_MODEL_REGISTRY_2026_07_12_4,
  GENERATION_MODEL_REGISTRY_2026_07_12_5,
  GENERATION_MODEL_REGISTRY_2026_07_13_1,
  GENERATION_MODEL_REGISTRY_2026_07_13_2,
  GENERATION_MODEL_REGISTRY_2026_07_13_3,
  GENERATION_MODEL_REGISTRY_2026_07_13_4,
  GENERATION_MODEL_REGISTRY_2026_07_13_5,
  GENERATION_MODEL_REGISTRY_2026_07_13_6,
}

export const GENERATION_MODEL_CONTRACT_VERSION_2026_07_13_1 = '2026-07-13.1'
export const GENERATION_MODEL_CONTRACT_VERSION_2026_07_13_2 = '2026-07-13.2'
export const GENERATION_MODEL_CONTRACT_VERSION_2026_07_13_3 = '2026-07-13.3'
export const GENERATION_MODEL_CONTRACT_VERSION_2026_07_13_4 = '2026-07-13.4'
export const GENERATION_MODEL_CONTRACT_VERSION_2026_07_13_5 = '2026-07-13.5'
export const GENERATION_MODEL_CONTRACT_VERSION_2026_07_13_6 = '2026-07-13.6'
export const GENERATION_MODEL_CONTRACT_VERSION_2026_07_13_7 = '2026-07-13.7'
export const GENERATION_MODEL_CONTRACT_VERSION_2026_07_13_8 = '2026-07-13.8'
export const GENERATION_MODEL_CONTRACT_VERSION
  = GENERATION_MODEL_CONTRACT_VERSION_2026_07_13_8
export const GENERATION_REGISTRY_VERSION = `${GENERATION_MODEL_CONTRACT_VERSION}-presentation.1`
export { GENERATION_MODEL_REGISTRY_2026_07_13_7 }
export const GENERATION_MODEL_REGISTRY_2026_07_13_8
  = CURRENT_GENERATION_MODEL_REGISTRY

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object')
    return value
  for (const nested of Object.values(value)) deepFreeze(nested)
  return Object.isFrozen(value) ? value : Object.freeze(value)
}

/**
 * Immutable model contracts retained by version. A capability change always
 * adds an entry; persisted Flow nodes continue resolving their captured entry.
 */
export const GENERATION_MODEL_CONTRACTS = deepFreeze({
  [GENERATION_MODEL_CONTRACT_VERSION_2026_07_12_2]:
    GENERATION_MODEL_REGISTRY_2026_07_12_2,
  [GENERATION_MODEL_CONTRACT_VERSION_2026_07_12_3]:
    GENERATION_MODEL_REGISTRY_2026_07_12_3,
  [GENERATION_MODEL_CONTRACT_VERSION_2026_07_12_4]:
    GENERATION_MODEL_REGISTRY_2026_07_12_4,
  [GENERATION_MODEL_CONTRACT_VERSION_2026_07_12_5]:
    GENERATION_MODEL_REGISTRY_2026_07_12_5,
  [GENERATION_MODEL_CONTRACT_VERSION_2026_07_13_1]:
    GENERATION_MODEL_REGISTRY_2026_07_13_1,
  [GENERATION_MODEL_CONTRACT_VERSION_2026_07_13_2]:
    GENERATION_MODEL_REGISTRY_2026_07_13_2,
  [GENERATION_MODEL_CONTRACT_VERSION_2026_07_13_3]:
    GENERATION_MODEL_REGISTRY_2026_07_13_3,
  [GENERATION_MODEL_CONTRACT_VERSION_2026_07_13_4]:
    GENERATION_MODEL_REGISTRY_2026_07_13_4,
  [GENERATION_MODEL_CONTRACT_VERSION_2026_07_13_5]:
    GENERATION_MODEL_REGISTRY_2026_07_13_5,
  [GENERATION_MODEL_CONTRACT_VERSION_2026_07_13_6]:
    GENERATION_MODEL_REGISTRY_2026_07_13_6,
  [GENERATION_MODEL_CONTRACT_VERSION_2026_07_13_7]:
    GENERATION_MODEL_REGISTRY_2026_07_13_7,
  [GENERATION_MODEL_CONTRACT_VERSION_2026_07_13_8]:
    GENERATION_MODEL_REGISTRY_2026_07_13_8,
})

export type GenerationModelContractVersion
  = keyof typeof GENERATION_MODEL_CONTRACTS

export const GENERATION_MODEL_REGISTRY
  = GENERATION_MODEL_CONTRACTS[GENERATION_MODEL_CONTRACT_VERSION]

export type GenerationModelId = Extract<
  keyof typeof GENERATION_MODEL_REGISTRY,
  string
>
export type ImageGenerationModelId = {
  [Id in GenerationModelId]: (typeof GENERATION_MODEL_REGISTRY)[Id]['mediaType'] extends 'image'
    ? Id
    : never;
}[GenerationModelId]

export const GENERATION_MODELS = Object.freeze(
  Object.values(GENERATION_MODEL_REGISTRY),
) as readonly GenerationModelDefinition[]

export const IMAGE_GENERATION_MODELS = Object.freeze(
  GENERATION_MODELS.filter(model => model.mediaType === 'image'),
)

export const DEFAULT_GENERATION_MODEL_IDS = Object.freeze({
  audio: 'talelabs/eleven-multilingual-v2',
  image: 'talelabs/nano-banana-2',
  text: 'talelabs/gemini-3.1-flash-lite',
  video: 'talelabs/veo-3.1',
} as const satisfies Record<GenerationOutputType, GenerationModelId>)

export const DEFAULT_GENERATION_MODEL_IDS_BY_NODE = Object.freeze({
  imageGeneration: DEFAULT_GENERATION_MODEL_IDS.image,
  llm: DEFAULT_GENERATION_MODEL_IDS.text,
  musicGeneration: 'talelabs/eleven-music-v2',
  soundEffectGeneration: 'talelabs/eleven-sound-effects-v2',
  speechGeneration: 'talelabs/eleven-multilingual-v2',
  videoGeneration: DEFAULT_GENERATION_MODEL_IDS.video,
  voiceChanger: 'talelabs/eleven-voice-changer',
  voiceIsolation: 'talelabs/eleven-voice-isolator',
} as const satisfies Record<
  Exclude<GenerationNodeType, 'audioGeneration'>,
  GenerationModelId
>)

export const DEFAULT_IMAGE_GENERATION_MODEL_ID
  = DEFAULT_GENERATION_MODEL_IDS.image

export const GENERATION_NODE_MEDIA_TYPES = Object.freeze({
  audioGeneration: 'audio',
  imageGeneration: 'image',
  llm: 'text',
  musicGeneration: 'audio',
  soundEffectGeneration: 'audio',
  speechGeneration: 'audio',
  videoGeneration: 'video',
  voiceChanger: 'audio',
  voiceIsolation: 'audio',
} as const satisfies Record<GenerationNodeType, GenerationOutputType>)

export const GENERATION_NODE_TYPES = Object.freeze(
  Object.keys(GENERATION_NODE_MEDIA_TYPES) as GenerationNodeType[],
)

export const ADAPTIVE_GENERATION_NODE_TYPES = Object.freeze([
  'imageGeneration',
  'llm',
  'musicGeneration',
  'soundEffectGeneration',
  'speechGeneration',
  'videoGeneration',
  'voiceChanger',
  'voiceIsolation',
] as const satisfies readonly GenerationNodeType[])

export function isAdaptiveGenerationNodeType(
  value: unknown,
): value is (typeof ADAPTIVE_GENERATION_NODE_TYPES)[number] {
  return (
    typeof value === 'string'
    && (ADAPTIVE_GENERATION_NODE_TYPES as readonly string[]).includes(value)
  )
}

export function isGenerationNodeType(
  value: unknown,
): value is GenerationNodeType {
  return typeof value === 'string' && value in GENERATION_NODE_MEDIA_TYPES
}

export function getGenerationMediaTypeForNode(type: GenerationNodeType) {
  return GENERATION_NODE_MEDIA_TYPES[type]
}

export function isGenerationModelId(
  value: unknown,
): value is GenerationModelId {
  return typeof value === 'string' && value in GENERATION_MODEL_REGISTRY
}

export function isImageGenerationModelId(
  value: unknown,
): value is ImageGenerationModelId {
  return (
    isGenerationModelId(value)
    && GENERATION_MODEL_REGISTRY[value].mediaType === 'image'
  )
}

export function isGenerationModelContractVersion(
  value: unknown,
): value is GenerationModelContractVersion {
  return typeof value === 'string' && value in GENERATION_MODEL_CONTRACTS
}

export function getGenerationModel(
  modelId: string,
  contractVersion: unknown = GENERATION_MODEL_CONTRACT_VERSION,
): GenerationModelDefinition | undefined {
  const registry:
    | Readonly<Record<string, GenerationModelDefinition>>
    | undefined = isGenerationModelContractVersion(contractVersion)
      ? GENERATION_MODEL_CONTRACTS[contractVersion]
      : undefined
  return registry?.[modelId]
}

const GENERATION_MODEL_NON_CONTRACT_FIELDS = new Set([
  'advanced',
  'capabilitySchemaVersion',
  'descriptionKey',
  'displayName',
  'enabled',
  'labelKey',
  'nodeType',
  'presentation',
  'provider',
  'recommended',
])
const generationModelContractSignatures = new WeakMap<object, string>()

function canonicalGenerationModelContract(value: unknown): unknown {
  if (Array.isArray(value))
    return value.map(canonicalGenerationModelContract)
  if (!value || typeof value !== 'object')
    return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !GENERATION_MODEL_NON_CONTRACT_FIELDS.has(key))
      .toSorted(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [
        key,
        canonicalGenerationModelContract(nested),
      ]),
  )
}

function generationModelContractSignature(model: GenerationModelDefinition) {
  const cached = generationModelContractSignatures.get(model)
  if (cached)
    return cached
  const signature = JSON.stringify(canonicalGenerationModelContract(model))
  generationModelContractSignatures.set(model, signature)
  return signature
}

/**
 * Compares one model's creative contract across immutable registry snapshots.
 * Presentation and catalog-only changes must not prompt Flow-node migrations.
 */
export function areGenerationModelContractsEquivalent(
  modelId: string,
  leftContractVersion: unknown,
  rightContractVersion: unknown = GENERATION_MODEL_CONTRACT_VERSION,
) {
  const left = getGenerationModel(modelId, leftContractVersion)
  const right = getGenerationModel(modelId, rightContractVersion)
  if (!left || !right)
    return false
  return generationModelContractSignature(left)
    === generationModelContractSignature(right)
}

export function isCurrentGenerationModelContract(
  modelId: string,
  contractVersion: unknown,
) {
  return areGenerationModelContractsEquivalent(modelId, contractVersion)
}

export function getImageGenerationModel(modelId: string) {
  const model = getGenerationModel(modelId)
  return model?.mediaType === 'image' ? model : undefined
}

export function getGenerationModels(mediaType: GenerationOutputType) {
  return GENERATION_MODELS.filter(model => model.mediaType === mediaType)
}

const LEGACY_NODE_TYPE_BY_MEDIA: Partial<Record<
  GenerationOutputType,
  Exclude<GenerationNodeType, 'audioGeneration'>
>> = {
  image: 'imageGeneration',
  text: 'llm',
  video: 'videoGeneration',
}

export function getGenerationOperationsForNodeType(
  model: GenerationModelDefinition,
  nodeType: Exclude<GenerationNodeType, 'audioGeneration'>,
) {
  return model.operations.filter(operation =>
    operation.nodeType === nodeType
    || (
      operation.nodeType === undefined
      && LEGACY_NODE_TYPE_BY_MEDIA[model.mediaType] === nodeType
    ))
}

export function getGenerationModelsForNodeType(
  nodeType: Exclude<GenerationNodeType, 'audioGeneration'>,
) {
  return GENERATION_MODELS.filter(model =>
    getGenerationOperationsForNodeType(model, nodeType).length > 0)
}

export function getGenerationInputSlotsForNodeType(
  model: GenerationModelDefinition,
  nodeType: Exclude<GenerationNodeType, 'audioGeneration'>,
) {
  const slotIds = new Set(
    getGenerationOperationsForNodeType(model, nodeType)
      .flatMap(operation => operation.inputSlotIds),
  )
  return model.inputSlots.filter(slot => slotIds.has(slot.id))
}

export function getGenerationOperation(
  model: GenerationModelDefinition,
  operationId: unknown,
) {
  return model.operations.find(operation => operation.id === operationId)
}

export function getActiveGenerationInputSlots(
  model: GenerationModelDefinition,
  operationId: unknown,
) {
  const operation
    = getGenerationOperation(model, operationId)
      ?? getGenerationOperation(model, model.defaultOperationId)
  const activeIds = new Set(operation?.inputSlotIds ?? [])
  return model.inputSlots.filter(slot => activeIds.has(slot.id))
}

export function getActiveGenerationSettings(
  model: GenerationModelDefinition,
  operationId: unknown,
) {
  const operation
    = getGenerationOperation(model, operationId)
      ?? getGenerationOperation(model, model.defaultOperationId)
  const activeIds = new Set(operation?.settingIds ?? [])
  const operationSettingValues = new Map<string, GenerationSettingValue[]>()

  for (const constraint of model.constraints) {
    if (
      !operation
      || !constraint.when.every(
        condition =>
          condition.field === 'operation' && condition.value === operation.id,
      )
    ) {
      continue
    }
    for (const requirement of constraint.require ?? []) {
      if (requirement.field !== 'setting')
        continue
      const requiredValues
        = requirement.operator === 'equals'
          ? [requirement.value]
          : [...requirement.values]
      const previous = operationSettingValues.get(requirement.id)
      operationSettingValues.set(
        requirement.id,
        previous
          ? previous.filter(value => requiredValues.includes(value))
          : requiredValues,
      )
    }
  }

  return model.settings
    .filter(setting => activeIds.has(setting.id))
    .map((setting): GenerationSettingDefinition => {
      const allowedValues = operationSettingValues.get(setting.id)
      if (!allowedValues || setting.kind !== 'enum')
        return setting
      return {
        ...setting,
        options: setting.options.filter(option =>
          allowedValues.includes(option.value),
        ),
      }
    })
}

export function getDefaultGenerationData(mediaType: GenerationOutputType) {
  const model
    = GENERATION_MODEL_REGISTRY[DEFAULT_GENERATION_MODEL_IDS[mediaType]]
  return {
    inputSelections: Object.fromEntries(
      model.inputSlots.map(slot => [slot.id, { mode: 'auto' as const }]),
    ),
    ...(mediaType === 'image' || mediaType === 'video' ? { prompt: '' } : {}),
    ...(mediaType === 'text' ? { instructions: '', prompt: '' } : {}),
    modelContractVersion: GENERATION_MODEL_CONTRACT_VERSION,
    modelId: model.id,
    operationId: model.defaultOperationId,
    settings: Object.fromEntries(
      model.settings.map(setting => [setting.id, setting.default]),
    ),
  }
}

export function getDefaultGenerationDataForNodeType(
  nodeType: Exclude<GenerationNodeType, 'audioGeneration'>,
) {
  const modelId = DEFAULT_GENERATION_MODEL_IDS_BY_NODE[nodeType]
  const model = GENERATION_MODEL_REGISTRY[modelId]
  const operation = getGenerationOperationsForNodeType(model, nodeType)[0]
  if (!operation) {
    throw new Error(`No default generation operation for ${nodeType}`)
  }
  return {
    inputSelections: Object.fromEntries(
      getGenerationInputSlotsForNodeType(model, nodeType).map(slot => [
        slot.id,
        { mode: 'auto' as const },
      ]),
    ),
    ...(nodeType === 'imageGeneration' || nodeType === 'videoGeneration'
      ? { prompt: '' }
      : {}),
    ...(nodeType === 'llm' ? { instructions: '', prompt: '' } : {}),
    ...(nodeType === 'musicGeneration' ? { lyrics: '', prompt: '' } : {}),
    ...(nodeType === 'soundEffectGeneration'
      || nodeType === 'speechGeneration'
      ? { prompt: '' }
      : {}),
    modelContractVersion: GENERATION_MODEL_CONTRACT_VERSION,
    modelId: model.id,
    operationId: operation.id,
    settings: Object.fromEntries(
      model.settings.map(setting => [setting.id, setting.default]),
    ),
  }
}

export function getDefaultImageGenerationData() {
  return getDefaultGenerationData('image')
}

export function matchesGenerationCondition(
  condition: GenerationConditionDefinition,
  context: {
    connectedSlotIds?: ReadonlySet<string>
    operationId: string
    settings: Readonly<Record<string, GenerationSettingValue>>
  },
) {
  if (condition.field === 'operation')
    return context.operationId === condition.value
  if (condition.field === 'slot')
    return context.connectedSlotIds?.has(condition.id) ?? false
  if (condition.operator === 'equals')
    return context.settings[condition.id] === condition.value
  return condition.values.includes(context.settings[condition.id])
}

function isStepAligned(value: number, minimum: number, step: number) {
  const steps = (value - minimum) / step
  return Math.abs(steps - Math.round(steps)) < 1e-9
}

export function isGenerationSettingValueValid(
  setting: GenerationSettingDefinition,
  value: GenerationSettingValue,
) {
  if (setting.kind === 'boolean')
    return typeof value === 'boolean'
  if (setting.kind === 'string')
    return typeof value === 'string' && value.length <= setting.maxLength
  if (setting.kind === 'enum') {
    return (
      typeof value === 'string'
      && setting.options.some(option => option.value === value)
    )
  }
  return (
    typeof value === 'number'
    && Number.isFinite(value)
    && value >= setting.min
    && value <= setting.max
    && isStepAligned(value, setting.min, setting.step)
  )
}

function conditionKey(condition: GenerationConditionDefinition) {
  if (condition.field === 'operation')
    return `operation:${condition.value}`
  if (condition.field === 'slot')
    return `slot:${condition.id}`
  return condition.operator === 'equals'
    ? `setting:${condition.id}:equals:${String(condition.value)}`
    : `setting:${condition.id}:in:${[...condition.values].sort().join(',')}`
}

function validateCondition(input: {
  condition: GenerationConditionDefinition
  constraintId: string
  inputIds: readonly string[]
  key: string
  operationIds: readonly string[]
  settingsById: ReadonlyMap<string, GenerationSettingDefinition>
}) {
  const errors: string[] = []
  const { condition } = input
  if (condition.field === 'slot' && !input.inputIds.includes(condition.id)) {
    errors.push(
      `${input.key}.${input.constraintId}: unknown slot ${condition.id}`,
    )
  }
  if (
    condition.field === 'operation'
    && !input.operationIds.includes(condition.value)
  ) {
    errors.push(
      `${input.key}.${input.constraintId}: unknown operation ${condition.value}`,
    )
  }
  if (condition.field !== 'setting')
    return errors

  const setting = input.settingsById.get(condition.id)
  if (!setting) {
    errors.push(
      `${input.key}.${input.constraintId}: unknown setting ${condition.id}`,
    )
    return errors
  }
  const values
    = condition.operator === 'equals' ? [condition.value] : condition.values
  if (!values.length || new Set(values).size !== values.length) {
    errors.push(
      `${input.key}.${input.constraintId}: setting condition values must be non-empty and unique`,
    )
  }
  if (values.some(value => !isGenerationSettingValueValid(setting, value))) {
    errors.push(
      `${input.key}.${input.constraintId}: invalid value for setting ${condition.id}`,
    )
  }
  return errors
}

export function validateGenerationRegistry(
  registry: Readonly<
    Record<string, GenerationModelDefinition>
  > = GENERATION_MODEL_REGISTRY,
  options: { requireHardened?: boolean } = {},
) {
  const errors: string[] = []

  for (const [key, model] of Object.entries(registry)) {
    const hardened
      = options.requireHardened
        || model.capabilitySchemaVersion === 2
        || model.capabilitySchemaVersion === 3
    if (key !== model.id)
      errors.push(`${key}: model id must match its registry key`)
    if (!model.id.startsWith('talelabs/'))
      errors.push(`${key}: product model ids must use the talelabs namespace`)
    if (!model.operations.length)
      errors.push(`${key}: at least one operation is required`)
    if (options.requireHardened && model.capabilitySchemaVersion !== 3) {
      errors.push(
        `${key}: current contracts must use capability schema version 3`,
      )
    }
    if (options.requireHardened && !model.enabled) {
      errors.push(
        `${key}: unavailable models must not exist in the current catalog`,
      )
    }
    if (hardened && model.provider) {
      errors.push(
        `${key}: hardened public contracts must not expose a provider`,
      )
    }
    if (model.mediaType === 'text' && !model.llm)
      errors.push(`${key}: text-output models require LLM capabilities`)
    if (model.mediaType !== 'text' && model.llm) {
      errors.push(
        `${key}: only text-output models may declare LLM capabilities`,
      )
    }

    const responseLength = model.settings.find(
      setting => setting.id === 'responseLength',
    )
    const reasoningMode = model.settings.find(
      setting => setting.id === 'reasoningMode',
    )
    if (model.mediaType === 'text') {
      const expectedResponseLengths = ['auto', 'short', 'medium', 'long']
      if (
        responseLength?.kind !== 'enum'
        || JSON.stringify(responseLength.options.map(option => option.value))
        !== JSON.stringify(expectedResponseLengths)
      ) {
        errors.push(`${key}: LLM response-length options are invalid`)
      }
      const reasoning = model.llm?.reasoning
      if (!reasoning && reasoningMode)
        errors.push(`${key}: unsupported reasoning must not expose a setting`)
      if (reasoning) {
        const optionValues
          = reasoningMode?.kind === 'enum'
            ? reasoningMode.options.map(option => option.value)
            : []
        if (
          reasoningMode?.kind !== 'enum'
          || reasoningMode.default !== reasoning.default
          || JSON.stringify(optionValues) !== JSON.stringify(reasoning.options)
        ) {
          errors.push(`${key}: reasoning setting must match its capability`)
        }
        if (
          !reasoning.options.length
          || new Set(reasoning.options).size !== reasoning.options.length
          || !reasoning.options.includes(reasoning.default)
        ) {
          errors.push(`${key}: reasoning options and default are invalid`)
        }
        if (reasoning.mandatory === reasoning.options.includes('off')) {
          errors.push(
            `${key}: mandatory reasoning controls whether Off is available`,
          )
        }
      }
    }

    const inputIds = model.inputSlots.map(slot => slot.id)
    const settingIds = model.settings.map(setting => setting.id)
    const operationIds = model.operations.map(operation => operation.id)
    const settingsById = new Map(
      model.settings.map(setting => [setting.id, setting]),
    )
    if (new Set(inputIds).size !== inputIds.length)
      errors.push(`${key}: input slot ids must be unique`)
    if (new Set(settingIds).size !== settingIds.length)
      errors.push(`${key}: setting ids must be unique`)
    if (new Set(operationIds).size !== operationIds.length)
      errors.push(`${key}: operation ids must be unique`)
    const constraintIds = model.constraints.map(constraint => constraint.id)
    if (new Set(constraintIds).size !== constraintIds.length)
      errors.push(`${key}: constraint ids must be unique`)
    if (!operationIds.includes(model.defaultOperationId))
      errors.push(`${key}: default operation must exist`)

    for (const slot of model.inputSlots) {
      if (
        !Number.isInteger(slot.maxConnections)
        || !Number.isInteger(slot.maxItems)
        || slot.maxConnections < 1
        || slot.maxItems < 1
      ) {
        errors.push(`${key}.${slot.id}: maxima must be positive integers`)
      }
      if (
        !Number.isInteger(slot.minConnections)
        || slot.minConnections < 0
        || slot.minConnections > slot.maxConnections
      ) {
        errors.push(`${key}.${slot.id}: connection cardinality is invalid`)
      }
      if (
        !slot.accepts.length
        || new Set(slot.accepts).size !== slot.accepts.length
      ) {
        errors.push(
          `${key}.${slot.id}: accepted value types must be non-empty and unique`,
        )
      }
      if (slot.referenceProfile) {
        const profile = slot.referenceProfile
        if (
          !profile.purposes.length
          || new Set(profile.purposes).size !== profile.purposes.length
        ) {
          errors.push(
            `${key}.${slot.id}: reference purposes must be non-empty and unique`,
          )
        }
        if (
          profile.recommendedMaxItems !== undefined
          && (!Number.isInteger(profile.recommendedMaxItems)
            || profile.recommendedMaxItems < 1
            || profile.recommendedMaxItems > slot.maxItems)
        ) {
          errors.push(`${key}.${slot.id}: recommended maximum is invalid`)
        }
        if (!slot.acceptedMedia) {
          errors.push(
            `${key}.${slot.id}: accepted media constraints are required`,
          )
        }
      }
      if (slot.acceptedMedia) {
        const media = slot.acceptedMedia
        if (
          !media.mimeTypes.length
          || new Set(media.mimeTypes).size !== media.mimeTypes.length
        ) {
          errors.push(
            `${key}.${slot.id}: accepted MIME types must be non-empty and unique`,
          )
        }
        if (
          media.maxBytes !== undefined
          && (!Number.isInteger(media.maxBytes) || media.maxBytes < 1)
        ) {
          errors.push(
            `${key}.${slot.id}: accepted media byte limit is invalid`,
          )
        }
        if (
          media.durationSeconds
          && (!Number.isFinite(media.durationSeconds.min)
            || !Number.isFinite(media.durationSeconds.max)
            || media.durationSeconds.min < 0
            || media.durationSeconds.min > media.durationSeconds.max)
        ) {
          errors.push(`${key}.${slot.id}: accepted media duration is invalid`)
        }
        if (
          media.framesPerSecond
          && (!media.framesPerSecond.length
            || new Set(media.framesPerSecond).size
            !== media.framesPerSecond.length
            || media.framesPerSecond.some(
              value => !Number.isFinite(value) || value <= 0,
            ))
        ) {
          errors.push(`${key}.${slot.id}: accepted frame rates are invalid`)
        }
        for (const [name, values] of [
          ['aspect ratios', media.aspectRatios],
          ['resolutions', media.resolutions],
        ] as const) {
          if (
            values
            && (!values.length || new Set(values).size !== values.length)
          ) {
            errors.push(
              `${key}.${slot.id}: accepted media ${name} must be non-empty and unique`,
            )
          }
        }
      }
    }

    for (const operation of model.operations) {
      if (model.capabilitySchemaVersion === 3 && !operation.nodeType) {
        errors.push(
          `${key}.${operation.id}: capability-v3 operations require a node type`,
        )
      }
      if (
        new Set(operation.inputSlotIds).size !== operation.inputSlotIds.length
      )
        errors.push(`${key}.${operation.id}: input slot ids must be unique`)
      if (new Set(operation.settingIds).size !== operation.settingIds.length)
        errors.push(`${key}.${operation.id}: setting ids must be unique`)
      for (const slotId of operation.inputSlotIds) {
        if (!inputIds.includes(slotId))
          errors.push(`${key}.${operation.id}: unknown input slot ${slotId}`)
      }
      for (const settingId of operation.settingIds) {
        if (!settingIds.includes(settingId))
          errors.push(`${key}.${operation.id}: unknown setting ${settingId}`)
      }
      for (const settingId of operation.requiredSettingIds ?? []) {
        if (!operation.settingIds.includes(settingId)) {
          errors.push(
            `${key}.${operation.id}: required setting ${settingId} must be active`,
          )
        }
      }
      for (const [contractId, contract] of Object.entries(operation.inputs)) {
        const contractModes = [
          Boolean(contract.required),
          Boolean(contract.oneOf),
          Boolean(contract.atLeastOne),
        ].filter(Boolean).length
        if (contractModes > 1) {
          errors.push(
            `${key}.${operation.id}.${contractId}: required, oneOf, and atLeastOne are mutually exclusive`,
          )
        }
        if (contract.atLeastOne) {
          if (contract.atLeastOne.length < 2) {
            errors.push(
              `${key}.${operation.id}.${contractId}: atLeastOne requires at least two slots`,
            )
          }
          if (
            new Set(contract.atLeastOne).size !== contract.atLeastOne.length
          ) {
            errors.push(
              `${key}.${operation.id}.${contractId}: atLeastOne slots must be unique`,
            )
          }
          for (const slotId of contract.atLeastOne) {
            if (!operation.inputSlotIds.includes(slotId)) {
              errors.push(
                `${key}.${operation.id}.${contractId}: inactive atLeastOne slot ${slotId}`,
              )
            }
          }
        }
        else if (contract.oneOf) {
          if (contract.oneOf.length < 2) {
            errors.push(
              `${key}.${operation.id}.${contractId}: oneOf requires at least two slots`,
            )
          }
          if (new Set(contract.oneOf).size !== contract.oneOf.length) {
            errors.push(
              `${key}.${operation.id}.${contractId}: oneOf slots must be unique`,
            )
          }
          for (const slotId of contract.oneOf) {
            if (!operation.inputSlotIds.includes(slotId)) {
              errors.push(
                `${key}.${operation.id}.${contractId}: inactive oneOf slot ${slotId}`,
              )
            }
          }
        }
        else if (!operation.inputSlotIds.includes(contractId)) {
          errors.push(
            `${key}.${operation.id}: input contract references inactive slot ${contractId}`,
          )
        }
      }

      if (hardened) {
        if (!operation.output || !operation.referenceLimit) {
          errors.push(
            `${key}.${operation.id}: hardened output and reference limits are required`,
          )
          continue
        }
        if (operation.output.mediaType !== model.mediaType) {
          errors.push(
            `${key}.${operation.id}: output media type must match the model`,
          )
        }
        const count = operation.output.count
        if (
          ![count.default, count.min, count.max].every(Number.isInteger)
          || count.min < 1
          || count.default < count.min
          || count.default > count.max
        ) {
          errors.push(`${key}.${operation.id}: output count is invalid`)
        }
        if (count.settingId) {
          const setting = settingsById.get(count.settingId)
          if (
            !setting
            || setting.kind !== 'number'
            || !operation.settingIds.includes(count.settingId)
            || setting.min !== count.min
            || setting.max !== count.max
            || setting.default !== count.default
          ) {
            errors.push(
              `${key}.${operation.id}: output count setting does not match its capability`,
            )
          }
        }
        const limit = operation.referenceLimit
        if (!Number.isInteger(limit.maxItems) || limit.maxItems < 0) {
          errors.push(
            `${key}.${operation.id}: total reference limit is invalid`,
          )
        }
        if (new Set(limit.slotIds).size !== limit.slotIds.length) {
          errors.push(
            `${key}.${operation.id}: reference limit slot ids must be unique`,
          )
        }
        const activeReferenceSlots = model.inputSlots.filter(
          slot =>
            operation.inputSlotIds.includes(slot.id) && slot.referenceProfile,
        )
        const activeReferenceIds = new Set(
          activeReferenceSlots.map(slot => slot.id),
        )
        if (
          limit.slotIds.some(slotId => !activeReferenceIds.has(slotId))
          || activeReferenceSlots.some(slot => !limit.slotIds.includes(slot.id))
        ) {
          errors.push(
            `${key}.${operation.id}: total reference slots must match active reference inputs`,
          )
        }
        const possibleReferences = activeReferenceSlots.reduce(
          (total, slot) => total + slot.maxItems,
          0,
        )
        if (limit.maxItems > possibleReferences) {
          errors.push(
            `${key}.${operation.id}: total reference limit exceeds slot limits`,
          )
        }
        const requiredReferenceIds = new Set(
          Object.entries(operation.inputs)
            .filter(
              ([slotId, requirement]) =>
                requirement.required && activeReferenceIds.has(slotId),
            )
            .map(([slotId]) => slotId),
        )
        const requiredReferenceGroups = Object.values(operation.inputs).filter(
          requirement =>
            (requirement.oneOf?.length
              && requirement.oneOf.every(slotId =>
                activeReferenceIds.has(slotId),
              ))
              || (requirement.atLeastOne?.length
                && requirement.atLeastOne.every(slotId =>
                  activeReferenceIds.has(slotId),
                )),
        ).length
        const minimumReferences
          = requiredReferenceIds.size + requiredReferenceGroups
        if (limit.maxItems < minimumReferences) {
          errors.push(
            `${key}.${operation.id}: total reference limit cannot satisfy required inputs`,
          )
        }
      }
    }

    for (const setting of model.settings) {
      if (
        setting.kind === 'number'
        && (![setting.default, setting.min, setting.max, setting.step].every(
          Number.isFinite,
        )
        || setting.step <= 0
        || setting.min > setting.max
        || !isGenerationSettingValueValid(setting, setting.default))
      ) {
        errors.push(`${key}.${setting.id}: number definition is invalid`)
      }
      if (setting.kind === 'enum') {
        const values = setting.options.map(option => option.value)
        if (
          !values.length
          || new Set(values).size !== values.length
          || !isGenerationSettingValueValid(setting, setting.default)
        ) {
          errors.push(`${key}.${setting.id}: enum definition is invalid`)
        }
      }
      if (
        setting.kind === 'string'
        && (!Number.isInteger(setting.maxLength)
          || setting.maxLength < 1
          || !isGenerationSettingValueValid(setting, setting.default))
      ) {
        errors.push(`${key}.${setting.id}: string definition is invalid`)
      }
      for (const condition of setting.visibleWhen ?? []) {
        errors.push(
          ...validateCondition({
            condition,
            constraintId: `${setting.id}.visibleWhen`,
            inputIds,
            key,
            operationIds,
            settingsById,
          }),
        )
      }
    }

    for (const constraint of model.constraints) {
      if (
        !constraint.when.length
        || (!constraint.require?.length && !constraint.forbid?.length)
      ) {
        errors.push(
          `${key}.${constraint.id}: constraint conditions are incomplete`,
        )
      }
      for (const condition of [
        ...constraint.when,
        ...(constraint.require ?? []),
        ...(constraint.forbid ?? []),
      ]) {
        errors.push(
          ...validateCondition({
            condition,
            constraintId: constraint.id,
            inputIds,
            key,
            operationIds,
            settingsById,
          }),
        )
      }
      const requiredKeys = new Set(
        (constraint.require ?? []).map(conditionKey),
      )
      if (
        (constraint.forbid ?? []).some(condition =>
          requiredKeys.has(conditionKey(condition)),
        )
      ) {
        errors.push(
          `${key}.${constraint.id}: the same condition cannot be required and forbidden`,
        )
      }
      const requiredEquals = new Map<string, GenerationSettingValue>()
      for (const condition of constraint.require ?? []) {
        if (condition.field !== 'setting' || condition.operator !== 'equals')
          continue
        const previous = requiredEquals.get(condition.id)
        if (previous !== undefined && previous !== condition.value) {
          errors.push(
            `${key}.${constraint.id}: conflicting requirements for ${condition.id}`,
          )
        }
        requiredEquals.set(condition.id, condition.value)
      }

      const explicitlyScopedOperations = constraint.when
        .filter(condition => condition.field === 'operation')
        .map(condition => condition.value)
      const applicableOperations = model.operations
        .filter(
          operation =>
            !explicitlyScopedOperations.length
            || explicitlyScopedOperations.includes(operation.id),
        )
        .filter(operation =>
          constraint.when.every((condition) => {
            if (condition.field === 'operation')
              return true
            if (condition.field === 'slot')
              return operation.inputSlotIds.includes(condition.id)
            return operation.settingIds.includes(condition.id)
          }),
        )
      if (!applicableOperations.length) {
        errors.push(
          `${key}.${constraint.id}: constraint cannot apply to any operation`,
        )
      }
      for (const operation of applicableOperations) {
        for (const condition of [
          ...(constraint.require ?? []),
          ...(constraint.forbid ?? []),
        ]) {
          if (
            condition.field === 'slot'
            && !operation.inputSlotIds.includes(condition.id)
          ) {
            errors.push(
              `${key}.${constraint.id}: slot ${condition.id} is inactive for ${operation.id}`,
            )
          }
          if (
            condition.field === 'setting'
            && !operation.settingIds.includes(condition.id)
          ) {
            errors.push(
              `${key}.${constraint.id}: setting ${condition.id} is inactive for ${operation.id}`,
            )
          }
        }
      }
    }
  }

  return errors
}

export function validateHardenedGenerationRegistry(
  registry: Readonly<
    Record<string, GenerationModelDefinition>
  > = GENERATION_MODEL_REGISTRY,
) {
  return validateGenerationRegistry(registry, { requireHardened: true })
}

export function isExecutableGenerationCandidate(
  value: unknown,
): value is GenerationReferenceCandidate {
  if (!value || typeof value !== 'object')
    return false
  const candidate = value as Partial<GenerationReferenceCandidate>
  if (
    typeof candidate.assetId !== 'string'
    || typeof candidate.candidateId !== 'string'
    || typeof candidate.order !== 'number'
    || !Number.isInteger(candidate.order)
    || candidate.order < 0
    || typeof candidate.slotId !== 'string'
    || !['audio', 'image', 'video'].includes(candidate.mediaType ?? '')
    || !candidate.origin
    || typeof candidate.origin !== 'object'
  ) {
    return false
  }
  const origin = candidate.origin as Partial<GenerationCandidateOrigin>
  if (origin.kind === 'nodeOutput') {
    return (
      typeof origin.nodeId === 'string'
      && typeof origin.outputIndex === 'number'
      && Number.isInteger(origin.outputIndex)
      && origin.outputIndex >= 0
    )
  }
  return origin.kind === 'asset'
}

export function validateGenerationCandidateSelectionSnapshot(
  snapshot: GenerationCandidateSelectionSnapshot,
) {
  const errors: string[] = []
  const consideredById = new Map(
    snapshot.considered.map(item => [item.candidate.candidateId, item]),
  )
  if (consideredById.size !== snapshot.considered.length)
    errors.push('considered candidate ids must be unique')
  const consideredOrderKeys = snapshot.considered.map(
    item => `${item.candidate.slotId}:${item.candidate.order}`,
  )
  if (new Set(consideredOrderKeys).size !== consideredOrderKeys.length)
    errors.push('considered candidate order must be unique within each slot')

  for (const item of snapshot.considered) {
    const candidateId = item.candidate.candidateId
    if (!isExecutableGenerationCandidate(item.candidate as unknown))
      errors.push(`${candidateId}: candidate is not executable`)
    if (item.selected && item.exclusionReasons.length) {
      errors.push(
        `${item.candidate.candidateId}: selected candidate cannot have exclusions`,
      )
    }
    if (!item.selected && !item.exclusionReasons.length) {
      errors.push(
        `${item.candidate.candidateId}: excluded candidate requires a reason`,
      )
    }
  }

  const selectedIds = snapshot.selectedInputs.map(input => input.candidateId)
  if (new Set(selectedIds).size !== selectedIds.length)
    errors.push('selected provider input candidate ids must be unique')
  const selectedOrders = snapshot.selectedInputs.map(input => input.order)
  if (
    selectedOrders.some(order => !Number.isInteger(order) || order < 0)
    || new Set(selectedOrders).size !== selectedOrders.length
  ) {
    errors.push(
      'selected provider input order must be unique non-negative integers',
    )
  }
  for (const [index, input] of snapshot.selectedInputs.entries()) {
    if (input.order !== index) {
      errors.push(
        `${input.candidateId}: selected provider input order must match payload order`,
      )
    }
    const considered = consideredById.get(input.candidateId)
    if (!considered?.selected) {
      errors.push(
        `${input.candidateId}: selected provider input was not selected from candidates`,
      )
    }
    else if (
      input.assetId !== considered.candidate.assetId
      || input.slotId !== considered.candidate.slotId
    ) {
      errors.push(
        `${input.candidateId}: selected provider input does not match its candidate`,
      )
    }
  }
  const expectedIds = snapshot.considered
    .filter(item => item.selected)
    .map(item => item.candidate.candidateId)
    .toSorted()
  if (
    JSON.stringify([...selectedIds].toSorted()) !== JSON.stringify(expectedIds)
  ) {
    errors.push(
      'selected provider inputs must preserve the exact selected candidate subset',
    )
  }

  return errors
}
