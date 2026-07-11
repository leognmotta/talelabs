import type { Folder } from '@talelabs/sdk'
import type { FolderActions } from './asset-actions.types'
import type { AssetLibraryInteractions } from './asset-library.types'

import { cn } from '@talelabs/ui/lib/utils'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { FolderDragPreview } from './drag-and-drop/folder-drag-preview'
import { useDraggableFolder } from './drag-and-drop/use-draggable-folder'
import { useFolderDropTarget } from './drag-and-drop/use-folder-drop-target'
import { FolderActionMenu } from './folder-action-menu'
import { FolderPreview } from './folder-preview'

export function FolderCard({ actions, folder, interactions }: {
  actions: FolderActions
  folder: Folder
  interactions: AssetLibraryInteractions
}) {
  const { t } = useTranslation()
  const elementRef = useRef<HTMLElement>(null)
  const dragHandleRef = useRef<HTMLButtonElement>(null)
  const selected = interactions.selectedFolderIds.has(folder.id)
  const drag = useDraggableFolder({
    elementRef,
    dragHandleRef,
    getData: () => interactions.getFolderDragData(folder),
    onDragStart: () => {
      if (!selected)
        interactions.onFolderSelect(folder, { ctrlKey: false, metaKey: false, shiftKey: false })
    },
  })
  const dropState = useFolderDropTarget({
    activeDragData: interactions.activeDragData,
    elementRef,
    folder,
    folders: interactions.folders,
  })

  return (
    <article
      ref={elementRef}
      className={cn('group min-w-0 select-none', drag.isDragging && 'opacity-40')}
      onClick={(event) => {
        event.stopPropagation()
        if (!drag.shouldIgnoreClick())
          interactions.onFolderSelect(folder, event)
      }}
      onDoubleClick={(event) => {
        event.stopPropagation()
        if (!drag.shouldIgnoreClick())
          interactions.onFolderOpen(folder)
      }}
    >
      <button
        ref={dragHandleRef}
        aria-label={t('assets.selectFolder', { name: folder.name })}
        aria-pressed={selected}
        className={cn(
          `
            flex aspect-square w-full cursor-grab items-center justify-center
            overflow-hidden rounded-xl bg-muted/60 ring-1 ring-border transition
            hover:bg-muted
            active:cursor-grabbing
          `,
          selected && 'ring-2 ring-primary',
          dropState === 'valid' && 'ring-primary/40',
          dropState === 'forbidden' && 'cursor-not-allowed opacity-60',
          dropState === 'active-valid' && 'bg-primary/10 ring-2 ring-primary',
          dropState === 'active-forbidden' && `
            cursor-not-allowed bg-destructive/10 ring-2 ring-destructive
          `,
        )}
        type="button"
      >
        <FolderPreview
          itemCount={folder.itemCount}
          thumbnailUrls={folder.thumbnailUrls}
        />
      </button>
      <div className="mt-2 flex min-w-0 items-start gap-2 px-0.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={folder.name}>{folder.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {t('assets.folderItemCount', { count: folder.itemCount })}
          </p>
        </div>
        {interactions.mode === 'manage' && <FolderActionMenu actions={actions} folder={folder} />}
      </div>
      <FolderDragPreview container={drag.previewContainer} name={folder.name} />
    </article>
  )
}
