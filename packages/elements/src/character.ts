import type { ElementTypeDefinition } from './types.js'
import { z } from 'zod'
import { audioRole, imageRole, videoRole } from './asset-limits.js'
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

/** Schema used for new Character writes. Advance only with the definition version. */
export const CharacterElementDataSchema = CharacterElementDataSchemaV1

export type CharacterElementData = z.infer<typeof CharacterElementDataSchema>

export const characterElementDefinition = Object.freeze({
  id: 'character',
  currentVersion: 1,
  schemas: Object.freeze({ 1: CharacterElementDataSchemaV1 }),
  migrations: Object.freeze({}),
  previewRole: 'appearance',
  assetRoles: [
    imageRole('appearance'),
    imageRole('expression'),
    videoRole('motion'),
    audioRole('voice'),
  ],
} as const satisfies ElementTypeDefinition<'character'>)
