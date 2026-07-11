import type { ElementTypeDefinition } from './types.js'
import { z } from 'zod'
import { imageRole } from './asset-limits.js'
import { focusedText, hexColor } from './schema-utils.js'

export const BRAND_MAX_COLORS = 12

/** Immutable historical schema for Brand v1. */
export const BrandElementDataSchemaV1 = z.object({
  description: focusedText(2_000).default(''),
  communicationStyle: focusedText(1_500).default(''),
}).strict()

/** Brand v2 adds a structured color palette without changing v1 semantics. */
export const BrandElementDataSchemaV2 = BrandElementDataSchemaV1.extend({
  colors: z.array(hexColor())
    .max(BRAND_MAX_COLORS, 'validation.maxItems')
    .refine(
      colors => new Set(colors.map(color => color.toLowerCase())).size === colors.length,
      'validation.duplicate',
    )
    .default([]),
}).strict()

export function migrateBrandV1ToV2(data: unknown) {
  return { ...BrandElementDataSchemaV1.parse(data), colors: [] }
}

export const BrandElementDataSchema = BrandElementDataSchemaV2
export type BrandElementData = z.infer<typeof BrandElementDataSchema>

export const brandElementDefinition = Object.freeze({
  id: 'brand',
  currentVersion: 2,
  schemas: Object.freeze({
    1: BrandElementDataSchemaV1,
    2: BrandElementDataSchemaV2,
  }),
  migrations: Object.freeze({ 1: migrateBrandV1ToV2 }),
  previewRole: 'primaryLogo',
  assetRoles: [
    imageRole('primaryLogo'),
    imageRole('alternateLogo'),
    imageRole('icon'),
    imageRole('typography'),
    imageRole('palette'),
    imageRole('referenceCampaign'),
  ],
} as const satisfies ElementTypeDefinition<'brand'>)
