/** Asset upload orchestration from policy validation through canonical registration. */

import type { Asset } from '@talelabs/sdk'

import { getAssetUploadValidationError } from '@talelabs/assets'
import { postAssets, postUploads } from '@talelabs/sdk'
import { getApiErrorCode } from '../../../shared/lib/api-error'
import { getOrganizationRequestHeaders } from '../../../shared/lib/organization-request'
import { AssetUploadError } from './asset-upload-error'
import { calculateAssetUploadMd5 } from './asset-upload-hash'
import { putAssetUploadFile } from './asset-upload-request'

function throwIfAborted(signal: AbortSignal) {
  if (signal.aborted)
    throw new DOMException('Upload canceled', 'AbortError')
}

/**
 * Validates, hashes, uploads, and registers one file while preserving the
 * resumable registration id and existing progress-stage semantics.
 */
export async function uploadAsset(input: {
  elementId?: string
  file: File
  folderId: null | string
  isPrimary?: boolean
  onProgress: (progress: number) => void
  onRegistrationReady?: (uploadId: string) => void
  onStageChange?: (state: 'hashing' | 'registering' | 'uploading') => void
  organizationId: string
  registrationUploadId?: string
  role?: string
  signal: AbortSignal
  sortOrder?: number
}): Promise<Asset> {
  const validationError = getAssetUploadValidationError({
    mimeType: input.file.type,
    sizeBytes: input.file.size,
  })
  if (validationError) {
    throw new AssetUploadError(
      'The selected asset does not satisfy the upload policy.',
      validationError,
    )
  }

  let registrationUploadId = input.registrationUploadId
  if (!registrationUploadId) {
    input.onStageChange?.('hashing')
    const checksum = await calculateAssetUploadMd5(
      input.file,
      input.signal,
      progress => input.onProgress(progress * 0.2),
    )
    throwIfAborted(input.signal)

    input.onStageChange?.('uploading')
    const grant = await postUploads(
      {
        data: {
          checksum: { algorithm: 'md5', value: checksum },
          filename: input.file.name,
          mimeType: input.file.type,
          sizeBytes: input.file.size,
        },
      },
      {
        headers: getOrganizationRequestHeaders(input.organizationId),
        signal: input.signal,
      },
    )

    await putAssetUploadFile({
      checksum,
      file: input.file,
      signal: input.signal,
      url: grant.uploadUrl,
      onProgress: progress => input.onProgress(0.2 + progress * 0.7),
    })
    throwIfAborted(input.signal)
    registrationUploadId = grant.uploadId
    input.onRegistrationReady?.(registrationUploadId)
  }
  else {
    input.onProgress(0.9)
  }

  input.onStageChange?.('registering')
  let asset
  try {
    asset = await postAssets(
      {
        data: {
          uploadId: registrationUploadId,
          elementId: input.elementId,
          folderId: input.folderId ?? undefined,
          isPrimary: input.isPrimary,
          role: input.role,
          sortOrder: input.sortOrder,
        },
      },
      {
        headers: getOrganizationRequestHeaders(input.organizationId),
        signal: input.signal,
      },
    )
  }
  catch (error) {
    const code = getApiErrorCode(error)
    if (
      code === 'element_asset_role_capacity_reached'
      || code === 'element_master_role_capacity_reached'
    ) {
      throw new AssetUploadError(
        'The Element Asset role has reached its capacity.',
        code,
      )
    }
    throw error
  }
  input.onProgress(1)
  return asset
}
