import type { NormalizedGenerationMediaAsset } from '@talelabs/flows'

import { db } from '@talelabs/db'
import {
  createDownloadUrl,
  getAssetBucket,
  headObject,
} from '@talelabs/storage'

import { GenerationProviderError } from '../adapters/errors.js'
import { GENERATION_PROVIDER_INPUT_URL_EXPIRES_IN_SECONDS } from '../adapters/execution-limits.js'

export interface ResolvedGenerationAsset {
  assetId: string
  durationSeconds: number | null
  height: number | null
  mimeType: string
  signedReadUrl: string
  sizeBytes: number | null
  width: number | null
}

/** Revalidates one tenant-owned Asset immediately before provider materialization. */
export function createGenerationAssetResolver(organizationId: string) {
  return async (
    reference: NormalizedGenerationMediaAsset,
  ): Promise<ResolvedGenerationAsset> => {
    const asset = await db
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
      signedReadUrl: await createDownloadUrl({
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
