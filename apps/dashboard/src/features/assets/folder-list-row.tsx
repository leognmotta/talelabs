import type { Folder } from '@talelabs/sdk'
import type { FolderActions } from './asset-actions.types'
import type { AssetLibraryInteractions } from './asset-library.types'

import { TableCell, TableRow } from '@talelabs/ui/components/table'
import { cn } from '@talelabs/ui/lib/utils'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { formatAssetSize } from './asset-formatters'
import { FolderDragPreview } from './drag-and-drop/folder-drag-preview'
import { useDraggableFolder } from './drag-and-drop/use-draggable-folder'
import { useFolderDropTarget } from './drag-and-drop/use-folder-drop-target'
import { FolderActionMenu } from './folder-action-menu'
import { FolderPreview } from './folder-preview'

export function FolderListRow({
  actions,
  folder,
  interactions,
  locale,
  mode,
}: {
  actions: FolderActions
  folder: Folder
  interactions: AssetLibraryInteractions
  locale: string
  mode: 'manage' | 'select'
}) {
  const { t } = useTranslation()
  const elementRef = useRef<HTMLTableRowElement>(null)
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
    <TableRow
      ref={elementRef}
      className={cn(
        'select-none',
        drag.isDragging && 'opacity-40',
        dropState === 'valid' && 'outline -outline-offset-1 outline-primary/30',
        dropState === 'forbidden' && 'cursor-not-allowed opacity-60',
        dropState === 'active-valid' && `
          bg-primary/10 outline-2 -outline-offset-2 outline-primary
        `,
        dropState === 'active-forbidden' && `
          cursor-not-allowed bg-destructive/10 outline-2 -outline-offset-2
          outline-destructive
        `,
      )}
      data-state={selected ? 'selected' : undefined}
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
      {mode === 'select' && <TableCell />}
      <TableCell>
        <button
          ref={dragHandleRef}
          aria-label={t('assets.selectFolder', { name: folder.name })}
          aria-pressed={selected}
          className="
            flex cursor-grab items-center gap-3 font-medium
            active:cursor-grabbing
          "
          type="button"
        >
          <FolderPreview
            className="
              size-10 shrink-0 gap-0.5 overflow-hidden rounded-lg p-1 ring-1
              ring-border
              [&>img]:rounded-sm
              [&>svg]:size-5
            "
            itemCount={folder.itemCount}
            thumbnailUrls={folder.thumbnailUrls}
          />
          <span className="min-w-0 text-left">
            <span className="block truncate">{folder.name}</span>
            <span className="
              block truncate text-xs font-normal text-muted-foreground
            "
            >
              {t('assets.folderItemCount', { count: folder.itemCount })}
            </span>
          </span>
        </button>
      </TableCell>
      <TableCell className="
        hidden text-muted-foreground
        md:table-cell
      "
      >
        {t('assets.folder')}
      </TableCell>
      <TableCell className="
        hidden text-muted-foreground
        lg:table-cell
      "
      >
        {formatAssetSize(folder.totalSizeBytes, locale) ?? '—'}
      </TableCell>
      <TableCell className="
        hidden
        xl:table-cell
      "
      />
      <TableCell className="
        hidden w-40 text-muted-foreground
        sm:table-cell
      "
      >
        {new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(folder.createdAt))}
      </TableCell>
      <TableCell className="w-10 text-right">
        {mode === 'manage' && <FolderActionMenu actions={actions} folder={folder} />}
      </TableCell>
      <FolderDragPreview container={drag.previewContainer} name={folder.name} />
    </TableRow>
  )
}
