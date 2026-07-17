/** Keyboard-accessible action wrapper used by Asset and folder presentations. */

import type { ReactNode, SyntheticEvent } from 'react'

function stopPropagation(event: SyntheticEvent) {
  event.stopPropagation()
}

/** Stops item selection gestures from swallowing an explicit menu command. */
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
