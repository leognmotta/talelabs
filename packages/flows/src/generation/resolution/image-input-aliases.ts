export const IMAGE_GENERATION_INPUT_SLOT_IDS = [
  'prompt',
  'imageReferences',
] as const

export type ImageGenerationInputSlotId
  = (typeof IMAGE_GENERATION_INPUT_SLOT_IDS)[number]

const LEGACY_SLOT_ALIASES: Readonly<
  Record<string, ImageGenerationInputSlotId>
> = {
  references: 'imageReferences',
}

export function normalizeImageGenerationInputSlotId(slotId: string) {
  return LEGACY_SLOT_ALIASES[slotId] ?? slotId
}
