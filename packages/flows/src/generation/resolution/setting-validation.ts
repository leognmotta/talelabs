import type {
  GenerationConditionDefinition,
  GenerationSettingDefinition,
  GenerationSettingValue,
} from '../registry/types.js'

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
    return typeof value === 'string'
      && setting.options.some(option => option.value === value)
  }
  return typeof value === 'number'
    && Number.isFinite(value)
    && value >= setting.min
    && value <= setting.max
    && isStepAligned(value, setting.min, setting.step)
}
