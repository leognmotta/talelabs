import type { ElementTypeDefinition } from './types.js'
import { z } from 'zod'
import { imageRole, videoRole } from './asset-limits.js'
import { focusedText } from './schema-utils.js'

export const PRODUCT_MAX_SELLING_POINTS = 10
export const PRODUCT_SELLING_POINT_MAX_LENGTH = 240

/**
 * Historical v1 schema. Once v1 data exists in production, keep this schema
 * unchanged and add a new schema plus a sequential migration for any semantic
 * change.
 */
export const ProductElementDataSchemaV1 = z.object({
  description: focusedText(2_000).default(''),
  sellingPoints: z.array(focusedText(PRODUCT_SELLING_POINT_MAX_LENGTH))
    .max(PRODUCT_MAX_SELLING_POINTS, 'validation.maxItems')
    .default([]),
}).strict()

/** Schema used for new Product writes. Advance only with the definition version. */
export const ProductElementDataSchema = ProductElementDataSchemaV1

export type ProductElementData = z.infer<typeof ProductElementDataSchema>

export const productElementDefinition = Object.freeze({
  id: 'product',
  currentVersion: 1,
  schemas: Object.freeze({ 1: ProductElementDataSchemaV1 }),
  migrations: Object.freeze({}),
  previewRole: 'packshot',
  assetRoles: [
    imageRole('packshot'),
    imageRole('detail'),
    imageRole('lifestyle'),
    videoRole('demonstration'),
  ],
} as const satisfies ElementTypeDefinition<'product'>)
