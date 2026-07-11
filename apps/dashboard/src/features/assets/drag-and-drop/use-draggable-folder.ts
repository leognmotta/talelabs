import type { RefObject } from 'react'
import type { FolderDragData } from './asset-drag-data'

import { useDraggableLibraryItem } from './use-draggable-library-item'

export function useDraggableFolder({
  dragHandleRef,
  elementRef,
  getData,
  onDragStart,
}: {
  dragHandleRef: RefObject<HTMLElement | null>
  elementRef: RefObject<HTMLElement | null>
  getData: () => FolderDragData
  onDragStart: () => void
}) {
  return useDraggableLibraryItem({ dragHandleRef, elementRef, getData, onDragStart })
}
