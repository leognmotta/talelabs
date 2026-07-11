import type { Asset } from '@talelabs/sdk'
import type { LibrarySelectionState } from './asset-library-selection'
import type { AssetLibraryProps, SelectionInput } from './asset-library.types'

import { useMemo, useState } from 'react'
import {
  createEmptyLibrarySelection,
  getNextLibrarySelection,
} from './asset-library-selection'

const emptySelectionSet = new Set<string>()

export function useAssetLibrarySelection({
  assets,
  mode,
  selectedAssetIds,
  visibleAssetIds,
  visibleFolderIds,
}: Pick<AssetLibraryProps, 'mode' | 'selectedAssetIds'> & {
  assets: Asset[]
  visibleAssetIds: string[]
  visibleFolderIds: string[]
}) {
  const [state, setState] = useState<LibrarySelectionState>(() => ({
    anchor: null,
    selection:
      selectedAssetIds && selectedAssetIds.length > 0
        ? { ids: new Set(selectedAssetIds), type: 'asset' as const }
        : createEmptyLibrarySelection(),
  }))
  const controlledAssetIds = useMemo(
    () => (selectedAssetIds ? new Set(selectedAssetIds) : null),
    [selectedAssetIds],
  )
  const selectedAssetIdsSet
    = mode === 'select' && controlledAssetIds
      ? controlledAssetIds
      : state.selection.type === 'asset'
        ? state.selection.ids
        : emptySelectionSet
  const selectedFolderIdsSet
    = state.selection.type === 'folder'
      ? state.selection.ids
      : emptySelectionSet

  function clear() {
    setState({
      anchor: null,
      selection: createEmptyLibrarySelection(),
    })
  }

  function select(
    type: 'asset' | 'folder',
    id: string,
    selectionInput: SelectionInput,
    orderedIds: string[],
  ) {
    setState(current => getNextLibrarySelection({
      anchor: current.anchor,
      current: current.selection,
      id,
      input: selectionInput,
      orderedIds,
      type,
    }))
  }

  function getAssetDragData(asset: Asset) {
    const assetIds = selectedAssetIdsSet.has(asset.id)
      ? assets
          .filter(item => selectedAssetIdsSet.has(item.id))
          .map(item => item.id)
      : [asset.id]

    return {
      assetIds: assetIds.length > 0 ? assetIds : [asset.id],
      sourceFolderId: asset.folderId,
      type: 'asset' as const,
    }
  }

  function getSelectedAssets(asset: Asset) {
    return selectedAssetIdsSet.has(asset.id)
      ? assets.filter(item => selectedAssetIdsSet.has(item.id))
      : [asset]
  }

  return {
    clear,
    getAssetDragData,
    getSelectedAssets,
    selectAsset: (id: string, input: SelectionInput) =>
      select('asset', id, input, visibleAssetIds),
    selectedAssetIds: selectedAssetIdsSet,
    selectedFolderIds: selectedFolderIdsSet,
    selectFolder: (id: string, input: SelectionInput) =>
      select('folder', id, input, visibleFolderIds),
  }
}
