import type { GenerationContractIssue } from './generation-evaluator.js'
import type {
  GenerationInputAvailability,
  GenerationModelDefinition,
  GenerationSettingValue,
} from './generation-registry-types.js'

import {
  applyGenerationSettingRequirements,
  evaluateGenerationContract,
} from './generation-evaluator.js'
import { isGenerationSettingValueValid } from './generation-registry.js'

export const IMAGE_GENERATION_INPUT_SLOT_IDS = [
  'prompt',
  'imageReferences',
] as const

export type ImageGenerationInputSlotId
  = (typeof IMAGE_GENERATION_INPUT_SLOT_IDS)[number]

export interface ImageGenerationStateIssue extends Omit<
  GenerationContractIssue,
  'code'
> {
  code: GenerationContractIssue['code'] | 'image_operation_unresolved'
}

export interface ImageGenerationState {
  inputAvailability: Readonly<Record<string, GenerationInputAvailability>>
  issues: readonly ImageGenerationStateIssue[]
  normalizedSettings: Readonly<Record<string, GenerationSettingValue>>
  readiness: 'incomplete' | 'invalid' | 'ready'
  resolvedOperationId: null | string
  visibleSettingIds: readonly string[]
}

export interface ResolveImageGenerationStateInput {
  connectionCounts?: Readonly<Record<string, number>>
  inlinePrompt?: string
  itemCounts?: Readonly<Record<string, number>>
  model: GenerationModelDefinition
  settings: Readonly<Record<string, GenerationSettingValue>>
}

const LEGACY_SLOT_ALIASES: Readonly<
  Record<string, ImageGenerationInputSlotId>
> = {
  references: 'imageReferences',
}

export function normalizeImageGenerationInputSlotId(slotId: string) {
  return LEGACY_SLOT_ALIASES[slotId] ?? slotId
}

function countForSlot(
  counts: Readonly<Record<string, number>>,
  slotId: string,
) {
  const normalized = normalizeImageGenerationInputSlotId(slotId)
  return Math.max(
    0,
    counts[normalized] ?? 0,
    normalized === 'imageReferences' ? (counts.references ?? 0) : 0,
  )
}

function normalizeCounts(counts: Readonly<Record<string, number>>) {
  const normalized = { ...counts }
  if (counts.references !== undefined) {
    normalized.imageReferences = Math.max(
      normalized.imageReferences ?? 0,
      counts.references,
    )
    delete normalized.references
  }
  return normalized
}

function countsForModel(
  model: GenerationModelDefinition,
  counts: Readonly<Record<string, number>>,
) {
  if (!model.inputSlots.some(slot => slot.id === 'references'))
    return counts
  const contractCounts = { ...counts }
  contractCounts.references = countForSlot(counts, 'imageReferences')
  delete contractCounts.imageReferences
  return contractCounts
}

function resolveOperation(
  model: GenerationModelDefinition,
  itemCounts: Readonly<Record<string, number>>,
) {
  if (model.mediaType !== 'image')
    return undefined
  const hasReferences = countForSlot(itemCounts, 'imageReferences') > 0
  if (hasReferences) {
    return model.operations.find(
      operation =>
        operation.id === 'imageToImage'
        && operation.inputSlotIds.some(
          slotId =>
            normalizeImageGenerationInputSlotId(slotId) === 'imageReferences',
        ),
    )
  }
  return (
    model.operations.find(
      operation => operation.id === model.defaultOperationId,
    ) ?? model.operations.find(operation => operation.id === 'textToImage')
  )
}

function normalizeSettings(input: {
  model: GenerationModelDefinition
  operationId: string
  settings: Readonly<Record<string, GenerationSettingValue>>
  connectedSlotIds: ReadonlySet<string>
}) {
  const operation = input.model.operations.find(
    item => item.id === input.operationId,
  )
  const activeSettingIds = new Set(operation?.settingIds ?? [])
  const normalized: Record<string, GenerationSettingValue> = {}
  for (const setting of input.model.settings) {
    if (!activeSettingIds.has(setting.id))
      continue
    const saved = input.settings[setting.id]
    normalized[setting.id]
      = saved !== undefined && isGenerationSettingValueValid(setting, saved)
        ? saved
        : setting.default
  }
  return applyGenerationSettingRequirements({
    connectedSlotIds: input.connectedSlotIds,
    model: input.model,
    operationId: input.operationId,
    settings: normalized,
  })
}

function availabilityForSlot(input: {
  connectionCounts: Readonly<Record<string, number>>
  itemCounts: Readonly<Record<string, number>>
  model: GenerationModelDefinition
  slotId: string
}): GenerationInputAvailability {
  const normalizedSlotId = normalizeImageGenerationInputSlotId(input.slotId)
  const slot = input.model.inputSlots.find(
    item => normalizeImageGenerationInputSlotId(item.id) === normalizedSlotId,
  )
  if (!slot)
    return { state: 'unsupported' }

  const connectionCount = countForSlot(
    input.connectionCounts,
    normalizedSlotId,
  )
  const itemCount = countForSlot(input.itemCounts, normalizedSlotId)
  if (connectionCount >= slot.maxConnections || itemCount >= slot.maxItems) {
    return {
      reasonKey:
        normalizedSlotId === 'imageReferences'
          ? 'flows.image.inputs.limitReached'
          : 'flows.image.inputs.connectionLimitReached',
      state: 'full',
    }
  }
  if (connectionCount > 0 || itemCount > 0)
    return { connectionCount, itemCount, state: 'connected' }
  return { state: 'available' }
}

