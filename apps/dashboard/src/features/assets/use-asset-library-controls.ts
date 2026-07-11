import type {
  AssetLibraryFilters,
  AssetLibraryProps,
  AssetLibraryView,
} from './asset-library.types'

import { useRef, useState } from 'react'
import {
  getAssetLibraryViewPreference,
  storeAssetLibraryViewPreference,
} from './asset-library-view-preference'

const initialFilters: AssetLibraryFilters = {
  archived: false,
  favorite: false,
  order: 'desc',
  search: '',
  sort: 'createdAt',
}

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
  const [internalView, setInternalView] = useState<AssetLibraryView>(
    getAssetLibraryViewPreference,
  )
  const view = input.view ?? internalView

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

  function updateView(nextView: AssetLibraryView) {
    storeAssetLibraryViewPreference(nextView)
    if (input.view === undefined)
      setInternalView(nextView)
    input.onViewChange?.(nextView)
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
