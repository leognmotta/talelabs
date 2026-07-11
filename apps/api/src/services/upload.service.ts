import { Buffer } from 'node:buffer'
import { createId } from '@paralleldrive/cuid2'
import { getAssetUploadPolicy } from '@talelabs/assets'
import {
  buildUploadObjectKey,
  createUploadUrl,
  headObject,
  TALELABS_PRIVATE_BUCKET,
} from '@talelabs/storage'
import { idempotencyKeys, triggerTask } from '@talelabs/trigger'

import { findAssetByUploadId, findFolderById, insertUploadedAsset } from '../data/assets.data.js'
import { getUploadRegistrationGrantTtlSeconds } from '../domain/assets/asset-policy.js'
import {
  createElementAssetMediaTypeNotAcceptedError,
  createElementAssetRoleNotFoundError,
} from '../domain/elements/element-asset-role-policy.js'
import { HttpError, TenantResourceNotFoundError } from '../middleware/error.js'
import { createElementAssetRoleCapacityError } from './element-asset-limit-error.js'
import { createUploadGrant, verifyUploadGrant } from './upload-grant.service.js'

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
    bucket: TALELABS_PRIVATE_BUCKET,
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

  if (existing)
    return { asset: existing, replay: true }

  // For Element uploads the stored association is authoritative. A stale client
  // folder ID is ignored and a deleted association is recreated transactionally.
  if (!input.elementId && input.folderId && !(await findFolderById(input.organizationId, input.folderId)))
    throw new TenantResourceNotFoundError('folderId')

  let object
  try {
    object = await headObject({ bucket: TALELABS_PRIVATE_BUCKET, key: grant.key })
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

  let asset
  let replayed = false
  try {
    const created = await insertUploadedAsset({
      createdBy: input.userId,
      elementId: input.elementId,
      folderId: input.folderId ?? null,
      id: createId(),
      mimeType: grant.mimeType,
      name: input.name ?? grant.filename,
      organizationId: input.organizationId,
      role: input.role,
      isPrimary: input.isPrimary,
      sortOrder: input.sortOrder,
      sizeBytes: grant.sizeBytes,
      storageKey: grant.key,
      type: policy.type,
      uploadId: grant.grantId,
    })
    if (created.status === 'element_not_found')
      throw new TenantResourceNotFoundError('elementId')
    if (created.status === 'role_not_found')
      throw createElementAssetRoleNotFoundError(input.role ?? '')
    if (created.status === 'incompatible_asset') {
      throw createElementAssetMediaTypeNotAcceptedError(
        input.role ?? '',
        policy.type,
        'role',
      )
    }
    if (created.status === 'folder_limit' || created.status === 'folder_depth') {
      throw new HttpError(400, 'validation_error', 'The Element folder could not be created.', [{
        code: created.status,
        field: 'folderId',
        message: created.status === 'folder_limit'
          ? 'This workspace has reached its folder limit.'
          : 'The workspace Elements folder cannot contain another nested folder.',
      }])
    }
    if (created.status === 'element_asset_role_capacity_reached')
      throw createElementAssetRoleCapacityError('role', created)
    asset = created.asset
  }
  catch (error) {
    const replay = await findAssetByUploadId(input.organizationId, grant.grantId)
    if (!replay)
      throw error
    asset = replay
    replayed = true
  }

  void dispatchIngestion(input.organizationId, asset.id)
  return { asset, replay: replayed }
}
