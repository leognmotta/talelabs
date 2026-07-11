import type { ElementTypeDefinition } from './types.js'
import { z } from 'zod'
import { imageRole, videoRole } from './asset-limits.js'
import { focusedText } from './schema-utils.js'

/** Immutable historical schema for Location v1. */
export const LocationElementDataSchemaV1 = z.object({
  description: focusedText(2_000).default(''),
  atmosphere: focusedText(1_000).default(''),
}).strict()

export const LocationElementDataSchema = LocationElementDataSchemaV1
export type LocationElementData = z.infer<typeof LocationElementDataSchema>

export const locationElementDefinition = Object.freeze({
  id: 'location',
  currentVersion: 1,
  schemas: Object.freeze({ 1: LocationElementDataSchemaV1 }),
  migrations: Object.freeze({}),
  previewRole: 'exterior',
  assetRoles: [
    imageRole('exterior'),
    imageRole('interior'),
    imageRole('detail'),
    imageRole('atmosphere'),
    videoRole('referenceVideo'),
  ],
} as const satisfies ElementTypeDefinition<'location'>)
