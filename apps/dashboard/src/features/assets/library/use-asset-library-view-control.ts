/** Controlled-or-local Asset library view state with persisted user preference. */

import type { AssetLibraryProps, AssetLibraryView } from './asset-library.types'

import { useState } from 'react'
import {
  getAssetLibraryViewPreference,
  storeAssetLibraryViewPreference,
} from './asset-library-view-preference'

/** Resolves the active library view and updates preference plus controlled callbacks. */
export function useAssetLibraryViewControl(input: Pick<
  AssetLibraryProps,
  'onViewChange' | 'view'
>) {
  const [internalView, setInternalView] = useState<AssetLibraryView>(
    getAssetLibraryViewPreference,
  )
  const view = input.view ?? internalView

  function updateView(nextView: AssetLibraryView) {
    storeAssetLibraryViewPreference(nextView)
    if (input.view === undefined)
      setInternalView(nextView)
    input.onViewChange?.(nextView)
  }

  return { updateView, view }
}
