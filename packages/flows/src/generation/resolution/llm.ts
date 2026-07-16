import type {
  GenerationInputAvailability,
  GenerationModelDefinition,
  GenerationSettingValue,
} from '../registry/types.js'
import type { GenerationContractIssue } from './evaluator.js'
import { isGenerationSettingValueValid } from '../registry/index.js'
import { evaluateGenerationContract } from './evaluator.js'
import {
  llmSlotAvailability,
  llmSlotCount,
  normalizeLlmSettings,
} from './llm-helpers.js'

export const LLM_INPUT_SLOT_IDS = [
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

/**
 * Resolves the complete LLM canvas contract without React, browser, provider,
 * persistence, or execution-engine dependencies.
 */
export function resolveLlmState(input: ResolveLlmStateInput): LlmState {
  const connectionCounts = input.connectionCounts ?? {}
  const itemCounts = input.itemCounts ?? connectionCounts
  const hasImages = llmSlotCount(itemCounts, 'imageReferences') > 0
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
    inputAvailability[slotId] = llmSlotAvailability({
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

  const normalizedSettings = normalizeLlmSettings(
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
  if (
    (input.inlineInstructions ?? '').trim()
    && input.model.inputSlots.some(slot => slot.id === 'instructions')
  ) {
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
    llmSlotCount(input.connectionCounts, input.slotId) < slot.maxConnections
    && llmSlotCount(
      input.itemCounts ?? input.connectionCounts,
      input.slotId,
    ) < slot.maxItems
  )
}
