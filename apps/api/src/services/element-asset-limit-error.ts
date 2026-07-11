import { HttpError } from '../middleware/error.js'

export function createElementAssetRoleCapacityError(
  field: 'assetId' | 'role',
  violation: { maximum: number, role: string },
) {
  return new HttpError(
    409,
    'element_asset_role_capacity_reached',
    'Element Asset role capacity reached.',
    [{
      code: 'element_asset_role_capacity_reached',
      field,
      message: 'The Element Asset role has reached its configured capacity.',
      params: violation,
    }],
  )
}
