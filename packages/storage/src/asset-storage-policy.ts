/** Canonical private and public Asset object-storage placement policy. */

import {
  buildOriginalObjectKey,
  buildThumbnailObjectKey,
  TALELABS_PRIVATE_BUCKET,
  TALELABS_PUBLIC_BUCKET,
} from './client.js'

/** Supported persistent Asset visibility boundaries. */
export const ASSET_VISIBILITIES = ['private', 'public'] as const

/** Persistent visibility deciding the owning object-storage bucket and key. */
export type AssetVisibility = typeof ASSET_VISIBILITIES[number]

/** Fail-closed generated-output fallback when no captured policy is supplied. */
export const CURRENT_GENERATED_OUTPUT_VISIBILITY: AssetVisibility = 'private'

/** Resolves the private or public bucket for one captured visibility policy. */
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

/** Tenant-safe identity used to derive one canonical Asset object key. */
export interface AssetStorageKeyInput {
  /** Opaque Asset identity; public keys must not contain tenant information. */
  assetId: string
  /** Tenant used only by private object keys. */
  organizationId: string
  /** Captured bucket and key visibility boundary. */
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
