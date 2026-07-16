import type {
  GenerationConditionDefinition,
  GenerationSettingDefinition,
  GenerationSettingValue,
} from '../types.js'

import { isGenerationSettingValueValid } from '../../resolution/setting-validation.js'

export function generationConditionKey(
  condition: GenerationConditionDefinition,
) {
  if (condition.field === 'operation')
    return `operation:${condition.value}`
  if (condition.field === 'slot')
    return `slot:${condition.id}`
  return condition.operator === 'equals'
    ? `setting:${condition.id}:equals:${String(condition.value)}`
    : `setting:${condition.id}:in:${[...condition.values].sort().join(',')}`
}

export function validateGenerationCondition(input: {
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
  const values: readonly GenerationSettingValue[]
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
