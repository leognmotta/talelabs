import type { GenerationModelDefinition } from '../registry/types.js'
import {
  normalizeVideoGenerationInputSlotId,
  videoInputCount,
} from './video-inputs.js'

const FRAME_SLOT_IDS = new Set(['firstFrame', 'lastFrame'])
const REFERENCE_SLOT_IDS = new Set([
  'audioReferences',
  'imageReferences',
  'videoReferences',
])

export function connectedVideoSlotIds(
  model: GenerationModelDefinition,
  connectionCounts: Readonly<Record<string, number>>,
  itemCounts: Readonly<Record<string, number>>,
) {
  return model.inputSlots
    .filter(slot => Math.max(
      videoInputCount(connectionCounts, slot.id),
      videoInputCount(itemCounts, slot.id),
    ) > 0)
    .map(slot => slot.id)
}

export function videoSlotFamily(slotId: string) {
  const normalized = normalizeVideoGenerationInputSlotId(slotId)
  if (FRAME_SLOT_IDS.has(normalized))
    return 'frame'
  if (REFERENCE_SLOT_IDS.has(normalized))
    return 'reference'
  return null
}
