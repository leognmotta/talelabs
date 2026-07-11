import type {
  ElementAssetMediaType,
  ElementAssetRoleDefinition,
  ElementCustomAssetRole,
  ElementType,
  ElementTypeDefinition,
} from './types.js'
import { createElementAssetRole } from './asset-limits.js'
import { brandElementDefinition } from './brand.js'
import { characterElementDefinition } from './character.js'
import { locationElementDefinition } from './location.js'
import { objectElementDefinition } from './object.js'
import { otherElementDefinition } from './other.js'
import { productElementDefinition } from './product.js'
import { vehicleElementDefinition } from './vehicle.js'
import { voiceElementDefinition } from './voice.js'

const ELEMENT_ASSET_MEDIA_TYPES = new Set<ElementAssetMediaType>([
  'audio',
  'image',
  'video',
])

function isElementAssetMediaType(value: unknown): value is ElementAssetMediaType {
  return typeof value === 'string'
    && ELEMENT_ASSET_MEDIA_TYPES.has(value as ElementAssetMediaType)
}

export const ELEMENT_TYPE_REGISTRY = Object.freeze({
  brand: brandElementDefinition,
  character: characterElementDefinition,
  location: locationElementDefinition,
  object: objectElementDefinition,
  product: productElementDefinition,
  vehicle: vehicleElementDefinition,
  voice: voiceElementDefinition,
  other: otherElementDefinition,
} as const satisfies Record<ElementType, ElementTypeDefinition>)

export const ELEMENT_TYPES = Object.freeze(
  Object.keys(ELEMENT_TYPE_REGISTRY) as ElementType[],
)

export function isElementType(value: unknown): value is ElementType {
  return typeof value === 'string' && value in ELEMENT_TYPE_REGISTRY
}

export function getElementTypeDefinition<Type extends ElementType>(type: Type) {
  return ELEMENT_TYPE_REGISTRY[type]
}

export function getElementAssetRoles(
  type: ElementType,
  data?: Record<string, unknown>,
) {
  const definition: ElementTypeDefinition = getElementTypeDefinition(type)
  const roles = [
    ...(definition.assetRoles as readonly ElementAssetRoleDefinition[]),
  ]
  if (!definition.customAssetRoles || !Array.isArray(data?.assetRoles))
    return roles

  const fixedRoleIds = new Set(roles.map(role => role.id))
  for (const value of data.assetRoles) {
    if (!value || typeof value !== 'object')
      continue
    const { id: roleId, mediaType } = value as Partial<ElementCustomAssetRole>
    if (
      typeof roleId !== 'string'
      || fixedRoleIds.has(roleId)
      || !isElementAssetMediaType(mediaType)
    ) {
      continue
    }
    roles.push({
      ...createElementAssetRole(roleId, mediaType),
    })
  }
  return roles
}

export function getElementAssetRole(
  type: ElementType,
  role: string,
  data?: Record<string, unknown>,
) {
  return getElementAssetRoles(type, data).find(item => item.id === role)
}

export function acceptsAssetType(
  type: ElementType,
  role: string,
  mediaType: ElementAssetMediaType,
  data?: Record<string, unknown>,
) {
  return getElementAssetRole(type, role, data)?.accepts.includes(mediaType)
    ?? false
}

export function validateElementRegistry(
  registry: Record<string, ElementTypeDefinition> = ELEMENT_TYPE_REGISTRY,
) {
  const errors: string[] = []

  for (const [key, definition] of Object.entries(registry)) {
    if (definition.id !== key)
      errors.push(`${key}: definition id must match its registry key`)
    if (!Number.isInteger(definition.currentVersion) || definition.currentVersion < 1)
      errors.push(`${key}: currentVersion must be a positive integer`)

    const roleIds = definition.assetRoles.map(role => role.id)
    if (new Set(roleIds).size !== roleIds.length)
      errors.push(`${key}: asset role ids must be unique`)
    if (definition.previewRole === null && !definition.customAssetRoles)
      errors.push(`${key}: a null previewRole requires custom Asset roles`)
    if (definition.previewRole !== null && !roleIds.includes(definition.previewRole))
      errors.push(`${key}: previewRole must reference an asset role`)
    if (roleIds.length === 0 && !definition.customAssetRoles)
      errors.push(`${key}: at least one fixed or custom asset role is required`)

    for (const role of definition.assetRoles) {
      if (!role.id.trim())
        errors.push(`${key}: asset role ids are required`)
      if (
        role.accepts.length !== 1
        || !isElementAssetMediaType(role.accepts[0])
      ) {
        errors.push(`${key}.${role.id}: accepted media type is invalid`)
      }
      if (!Number.isInteger(role.maxAssets) || role.maxAssets < 1)
        errors.push(`${key}.${role.id}: maxAssets must be a positive integer`)
      if (role.multiple !== (role.maxAssets > 1))
        errors.push(`${key}.${role.id}: multiple must match maxAssets`)
    }

    if (definition.customAssetRoles) {
      const custom = definition.customAssetRoles
      if (!Number.isInteger(custom.maxRoles) || custom.maxRoles < 1)
        errors.push(`${key}: custom Asset role limit must be a positive integer`)
      if (
        custom.allowedMediaTypes.length === 0
        || new Set(custom.allowedMediaTypes).size !== custom.allowedMediaTypes.length
      ) {
        errors.push(`${key}: custom media type choices must be non-empty and unique`)
      }
      if (custom.allowedMediaTypes.some(type => !isElementAssetMediaType(type)))
        errors.push(`${key}: custom accepted media type is invalid`)
    }

    for (let version = 1; version <= definition.currentVersion; version++) {
      const schema = definition.schemas[version]
      if (!schema) {
        errors.push(`${key}: missing schema for version ${version}`)
      }
      else if (typeof schema.parse !== 'function') {
        errors.push(`${key}: schema for version ${version} is not a Zod schema`)
      }

      if (version < definition.currentVersion) {
        const migration = definition.migrations[version]
        if (typeof migration !== 'function')
          errors.push(`${key}: missing migration from version ${version} to ${version + 1}`)
      }
    }
    for (const version of Object.keys(definition.schemas).map(Number)) {
      if (!Number.isInteger(version) || version < 1 || version > definition.currentVersion)
        errors.push(`${key}: schema version ${version} is outside the supported range`)
    }
    for (const version of Object.keys(definition.migrations).map(Number)) {
      if (!Number.isInteger(version) || version < 1 || version >= definition.currentVersion)
        errors.push(`${key}: migration version ${version} is outside the supported range`)
    }
  }

  if (errors.length)
    throw new Error(`Invalid Element registry:\n${errors.map(error => `- ${error}`).join('\n')}`)

  return true
}

validateElementRegistry()
