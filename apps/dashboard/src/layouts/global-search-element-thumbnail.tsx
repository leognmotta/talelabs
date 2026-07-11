import type { SearchElement } from '@talelabs/sdk'

import { ELEMENT_TYPE_ICONS } from '../features/elements/element-type-icons'

export function GlobalSearchElementThumbnail({
  element,
}: {
  element: SearchElement
}) {
  if (element.thumbnailUrl) {
    return (
      <img
        alt=""
        className="size-9 shrink-0 rounded-lg object-cover ring-1 ring-border"
        loading="lazy"
        src={element.thumbnailUrl}
      />
    )
  }

  const Icon = ELEMENT_TYPE_ICONS[element.type]
  return (
    <span className="
      flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted
      ring-1 ring-border
    "
    >
      <Icon aria-hidden className="text-muted-foreground" />
    </span>
  )
}
