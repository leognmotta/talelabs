import type { GenerationModelDefinition } from '../registry/types.js'

import { normalizeImageGenerationInputSlotId } from './image-input-aliases.js'

export function imageInputCount(
  counts: Readonly<Record<string, number>>,
  slotId: string,
) {
  const normalized = normalizeImageGenerationInputSlotId(slotId)
  return Math.max(
    0,
    counts[normalized] ?? 0,
    normalized === 'imageReferences' ? (counts.references ?? 0) : 0,
  )
}

export function normalizeImageInputCounts(
  counts: Readonly<Record<string, number>>,
) {
  const normalized = { ...counts }
  if (counts.references !== undefined) {
    normalized.imageReferences = Math.max(
      normalized.imageReferences ?? 0,
      counts.references,
    )
    delete normalized.references
  }
  return normalized
}

export function imageInputCountsForModel(
  model: GenerationModelDefinition,
  counts: Readonly<Record<string, number>>,
) {
  if (!model.inputSlots.some(slot => slot.id === 'references'))
    return counts
  const contractCounts = { ...counts }
  contractCounts.references = imageInputCount(counts, 'imageReferences')
  delete contractCounts.imageReferences
  return contractCounts
}
