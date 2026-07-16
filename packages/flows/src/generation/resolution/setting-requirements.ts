import type {
  GenerationModelDefinition,
  GenerationSettingValue,
} from '../registry/index.js'

import { matchesGenerationCondition } from '../registry/index.js'

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
