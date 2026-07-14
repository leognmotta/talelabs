import type { FlowGraphReferences, FlowReferenceAsset } from '@talelabs/sdk'
import type { FlowReferenceData } from './flow-canvas-types'

import { useMemo } from 'react'

export function useFlowReferenceData(
  references: FlowGraphReferences,
  transientAssets: readonly FlowReferenceAsset[] = [],
): FlowReferenceData {
  return useMemo(() => {
    const assetsById = new Map(
      [...references.assets, ...transientAssets].map(asset => [asset.id, asset]),
    )
    return {
      assetTypesById: Object.fromEntries(
        [...assetsById.values()].map(asset => [asset.id, asset.type]),
      ),
      assetsById,
    }
  }, [references, transientAssets])
}
