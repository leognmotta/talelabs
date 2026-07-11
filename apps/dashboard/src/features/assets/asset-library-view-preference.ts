import type { AssetLibraryView } from './asset-library.types'

const assetLibraryViewStorageKey = 'talelabs_asset_library_view'

function isAssetLibraryView(value: null | string): value is AssetLibraryView {
  return value === 'grid' || value === 'list'
}

export function getAssetLibraryViewPreference(): AssetLibraryView {
  if (typeof window === 'undefined')
    return 'grid'

  try {
    const storedView = window.localStorage.getItem(assetLibraryViewStorageKey)
    return isAssetLibraryView(storedView) ? storedView : 'grid'
  }
  catch {
    return 'grid'
  }
}

export function storeAssetLibraryViewPreference(view: AssetLibraryView) {
  if (typeof window === 'undefined')
    return

  try {
    window.localStorage.setItem(assetLibraryViewStorageKey, view)
  }
  catch {
    // Storage is an optional enhancement; URL state remains authoritative.
  }
}
