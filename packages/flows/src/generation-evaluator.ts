import type {
  GenerationModelDefinition,
  GenerationSettingDefinition,
  GenerationSettingValue,
} from './generation-registry.js'

import {
  getActiveGenerationInputSlots,
  getActiveGenerationSettings,
  getGenerationOperation,
  matchesGenerationCondition,
} from './generation-registry.js'

export interface GenerationContractIssue {
  code:
    | 'generation_constraint'
    | 'generation_input_cardinality'
    | 'generation_input_one_of'
    | 'generation_input_required'
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
  model: GenerationModelDefinition
  operationId: string
  requireComplete?: boolean
  settings: Readonly<Record<string, GenerationSettingValue>>
}

function hasSettingValue(
  setting: GenerationSettingDefinition,
  value: GenerationSettingValue | undefined,
) {
  if (value === undefined)
    return false
  if (setting.kind === 'string')
    return typeof value === 'string' && value.trim().length > 0
  return true
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
  const connectedSlotIds = new Set(
    Object.entries(connectionCounts)
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

  for (const slot of activeSlots) {
    if ((connectionCounts[slot.id] ?? 0) > slot.maxConnections) {
      issues.push({
        code: 'generation_input_cardinality',
        inputId: slot.id,
      })
    }
  }

  for (const [inputId, contract] of Object.entries(operation.inputs)) {
    if (contract.oneOf) {
      const connected = contract.oneOf.filter(slotId => (
        (connectionCounts[slotId] ?? 0) > 0
      ))
      if (connected.length > 1 || (input.requireComplete && connected.length !== 1)) {
        issues.push({ code: 'generation_input_one_of', inputId })
      }
    }
    else if (
      input.requireComplete
      && contract.required
      && (connectionCounts[inputId] ?? 0) < 1
    ) {
      issues.push({ code: 'generation_input_required', inputId })
    }
  }

  if (input.requireComplete) {
    for (const settingId of operation.requiredSettingIds ?? []) {
      const setting = activeSettings.find(item => item.id === settingId)
      if (!setting || !hasSettingValue(setting, input.settings[settingId])) {
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
    const forbiddenCondition = constraint.forbid?.some(condition => (
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

export function applyGenerationSettingRequirements(input: {
  connectedSlotIds: ReadonlySet<string>
  model: GenerationModelDefinition
  operationId: string
  settings: Readonly<Record<string, GenerationSettingValue>>
}) {
  const settings = { ...input.settings }
  for (const constraint of input.model.constraints) {
    const context = {
      connectedSlotIds: input.connectedSlotIds,
      operationId: input.operationId,
      settings,
    }
    if (!constraint.when.every(condition => matchesGenerationCondition(condition, context)))
      continue
    for (const required of constraint.require ?? []) {
      if (required.field !== 'setting')
        continue
      if (required.operator === 'equals')
        settings[required.id] = required.value
      else if (!required.values.includes(settings[required.id]))
        settings[required.id] = required.values[0]
    }
  }
  return settings
}
