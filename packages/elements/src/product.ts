import type { ElementTypeDefinition } from './types.js'
import { z } from 'zod'
import { imageRole, videoRole } from './asset-limits.js'
import {
  createEmptyElementIdentity,
  DEFAULT_ELEMENT_READINESS_DEFINITION,
  ElementIdentitySchema,
} from './consistency.js'
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

/** Product v2 adds shared consistency identity guidance. */
export const ProductElementDataSchemaV2 = ProductElementDataSchemaV1.extend({
  identity: ElementIdentitySchema.default(createEmptyElementIdentity()),
}).strict()

export function migrateProductV1ToV2(data: unknown) {
  return {
    ...ProductElementDataSchemaV1.parse(data),
    identity: createEmptyElementIdentity(),
  }
}

/** Schema used for new Product writes. Advance only with the definition version. */
export const ProductElementDataSchema = ProductElementDataSchemaV2

export type ProductElementData = z.infer<typeof ProductElementDataSchema>

export const productElementDefinition = Object.freeze({
  id: 'product',
  currentVersion: 2,
  schemas: Object.freeze({
    1: ProductElementDataSchemaV1,
    2: ProductElementDataSchemaV2,
  }),
  migrations: Object.freeze({ 1: migrateProductV1ToV2 }),
  previewRole: 'packshot',
  readiness: DEFAULT_ELEMENT_READINESS_DEFINITION,
  assetRoles: [
    imageRole('packshot'),
    imageRole('detail'),
    imageRole('lifestyle'),
    videoRole('demonstration'),
  ],
} as const satisfies ElementTypeDefinition<'product'>)
