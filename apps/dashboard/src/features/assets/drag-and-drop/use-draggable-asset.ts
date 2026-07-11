import type { RefObject } from 'react'
import type { AssetDragData } from './asset-drag-data'

import { useDraggableLibraryItem } from './use-draggable-library-item'

export function useDraggableAsset({
  dragHandleRef,
  elementRef,
  getData,
  onDragStart,
}: {
  dragHandleRef: RefObject<HTMLElement | null>
  elementRef: RefObject<HTMLElement | null>
  getData: () => AssetDragData
  onDragStart: () => void
}) {
  return useDraggableLibraryItem({ dragHandleRef, elementRef, getData, onDragStart })
}
