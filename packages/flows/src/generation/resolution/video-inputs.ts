import type { GenerationOperationDefinition } from '../registry/types.js'

export const VIDEO_GENERATION_INPUT_SLOT_IDS = [
  'prompt',
  'firstFrame',
  'lastFrame',
  'imageReferences',
  'videoReferences',
  'audioReferences',
] as const

export type VideoGenerationInputSlotId
  = typeof VIDEO_GENERATION_INPUT_SLOT_IDS[number]

const LEGACY_SLOT_ALIASES: Readonly<Record<string, VideoGenerationInputSlotId>> = {
  referenceAudio: 'audioReferences',
  references: 'imageReferences',
  referenceVideo: 'videoReferences',
}

export function normalizeVideoGenerationInputSlotId(slotId: string) {
  return LEGACY_SLOT_ALIASES[slotId] ?? slotId
}

export function videoInputCount(
  counts: Readonly<Record<string, number>>,
  slotId: string,
) {
  return Math.max(0, counts[slotId] ?? 0)
}

export function effectiveVideoInputCount(input: {
  connectionCounts: Readonly<Record<string, number>>
  inlinePrompt: string
  itemCounts: Readonly<Record<string, number>>
  operation?: GenerationOperationDefinition
  slotId: string
}) {
  const count = Math.max(
    videoInputCount(input.connectionCounts, input.slotId),
    videoInputCount(input.itemCounts, input.slotId),
  )
  return normalizeVideoGenerationInputSlotId(input.slotId) === 'prompt'
    && input.inlinePrompt.trim().length > 0
    ? Math.max(1, count)
    : count
}
