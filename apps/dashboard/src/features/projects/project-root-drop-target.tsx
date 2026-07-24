/** Accessible Project-root folder-tree row and shared library drop target. */

import type { ProjectFolderTreeItem } from '@talelabs/sdk'
import type { LibraryDragData } from '../assets/drag-and-drop/asset-drag-data'

import {
  dropTargetForElements,
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { IconFolderOpen } from '@tabler/icons-react'
import { cn } from '@talelabs/ui/lib/utils'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  validateLibraryMove,
} from '../assets/drag-and-drop/folder-move-validation'
import {
  isLibraryDragData,
} from '../assets/drag-and-drop/library-drop-data-guards'

/** Renders the Project root as a selectable and droppable tree row. */
export function ProjectRootDropTarget({
  active,
  activeDragData,
  folders,
  selected,
  onFocus,
  onOpen,
  rowRef,
}: {
  /** Whether this row owns the roving keyboard tab stop. */
  active: boolean
  /** Current shared-library drag payload, when one is active. */
  activeDragData: LibraryDragData | null
  /** Complete bounded Project folder set used to validate the move. */
  folders: ProjectFolderTreeItem[]
  /** Whether Project root is the open Asset Library location. */
  selected: boolean
  /** Updates the parent tree's roving focus state. */
  onFocus: () => void
  /** Opens Project root in the shared Asset Library. */
  onOpen: () => void
  /** Registers the physical row element for keyboard navigation. */
  rowRef: (element: HTMLButtonElement | null) => void
}) {
  const { t } = useTranslation()
  const ref = useRef<HTMLButtonElement>(null)
  const [over, setOver] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element)
      return
    return dropTargetForElements({
      canDrop: ({ source }) => isLibraryDragData(source.data),
      element,
      getData: () => ({ folderId: null, type: 'folder-drop-target' }),
      getDropEffect: () => 'move',
      onDragEnter: () => setOver(true),
      onDragLeave: () => setOver(false),
      onDrop: () => setOver(false),
    })
  }, [])
  const allowed = activeDragData
    ? validateLibraryMove(activeDragData, null, folders).allowed
    : true

  return (
    <button
      aria-level={1}
      aria-selected={selected}
      className={cn(
        `
          flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-sm
          outline-none
          hover:bg-sidebar-accent
          focus-visible:ring-2 focus-visible:ring-sidebar-ring
        `,
        selected && 'bg-sidebar-accent text-sidebar-accent-foreground',
        over && allowed && 'bg-primary/10 ring-2 ring-primary',
        over && !allowed && 'cursor-not-allowed opacity-50',
      )}
      ref={(element) => {
        ref.current = element
        rowRef(element)
      }}
      role="treeitem"
      tabIndex={active ? 0 : -1}
      type="button"
      onClick={onOpen}
      onFocus={onFocus}
    >
      <IconFolderOpen className="size-4 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">
        {t('projects.projectRoot')}
      </span>
    </button>
  )
}
