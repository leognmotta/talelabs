/** Deterministic string-to-structured-prompt node-data migrations. */

import { promptTemplateFromText } from '../../prompts/schema.js'
import {
  ImageGenerationNodeDataSchemaV7,
  LlmNodeDataSchemaV1,
  MusicGenerationNodeDataSchemaV1,
  SoundEffectGenerationNodeDataSchemaV1,
  SpeechGenerationNodeDataSchemaV1,
  VideoGenerationNodeDataSchemaV3,
} from '../data/schemas.js'

function withStructuredPrompt<T extends Record<string, unknown>>(data: T) {
  if (typeof data.prompt !== 'string')
    throw new TypeError('prompt_migration_requires_string')
  return { ...data, prompt: promptTemplateFromText(data.prompt) }
}

/** Migrates image-generation schema 7 to its structured prompt. */
export function migrateImageGenerationNodeDataV7(data: unknown) {
  return withStructuredPrompt(ImageGenerationNodeDataSchemaV7.parse(data))
}

/** Migrates video-generation schema 3 to its structured prompt. */
export function migrateVideoGenerationNodeDataV3(data: unknown) {
  return withStructuredPrompt(VideoGenerationNodeDataSchemaV3.parse(data))
}

/** Migrates LLM schema 1 to its structured prompt. */
export function migrateLlmNodeDataV1(data: unknown) {
  return withStructuredPrompt(LlmNodeDataSchemaV1.parse(data))
}

/** Migrates speech schema 1 to its structured prompt. */
export function migrateSpeechGenerationNodeDataV1(data: unknown) {
  return withStructuredPrompt(SpeechGenerationNodeDataSchemaV1.parse(data))
}

/** Migrates music schema 1 while preserving plain lyrics. */
export function migrateMusicGenerationNodeDataV1(data: unknown) {
  return withStructuredPrompt(MusicGenerationNodeDataSchemaV1.parse(data))
}

/** Migrates sound-effect schema 1 to its structured prompt. */
export function migrateSoundEffectGenerationNodeDataV1(data: unknown) {
  return withStructuredPrompt(SoundEffectGenerationNodeDataSchemaV1.parse(data))
}
