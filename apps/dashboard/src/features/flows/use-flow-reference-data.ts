import type { FlowGraphReferences } from '@talelabs/sdk'
import type { FlowElementAssetLink, FlowReferenceData } from './flow-canvas-types'

import { getElementAssetRoles, upcastElementData } from '@talelabs/elements'
import { assetTypeToValueType } from '@talelabs/flows'
import { useMemo } from 'react'

export function useFlowReferenceData(
  references: FlowGraphReferences,
): FlowReferenceData {
  return useMemo(() => {
    const assetsById = new Map(
      references.assets.map(asset => [asset.id, asset]),
    )
    const elementsById = new Map(
      references.elements.map(element => [element.id, element]),
    )
    const elementKitsById = new Map<string, FlowElementAssetLink[]>()
    for (const link of references.elementAssets) {
      const asset = assetsById.get(link.assetId)
      if (!asset)
        continue
      const kit = elementKitsById.get(link.elementId) ?? []
      kit.push({ ...link, asset })
      elementKitsById.set(link.elementId, kit)
    }

    const elementRolesById = Object.fromEntries(
      [...elementsById.values()].map((element) => {
        const data = upcastElementData(
          element.type,
          element.schemaVersion,
          element.data,
        ).data
        const kit = elementKitsById.get(element.id) ?? []
        return [
          element.id,
          getElementAssetRoles(element.type, data).map(role => ({
            id: role.id,
            valueType: assetTypeToValueType(role.accepts[0]) as
              'AudioSet' | 'ImageSet' | 'VideoSet',
            assetIds: kit
              .filter(link => (
                link.role === role.id
                && link.asset.processingState === 'ready'
                && link.asset.lifecycle !== 'purging'
                && link.asset.lifecycle !== 'purged'
              ))
              .toSorted((left, right) => (
                Number(right.isPrimary) - Number(left.isPrimary)
                || left.sortOrder - right.sortOrder
                || left.assetId.localeCompare(right.assetId)
              ))
              .map(link => link.assetId),
          })),
        ]
      }),
    )

    return {
      assetTypesById: Object.fromEntries(
        [...assetsById.values()].map(asset => [asset.id, asset.type]),
      ),
      elementRolesById,
      assetsById,
      elementKitsById,
      elementsById,
    }
  }, [references])
}
