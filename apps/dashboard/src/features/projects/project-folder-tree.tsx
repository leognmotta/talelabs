/**
 * Selected-path Project folder tree with search, keyboard, and shared DnD.
 *
 * The tree consumes one bounded flat folder set and derives every visible row
 * locally. It never loads Assets or issues child-folder requests.
 */

import type { ProjectFolderTreeItem } from '@talelabs/sdk'
import type { LibraryDragData } from '../assets/drag-and-drop/asset-drag-data'

import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'

import { isLibraryDragData } from '../assets/drag-and-drop/library-drop-data-guards'
import { ProjectFolderTreeRow } from './project-folder-tree-row'
import { ProjectRootDropTarget } from './project-root-drop-target'

interface VisibleFolder {
  depth: number
  expanded: boolean
  folder: ProjectFolderTreeItem
  hasChildren: boolean
}

const EMPTY_FOLDER_IDS: ReadonlySet<string> = new Set()

function ancestorIds(
  folderId: null | string | undefined,
  foldersById: Map<string, ProjectFolderTreeItem>,
) {
  const ids: string[] = []
  const seen = new Set<string>()
  let currentId = folderId
  while (currentId && !seen.has(currentId)) {
    seen.add(currentId)
    ids.unshift(currentId)
    currentId = foldersById.get(currentId)?.parentId ?? null
  }
  return ids
}

function visibleFolderRows(input: {
  collapsedIds?: ReadonlySet<string>
  dragExpandedId: null | string
  expandedIds: ReadonlySet<string>
  folders: ProjectFolderTreeItem[]
  search: string
  selectedFolderId?: null | string
  sort: 'asc' | 'desc'
}) {
  const collapsedIds = input.collapsedIds ?? EMPTY_FOLDER_IDS
  const foldersById = new Map(input.folders.map(folder => [folder.id, folder]))
  const childrenByParent = new Map<null | string, ProjectFolderTreeItem[]>()
  for (const folder of input.folders) {
    childrenByParent.set(folder.parentId, [
      ...(childrenByParent.get(folder.parentId) ?? []),
      folder,
    ])
  }
  for (const children of childrenByParent.values()) {
    children.sort((left, right) => {
      const compared = left.name.localeCompare(right.name)
      return input.sort === 'asc' ? compared : -compared
    })
  }
  const search = input.search.trim().toLocaleLowerCase()
  if (search) {
    const included = new Set<string>()
    for (const folder of input.folders) {
      if (!folder.name.toLocaleLowerCase().includes(search))
        continue
      for (const id of ancestorIds(folder.id, foldersById))
        included.add(id)
    }
    const rows: VisibleFolder[] = []
    const visit = (folder: ProjectFolderTreeItem, depth: number) => {
      if (!included.has(folder.id))
        return
      const children = childrenByParent.get(folder.id) ?? []
      rows.push({
        depth,
        expanded: children.some(child => included.has(child.id)),
        folder,
        hasChildren: children.length > 0,
      })
      for (const child of children)
        visit(child, depth + 1)
    }
    for (const root of childrenByParent.get(null) ?? [])
      visit(root, 0)
    return rows
  }
  const selectedPath = new Set(ancestorIds(
    input.selectedFolderId,
    foldersById,
  ))
  const rows: VisibleFolder[] = []
  const visit = (folder: ProjectFolderTreeItem, depth: number) => {
    const children = childrenByParent.get(folder.id) ?? []
    const expanded = input.dragExpandedId === folder.id
      || (
        !collapsedIds.has(folder.id)
        && (
          selectedPath.has(folder.id)
          || input.expandedIds.has(folder.id)
        )
      )
    rows.push({
      depth,
      expanded,
      folder,
      hasChildren: children.length > 0,
    })
    if (!expanded)
      return
    for (const child of children)
      visit(child, depth + 1)
  }
  for (const root of childrenByParent.get(null) ?? [])
    visit(root, 0)
  return rows
}