/**
 * Resolves the complete Image Generation canvas contract without React,
 * browser, provider, persistence, or execution-engine dependencies.
 */
export function resolveImageGenerationState(
  input: ResolveImageGenerationStateInput,
): ImageGenerationState {
  const connectionCounts = normalizeCounts(input.connectionCounts ?? {})
  const itemCounts = normalizeCounts(input.itemCounts ?? connectionCounts)
  const effectiveConnectionCounts = { ...connectionCounts }
  const effectiveItemCounts = { ...itemCounts }
  if ((input.inlinePrompt ?? '').trim().length > 0) {
    effectiveConnectionCounts.prompt = Math.max(
      1,
      effectiveConnectionCounts.prompt ?? 0,
    )
    effectiveItemCounts.prompt = Math.max(
      1,
      effectiveItemCounts.prompt ?? 0,
    )
  }

  const operation = resolveOperation(input.model, itemCounts)
  const inputAvailability: Record<string, GenerationInputAvailability> = {}
  for (const slotId of new Set([
    ...IMAGE_GENERATION_INPUT_SLOT_IDS,
    ...input.model.inputSlots.map(slot =>
      normalizeImageGenerationInputSlotId(slot.id),
    ),
  ])) {
    inputAvailability[slotId] = availabilityForSlot({
      connectionCounts,
      itemCounts,
      model: input.model,
      slotId,
    })
  }

  if (!operation) {
    return {
      inputAvailability,
      issues: [
        {
          code: 'image_operation_unresolved',
          messageKey: 'flows.image.readiness.unsupportedCombination',
        },
      ],
      normalizedSettings: {},
      readiness: 'invalid',
      resolvedOperationId: null,
      visibleSettingIds: [],
    }
  }

  const connectedSlotIds = new Set(
    [
      ...new Set([
        ...Object.keys(effectiveConnectionCounts),
        ...Object.keys(itemCounts),
      ]),
    ]
      .filter(
        slotId =>
          Math.max(
            countForSlot(effectiveConnectionCounts, slotId),
            countForSlot(itemCounts, slotId),
          ) > 0,
      )
      .map(normalizeImageGenerationInputSlotId),
  )
  const normalizedSettings = normalizeSettings({
    connectedSlotIds,
    model: input.model,
    operationId: operation.id,
    settings: input.settings,
  })
  const contractConnectionCounts = countsForModel(
    input.model,
    effectiveConnectionCounts,
  )
  const contractItemCounts = countsForModel(input.model, effectiveItemCounts)
  const evaluation = evaluateGenerationContract({
    connectionCounts: contractConnectionCounts,
    itemCounts: contractItemCounts,
    model: input.model,
    operationId: operation.id,
    requireComplete: true,
    settings: normalizedSettings,
  })
  const invalidSavedSettings = input.model.settings
    .filter(
      setting =>
        operation.settingIds.includes(setting.id)
        && input.settings[setting.id] !== undefined
        && !isGenerationSettingValueValid(setting, input.settings[setting.id]!),
    )
    .map<ImageGenerationStateIssue>(setting => ({
      code: 'generation_setting_invalid',
      settingId: setting.id,
    }))
  const issues = [
    ...evaluation.issues,
    ...invalidSavedSettings,
  ] as readonly ImageGenerationStateIssue[]
  const incompleteCodes = new Set<GenerationContractIssue['code']>([
    'generation_input_at_least_one',
    'generation_input_one_of',
    'generation_input_required',
    'generation_setting_required',
  ])
  const invalid = issues.some(
    issue =>
      !incompleteCodes.has(issue.code as GenerationContractIssue['code']),
  )

  return {
    inputAvailability,
    issues,
    normalizedSettings,
    readiness: invalid ? 'invalid' : issues.length ? 'incomplete' : 'ready',
    resolvedOperationId: operation.id,
    visibleSettingIds: evaluation.visibleSettingIds,
  }
}

export function isImageGenerationConnectionAdmissible(input: {
  connectionCounts: Readonly<Record<string, number>>
  itemCounts?: Readonly<Record<string, number>>
  model: GenerationModelDefinition
  settings: Readonly<Record<string, GenerationSettingValue>>
  slotId: string
}) {
  const slotId = normalizeImageGenerationInputSlotId(input.slotId)
  const state = resolveImageGenerationState(input)
  const availability = state.inputAvailability[slotId]
  if (
    !availability
    || ['blocked', 'full', 'unsupported'].includes(availability.state)
  ) {
    return false
  }

  const slot = input.model.inputSlots.find(
    item => normalizeImageGenerationInputSlotId(item.id) === slotId,
  )
  if (!slot)
    return false
  const connectionCount = countForSlot(input.connectionCounts, slotId)
  const itemCount = countForSlot(
    input.itemCounts ?? input.connectionCounts,
    slotId,
  )
  return connectionCount < slot.maxConnections && itemCount < slot.maxItems
}
