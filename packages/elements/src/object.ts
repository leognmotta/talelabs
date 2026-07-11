import type { ElementTypeDefinition } from './types.js'
import { z } from 'zod'
import { imageRole, videoRole } from './asset-limits.js'
import { focusedText } from './schema-utils.js'

/** Immutable historical schema for Object v1. */
export const ObjectElementDataSchemaV1 = z.object({
  description: focusedText(2_000).default(''),
  interactionGuidance: focusedText(1_500).default(''),
}).strict()

export const ObjectElementDataSchema = ObjectElementDataSchemaV1
export type ObjectElementData = z.infer<typeof ObjectElementDataSchema>

export const objectElementDefinition = Object.freeze({
  id: 'object',
  currentVersion: 1,
  schemas: Object.freeze({ 1: ObjectElementDataSchemaV1 }),
  migrations: Object.freeze({}),
  previewRole: 'appearance',
  assetRoles: [
    imageRole('appearance'),
    imageRole('detail'),
    imageRole('interaction'),
    videoRole('motion'),
  ],
} as const satisfies ElementTypeDefinition<'object'>)