function useActiveLibraryDrag() {
  const [active, setActive] = useState<LibraryDragData | null>(null)
  useEffect(() => monitorForElements({
    canMonitor: ({ source }) => isLibraryDragData(source.data),
    onDragStart: ({ source }) => {
      if (isLibraryDragData(source.data))
        setActive(source.data)
    },
    onDrop: () => setActive(null),
  }), [])
  return active
}

/** Renders the Project-root target and accessible selected-path folder rows. */
export function ProjectFolderTree({
  folders,
  search,
  selectedFolderId,
  sort,
  onCreateFolder,
  onOpenFolder,
}: {
  /** One bounded flat Project folder metadata set. */
  folders: ProjectFolderTreeItem[]
  /** Inline folder-name query. */
  search: string
  /** Folder opened by the shared Asset Library route. */
  selectedFolderId?: null | string
  /** Local folder-name sort direction. */
  sort: 'asc' | 'desc'
  /** Opens folder creation with one real folder as the parent. */
  onCreateFolder: (parentId: string) => void
  /** Navigates the shared Asset Library to root or one folder. */
  onOpenFolder: (folderId: null | string) => void
}) {
  const activeDragData = useActiveLibraryDrag()
  const [keyboardState, setKeyboardState] = useState<{
    activeId: null | string
    selectedId?: null | string
  }>({
    activeId: selectedFolderId ?? null,
    selectedId: selectedFolderId,
  })
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set())
  const [dragExpandedId, setDragExpandedId] = useState<null | string>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const rootElementRef = useRef<HTMLButtonElement>(null)
  const rowElementsRef = useRef(new Map<string, HTMLButtonElement>())
  const keyboardNavigationRef = useRef(false)
  const rows = useMemo(() => visibleFolderRows({
    collapsedIds,
    dragExpandedId,
    expandedIds,
    folders,
    search,
    selectedFolderId,
    sort,
  }), [
    collapsedIds,
    dragExpandedId,
    expandedIds,
    folders,
    search,
    selectedFolderId,
    sort,
  ])
  const foldersById = useMemo(
    () => new Map(folders.map(folder => [folder.id, folder])),
    [folders],
  )
  const rowIds = rows.map(row => row.folder.id)
  const activeKeyboardId = keyboardState.selectedId === selectedFolderId
    ? keyboardState.activeId
    : selectedFolderId
  const navigableKeyboardId = activeKeyboardId
    && rowIds.includes(activeKeyboardId)
    ? activeKeyboardId
    : null
  const activeIndex = navigableKeyboardId
    ? rowIds.indexOf(navigableKeyboardId)
    : -1

  useEffect(() => {
    if (!keyboardNavigationRef.current)
      return
    const element = navigableKeyboardId
      ? rowElementsRef.current.get(navigableKeyboardId)
      : rootElementRef.current
    element?.scrollIntoView({
      block: 'nearest',
    })
    keyboardNavigationRef.current = false
  }, [navigableKeyboardId])

  function focusRow(folderId: string) {
    keyboardNavigationRef.current = true
    setKeyboardState({ activeId: folderId, selectedId: selectedFolderId })
    requestAnimationFrame(() => rowElementsRef.current.get(folderId)?.focus())
  }

  function focusRoot() {
    keyboardNavigationRef.current = true
    setKeyboardState({ activeId: null, selectedId: selectedFolderId })
    requestAnimationFrame(() => rootElementRef.current?.focus())
  }

  function openFolder(folderId: null | string) {
    setCollapsedIds(new Set())
    setExpandedIds(new Set())
    setDragExpandedId(null)
    onOpenFolder(folderId)
  }

  function toggleFolder(folderId: string, expanded: boolean) {
    const hidesSelectedFolder = expanded
      && folderId !== selectedFolderId
      && ancestorIds(selectedFolderId, foldersById).includes(folderId)
    setCollapsedIds((current) => {
      const next = new Set(current)
      if (expanded)
        next.add(folderId)
      else
        next.delete(folderId)
      return next
    })
    setExpandedIds((current) => {
      const next = new Set(current)
      if (expanded)
        next.delete(folderId)
      else
        next.add(folderId)
      return next
    })
    if (hidesSelectedFolder) {
      setDragExpandedId(null)
      onOpenFolder(folderId)
    }
  }

  function createNestedFolder(folderId: string) {
    setCollapsedIds((current) => {
      const next = new Set(current)
      next.delete(folderId)
      return next
    })
    setExpandedIds(current => new Set(current).add(folderId))
    onCreateFolder(folderId)
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (
      !(event.target instanceof HTMLElement)
      || event.target.getAttribute('role') !== 'treeitem'
    ) {
      return
    }
    if (navigableKeyboardId === null) {
      if (event.key === 'Enter') {
        event.preventDefault()
        openFolder(null)
      }
      else if (
        (event.key === 'ArrowDown' || event.key === 'ArrowRight')
        && rows[0]
      ) {
        event.preventDefault()
        focusRow(rows[0].folder.id)
      }
      return
    }
    if (rows.length === 0)
      return
    const activeRow = rows[activeIndex]
    if (!activeRow)
      return
    const active = activeRow.folder
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (event.key === 'ArrowUp' && activeIndex === 0) {
        focusRoot()
        return
      }
      const offset = event.key === 'ArrowDown' ? 1 : -1
      const nextIndex = Math.min(
        rows.length - 1,
        Math.max(0, activeIndex + offset),
      )
      focusRow(rows[nextIndex].folder.id)
      return
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      const nextRow = rows[activeIndex + 1]
      if (
        activeRow.expanded
        && nextRow
        && nextRow.depth === activeRow.depth + 1
      ) {
        focusRow(nextRow.folder.id)
      }
      else if (activeRow.hasChildren) {
        toggleFolder(active.id, false)
      }
      return
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      if (activeRow.expanded && activeRow.hasChildren) {
        toggleFolder(active.id, true)
      }
      else if (active.parentId && foldersById.has(active.parentId)) {
        focusRow(active.parentId)
      }
      else {
        focusRoot()
      }
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      openFolder(active.id)
    }
  }

  return (
    <div
      aria-label={useTranslation().t('projects.folders')}
      className="
        min-h-0 flex-1 scroll-fade-y scrollbar-none overflow-y-auto
        overscroll-contain px-2 pb-3
      "
      role="tree"
      onKeyDown={handleKeyDown}
    >
      <ProjectRootDropTarget
        active={navigableKeyboardId === null}
        activeDragData={activeDragData}
        folders={folders}
        rowRef={element => rootElementRef.current = element}
        selected={selectedFolderId === null}
        onFocus={() => setKeyboardState({
          activeId: null,
          selectedId: selectedFolderId,
        })}
        onOpen={() => openFolder(null)}
      />
      {rows.map(({ depth, expanded, folder, hasChildren }) => (
        <ProjectFolderTreeRow
          activeDragData={activeDragData}
          activeKeyboardId={navigableKeyboardId}
          depth={depth}
          expanded={expanded}
          folder={folder}
          folders={folders}
          hasChildren={hasChildren}
          key={folder.id}
          rowRef={(element) => {
            if (element)
              rowElementsRef.current.set(folder.id, element)
            else
              rowElementsRef.current.delete(folder.id)
          }}
          selected={folder.id === selectedFolderId}
          onCreateNested={createNestedFolder}
          onDragHover={setDragExpandedId}
          onFocus={activeId => setKeyboardState({
            activeId,
            selectedId: selectedFolderId,
          })}
          onOpen={openFolder}
          onToggle={toggleFolder}
        />
      ))}
    </div>
  )
}
