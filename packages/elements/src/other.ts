import type {
  ElementCustomAssetRole,
  ElementTypeDefinition,
} from './types.js'
import { z } from 'zod'
import {
  createEmptyElementIdentity,
  DEFAULT_ELEMENT_READINESS_DEFINITION,
  ElementIdentitySchema,
} from './consistency.js'
import { focusedText } from './schema-utils.js'

export const OTHER_MAX_ASSET_ROLES = 3

const OtherAssetRoleNameSchema = focusedText(64)
  .min(1, 'validation.required')

export const OtherAssetRoleSchema = z.object({
  id: OtherAssetRoleNameSchema,
  mediaType: z.enum(['audio', 'image', 'video']),
}).strict()

/** Immutable historical schema for Other v1. */
export const OtherElementDataSchemaV1 = z.object({
  assetRoles: z.array(OtherAssetRoleNameSchema)
    .max(OTHER_MAX_ASSET_ROLES, 'validation.maxItems')
    .superRefine((roles, context) => {
      const seen = new Set<string>()
      roles.forEach((role, index) => {
        const normalized = role.toLowerCase()
        if (seen.has(normalized)) {
          context.addIssue({
            code: 'custom',
            message: 'validation.duplicate',
            path: [index],
          })
        }
        seen.add(normalized)
      })
    })
    .default([]),
}).strict()

/** Other v2 assigns exactly one media family to every custom Asset role. */
export const OtherElementDataSchemaV2 = z.object({
  assetRoles: z.array(OtherAssetRoleSchema)
    .max(OTHER_MAX_ASSET_ROLES, 'validation.maxItems')
    .superRefine((roles, context) => {
      const seen = new Set<string>()
      roles.forEach((role, index) => {
        const normalized = role.id.toLowerCase()
        if (seen.has(normalized)) {
          context.addIssue({
            code: 'custom',
            message: 'validation.duplicate',
            path: [index, 'id'],
          })
        }
        seen.add(normalized)
      })
    })
    .default([]),
}).strict()

export function migrateOtherV1ToV2(data: unknown) {
  const parsed = OtherElementDataSchemaV1.parse(data)
  return {
    assetRoles: parsed.assetRoles.map((id): ElementCustomAssetRole => ({
      id,
      mediaType: 'image',
    })),
  }
}

/** Other v3 adds shared consistency identity guidance. */
export const OtherElementDataSchemaV3 = OtherElementDataSchemaV2.extend({
  identity: ElementIdentitySchema.default(createEmptyElementIdentity()),
}).strict()

export function migrateOtherV2ToV3(data: unknown) {
  return {
    ...OtherElementDataSchemaV2.parse(data),
    identity: createEmptyElementIdentity(),
  }
}

export const OtherElementDataSchema = OtherElementDataSchemaV3
export type OtherElementData = z.infer<typeof OtherElementDataSchema>

export const otherElementDefinition = Object.freeze({
  id: 'other',
  currentVersion: 3,
  schemas: Object.freeze({
    1: OtherElementDataSchemaV1,
    2: OtherElementDataSchemaV2,
    3: OtherElementDataSchemaV3,
  }),
  migrations: Object.freeze({
    1: migrateOtherV1ToV2,
    2: migrateOtherV2ToV3,
  }),
  previewRole: null,
  readiness: DEFAULT_ELEMENT_READINESS_DEFINITION,
  assetRoles: [],
  customAssetRoles: {
    allowedMediaTypes: ['image', 'video', 'audio'],
    maxRoles: OTHER_MAX_ASSET_ROLES,
  },
} as const satisfies ElementTypeDefinition<'other'>)
