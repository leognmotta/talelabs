import type {
  GenerationInputAvailability,
  GenerationModelDefinition,
} from '../registry/types.js'

import { normalizeImageGenerationInputSlotId } from './image-input-aliases.js'
import { imageInputCount } from './image-input-counts.js'

export function imageInputAvailability(input: {
  connectionCounts: Readonly<Record<string, number>>
  itemCounts: Readonly<Record<string, number>>
  model: GenerationModelDefinition
  slotId: string
}): GenerationInputAvailability {
  const normalizedSlotId = normalizeImageGenerationInputSlotId(input.slotId)
  const slot = input.model.inputSlots.find(
    item => normalizeImageGenerationInputSlotId(item.id) === normalizedSlotId,
  )
  if (!slot)
    return { state: 'unsupported' }

  const connectionCount = imageInputCount(input.connectionCounts, normalizedSlotId)
  const itemCount = imageInputCount(input.itemCounts, normalizedSlotId)
  if (connectionCount >= slot.maxConnections || itemCount >= slot.maxItems) {
    return {
      reasonKey: normalizedSlotId === 'imageReferences'
        ? 'flows.image.inputs.limitReached'
        : 'flows.image.inputs.connectionLimitReached',
      state: 'full',
    }
  }
  if (connectionCount > 0 || itemCount > 0)
    return { connectionCount, itemCount, state: 'connected' }
  return { state: 'available' }
}
