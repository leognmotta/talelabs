import type { AssetType } from '@talelabs/db'
import type { ElementReferenceKind } from '@talelabs/elements'
import type { ElementAssetLinkMutationFailure } from '../data/element-asset-links.data.js'

import { createId } from '@paralleldrive/cuid2'

import {
  findAssetByUploadId,
  insertUploadedAsset,
} from '../data/assets.data.js'
import { HttpError } from '../middleware/error.js'
import { assertElementFlowReferenceBudgets } from './flow-reference-budget.js'
import {
  reconcileElementUploadLink,
  throwElementUploadLinkError,
} from './upload-element-link.service.js'

/**
 * Persists a previously verified upload grant. Object storage verification must
 * happen before this boundary; everything from Asset insertion through an
 * optional Element link and concurrent replay recovery stays database-only.
 */
export async function persistUploadedAssetRegistration(input: {
  createdBy: string
  elementId?: string
  folderId: null | string
  id?: string
  isPrimary?: boolean
  mimeType: string
  name: string
  organizationId: string
  referenceKind?: ElementReferenceKind
  referenceMetadata?: unknown
  role?: string
  sizeBytes: number
  sortOrder?: number
  storageKey: string
  type: AssetType
  uploadId: string
}) {
  try {
    const created = await insertUploadedAsset({
      ...input,
      id: input.id ?? createId(),
      validateFlowReferenceBudgets: executor => input.elementId
        ? assertElementFlowReferenceBudgets(executor, {
            elementId: input.elementId,
            organizationId: input.organizationId,
          })
        : Promise.resolve(),
    })
    if (created.status === 'folder_limit' || created.status === 'folder_depth') {
      throw new HttpError(400, 'validation_error', 'The Element folder could not be created.', [{
        code: created.status,
        field: 'folderId',
        message: created.status === 'folder_limit'
          ? 'This workspace has reached its folder limit.'
          : 'The workspace Elements folder cannot contain another nested folder.',
      }])
    }
    if (created.status !== 'created') {
      throwElementUploadLinkError(
        created as ElementAssetLinkMutationFailure,
        input.role ?? '',
      )
    }
    return { asset: created.asset, replay: false }
  }
  catch (error) {
    const replay = await findAssetByUploadId(
      input.organizationId,
      input.uploadId,
    )
    if (!replay)
      throw error
    await reconcileElementUploadLink({
      assetId: replay.id,
      ...input,
    })
    return { asset: replay, replay: true }
  }
}
