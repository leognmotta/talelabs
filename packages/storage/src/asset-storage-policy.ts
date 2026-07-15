import {
  buildOriginalObjectKey,
  buildThumbnailObjectKey,
  TALELABS_PRIVATE_BUCKET,
  TALELABS_PUBLIC_BUCKET,
} from './client.js'

export const ASSET_VISIBILITIES = ['private', 'public'] as const

export type AssetVisibility = typeof ASSET_VISIBILITIES[number]

/**
 * Temporary generation-funding policy. Billing will eventually choose output
 * visibility from the funding source without changing the Asset lifecycle.
 */
export const CURRENT_GENERATED_OUTPUT_VISIBILITY: AssetVisibility = 'public'

export function getAssetBucket(visibility: AssetVisibility) {
  switch (visibility) {
    case 'private':
      return TALELABS_PRIVATE_BUCKET
    case 'public':
      return TALELABS_PUBLIC_BUCKET
    default:
      throw new Error('Unsupported Asset visibility.')
  }
}

export interface AssetStorageKeyInput {
  assetId: string
  organizationId: string
  visibility: AssetVisibility
}

/** Builds the canonical original-object key without exposing tenant data publicly. */
export function buildAssetStorageKey(input: AssetStorageKeyInput) {
  switch (input.visibility) {
    case 'private':
      return buildOriginalObjectKey(input.organizationId, input.assetId)
    case 'public':
      return `generated/${assertOpaqueAssetId(input.assetId)}/original`
    default:
      throw new Error('Unsupported Asset visibility.')
  }
}

/** Builds the deterministic thumbnail key in the same visibility boundary. */
export function buildAssetThumbnailKey(input: AssetStorageKeyInput) {
  switch (input.visibility) {
    case 'private':
      return buildThumbnailObjectKey(input.organizationId, input.assetId)
    case 'public':
      return `generated/${assertOpaqueAssetId(input.assetId)}/thumbnail.jpg`
    default:
      throw new Error('Unsupported Asset visibility.')
  }
}

function assertOpaqueAssetId(assetId: string) {
  if (!/^[a-z][0-9a-z]+$/.test(assetId))
    throw new Error('assetId contains unsupported object-key characters.')

  return assetId
}
