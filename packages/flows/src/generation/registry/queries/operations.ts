import type {
  GenerationModelDefinition,
  GenerationSettingDefinition,
  GenerationSettingValue,
} from '../types.js'

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
  const operation = getGenerationOperation(model, operationId)
    ?? getGenerationOperation(model, model.defaultOperationId)
  const activeIds = new Set(operation?.inputSlotIds ?? [])
  return model.inputSlots.filter(slot => activeIds.has(slot.id))
}

export function getActiveGenerationSettings(
  model: GenerationModelDefinition,
  operationId: unknown,
) {
  const operation = getGenerationOperation(model, operationId)
    ?? getGenerationOperation(model, model.defaultOperationId)
  const activeIds = new Set(operation?.settingIds ?? [])
  const operationSettingValues = new Map<string, GenerationSettingValue[]>()

  for (const constraint of model.constraints) {
    if (!operation || !constraint.when.every(condition =>
      condition.field === 'operation' && condition.value === operation.id)) {
      continue
    }
    for (const requirement of constraint.require ?? []) {
      if (requirement.field !== 'setting')
        continue
      const requiredValues = requirement.operator === 'equals'
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
