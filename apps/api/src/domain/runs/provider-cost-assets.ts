/** Tenant-scoped read projection of Asset metadata used by cost preflight. */

import type { ProviderCostInputAsset } from '@talelabs/providers/server'

import { db } from '@talelabs/db'

/** Loads existing media metadata without locking or mutating canonical Assets. */
export async function loadProviderCostInputAssets(input: {
  /** Canonical Asset IDs captured by the planned request. */
  assetIds: readonly string[]
  /** Tenant owning every readable Asset. */
  organizationId: string
}): Promise<Map<string, ProviderCostInputAsset>> {
  if (input.assetIds.length === 0)
    return new Map()
  const assets = await db.selectFrom('assets')
    .select(['durationSeconds', 'height', 'id', 'type', 'width'])
    .where('organizationId', '=', input.organizationId)
    .where('id', 'in', [...input.assetIds])
    .execute()
  return new Map(assets.flatMap((asset) => {
    if (asset.type === 'document')
      return []
    return [[asset.id, {
      assetId: asset.id,
      durationSeconds: asset.durationSeconds,
      height: asset.height,
      mediaType: asset.type,
      width: asset.width,
    } satisfies ProviderCostInputAsset] as const]
  }))
}
