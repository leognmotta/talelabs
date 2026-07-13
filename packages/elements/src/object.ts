import type { ElementTypeDefinition } from './types.js'
import { z } from 'zod'
import { imageRole, videoRole } from './asset-limits.js'
import {
  createEmptyElementIdentity,
  DEFAULT_ELEMENT_READINESS_DEFINITION,
  ElementIdentitySchema,
} from './consistency.js'
import { focusedText } from './schema-utils.js'

/** Immutable historical schema for Object v1. */
export const ObjectElementDataSchemaV1 = z.object({
  description: focusedText(2_000).default(''),
  interactionGuidance: focusedText(1_500).default(''),
}).strict()

/** Object v2 adds shared consistency identity guidance. */
export const ObjectElementDataSchemaV2 = ObjectElementDataSchemaV1.extend({
  identity: ElementIdentitySchema.default(createEmptyElementIdentity()),
}).strict()

export function migrateObjectV1ToV2(data: unknown) {
  return {
    ...ObjectElementDataSchemaV1.parse(data),
    identity: createEmptyElementIdentity(),
  }
}

export const ObjectElementDataSchema = ObjectElementDataSchemaV2
export type ObjectElementData = z.infer<typeof ObjectElementDataSchema>

export const objectElementDefinition = Object.freeze({
  id: 'object',
  currentVersion: 2,
  schemas: Object.freeze({
    1: ObjectElementDataSchemaV1,
    2: ObjectElementDataSchemaV2,
  }),
  migrations: Object.freeze({ 1: migrateObjectV1ToV2 }),
  previewRole: 'appearance',
  readiness: DEFAULT_ELEMENT_READINESS_DEFINITION,
  assetRoles: [
    imageRole('appearance'),
    imageRole('detail'),
    imageRole('interaction'),
    videoRole('motion'),
  ],
} as const satisfies ElementTypeDefinition<'object'>)
