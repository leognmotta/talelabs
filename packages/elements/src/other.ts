import type {
  ElementCustomAssetRole,
  ElementTypeDefinition,
} from './types.js'
import { z } from 'zod'
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

export const OtherElementDataSchema = OtherElementDataSchemaV2
export type OtherElementData = z.infer<typeof OtherElementDataSchema>

export const otherElementDefinition = Object.freeze({
  id: 'other',
  currentVersion: 2,
  schemas: Object.freeze({
    1: OtherElementDataSchemaV1,
    2: OtherElementDataSchemaV2,
  }),
  migrations: Object.freeze({ 1: migrateOtherV1ToV2 }),
  previewRole: null,
  assetRoles: [],
  customAssetRoles: {
    allowedMediaTypes: ['image', 'video', 'audio'],
    maxRoles: OTHER_MAX_ASSET_ROLES,
  },
} as const satisfies ElementTypeDefinition<'other'>)
