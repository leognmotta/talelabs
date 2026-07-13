import type {
  ElementReadiness,
  ElementReadinessMetadataCriteria,
  ElementReadinessReference,
  ElementReferenceMetadata,
} from './consistency.js'
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
import {
  ELEMENT_READINESS_ADD_REFERENCE_RECOMMENDATION_ID,
  ELEMENT_READINESS_MISSING_REFERENCE_ID,
  ELEMENT_REFERENCE_BACKGROUNDS,
  ELEMENT_REFERENCE_FRAMINGS,
  ELEMENT_REFERENCE_VIEWS,
  ElementReadinessSchema,
} from './consistency.js'
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

function referenceMetadataMatches(
  metadata: ElementReferenceMetadata,
  criteria: ElementReadinessMetadataCriteria | undefined,
) {
  if (!criteria)
    return true

  if (
    criteria.background
    && (!metadata.background || !criteria.background.includes(metadata.background))
  ) {
    return false
  }
  if (
    criteria.framing
    && (!metadata.framing || !criteria.framing.includes(metadata.framing))
  ) {
    return false
  }
  if (
    criteria.view
    && (!metadata.view || !criteria.view.includes(metadata.view))
  ) {
    return false
  }

  return true
}

/**
 * Derives Element consistency readiness from currently usable master links.
 *
 * Invalid roles, invalid metadata, source evidence, and unusable canonical
 * Assets fail closed and cannot improve readiness. Strong readiness is only
 * available when the type registry declares metadata-backed evidence rules.
 */
export function evaluateElementReadiness(
  type: ElementType,
  references: readonly ElementReadinessReference[],
  data?: Record<string, unknown>,
): ElementReadiness {
  const definition: ElementTypeDefinition = getElementTypeDefinition(type)
  const validMasters = references.flatMap((reference) => {
    if (reference.referenceKind !== 'master' || !reference.isUsable)
      return []

    const role = getElementAssetRole(type, reference.role, data)
    if (!role)
      return []

    const metadata = role.referenceMetadataSchema.safeParse(
      reference.referenceMetadata ?? {},
    )
    if (!metadata.success)
      return []

    return [{
      metadata: metadata.data,
      role: reference.role,
    }]
  })

  const usableRoleIds = definition.readiness.usableRoles === null
    ? null
    : new Set(definition.readiness.usableRoles)
  const usableMasters = usableRoleIds === null
    ? validMasters
    : validMasters.filter(reference => usableRoleIds.has(reference.role))

  if (usableMasters.length === 0) {
    return ElementReadinessSchema.parse({
      state: 'empty',
      missing: [ELEMENT_READINESS_MISSING_REFERENCE_ID],
      recommendations: [ELEMENT_READINESS_ADD_REFERENCE_RECOMMENDATION_ID],
    })
  }

  const missingEvidence = definition.readiness.strongEvidence.filter(
    requirement => !validMasters.some(reference => (
      requirement.roles.includes(reference.role)
      && referenceMetadataMatches(
        reference.metadata,
        requirement.referenceMetadata,
      )
    )),
  )
  const hasStrongContract = definition.readiness.strongEvidence.length > 0

  return ElementReadinessSchema.parse({
    state: hasStrongContract && missingEvidence.length === 0
      ? 'strong'
      : 'usable',
    missing: missingEvidence.map(requirement => requirement.id),
    recommendations: missingEvidence.map(
      requirement => requirement.recommendation,
    ),
  })
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
      if (!role.referenceMetadataSchema?.safeParse) {
        errors.push(`${key}.${role.id}: reference metadata schema is required`)
      }
      else {
        if (!role.referenceMetadataSchema.safeParse({}).success)
          errors.push(`${key}.${role.id}: empty reference metadata must be valid`)
        if (role.referenceMetadataSchema.safeParse({ unsupported: true }).success)
          errors.push(`${key}.${role.id}: reference metadata must reject unknown keys`)
      }
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

    const readiness = definition.readiness
    if (!readiness) {
      errors.push(`${key}: readiness rules are required`)
    }
    else {
      if (
        readiness.usableRoles !== null
        && (
          readiness.usableRoles.length === 0
          || readiness.usableRoles.some(role => !roleIds.includes(role))
        )
      ) {
        errors.push(`${key}: readiness usable roles must reference fixed asset roles`)
      }

      const evidenceIds = readiness.strongEvidence.map(rule => rule.id)
      if (new Set(evidenceIds).size !== evidenceIds.length)
        errors.push(`${key}: strong readiness evidence ids must be unique`)

      const validViews = new Set<string>(ELEMENT_REFERENCE_VIEWS)
      const validFramings = new Set<string>(ELEMENT_REFERENCE_FRAMINGS)
      const validBackgrounds = new Set<string>(ELEMENT_REFERENCE_BACKGROUNDS)
      for (const rule of readiness.strongEvidence) {
        if (!rule.id.trim() || !rule.recommendation.trim())
          errors.push(`${key}: readiness evidence ids and recommendations are required`)
        if (
          rule.roles.length === 0
          || rule.roles.some(role => !roleIds.includes(role))
        ) {
          errors.push(`${key}.${rule.id}: readiness evidence roles are invalid`)
        }

        const criteria = rule.referenceMetadata
        if (
          criteria?.view
          && (
            criteria.view.length === 0
            || criteria.view.some(value => !validViews.has(value))
          )
        ) {
          errors.push(`${key}.${rule.id}: readiness view criteria are invalid`)
        }
        if (
          criteria?.framing
          && (
            criteria.framing.length === 0
            || criteria.framing.some(value => !validFramings.has(value))
          )
        ) {
          errors.push(`${key}.${rule.id}: readiness framing criteria are invalid`)
        }
        if (
          criteria?.background
          && (
            criteria.background.length === 0
            || criteria.background.some(value => !validBackgrounds.has(value))
          )
        ) {
          errors.push(`${key}.${rule.id}: readiness background criteria are invalid`)
        }
      }
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
