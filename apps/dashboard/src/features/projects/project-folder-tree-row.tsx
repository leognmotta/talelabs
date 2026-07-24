/**
 * Interactive Project folder row with contextual disclosure and creation menu.
 *
 * The row owns only presentation and drop-target feedback. Tree visibility,
 * navigation, and folder mutations remain with the surrounding Project shell.
 */

import type { ProjectFolderTreeItem } from '@talelabs/sdk'
import type { LibraryDragData } from '../assets/drag-and-drop/asset-drag-data'

import {
  IconChevronRight,
  IconDots,
  IconFolder,
  IconFolderOpen,
  IconFolderPlus,
} from '@tabler/icons-react'
import { Button } from '@talelabs/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@talelabs/ui/components/dropdown-menu'
import { cn } from '@talelabs/ui/lib/utils'
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useFolderDropTarget } from '../assets/drag-and-drop/use-folder-drop-target'

/** Renders one accessible folder treeitem and its hover/focus actions. */
export function ProjectFolderTreeRow({
  activeDragData,
  activeKeyboardId,
  depth,
  expanded,
  folder,
  folders,
  hasChildren,
  selected,
  onCreateNested,
  onDragHover,
  onFocus,
  onOpen,
  onToggle,
  rowRef,
}: {
  activeDragData: LibraryDragData | null
  activeKeyboardId: null | string
  depth: number
  expanded: boolean
  folder: ProjectFolderTreeItem
  folders: ProjectFolderTreeItem[]
  hasChildren: boolean
  selected: boolean
  onCreateNested: (folderId: string) => void
  onDragHover: (folderId: null | string) => void
  onFocus: (folderId: string) => void
  onOpen: (folderId: string) => void
  onToggle: (folderId: string, expanded: boolean) => void
  rowRef: (element: HTMLButtonElement | null) => void
}) {
  const { t } = useTranslation()
  const elementRef = useRef<HTMLButtonElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const setRef = useCallback((element: HTMLButtonElement | null) => {
    elementRef.current = element
    rowRef(element)
  }, [rowRef])
  const handleHover = useCallback((over: boolean) => {
    onDragHover(over ? folder.id : null)
  }, [folder.id, onDragHover])
  const dropState = useFolderDropTarget({
    activeDragData,
    elementRef,
    folder,
    folders,
    onHoverChange: handleHover,
  })
  const FolderIcon = selected ? IconFolderOpen : IconFolder

  return (
    <div className="group/tree-row relative" role="none">
      <button
        aria-level={depth + 2}
        aria-expanded={hasChildren ? expanded : undefined}
        aria-selected={selected}
        className={cn(
          `
            flex h-8 w-full min-w-0 items-center gap-2 rounded-lg pr-9 text-left
            text-sm outline-none
            hover:bg-sidebar-accent
            focus-visible:ring-2 focus-visible:ring-sidebar-ring
          `,
          selected && 'bg-sidebar-accent text-sidebar-accent-foreground',
          dropState === 'active-valid' && 'bg-primary/10 ring-2 ring-primary',
          dropState === 'active-forbidden' && 'cursor-not-allowed opacity-50',
        )}
        ref={setRef}
        role="treeitem"
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        tabIndex={activeKeyboardId === folder.id ? 0 : -1}
        type="button"
        onClick={() => onOpen(folder.id)}
        onFocus={() => onFocus(folder.id)}
      >
        <FolderIcon
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-opacity',
            hasChildren && `
              group-focus-within/tree-row:opacity-0
              group-hover/tree-row:opacity-0
            `,
            hasChildren && (selected || menuOpen) && 'opacity-0',
          )}
        />
        <span className="min-w-0 flex-1 truncate">{folder.name}</span>
        <span
          className={cn(
            `
              shrink-0 text-xs text-muted-foreground tabular-nums
              transition-opacity
              group-focus-within/tree-row:opacity-0
              group-hover/tree-row:opacity-0
            `,
            (selected || menuOpen) && 'opacity-0',
          )}
        >
          {folder.assetCount}
        </span>
      </button>
      {hasChildren
        ? (
            <Button
              aria-label={t(
                expanded ? 'projects.collapseFolder' : 'projects.expandFolder',
                { name: folder.name },
              )}
              className={cn(
                `
                  pointer-events-none absolute top-1/2 z-10 size-6
                  -translate-y-1/2 opacity-0 transition-opacity
                  group-focus-within/tree-row:pointer-events-auto
                  group-focus-within/tree-row:opacity-100
                  group-hover/tree-row:pointer-events-auto
                  group-hover/tree-row:opacity-100
                  active:not-aria-[haspopup]:-translate-y-1/2
                `,
                (selected || menuOpen) && 'pointer-events-auto opacity-100',
              )}
              size="icon-sm"
              style={{ left: `${4 + depth * 14}px` }}
              type="button"
              variant="ghost"
              onClick={() => onToggle(folder.id, expanded)}
            >
              <IconChevronRight
                className={cn(
                  'transition-transform',
                  expanded && 'rotate-90',
                )}
              />
            </Button>
          )
        : null}
      <div
        className={cn(
          `
            pointer-events-none absolute top-1/2 right-1 z-10 -translate-y-1/2
            opacity-0 transition-opacity
            group-focus-within/tree-row:pointer-events-auto
            group-focus-within/tree-row:opacity-100
            group-hover/tree-row:pointer-events-auto
            group-hover/tree-row:opacity-100
          `,
          (selected || menuOpen) && 'pointer-events-auto opacity-100',
        )}
      >
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger
            render={(
              <Button
                aria-label={t('common.moreOptions')}
                className="size-6"
                size="icon-sm"
                type="button"
                variant="ghost"
              />
            )}
          >
            <IconDots />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onCreateNested(folder.id)}>
              <IconFolderPlus />
              {t('assets.newFolder')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
