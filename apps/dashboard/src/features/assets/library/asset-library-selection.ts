/** Pure homogeneous selection transitions shared by Asset grid and list modes. */

import type { SelectionInput } from './asset-library.types'

/** Selectable entity family; selections never mix Assets and folders. */
export type LibraryItemType = 'asset' | 'folder'

/** Homogeneous selected ids plus their entity family. */
export type LibrarySelection
  = | { ids: Set<string>, type: LibraryItemType }
    | { ids: Set<string>, type: null }

/** Last range-selection anchor, retained separately for Assets and folders. */
export interface LibrarySelectionAnchor {
  id: string
  type: LibraryItemType
}

/** Current homogeneous selection and its optional range anchor. */
export interface LibrarySelectionState {
  anchor: LibrarySelectionAnchor | null
  selection: LibrarySelection
}

/** Creates the neutral selection used after clear or entity-family changes. */
export function createEmptyLibrarySelection(): LibrarySelection {
  return { ids: new Set(), type: null }
}

/** Applies single, toggle, or ordered-range selection without mixing entity families. */
export function getNextLibrarySelection({
  anchor,
  current,
  id,
  input,
  orderedIds,
  type,
}: {
  anchor: LibrarySelectionAnchor | null
  current: LibrarySelection
  id: string
  input: SelectionInput
  orderedIds: string[]
  type: LibraryItemType
}): LibrarySelectionState {
  if (input.shiftKey && anchor?.type === type) {
    const anchorIndex = orderedIds.indexOf(anchor.id)
    const targetIndex = orderedIds.indexOf(id)

    if (anchorIndex >= 0 && targetIndex >= 0) {
      const rangeStart = Math.min(anchorIndex, targetIndex)
      const rangeEnd = Math.max(anchorIndex, targetIndex)
      const ids = input.ctrlKey || input.metaKey
        ? new Set(current.type === type ? current.ids : [])
        : new Set<string>()

      for (const rangeId of orderedIds.slice(rangeStart, rangeEnd + 1))
        ids.add(rangeId)

      return { anchor, selection: { ids, type } }
    }
  }

  const nextAnchor = { id, type }
  const extendSelection = input.ctrlKey || input.metaKey

  if (!extendSelection || current.type !== type) {
    return {
      anchor: nextAnchor,
      selection: { ids: new Set([id]), type },
    }
  }

  const ids = new Set(current.ids)
  if (ids.has(id))
    ids.delete(id)
  else
    ids.add(id)

  return {
    anchor: nextAnchor,
    selection: ids.size > 0
      ? { ids, type }
      : createEmptyLibrarySelection(),
  }
}
