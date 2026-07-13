import type { ElementTypeDefinition } from './types.js'
import { z } from 'zod'
import { imageRole, videoRole } from './asset-limits.js'
import {
  createEmptyElementIdentity,
  DEFAULT_ELEMENT_READINESS_DEFINITION,
  ElementIdentitySchema,
} from './consistency.js'
import { focusedText } from './schema-utils.js'

/** Immutable historical schema for Vehicle v1. */
export const VehicleElementDataSchemaV1 = z.object({
  description: focusedText(2_000).default(''),
  motionGuidance: focusedText(1_500).default(''),
}).strict()

/** Vehicle v2 adds shared consistency identity guidance. */
export const VehicleElementDataSchemaV2 = VehicleElementDataSchemaV1.extend({
  identity: ElementIdentitySchema.default(createEmptyElementIdentity()),
}).strict()

export function migrateVehicleV1ToV2(data: unknown) {
  return {
    ...VehicleElementDataSchemaV1.parse(data),
    identity: createEmptyElementIdentity(),
  }
}

export const VehicleElementDataSchema = VehicleElementDataSchemaV2
export type VehicleElementData = z.infer<typeof VehicleElementDataSchema>

export const vehicleElementDefinition = Object.freeze({
  id: 'vehicle',
  currentVersion: 2,
  schemas: Object.freeze({
    1: VehicleElementDataSchemaV1,
    2: VehicleElementDataSchemaV2,
  }),
  migrations: Object.freeze({ 1: migrateVehicleV1ToV2 }),
  previewRole: 'exterior',
  readiness: DEFAULT_ELEMENT_READINESS_DEFINITION,
  assetRoles: [
    imageRole('exterior'),
    imageRole('interior'),
    imageRole('detail'),
    videoRole('movement'),
  ],
} as const satisfies ElementTypeDefinition<'vehicle'>)
