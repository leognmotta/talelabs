import type { ElementTypeDefinition } from './types.js'
import { z } from 'zod'
import { audioRole } from './asset-limits.js'
import {
  createEmptyElementIdentity,
  DEFAULT_ELEMENT_READINESS_DEFINITION,
  ElementIdentitySchema,
} from './consistency.js'
import { focusedText } from './schema-utils.js'

/** Immutable historical schema for Voice v1. */
export const VoiceElementDataSchemaV1 = z.object({
  description: focusedText(2_000).default(''),
  languageAccent: focusedText(240).default(''),
  tone: focusedText(1_000).default(''),
}).strict()

/** Voice v2 adds shared consistency identity guidance. */
export const VoiceElementDataSchemaV2 = VoiceElementDataSchemaV1.extend({
  identity: ElementIdentitySchema.default(createEmptyElementIdentity()),
}).strict()

export function migrateVoiceV1ToV2(data: unknown) {
  return {
    ...VoiceElementDataSchemaV1.parse(data),
    identity: createEmptyElementIdentity(),
  }
}

export const VoiceElementDataSchema = VoiceElementDataSchemaV2
export type VoiceElementData = z.infer<typeof VoiceElementDataSchema>

export const voiceElementDefinition = Object.freeze({
  id: 'voice',
  currentVersion: 2,
  schemas: Object.freeze({
    1: VoiceElementDataSchemaV1,
    2: VoiceElementDataSchemaV2,
  }),
  migrations: Object.freeze({ 1: migrateVoiceV1ToV2 }),
  previewRole: 'cleanSample',
  readiness: DEFAULT_ELEMENT_READINESS_DEFINITION,
  assetRoles: [
    audioRole('cleanSample'),
    audioRole('emotionalSample'),
    audioRole('pronunciation'),
    audioRole('performanceReference'),
  ],
} as const satisfies ElementTypeDefinition<'voice'>)
