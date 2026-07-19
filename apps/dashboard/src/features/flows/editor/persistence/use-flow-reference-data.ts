/** Flow autosave, reconciliation, serialization, and navigation persistence. */

import type { FlowGraphReferences, FlowReferenceAsset } from '@talelabs/sdk'
import type { TransientElementData } from '../canvas-state/canvas-store'
import type { FlowReferenceData } from '../flow-canvas-types'

import { useMemo } from 'react'

/**
 * Merges canonical references with transient uploaded Assets and freshly
 * picked Elements for validation and display. Canonical server hydration
 * always wins; transient entries only fill gaps until the next refetch.
 */
export function useFlowReferenceData(
  references: FlowGraphReferences,
  transientAssets: readonly FlowReferenceAsset[] = [],
  transientElementData: Readonly<Record<string, TransientElementData>> = {},
): FlowReferenceData {
  return useMemo(() => {
    const transientEntries = Object.values(transientElementData)
    const assetsById = new Map(
      [
        ...transientEntries.flatMap(entry => entry.assets),
        ...references.assets,
        ...transientAssets,
      ].map(asset => [asset.id, asset]),
    )
    const elementsById = new Map(
      [
        ...transientEntries.map(entry => entry.element),
        ...references.elements,
      ].map(element => [element.id, element]),
    )
    return {
      assetTypesById: Object.fromEntries(
        [...assetsById.values()].map(asset => [asset.id, asset.type]),
      ),
      assetsById,
      elementReferencesById: Object.fromEntries(
        [...elementsById.values()].map(element => [
          element.id,
          element.referenceAssetIds,
        ]),
      ),
      elementsById,
    }
  }, [references, transientAssets, transientElementData])
}
