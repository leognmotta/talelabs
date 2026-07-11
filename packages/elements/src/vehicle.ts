import type { ElementTypeDefinition } from './types.js'
import { z } from 'zod'
import { imageRole, videoRole } from './asset-limits.js'
import { focusedText } from './schema-utils.js'

/** Immutable historical schema for Vehicle v1. */
export const VehicleElementDataSchemaV1 = z.object({
  description: focusedText(2_000).default(''),
  motionGuidance: focusedText(1_500).default(''),
}).strict()

export const VehicleElementDataSchema = VehicleElementDataSchemaV1
export type VehicleElementData = z.infer<typeof VehicleElementDataSchema>

export const vehicleElementDefinition = Object.freeze({
  id: 'vehicle',
  currentVersion: 1,
  schemas: Object.freeze({ 1: VehicleElementDataSchemaV1 }),
  migrations: Object.freeze({}),
  previewRole: 'exterior',
  assetRoles: [
    imageRole('exterior'),
    imageRole('interior'),
    imageRole('detail'),
    videoRole('movement'),
  ],
} as const satisfies ElementTypeDefinition<'vehicle'>)
