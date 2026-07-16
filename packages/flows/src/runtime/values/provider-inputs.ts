import type {
  NormalizedGenerationInputItem,
  NormalizedGenerationMediaAsset,
} from '../../generation/contracts/provider.js'
import type { PlannedJobRequestPayload } from '../planning/planner-contracts.js'
import type { RuntimeAssetReference } from './runtime-values.js'

import { GenerationProviderRequestMaterializationError } from './provider-request-error.js'

function normalizedMediaAssets(
  assets: readonly RuntimeAssetReference[],
): readonly NormalizedGenerationMediaAsset[] {
  return Object.freeze(assets.map((asset, order) => {
    if (!('assetId' in asset)) {
      throw new GenerationProviderRequestMaterializationError(
        'provider_request_asset_unresolved',
      )
    }
    return Object.freeze({
      assetId: asset.assetId,
      mediaType: asset.mediaType,
      order,
    })
  }))
}

export function normalizedInputItem(
  item: PlannedJobRequestPayload['inputs'][number]['items'][number],
): NormalizedGenerationInputItem {
  if (item.value.kind === 'text') {
    if (item.value.text === null) {
      throw new GenerationProviderRequestMaterializationError(
        'provider_request_text_unresolved',
      )
    }
    return Object.freeze({
      assets: Object.freeze([]),
      dimensions: item.dimensions,
      itemKey: item.key,
      text: item.value.text,
    })
  }
  return Object.freeze({
    assets: normalizedMediaAssets(item.value.assets),
    dimensions: item.dimensions,
    itemKey: item.key,
    text: null,
  })
}
