import type { ElementReferenceKind } from '@talelabs/elements'
import type { ElementAssetLinkMutationFailure } from '../data/element-asset-links.data.js'

import { createElementAssetLinkRow } from '../data/element-asset-links.data.js'
import { listElementAssetRows } from '../data/elements.data.js'
import {
  createElementAssetMediaTypeNotAcceptedError,
  createElementAssetRoleNotFoundError,
} from '../domain/elements/element-asset-role-policy.js'
import { HttpError, TenantResourceNotFoundError } from '../middleware/error.js'
import {
  createElementMasterRoleCapacityError,
  createElementReferenceMetadataError,
  createElementSourceCapacityError,
  createElementSourcePrimaryError,
} from './element-asset-limit-error.js'
import { assertElementFlowReferenceBudgets } from './flow-reference-budget.js'

export function throwElementUploadLinkError(
  result: ElementAssetLinkMutationFailure,
  role: string,
): never {
  if (result.status === 'element_not_found')
    throw new TenantResourceNotFoundError('elementId')
  if (result.status === 'asset_not_found')
    throw new TenantResourceNotFoundError('uploadId')
  if (result.status === 'asset_not_available') {
    throw new HttpError(409, 'asset_not_available', 'The Asset is not available.', [{
      code: 'asset_not_available',
      field: 'uploadId',
      message: 'The uploaded Asset is no longer available.',
    }])
  }
  if (result.status === 'role_not_found')
    throw createElementAssetRoleNotFoundError(role)
  if (result.status === 'incompatible_asset') {
    throw createElementAssetMediaTypeNotAcceptedError(
      role,
      result.mediaType,
      'role',
    )
  }
  if (result.status === 'element_master_role_capacity_reached')
    throw createElementMasterRoleCapacityError('role', result)
  if (result.status === 'element_source_capacity_reached')
    throw createElementSourceCapacityError('role', result.maximum)
  if (result.status === 'invalid_reference_metadata')
    throw createElementReferenceMetadataError()
  if (result.status === 'source_primary_invalid')
    throw createElementSourcePrimaryError()
  throw new HttpError(409, 'element_asset_already_attached', 'The Asset is already attached.')
}

export async function reconcileElementUploadLink(input: {
  assetId: string
  elementId?: string
  isPrimary?: boolean
  organizationId: string
  referenceKind?: ElementReferenceKind
  referenceMetadata?: unknown
  role?: string
  sortOrder?: number
}) {
  if (!input.elementId || !input.role)
    return

  const expectedKind = input.referenceKind ?? 'master'
  const existingLinks = await listElementAssetRows({
    elementId: input.elementId,
    organizationId: input.organizationId,
    role: input.role,
  })
  const existingLink = existingLinks.find(link => link.assetId === input.assetId)
  if (existingLink && existingLink.referenceKind !== expectedKind) {
    throw new HttpError(409, 'invalid_state', 'The upload relationship has changed.', [{
      code: 'invalid_state',
      field: 'referenceKind',
      message: 'The existing upload relationship does not match this replay.',
    }])
  }
  if (existingLink)
    return

  const attached = await createElementAssetLinkRow({
    assetId: input.assetId,
    elementId: input.elementId,
    isPrimary: input.isPrimary ?? false,
    organizationId: input.organizationId,
    referenceKind: expectedKind,
    referenceMetadata: input.referenceMetadata ?? {},
    role: input.role,
    sortOrder: input.sortOrder,
    validateFlowReferenceBudgets: executor => assertElementFlowReferenceBudgets(
      executor,
      {
        elementId: input.elementId!,
        organizationId: input.organizationId,
      },
    ),
  })
  if (attached.status !== 'created' && attached.status !== 'conflict')
    throwElementUploadLinkError(attached, input.role)
  if (attached.status === 'conflict') {
    const racedLinks = await listElementAssetRows({
      elementId: input.elementId,
      organizationId: input.organizationId,
      role: input.role,
    })
    const racedLink = racedLinks.find(link => link.assetId === input.assetId)
    if (!racedLink || racedLink.referenceKind !== expectedKind) {
      throw new HttpError(
        409,
        'invalid_state',
        'The upload relationship has changed.',
      )
    }
  }
}
