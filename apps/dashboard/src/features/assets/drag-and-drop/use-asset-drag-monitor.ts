/** Global drag monitor that resolves the active library payload and folder target. */

import type { LibraryDragData } from './asset-drag-data'

import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { useEffect, useRef, useState } from 'react'
import {
  isFolderDropTargetData,
  isLibraryDragData,
} from './library-drop-data-guards'

/** Tracks the active drag payload and dispatches a validated drop when it ends. */
export function useAssetDragMonitor({
  onDrop,
}: {
  onDrop: (source: LibraryDragData, destinationFolderId: string) => void
}) {
  const onDropRef = useRef(onDrop)
  const [activeDragData, setActiveDragData] = useState<LibraryDragData | null>(null)

  useEffect(() => {
    onDropRef.current = onDrop
  })

  useEffect(() => monitorForElements({
    canMonitor: ({ source }) => isLibraryDragData(source.data),
    onDragStart: ({ source }) => {
      if (isLibraryDragData(source.data))
        setActiveDragData(source.data)
    },
    onDrop: ({ location, source }) => {
      setActiveDragData(null)
      if (!isLibraryDragData(source.data))
        return

      const innermostTarget = location.current.dropTargets[0]
      if (!innermostTarget || !isFolderDropTargetData(innermostTarget.data))
        return

      onDropRef.current(source.data, innermostTarget.data.folderId)
    },
  }), [])

  return activeDragData
}
/** Global drag monitor that resolves the active library payload and folder target. */
