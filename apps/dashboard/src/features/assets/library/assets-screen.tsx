/** Route-level composition for the workspace Asset library. */

import { useAssetViewerUrlState } from '../viewer/use-asset-viewer-url-state'
import { AssetLibrary } from './asset-library'
import { useAssetLibraryUrlState } from './use-asset-library-url-state'

/** Supplies the full-page library mode while lower modules own its behavior. */
export function AssetsScreen() {
  const urlState = useAssetLibraryUrlState()
  const viewer = useAssetViewerUrlState()

  return (
    <AssetLibrary
      className="min-h-[calc(100svh-8rem)]"
      filters={urlState.filters}
      folderId={urlState.folderId}
      onFiltersChange={urlState.setFilters}
      onFolderChange={urlState.setFolderId}
      onOpenAsset={asset => viewer.openAsset(asset.id)}
      onViewChange={urlState.setView}
      view={urlState.view}
    />
  )
}
