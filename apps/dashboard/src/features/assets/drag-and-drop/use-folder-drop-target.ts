import type { Folder } from '@talelabs/sdk'
import type { RefObject } from 'react'
import type { LibraryDragData } from './asset-drag-data'

import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { useEffect, useRef, useState } from 'react'
import { isLibraryDragData } from './asset-drag-data'
import { validateLibraryMove } from './folder-move-validation'

export type FolderDropState = 'active-forbidden' | 'active-valid' | 'forbidden' | 'idle' | 'valid'

export function useFolderDropTarget({
  activeDragData,
  elementRef,
  folder,
  folders,
}: {
  activeDragData: LibraryDragData | null
  elementRef: RefObject<HTMLElement | null>
  folder: Folder
  folders: Folder[]
}) {
  const folderRef = useRef(folder)
  const foldersRef = useRef(folders)
  const [isOver, setIsOver] = useState(false)

  useEffect(() => {
    folderRef.current = folder
    foldersRef.current = folders
  })

  useEffect(() => {
    const element = elementRef.current
    if (!element)
      return

    return dropTargetForElements({
      element,
      canDrop: ({ source }) => isLibraryDragData(source.data),
      getData: () => ({ type: 'folder-drop-target', folderId: folderRef.current.id }),
      getDropEffect: () => 'move',
      onDragEnter: () => setIsOver(true),
      onDragLeave: () => setIsOver(false),
      onDrop: () => setIsOver(false),
    })
  }, [elementRef])

  if (!activeDragData)
    return 'idle'

  const valid = validateLibraryMove(activeDragData, folder.id, folders).allowed
  if (isOver)
    return valid ? 'active-valid' : 'active-forbidden'

  return valid ? 'valid' : 'forbidden'
}
