/** Resolves controlled, URL-backed, and local Asset library control ownership. */

import type {
  AssetLibraryFilters,
  AssetLibraryProps,
} from './asset-library.types'

import { useRef, useState } from 'react'
import { useAssetLibraryViewControl } from './use-asset-library-view-control'

const initialFilters: AssetLibraryFilters = {
  archived: false,
  favorite: false,
  order: 'desc',
  search: '',
  sort: 'createdAt',
}

/** Coordinates controlled or local folder and filter state with view preference state. */
export function useAssetLibraryControls(input: Pick<
  AssetLibraryProps,
  | 'filters'
  | 'folderId'
  | 'initialFolderId'
  | 'onFiltersChange'
  | 'onFolderChange'
  | 'onViewChange'
  | 'view'
>) {
  const [internalFolderId, setInternalFolderId] = useState<null | string>(
    input.initialFolderId ?? null,
  )
  const folderId
    = input.folderId === undefined ? internalFolderId : input.folderId
  const [internalFilters, setInternalFilters] = useState(initialFilters)
  const filters = input.filters ?? internalFilters
  const filtersRef = useRef(filters)
  filtersRef.current = filters
  const { updateView, view } = useAssetLibraryViewControl(input)

  function navigateToFolder(nextFolderId: null | string) {
    if (input.folderId === undefined)
      setInternalFolderId(nextFolderId)
    input.onFolderChange?.(nextFolderId)
  }

  function updateFilters(update: Partial<AssetLibraryFilters>) {
    const nextFilters = { ...filtersRef.current, ...update }
    filtersRef.current = nextFilters
    if (input.filters === undefined)
      setInternalFilters(nextFilters)
    input.onFiltersChange?.(nextFilters)
  }

  return {
    filters,
    folderId,
    navigateToFolder,
    updateFilters,
    updateView,
    view,
  }
}
