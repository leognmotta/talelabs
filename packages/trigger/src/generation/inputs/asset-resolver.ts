/**
 * Server resolution of tenant-owned Assets into short-lived provider inputs.
 */

import type { DatabaseExecutor } from '@talelabs/db'
import type { NormalizedGenerationMediaAsset } from '@talelabs/flows'

import { db } from '@talelabs/db'
import {
  createDownloadUrl,
  getAssetBucket,
  headObject,
} from '@talelabs/storage'

import { GenerationProviderError } from '../adapters/errors.js'
import { GENERATION_PROVIDER_INPUT_URL_EXPIRES_IN_SECONDS } from '../adapters/execution-limits.js'

/** Provider-ready metadata resolved from one authorized canonical Asset. */
export interface ResolvedGenerationAsset {
  /** Canonical organization-owned Asset identifier. */
  assetId: string
  /** Media duration in seconds when available. */
  durationSeconds: number | null
  /** Pixel height when available. */
  height: number | null
  /** Validated provider-facing MIME type. */
  mimeType: string
  /** Short-lived signed URL readable by the managed provider. */
  providerUrl: string
  /** Object size in bytes when available. */
  sizeBytes: number | null
  /** Pixel width when available. */
  width: number | null
}

/** Revalidates one tenant-owned Asset immediately before provider materialization. */
export function createGenerationAssetResolver(
  organizationId: string,
  database: DatabaseExecutor = db,
) {
  return async (
    reference: NormalizedGenerationMediaAsset,
  ): Promise<ResolvedGenerationAsset> => {
    const asset = await database
      .selectFrom('assets')
      .select([
        'durationSeconds',
        'height',
        'id',
        'mimeType',
        'sizeBytes',
        'storageKey',
        'type',
        'visibility',
        'width',
      ])
      .where('organizationId', '=', organizationId)
      .where('id', '=', reference.assetId)
      .where('processingState', '=', 'ready')
      .where('deletedAt', 'is', null)
      .where('purgeRequestedAt', 'is', null)
      .where('purgedAt', 'is', null)
      .executeTakeFirst()
    if (
      !asset
      || asset.type !== reference.mediaType
      || !asset.mimeType.toLowerCase().startsWith(`${reference.mediaType}/`)
    ) {
      throw new GenerationProviderError({
        code: 'provider_rejected',
        retryable: false,
      })
    }
    const bucket = getAssetBucket(asset.visibility)
    const storedObject = asset.sizeBytes === null
      ? await headObject({ bucket, key: asset.storageKey })
      : null
    const resolvedSizeBytes = asset.sizeBytes === null
      ? storedObject?.ContentLength
      : Number(asset.sizeBytes)
    return {
      assetId: asset.id,
      durationSeconds:
        asset.durationSeconds === null ? null : Number(asset.durationSeconds),
      height: asset.height,
      mimeType: asset.mimeType,
      providerUrl: await createDownloadUrl({
        bucket,
        expiresIn: GENERATION_PROVIDER_INPUT_URL_EXPIRES_IN_SECONDS,
        key: asset.storageKey,
        responseContentType: asset.mimeType,
      }),
      sizeBytes: resolvedSizeBytes === undefined ? null : resolvedSizeBytes,
      width: asset.width,
    }
  }
}
