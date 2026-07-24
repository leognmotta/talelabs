/** URL-backed ownership for shareable Asset library filters and presentation. */

import type { AssetLibraryFilters, AssetLibraryView } from './asset-library.types'

import { useQueryStates } from 'nuqs'
import { useCallback, useEffect, useMemo } from 'react'
import {
  assetLibraryUrlKeys,
  createAssetLibrarySearchParams,
} from './asset-library-search-params'
import {
  getAssetLibraryViewPreference,
  storeAssetLibraryViewPreference,
} from './asset-library-view-preference'
import {
  ASSET_LIBRARY_ALL_FOLDERS,
} from './asset-library.types'

/** Synchronizes folder, filters, search, sort, and view with shareable URL state. */
export function useAssetLibraryUrlState() {
  const searchParams = useMemo(
    () => createAssetLibrarySearchParams(getAssetLibraryViewPreference()),
    [],
  )
  const [state, setState] = useQueryStates(searchParams, {
    history: 'replace',
    scroll: false,
    urlKeys: assetLibraryUrlKeys,
  })

  const filters: AssetLibraryFilters = {
    archived: state.archived,
    favorite: state.favorite,
    ...(state.generatedBy ? { generatedBy: state.generatedBy } : {}),
    order: state.order,
    ...(state.projectId
      ? { projectId: state.projectId === 'private' ? null : state.projectId }
      : {}),
    search: state.search,
    sort: state.sort,
    ...(state.source ? { source: state.source } : {}),
    ...(state.tagId ? { tagId: state.tagId } : {}),
    ...(state.type ? { type: state.type } : {}),
  }

  const setFilters = useCallback((nextFilters: AssetLibraryFilters) => {
    const nextProjectId = nextFilters.projectId === null
      ? 'private'
      : nextFilters.projectId ?? null
    const locationChanged = nextProjectId !== state.projectId
    void setState({
      archived: nextFilters.archived,
      favorite: nextFilters.favorite,
      ...(locationChanged
        ? { folderId: nextProjectId === null ? null : 'root' }
        : {}),
      generatedBy: nextFilters.generatedBy ?? null,
      order: nextFilters.order,
      projectId: nextProjectId,
      search: nextFilters.search || null,
      sort: nextFilters.sort,
      source: nextFilters.source ?? null,
      tagId: nextFilters.tagId ?? null,
      type: nextFilters.type ?? null,
    })
  }, [setState, state.projectId])

  const setFolderId = useCallback((folderId: null | string) => {
    void setState({
      folderId: folderId === ASSET_LIBRARY_ALL_FOLDERS
        ? null
        : folderId ?? 'root',
    }, { history: 'push' })
  }, [setState])

  const setView = useCallback((view: AssetLibraryView) => {
    void setState({ view })
  }, [setState])

  useEffect(() => {
    storeAssetLibraryViewPreference(state.view)
  }, [state.view])

  return {
    filters,
    folderId: state.folderId === null
      ? ASSET_LIBRARY_ALL_FOLDERS
      : state.folderId === 'root'
        ? null
        : state.folderId,
    setFilters,
    setFolderId,
    setView,
    view: state.view,
  }
}
