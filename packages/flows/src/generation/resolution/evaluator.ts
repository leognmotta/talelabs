import type {
  GenerationModelDefinition,
  GenerationSettingValue,
} from '../registry/index.js'
import {
  getActiveGenerationInputSlots,
  getActiveGenerationSettings,
  getGenerationOperation,
  isGenerationSettingValueValid,
  matchesGenerationCondition,
} from '../registry/index.js'

import { hasGenerationSettingValue } from './setting-presence.js'

export interface GenerationContractIssue {
  code:
    | 'generation_constraint'
    | 'generation_input_cardinality'
    | 'generation_input_at_least_one'
    | 'generation_input_inactive'
    | 'generation_input_items'
    | 'generation_input_one_of'
    | 'generation_input_required'
    | 'generation_output_count'
    | 'generation_reference_limit'
    | 'generation_setting_invalid'
    | 'generation_setting_required'
    | 'unknown_generation_operation'
  constraintId?: string
  inputId?: string
  messageKey?: string
  settingId?: string
}

export interface GenerationContractEvaluation {
  activeInputSlotIds: readonly string[]
  issues: readonly GenerationContractIssue[]
  visibleSettingIds: readonly string[]
}

export interface GenerationContractEvaluationInput {
  connectionCounts?: Readonly<Record<string, number>>
  itemCounts?: Readonly<Record<string, number>>
  model: GenerationModelDefinition
  operationId: string
  requireComplete?: boolean
  settings: Readonly<Record<string, GenerationSettingValue>>
}

/**
 * Evaluates the complete public generation contract. Canvas admission, draft
 * validation, executable validation, and the future planner share this result.
 */
export function evaluateGenerationContract(
  input: GenerationContractEvaluationInput,
): GenerationContractEvaluation {
  const operation = getGenerationOperation(input.model, input.operationId)
  if (!operation) {
    return {
      activeInputSlotIds: [],
      issues: [{ code: 'unknown_generation_operation' }],
      visibleSettingIds: [],
    }
  }

  const connectionCounts = input.connectionCounts ?? {}
  const itemCounts = input.itemCounts ?? connectionCounts
  const connectedSlotIds = new Set(
    [...new Set([
      ...Object.keys(connectionCounts),
      ...Object.keys(itemCounts),
    ])]
      .map(slotId => [
        slotId,
        Math.max(connectionCounts[slotId] ?? 0, itemCounts[slotId] ?? 0),
      ] as const)
      .filter(([, count]) => count > 0)
      .map(([slotId]) => slotId),
  )
  const conditionContext = {
    connectedSlotIds,
    operationId: operation.id,
    settings: input.settings,
  }
  const activeSlots = getActiveGenerationInputSlots(input.model, operation.id)
  const activeSettings = getActiveGenerationSettings(input.model, operation.id)
  const issues: GenerationContractIssue[] = []
  const activeSlotIds = new Set(activeSlots.map(slot => slot.id))

  for (const slotId of connectedSlotIds) {
    if (!activeSlotIds.has(slotId)) {
      issues.push({
        code: 'generation_input_inactive',
        inputId: slotId,
      })
    }
  }

  for (const slot of activeSlots) {
    if ((connectionCounts[slot.id] ?? 0) > slot.maxConnections) {
      issues.push({
        code: 'generation_input_cardinality',
        inputId: slot.id,
      })
    }
    if ((itemCounts[slot.id] ?? 0) > slot.maxItems) {
      issues.push({
        code: 'generation_input_items',
        inputId: slot.id,
      })
    }
  }

  if (operation.referenceLimit) {
    const referenceCount = operation.referenceLimit.slotIds.reduce(
      (total, slotId) => total + (itemCounts[slotId] ?? 0),
      0,
    )
    if (referenceCount > operation.referenceLimit.maxItems)
      issues.push({ code: 'generation_reference_limit' })
  }

  for (const [inputId, contract] of Object.entries(operation.inputs)) {
    if (contract.atLeastOne) {
      const connected = contract.atLeastOne.filter(slotId => (
        (itemCounts[slotId] ?? 0) > 0
      ))
      if (input.requireComplete && connected.length < 1)
        issues.push({ code: 'generation_input_at_least_one', inputId })
    }
    else if (contract.oneOf) {
      const connected = contract.oneOf.filter(slotId => (
        (itemCounts[slotId] ?? 0) > 0
      ))
      if (connected.length > 1 || (input.requireComplete && connected.length !== 1)) {
        issues.push({ code: 'generation_input_one_of', inputId })
      }
    }
    else if (
      input.requireComplete
      && contract.required
      && (itemCounts[inputId] ?? 0) < 1
    ) {
      issues.push({ code: 'generation_input_required', inputId })
    }
  }

  for (const setting of activeSettings) {
    const value = input.settings[setting.id]
    if (value !== undefined && !isGenerationSettingValueValid(setting, value)) {
      issues.push({
        code: 'generation_setting_invalid',
        settingId: setting.id,
      })
    }
  }

  if (operation.output) {
    const count = operation.output.count.settingId
      ? input.settings[operation.output.count.settingId]
      : operation.output.count.default
    if (
      typeof count !== 'number'
      || !Number.isInteger(count)
      || count < operation.output.count.min
      || count > operation.output.count.max
    ) {
      issues.push({
        code: 'generation_output_count',
        settingId: operation.output.count.settingId,
      })
    }
  }

  if (input.requireComplete) {
    for (const settingId of operation.requiredSettingIds ?? []) {
      const setting = activeSettings.find(item => item.id === settingId)
      if (!setting || !hasGenerationSettingValue(setting, input.settings[settingId])) {
        issues.push({ code: 'generation_setting_required', settingId })
      }
    }
  }

  for (const constraint of input.model.constraints) {
    if (!constraint.when.every(condition => (
      matchesGenerationCondition(condition, conditionContext)
    ))) {
      continue
    }
    const missingRequirement = constraint.require?.some(condition => (
      !matchesGenerationCondition(condition, conditionContext)
    ))
    const forbiddenCondition = constraint.forbid?.every(condition => (
      matchesGenerationCondition(condition, conditionContext)
    ))
    if (missingRequirement || forbiddenCondition) {
      issues.push({
        code: 'generation_constraint',
        constraintId: constraint.id,
        messageKey: constraint.messageKey,
      })
    }
  }

  return {
    activeInputSlotIds: activeSlots.map(slot => slot.id),
    issues,
    visibleSettingIds: activeSettings
      .filter(setting => !setting.visibleWhen || setting.visibleWhen.every(condition => (
        matchesGenerationCondition(condition, conditionContext)
      )))
      .map(setting => setting.id),
  }
}

export function isGenerationConnectionAdmissible(input: {
  connectionCounts: Readonly<Record<string, number>>
  model: GenerationModelDefinition
  operationId: string
  settings: Readonly<Record<string, GenerationSettingValue>>
  slotId: string
}) {
  const activeSlots = getActiveGenerationInputSlots(input.model, input.operationId)
  if (!activeSlots.some(slot => slot.id === input.slotId))
    return false

  const evaluation = evaluateGenerationContract({
    connectionCounts: {
      ...input.connectionCounts,
      [input.slotId]: (input.connectionCounts[input.slotId] ?? 0) + 1,
    },
    model: input.model,
    operationId: input.operationId,
    settings: input.settings,
  })
  return evaluation.issues.length === 0
}
