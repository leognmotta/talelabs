/** Canonical current-shape migration for persisted image generation nodes. */

import { getGenerationModel } from '../../generation/registry/index.js'
import {
  GenerationNodeDataLegacySchema,
  ImageGenerationNodeDataSchemaV3Base,
} from '../data/schemas.js'

/** Migrates legacy provider-native image identity into the catalog-era shape. */
export function migrateImageGenerationNodeDataV1(data: unknown) {
  const parsed = GenerationNodeDataLegacySchema.parse(data)
  const { outputCount: _outputCount, ...settings } = parsed.settings
  return { ...parsed, settings }
}

/** Migrates catalog-era image data to the canonical vendor/model shape. */
export function migrateImageGenerationNodeDataV3(data: unknown) {
  const parsed = ImageGenerationNodeDataSchemaV3Base.parse(data)
  const model = getGenerationModel(parsed.modelId)!
  return {
    ...parsed,
    inputSelections: Object.fromEntries(
      model.inputSlots.map(slot => [
        slot.id,
        parsed.inputSelections[slot.id] ?? { mode: 'auto' },
      ]),
    ),
    modelId: model.id,
    operationId: model.defaultOperationId,
    settings: Object.fromEntries(
      model.settings.map(setting => [
        setting.id,
        parsed.settings[setting.id] ?? setting.default,
      ]),
    ),
  }
}
