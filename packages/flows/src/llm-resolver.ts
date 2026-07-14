import type { GenerationContractIssue } from './generation-evaluator.js'
import type {
  GenerationInputAvailability,
  GenerationModelDefinition,
  GenerationSettingValue,
} from './generation-registry-types.js'
import { evaluateGenerationContract } from './generation-evaluator.js'
import { isGenerationSettingValueValid } from './generation-registry.js'

export const LLM_INPUT_SLOT_IDS = [
  'instructions',
  'prompt',
  'imageReferences',
] as const

export type LlmInputSlotId = typeof LLM_INPUT_SLOT_IDS[number]

export interface LlmStateIssue extends Omit<GenerationContractIssue, 'code'> {
  code: GenerationContractIssue['code'] | 'llm_operation_unresolved'
}
export interface LlmState {
  inputAvailability: Readonly<Record<string, GenerationInputAvailability>>
  issues: readonly LlmStateIssue[]
  normalizedSettings: Readonly<Record<string, GenerationSettingValue>>
  readiness: 'incomplete' | 'invalid' | 'ready'
  resolvedOperationId: null | string
  visibleSettingIds: readonly string[]
}

export interface ResolveLlmStateInput {
  connectionCounts?: Readonly<Record<string, number>>
  inlineInstructions?: string
  inlinePrompt?: string
  itemCounts?: Readonly<Record<string, number>>
  model: GenerationModelDefinition
  settings: Readonly<Record<string, GenerationSettingValue>>
}

function countForSlot(
  counts: Readonly<Record<string, number>>,
  slotId: string,
) {
  return Math.max(0, counts[slotId] ?? 0)
}

function availabilityForSlot(input: {
  connectionCounts: Readonly<Record<string, number>>
  itemCounts: Readonly<Record<string, number>>
  model: GenerationModelDefinition
  slotId: string
}): GenerationInputAvailability {
  const slot = input.model.inputSlots.find(item => item.id === input.slotId)
  if (!slot)
    return { state: 'unsupported' }

  const connectionCount = countForSlot(input.connectionCounts, input.slotId)
  const itemCount = countForSlot(input.itemCounts, input.slotId)
  if (connectionCount >= slot.maxConnections || itemCount >= slot.maxItems) {
    return {
      reasonKey: input.slotId === 'imageReferences'
        ? 'flows.llm.inputs.imageLimitReached'
        : 'flows.llm.inputs.connectionLimitReached',
      state: 'full',
    }
  }
  if (connectionCount > 0 || itemCount > 0)
    return { connectionCount, itemCount, state: 'connected' }
  return { state: 'available' }
}

function normalizeSettings(
  model: GenerationModelDefinition,
  operationId: string,
  settings: Readonly<Record<string, GenerationSettingValue>>,
) {
  const operation = model.operations.find(item => item.id === operationId)
  const activeIds = new Set(operation?.settingIds ?? [])
  return Object.fromEntries(model.settings
    .filter(setting => activeIds.has(setting.id))
    .map((setting) => {
      const saved = settings[setting.id]
      return [
        setting.id,
        saved !== undefined && isGenerationSettingValueValid(setting, saved)
          ? saved
          : setting.default,
      ]
    }))
}

/**
 * Resolves the complete LLM canvas contract without React, browser, provider,
 * persistence, or execution-engine dependencies.
 */
export function resolveLlmState(input: ResolveLlmStateInput): LlmState {
  const connectionCounts = input.connectionCounts ?? {}
  const itemCounts = input.itemCounts ?? connectionCounts
  const hasImages = countForSlot(itemCounts, 'imageReferences') > 0
  const operation = input.model.mediaType === 'text'
    ? input.model.operations.find(item => item.id === (
        hasImages ? 'visionToText' : 'textToText'
      ))
    : undefined

  const inputAvailability: Record<string, GenerationInputAvailability> = {}
  for (const slotId of new Set([
    ...LLM_INPUT_SLOT_IDS,
    ...input.model.inputSlots.map(slot => slot.id),
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
      issues: [{
        code: 'llm_operation_unresolved',
        messageKey: 'flows.llm.readiness.unsupportedCombination',
      }],
      normalizedSettings: {},
      readiness: 'invalid',
      resolvedOperationId: null,
      visibleSettingIds: [],
    }
  }

  const normalizedSettings = normalizeSettings(
    input.model,
    operation.id,
    input.settings,
  )
  const effectiveConnectionCounts = { ...connectionCounts }
  const effectiveItemCounts = { ...itemCounts }
  if ((input.inlinePrompt ?? '').trim()) {
    effectiveConnectionCounts.prompt = Math.max(
      1,
      effectiveConnectionCounts.prompt ?? 0,
    )
    effectiveItemCounts.prompt = Math.max(
      1,
      effectiveItemCounts.prompt ?? 0,
    )
  }
  if ((input.inlineInstructions ?? '').trim()) {
    effectiveConnectionCounts.instructions = Math.max(
      1,
      effectiveConnectionCounts.instructions ?? 0,
    )
    effectiveItemCounts.instructions = Math.max(
      1,
      effectiveItemCounts.instructions ?? 0,
    )
  }
  const evaluation = evaluateGenerationContract({
    connectionCounts: effectiveConnectionCounts,
    itemCounts: effectiveItemCounts,
    model: input.model,
    operationId: operation.id,
    requireComplete: true,
    settings: normalizedSettings,
  })
  const invalidSavedSettings = input.model.settings
    .filter(setting => (
      operation.settingIds.includes(setting.id)
      && input.settings[setting.id] !== undefined
      && !isGenerationSettingValueValid(setting, input.settings[setting.id]!)
    ))
    .map<LlmStateIssue>(setting => ({
      code: 'generation_setting_invalid',
      settingId: setting.id,
    }))
  const issues = [
    ...evaluation.issues,
    ...invalidSavedSettings,
  ] as readonly LlmStateIssue[]
  const incompleteCodes = new Set<GenerationContractIssue['code']>([
    'generation_input_required',
    'generation_setting_required',
  ])
  const invalid = issues.some(issue => !incompleteCodes.has(
    issue.code as GenerationContractIssue['code'],
  ))

  return {
    inputAvailability,
    issues,
    normalizedSettings,
    readiness: invalid ? 'invalid' : issues.length ? 'incomplete' : 'ready',
    resolvedOperationId: operation.id,
    visibleSettingIds: evaluation.visibleSettingIds,
  }
}

export function isLlmConnectionAdmissible(input: {
  connectionCounts: Readonly<Record<string, number>>
  itemCounts?: Readonly<Record<string, number>>
  model: GenerationModelDefinition
  settings: Readonly<Record<string, GenerationSettingValue>>
  slotId: string
}) {
  const state = resolveLlmState(input)
  const availability = state.inputAvailability[input.slotId]
  if (!availability || ['blocked', 'full', 'unsupported'].includes(availability.state))
    return false
  const slot = input.model.inputSlots.find(item => item.id === input.slotId)
  if (!slot)
    return false
  return (
    countForSlot(input.connectionCounts, input.slotId) < slot.maxConnections
    && countForSlot(input.itemCounts ?? input.connectionCounts, input.slotId) < slot.maxItems
  )
}
