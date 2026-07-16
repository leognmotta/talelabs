import type {
  GenerationInputAvailability,
  GenerationModelDefinition,
  GenerationSettingValue,
} from '../registry/types.js'
import type { GenerationContractIssue } from './evaluator.js'

import { isGenerationSettingValueValid } from '../registry/index.js'
import { evaluateGenerationContract } from './evaluator.js'
import { imageInputAvailability } from './image-availability.js'
import {
  IMAGE_GENERATION_INPUT_SLOT_IDS,
  normalizeImageGenerationInputSlotId,
} from './image-input-aliases.js'
import {
  imageInputCount,
  imageInputCountsForModel,
  normalizeImageInputCounts,
} from './image-input-counts.js'
import {
  normalizeImageGenerationSettings,
  resolveImageGenerationOperation,
} from './image-operation.js'

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

/**
 * Resolves the complete Image Generation canvas contract without React,
 * browser, provider, persistence, or execution-engine dependencies.
 */
export function resolveImageGenerationState(
  input: ResolveImageGenerationStateInput,
): ImageGenerationState {
  const connectionCounts = normalizeImageInputCounts(input.connectionCounts ?? {})
  const itemCounts = normalizeImageInputCounts(input.itemCounts ?? connectionCounts)
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

  const operation = resolveImageGenerationOperation(input.model, itemCounts)
  const inputAvailability: Record<string, GenerationInputAvailability> = {}
  for (const slotId of new Set([
    ...IMAGE_GENERATION_INPUT_SLOT_IDS,
    ...input.model.inputSlots.map(slot =>
      normalizeImageGenerationInputSlotId(slot.id),
    ),
  ])) {
    inputAvailability[slotId] = imageInputAvailability({
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
            imageInputCount(effectiveConnectionCounts, slotId),
            imageInputCount(itemCounts, slotId),
          ) > 0,
      )
      .map(normalizeImageGenerationInputSlotId),
  )
  const normalizedSettings = normalizeImageGenerationSettings({
    connectedSlotIds,
    model: input.model,
    operationId: operation.id,
    settings: input.settings,
  })
  const contractConnectionCounts = imageInputCountsForModel(
    input.model,
    effectiveConnectionCounts,
  )
  const contractItemCounts = imageInputCountsForModel(input.model, effectiveItemCounts)
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
  const connectionCount = imageInputCount(input.connectionCounts, slotId)
  const itemCount = imageInputCount(
    input.itemCounts ?? input.connectionCounts,
    slotId,
  )
  return connectionCount < slot.maxConnections && itemCount < slot.maxItems
}
