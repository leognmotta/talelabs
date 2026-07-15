import type { ElementReferenceKind } from '@talelabs/elements'

import { Buffer } from 'node:buffer'

import { createId } from '@paralleldrive/cuid2'
import { getAssetUploadPolicy } from '@talelabs/assets'
import {
  buildUploadObjectKey,
  createUploadUrl,
  getAssetBucket,
  headObject,
} from '@talelabs/storage'
import { idempotencyKeys, triggerTask } from '@talelabs/trigger'

import { findAssetByUploadId, findFolderById } from '../data/assets.data.js'
import { getUploadRegistrationGrantTtlSeconds } from '../domain/assets/asset-policy.js'
import { HttpError, TenantResourceNotFoundError } from '../middleware/error.js'
import { reconcileElementUploadLink } from './upload-element-link.service.js'
import { createUploadGrant, verifyUploadGrant } from './upload-grant.service.js'
import { persistUploadedAssetRegistration } from './upload-registration-persistence.service.js'

export async function createUpload(input: {
  checksum: { algorithm: 'md5', value: string }
  filename: string
  mimeType: string
  organizationId: string
  sizeBytes: number
  userId: string
}) {
  const policy = getAssetUploadPolicy(input.mimeType)

  if (!policy || input.sizeBytes > policy.maxSizeBytes) {
    throw new HttpError(400, 'validation_error', 'This file type or size is not supported.', [{
      code: policy ? 'file_too_large' : 'unsupported_file_type',
      field: policy ? 'sizeBytes' : 'mimeType',
      message: policy
        ? `The maximum file size is ${policy.maxSizeBytes} bytes.`
        : 'Upload an image, video, or audio file in a supported format.',
      params: policy ? { maximum: policy.maxSizeBytes } : undefined,
    }])
  }

  const grantId = createId()
  const key = buildUploadObjectKey(input.organizationId, grantId)
  const { token } = createUploadGrant({
    checksum: input.checksum,
    filename: input.filename,
    grantId,
    key,
    mimeType: input.mimeType,
    organizationId: input.organizationId,
    sizeBytes: input.sizeBytes,
    userId: input.userId,
  }, getUploadRegistrationGrantTtlSeconds(input.sizeBytes))
  const uploadUrl = await createUploadUrl({
    bucket: getAssetBucket('private'),
    key,
    contentMd5: input.checksum.value,
    contentLength: input.sizeBytes,
    contentType: input.mimeType,
    metadata: {
      organization: input.organizationId,
      upload: grantId,
    },
  })

  return { uploadId: token, uploadUrl }
}

function md5Base64ToHex(value: string) {
  return Buffer.from(value, 'base64').toString('hex')
}

function normalizeEtag(value?: string) {
  return value?.replace(/^"|"$/g, '').toLowerCase()
}

async function dispatchIngestion(organizationId: string, assetId: string) {
  try {
    const idempotencyKey = await idempotencyKeys.create(assetId, {
      scope: 'global',
    })
    await triggerTask('asset-ingest', { assetId, organizationId }, {
      idempotencyKey,
    })
  }
  catch (error) {
    console.error('Asset ingestion dispatch failed; reconciliation will retry.', {
      assetId,
      error,
      organizationId,
    })
  }
}

export async function registerUploadedAsset(input: {
  elementId?: string
  folderId?: string
  isPrimary?: boolean
  name?: string
  organizationId: string
  referenceKind?: ElementReferenceKind
  referenceMetadata?: unknown
  role?: string
  sortOrder?: number
  uploadId: string
  userId: string
}) {
  const grant = verifyUploadGrant(input.uploadId)

  if (
    !grant
    || grant.organizationId !== input.organizationId
    || grant.userId !== input.userId
  ) {
    throw new HttpError(400, 'validation_error', 'The upload grant is invalid or expired.', [{
      code: 'invalid_upload_grant',
      field: 'uploadId',
      message: 'Start the upload again.',
    }])
  }

  const existing = await findAssetByUploadId(input.organizationId, grant.grantId)

  if (existing) {
    await reconcileElementUploadLink({
      assetId: existing.id,
      ...input,
    })
    return { asset: existing, replay: true }
  }

  // For Element uploads the stored association is authoritative. A stale client
  // folder ID is ignored and a deleted association is recreated transactionally.
  if (!input.elementId && input.folderId && !(await findFolderById(input.organizationId, input.folderId)))
    throw new TenantResourceNotFoundError('folderId')

  let object
  try {
    object = await headObject({ bucket: getAssetBucket('private'), key: grant.key })
  }
  catch {
    throw new HttpError(400, 'validation_error', 'The uploaded object could not be verified.', [{
      code: 'upload_missing',
      field: 'uploadId',
      message: 'Upload the file before registering it.',
    }])
  }

  const actualEtag = normalizeEtag(object.ETag)
  const expectedEtag = md5Base64ToHex(grant.checksum.value)
  const actualMimeType = object.ContentType?.toLowerCase()

  if (
    object.ContentLength !== grant.sizeBytes
    || actualMimeType !== grant.mimeType.toLowerCase()
    || actualEtag !== expectedEtag
  ) {
    throw new HttpError(400, 'validation_error', 'The uploaded object does not match its grant.', [{
      code: 'upload_mismatch',
      field: 'uploadId',
      message: 'Start the upload again with the original file.',
    }])
  }

  const policy = getAssetUploadPolicy(grant.mimeType)
  if (!policy)
    throw new HttpError(400, 'validation_error', 'The uploaded media type is not supported.')

  const result = await persistUploadedAssetRegistration({
    createdBy: input.userId,
    elementId: input.elementId,
    folderId: input.folderId ?? null,
    isPrimary: input.isPrimary,
    mimeType: grant.mimeType,
    name: input.name ?? grant.filename,
    organizationId: input.organizationId,
    referenceKind: input.referenceKind,
    referenceMetadata: input.referenceMetadata,
    role: input.role,
    sizeBytes: grant.sizeBytes,
    sortOrder: input.sortOrder,
    storageKey: grant.key,
    type: policy.type,
    uploadId: grant.grantId,
  })

  void dispatchIngestion(input.organizationId, result.asset.id)
  return result
}
