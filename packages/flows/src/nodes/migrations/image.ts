import {
  GenerationNodeDataSchemaBase,
  ImageGenerationNodeDataSchemaV2,
  ImageGenerationNodeDataSchemaV6,
} from '../data/schemas.js'
import { addLockedState } from './index.js'

export function migrateImageGenerationNodeDataV2(data: unknown) {
  return addLockedState(ImageGenerationNodeDataSchemaV2.parse(data))
}

export function migrateImageGenerationNodeDataV5(data: unknown) {
  return {
    ...GenerationNodeDataSchemaBase.parse(data),
    prompt: '',
  }
}

export function migrateImageGenerationNodeDataV6(data: unknown) {
  return ImageGenerationNodeDataSchemaV6.parse(data)
}
