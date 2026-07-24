/**
 * Tenant-scoped canonical Asset reads for direct generation.
 *
 * Estimate reads current metadata without locks. Admission calls the same
 * projection inside its transaction with row locks before recompiling.
 */

import type { DatabaseExecutor } from '@talelabs/db'
import type { ProviderCostInputAsset } from '@talelabs/providers/server'
import type { DirectGenerationAsset } from './direct-generation-resolution.js'

/** Loads exact tenant-owned input Assets, optionally locking them for admission. */
export async function loadDirectGenerationAssets(input: {
  /** Canonical Asset identities referenced by the request. */
  assetIds: readonly string[]
  /** Shared database or caller-owned admission transaction. */
  executor: DatabaseExecutor
  /** Whether selected rows must remain immutable until admission commits. */
  lockForUpdate?: boolean
  /** Tenant that must own every returned Asset. */
  organizationId: string
}): Promise<Map<string, DirectGenerationAsset>> {
  const assetIds = [...new Set(input.assetIds)]
  if (assetIds.length === 0)
    return new Map()
  let query = input.executor
    .selectFrom('assets')
    .select([
      'deletedAt',
      'durationSeconds',
      'height',
      'id',
      'mimeType',
      'processingState',
      'purgeRequestedAt',
      'purgedAt',
      'sizeBytes',
      'type',
      'width',
    ])
    .where('organizationId', '=', input.organizationId)
    .where('id', 'in', assetIds)
  if (input.lockForUpdate)
    query = query.forUpdate()
  const rows = await query.execute()
  return new Map(rows.map(row => [row.id, {
    durationSeconds: row.durationSeconds === null
      ? null
      : Number(row.durationSeconds),
    height: row.height,
    id: row.id,
    mimeType: row.mimeType,
    processingState: row.processingState,
    sizeBytes: row.sizeBytes === null ? null : Number(row.sizeBytes),
    type: row.type,
    unavailable: Boolean(
      row.deletedAt || row.purgeRequestedAt || row.purgedAt,
    ),
    width: row.width,
  }]))
}

/** Projects validated direct input metadata into the shared cost resolver. */
export function directGenerationCostAssets(
  assets: ReadonlyMap<string, DirectGenerationAsset>,
): Map<string, ProviderCostInputAsset> {
  return new Map([...assets].flatMap(([assetId, asset]) => (
    asset.type === 'document'
      ? []
      : [[assetId, {
        assetId,
        durationSeconds: asset.durationSeconds === null
          ? null
          : String(asset.durationSeconds),
        height: asset.height,
        mediaType: asset.type,
        width: asset.width,
      } satisfies ProviderCostInputAsset] as const]
  )))
}
