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

export function createElementMasterRoleCapacityError(
  field: 'assetId' | 'role',
  violation: { maximum: number, role: string },
) {
  return new HttpError(
    409,
    'element_master_role_capacity_reached',
    'Element reference capacity reached.',
    [{
      code: 'element_master_role_capacity_reached',
      field,
      message: 'The Element reference role has reached its configured capacity.',
      params: violation,
    }],
  )
}

export function createElementSourceCapacityError(
  field: 'assetId' | 'role',
  maximum: number,
) {
  return new HttpError(
    409,
    'element_source_capacity_reached',
    'Element source capacity reached.',
    [{
      code: 'element_source_capacity_reached',
      field,
      message: 'The Element has reached its source capacity.',
      params: { maximum },
    }],
  )
}

export function createElementReferenceMetadataError() {
  return new HttpError(
    400,
    'element_reference_metadata_invalid',
    'Element reference metadata is invalid.',
    [{
      code: 'element_reference_metadata_invalid',
      field: 'referenceMetadata',
      message: 'The relationship metadata is not valid for this Element role.',
    }],
  )
}

export function createElementSourcePrimaryError() {
  return new HttpError(
    400,
    'element_source_primary_invalid',
    'Element source references cannot be primary.',
    [{
      code: 'element_source_primary_invalid',
      field: 'isPrimary',
      message: 'A source relationship cannot be the primary reference.',
    }],
  )
}
