/** Exact normalized-slot to fal request-field media mapping. */

import type {
  NormalizedGenerationMediaAsset,
  NormalizedGenerationRequest,
} from '@talelabs/flows'
import type { CatalogFalRequestProfile } from '@talelabs/models-catalog'
import type { FalAssetResolver } from '../../types.js'

import { throwProviderResponseInvalid } from '../../../generation-error.js'
import { inputAssets } from '../../../generation-request.js'

function mediaAssets(request: NormalizedGenerationRequest) {
  return request.orderedInputs.flatMap(input => input.items.flatMap(
    item => item.assets,
  ))
}

async function resolveUrls(
  assets: readonly NormalizedGenerationMediaAsset[],
  resolveAsset: FalAssetResolver,
) {
  const urls: string[] = []
  for (const asset of assets) {
    const resolved = await resolveAsset(asset)
    urls.push(resolved.providerUrl)
  }
  return urls
}

/**
 * Applies every captured media Asset to its declared fal field and rejects any
 * slot, media family, cardinality, or combined-count mismatch before submit.
 */
export async function applyFalInputMappings(input: {
  body: Record<string, unknown>
  profile: CatalogFalRequestProfile
  request: NormalizedGenerationRequest
  resolveAsset: FalAssetResolver
}): Promise<void> {
  const { profile, request } = input
  const mappingsBySlot = new Map(
    profile.inputMappings.map(mapping => [mapping.targetSlotId, mapping]),
  )
  const mappedFields = profile.inputMappings.flatMap(mapping => [
    mapping.field,
    ...(mapping.alternativeFields ?? []).map(field => field.field),
  ])
  if (
    mappingsBySlot.size !== profile.inputMappings.length
    || new Set(mappedFields).size !== mappedFields.length
  ) {
    throwProviderResponseInvalid()
  }

  const allMediaAssets = mediaAssets(request)
  if (allMediaAssets.length > profile.maxInputItems)
    throwProviderResponseInvalid()

  for (const orderedInput of request.orderedInputs) {
    if (
      orderedInput.items.some(item => item.assets.length > 0)
      && !mappingsBySlot.has(orderedInput.targetSlotId)
    ) {
      throwProviderResponseInvalid()
    }
  }

  let consumedAssets = 0
  for (const mapping of profile.inputMappings) {
    const assets = inputAssets(request, mapping.targetSlotId)
    const mediaFields = [
      { field: mapping.field, mediaType: mapping.mediaType },
      ...(mapping.alternativeFields ?? []),
    ]
    const selectedField = assets.length
      ? mediaFields.find(field => field.mediaType === assets[0]?.mediaType)
      : undefined
    if (
      assets.length < mapping.minItems
      || assets.length > mapping.maxItems
      || assets.some(asset => asset.mediaType !== assets[0]?.mediaType)
      || (mapping.cardinality === 'single' && assets.length > 1)
    ) {
      throwProviderResponseInvalid()
    }
    consumedAssets += assets.length
    if (!assets.length)
      continue
    if (!selectedField)
      throwProviderResponseInvalid()
    const urls = await resolveUrls(assets, input.resolveAsset)
    input.body[selectedField.field] = mapping.cardinality === 'single'
      ? urls[0]
      : urls
  }

  if (consumedAssets !== allMediaAssets.length)
    throwProviderResponseInvalid()
}
