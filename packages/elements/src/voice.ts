import type { ElementTypeDefinition } from './types.js'
import { z } from 'zod'
import { audioRole } from './asset-limits.js'
import { focusedText } from './schema-utils.js'

/** Immutable historical schema for Voice v1. */
export const VoiceElementDataSchemaV1 = z.object({
  description: focusedText(2_000).default(''),
  languageAccent: focusedText(240).default(''),
  tone: focusedText(1_000).default(''),
}).strict()

export const VoiceElementDataSchema = VoiceElementDataSchemaV1
export type VoiceElementData = z.infer<typeof VoiceElementDataSchema>

export const voiceElementDefinition = Object.freeze({
  id: 'voice',
  currentVersion: 1,
  schemas: Object.freeze({ 1: VoiceElementDataSchemaV1 }),
  migrations: Object.freeze({}),
  previewRole: 'cleanSample',
  assetRoles: [
    audioRole('cleanSample'),
    audioRole('emotionalSample'),
    audioRole('pronunciation'),
    audioRole('performanceReference'),
  ],
} as const satisfies ElementTypeDefinition<'voice'>)
