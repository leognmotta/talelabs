import type {
  ElementAssetMediaType,
  ElementAssetRoleDefinition,
} from './types.js'

/**
 * Default Element context capacity per role media family.
 *
 * These are storage/context limits, not generation-model input limits. Flow
 * execution will select and validate model-specific inputs separately.
 */
export const DEFAULT_ELEMENT_ASSET_ROLE_LIMITS = Object.freeze({
  audio: 1,
  image: 8,
  video: 1,
} as const satisfies Record<ElementAssetMediaType, number>)

export function createElementAssetRole<Role extends string>(
  id: Role,
  mediaType: ElementAssetMediaType,
  options: { maxAssets?: number } = {},
): ElementAssetRoleDefinition<Role> {
  const maxAssets = options.maxAssets
    ?? DEFAULT_ELEMENT_ASSET_ROLE_LIMITS[mediaType]
  return {
    accepts: [mediaType],
    id,
    maxAssets,
    multiple: maxAssets > 1,
  }
}

export function imageRole<Role extends string>(
  id: Role,
  options?: { maxAssets?: number },
) {
  return createElementAssetRole(id, 'image', options)
}

export function videoRole<Role extends string>(
  id: Role,
  options?: { maxAssets?: number },
) {
  return createElementAssetRole(id, 'video', options)
}

export function audioRole<Role extends string>(
  id: Role,
  options?: { maxAssets?: number },
) {
  return createElementAssetRole(id, 'audio', options)
}
