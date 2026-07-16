import type {
  GenerationSettingDefinition,
  GenerationSettingValue,
} from '../registry/index.js'

export function hasGenerationSettingValue(
  setting: GenerationSettingDefinition,
  value: GenerationSettingValue | undefined,
) {
  if (value === undefined)
    return false
  if (setting.kind === 'string')
    return typeof value === 'string' && value.trim().length > 0
  return true
}
