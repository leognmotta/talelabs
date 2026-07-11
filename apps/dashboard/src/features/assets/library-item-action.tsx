import type { ReactNode, SyntheticEvent } from 'react'

function stopPropagation(event: SyntheticEvent) {
  event.stopPropagation()
}

export function LibraryItemAction({ children }: { children: ReactNode }) {
  return (
    <div
      data-library-item-action
      onClick={stopPropagation}
      onDoubleClick={stopPropagation}
      onPointerDown={stopPropagation}
    >
      {children}
    </div>
  )
}
