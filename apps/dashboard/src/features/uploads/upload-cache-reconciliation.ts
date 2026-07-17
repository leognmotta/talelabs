/**
 * Reconciles successful upload work into TanStack Query without making cache
 * refresh failures roll back an already registered canonical Asset.
 */

import type { Asset } from '@talelabs/sdk'
import type { RuntimeUploadBatch } from './upload-runtime'

import { isUploadOrganizationActive } from './queue/upload-queue-activity'
import { uploadQueueState } from './queue/upload-queue-state'

/** Refreshes Asset and folder views after registration has committed. */
export async function refreshRegisteredAssetCache(
  batch: RuntimeUploadBatch,
  asset: Asset,
) {
  if (!uploadQueueState.cache || !isUploadOrganizationActive(batch.organizationId))
    return
  try {
    await uploadQueueState.cache.assetRegistered(batch.organizationId, asset)
  }
  catch (error) {
    console.error('Registered Asset cache refresh failed.', {
      assetId: asset.id,
      error,
      organizationId: batch.organizationId,
    })
  }
}

/** Refreshes Element, Asset, and Flow reference views after a link commits. */
export async function refreshElementLinkCache(
  batch: RuntimeUploadBatch,
  elementId: string,
  assetId: string,
) {
  if (!uploadQueueState.cache || !isUploadOrganizationActive(batch.organizationId))
    return
  try {
    await uploadQueueState.cache.elementLinked(
      batch.organizationId,
      elementId,
      assetId,
    )
  }
  catch (error) {
    console.error('Element Asset cache refresh failed.', {
      elementId,
      error,
      organizationId: batch.organizationId,
    })
  }
}
