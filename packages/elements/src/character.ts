import type { ElementTypeDefinition } from './types.js'
import { z } from 'zod'
import { audioRole, imageRole, videoRole } from './asset-limits.js'
import {
  CHARACTER_ELEMENT_READINESS_DEFINITION,
  createEmptyElementIdentity,
  ElementIdentitySchema,
} from './consistency.js'
import { focusedText } from './schema-utils.js'

/**
 * Historical v1 schema. Once v1 data exists in production, keep this schema
 * unchanged and add a new schema plus a sequential migration for any semantic
 * change.
 */
export const CharacterElementDataSchemaV1 = z.object({
  description: focusedText(2_000).default(''),
  personality: focusedText(1_000).default(''),
}).strict()

/** Character v2 adds shared consistency identity guidance. */
export const CharacterElementDataSchemaV2 = CharacterElementDataSchemaV1.extend({
  identity: ElementIdentitySchema.default(createEmptyElementIdentity()),
}).strict()

export function migrateCharacterV1ToV2(data: unknown) {
  return {
    ...CharacterElementDataSchemaV1.parse(data),
    identity: createEmptyElementIdentity(),
  }
}

/** Schema used for new Character writes. Advance only with the definition version. */
export const CharacterElementDataSchema = CharacterElementDataSchemaV2

export type CharacterElementData = z.infer<typeof CharacterElementDataSchema>

export const characterElementDefinition = Object.freeze({
  id: 'character',
  currentVersion: 2,
  schemas: Object.freeze({
    1: CharacterElementDataSchemaV1,
    2: CharacterElementDataSchemaV2,
  }),
  migrations: Object.freeze({ 1: migrateCharacterV1ToV2 }),
  previewRole: 'appearance',
  readiness: CHARACTER_ELEMENT_READINESS_DEFINITION,
  assetRoles: [
    imageRole('appearance'),
    imageRole('expression'),
    videoRole('motion'),
    audioRole('voice'),
  ],
} as const satisfies ElementTypeDefinition<'character'>)
