import { GenerationNodeDataSchemaBase } from '../data/schemas.js'

export function migrateVideoGenerationNodeDataV2(data: unknown) {
  return {
    ...GenerationNodeDataSchemaBase.parse(data),
    prompt: '',
  }
}
