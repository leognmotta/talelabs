import type { ElementType } from '@talelabs/elements'

import {
  ELEMENT_TYPES,
  getElementTypeDefinition,
} from '@talelabs/elements'

export const ELEMENT_PREVIEW_ROLES = Object.freeze(
  Object.fromEntries(ELEMENT_TYPES.map(type => [
    type,
    getElementTypeDefinition(type).previewRole,
  ])) as Record<ElementType, null | string>,
)
