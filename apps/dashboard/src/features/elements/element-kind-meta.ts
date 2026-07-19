/** Presentation metadata for product-controlled Element kinds. */

import type { ElementKind } from '@talelabs/sdk'

import {
  IconCube,
  IconMapPin,
  IconPalette,
  IconPuzzle,
  IconUser,
} from '@tabler/icons-react'
import { ELEMENT_KINDS } from '@talelabs/assets'

/** Icon shown for one Element kind in cards, pickers, and canvas nodes. */
export const ELEMENT_KIND_ICONS: Record<ElementKind, typeof IconUser> = {
  character: IconUser,
  location: IconMapPin,
  other: IconPuzzle,
  prop: IconCube,
  style: IconPalette,
}

/** Stable translation key for one Element kind label. */
export function elementKindLabelKey(kind: ElementKind) {
  return `elements.kinds.${kind}`
}

export { ELEMENT_KINDS }
