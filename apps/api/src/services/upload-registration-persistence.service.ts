/** Persists uploaded Assets idempotently from a verified upload grant. */

import type { AssetType } from '@talelabs/db'

import { createId } from '@paralleldrive/cuid2'

import {
  findAssetByUploadId,
  insertUploadedAsset,
} from '../data/assets.data.js'

/**
 * Persists a previously verified upload grant. Object storage verification must
 * happen before this boundary; Asset insertion and concurrent replay recovery
 * stay database-only.
 */
export async function persistUploadedAssetRegistration(input: {
  createdBy: string
  folderId: null | string
  id?: string
  mimeType: string
  name: string
  organizationId: string
  sizeBytes: number
  storageKey: string
  type: AssetType
  uploadId: string
}) {
  try {
    const created = await insertUploadedAsset({
      ...input,
      id: input.id ?? createId(),
    })
    return { asset: created.asset, replay: false }
  }
  catch (error) {
    const replay = await findAssetByUploadId(
      input.organizationId,
      input.uploadId,
    )
    if (!replay)
      throw error
    return { asset: replay, replay: true }
  }
}
