import { IconFolder } from '@tabler/icons-react'
import { createPortal } from 'react-dom'

export function FolderDragPreview({
  container,
  name,
}: {
  container: HTMLElement | null
  name: string
}) {
  if (!container)
    return null

  return createPortal(
    <div className="
      flex max-w-64 items-center gap-3 rounded-xl border bg-popover p-2 pr-3
      text-popover-foreground shadow-lg
    "
    >
      <span className="
        flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted
      "
      >
        <IconFolder aria-hidden />
      </span>
      <span className="min-w-0 truncate text-sm font-medium">{name}</span>
    </div>,
    container,
  )
}
