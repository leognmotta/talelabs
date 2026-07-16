import {
  DEFAULT_GENERATION_MODEL_IDS,
  getGenerationModel,
} from '../../generation/registry/index.js'
import {
  GenerationNodeDataLegacySchema,
  ImageGenerationNodeDataSchemaV3Base,
  LEGACY_IMAGE_MODEL_IDS,
} from '../data/schemas.js'

export function migrateImageGenerationNodeDataV1(data: unknown) {
  const parsed = GenerationNodeDataLegacySchema.parse(data)
  const { outputCount: _outputCount, ...settings } = parsed.settings
  return { ...parsed, settings }
}

export function migrateImageGenerationNodeDataV3(data: unknown) {
  const parsed = ImageGenerationNodeDataSchemaV3Base.parse(data)
  const legacyModel = LEGACY_IMAGE_MODEL_IDS.has(parsed.modelId)
  const modelId = legacyModel
    ? DEFAULT_GENERATION_MODEL_IDS.image
    : parsed.modelId
  const model
    = getGenerationModel(modelId)
      ?? getGenerationModel(DEFAULT_GENERATION_MODEL_IDS.image)!
  return {
    ...parsed,
    inputSelections: Object.fromEntries(
      model.inputSlots.map(slot => [
        slot.id,
        parsed.inputSelections[slot.id] ?? { mode: 'auto' },
      ]),
    ),
    modelId: model.id,
    operationId: legacyModel ? 'imageToImage' : model.defaultOperationId,
    settings: Object.fromEntries(
      model.settings.map(setting => [
        setting.id,
        legacyModel
          ? setting.default
          : (parsed.settings[setting.id] ?? setting.default),
      ]),
    ),
  }
}
