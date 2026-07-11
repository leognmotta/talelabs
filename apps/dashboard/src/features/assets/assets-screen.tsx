import { AssetLibrary } from './asset-library'
import { useAssetLibraryUrlState } from './use-asset-library-url-state'
import { useAssetViewerUrlState } from './use-asset-viewer-url-state'

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
