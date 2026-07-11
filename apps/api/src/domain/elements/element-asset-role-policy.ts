import type {
  ElementAssetMediaType,
  ElementAssetRoleDefinition,
  ElementType,
} from '@talelabs/elements'

import { getElementAssetRole } from '@talelabs/elements'
import { HttpError } from '../../middleware/error.js'

export function createElementAssetRoleNotFoundError(role: string) {
  return new HttpError(
    400,
    'element_asset_role_not_found',
    'Element Asset role validation failed.',
    [{
      code: 'element_asset_role_not_found',
      field: 'role',
      message: 'The requested Element Asset role is not registered.',
      params: { role },
    }],
  )
}

export function createElementAssetMediaTypeNotAcceptedError(
  role: string,
  mediaType: string,
  field: 'assetId' | 'role',
) {
  return new HttpError(
    400,
    'element_asset_media_type_not_accepted',
    'Element Asset role validation failed.',
    [{
      code: 'element_asset_media_type_not_accepted',
      field,
      message: 'The Asset media type is not accepted by this role.',
      params: { mediaType, role },
    }],
  )
}

export function requireElementAssetRole(
  type: ElementType,
  role: string,
  data: Record<string, unknown>,
) {
  const definition = getElementAssetRole(type, role, data)
  if (!definition)
    throw createElementAssetRoleNotFoundError(role)
  return definition
}

export function requireElementAssetMediaType(
  role: ElementAssetRoleDefinition,
  mediaType: ElementAssetMediaType,
  field: 'assetId' | 'role',
) {
  if (role.accepts.includes(mediaType))
    return

  throw createElementAssetMediaTypeNotAcceptedError(role.id, mediaType, field)
}
