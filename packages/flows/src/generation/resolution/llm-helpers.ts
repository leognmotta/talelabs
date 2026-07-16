import type {
  GenerationInputAvailability,
  GenerationModelDefinition,
  GenerationSettingValue,
} from '../registry/types.js'

import { isGenerationSettingValueValid } from '../registry/index.js'

export function llmSlotCount(
  counts: Readonly<Record<string, number>>,
  slotId: string,
) {
  return Math.max(0, counts[slotId] ?? 0)
}

export function llmSlotAvailability(input: {
  connectionCounts: Readonly<Record<string, number>>
  itemCounts: Readonly<Record<string, number>>
  model: GenerationModelDefinition
  slotId: string
}): GenerationInputAvailability {
  const slot = input.model.inputSlots.find(item => item.id === input.slotId)
  if (!slot)
    return { state: 'unsupported' }

  const connectionCount = llmSlotCount(input.connectionCounts, input.slotId)
  const itemCount = llmSlotCount(input.itemCounts, input.slotId)
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

export function normalizeLlmSettings(
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
