import type { ElementTypeDefinition } from './types.js'
import { z } from 'zod'
import { imageRole, videoRole } from './asset-limits.js'
import {
  createEmptyElementIdentity,
  DEFAULT_ELEMENT_READINESS_DEFINITION,
  ElementIdentitySchema,
} from './consistency.js'
import { focusedText } from './schema-utils.js'

/** Immutable historical schema for Location v1. */
export const LocationElementDataSchemaV1 = z.object({
  description: focusedText(2_000).default(''),
  atmosphere: focusedText(1_000).default(''),
}).strict()

/** Location v2 adds shared consistency identity guidance. */
export const LocationElementDataSchemaV2 = LocationElementDataSchemaV1.extend({
  identity: ElementIdentitySchema.default(createEmptyElementIdentity()),
}).strict()

export function migrateLocationV1ToV2(data: unknown) {
  return {
    ...LocationElementDataSchemaV1.parse(data),
    identity: createEmptyElementIdentity(),
  }
}

export const LocationElementDataSchema = LocationElementDataSchemaV2
export type LocationElementData = z.infer<typeof LocationElementDataSchema>

export const locationElementDefinition = Object.freeze({
  id: 'location',
  currentVersion: 2,
  schemas: Object.freeze({
    1: LocationElementDataSchemaV1,
    2: LocationElementDataSchemaV2,
  }),
  migrations: Object.freeze({ 1: migrateLocationV1ToV2 }),
  previewRole: 'exterior',
  readiness: DEFAULT_ELEMENT_READINESS_DEFINITION,
  assetRoles: [
    imageRole('exterior'),
    imageRole('interior'),
    imageRole('detail'),
    imageRole('atmosphere'),
    videoRole('referenceVideo'),
  ],
} as const satisfies ElementTypeDefinition<'location'>)
