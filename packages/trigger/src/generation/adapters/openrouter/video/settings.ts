import type {
  GenerationModelDefinition,
  NormalizedGenerationRequest,
} from '@talelabs/flows'

import type { OpenRouterVideoRequestProfile } from '@talelabs/openrouter'
import { isGenerationSettingValueValid } from '@talelabs/flows'
import { throwProviderResponseInvalid } from '../../errors.js'
import { assertOnlySettings } from '../shared/request.js'

function enumSetting(
  model: GenerationModelDefinition,
  request: NormalizedGenerationRequest,
  settingId: string,
) {
  const definition = model.settings.find(setting => setting.id === settingId)
  const value = request.settings[settingId]
  if (
    definition?.kind !== 'enum'
    || typeof value !== 'string'
    || !definition.options.some(option => option.value === value)
  ) {
    throwProviderResponseInvalid()
  }
  return value
}

export function openRouterVideoSettings(
  model: GenerationModelDefinition,
  request: NormalizedGenerationRequest,
  profile: OpenRouterVideoRequestProfile,
) {
  assertOnlySettings(request, profile.settingIds)
  for (const settingId of profile.settingIds) {
    const definition = model.settings.find(setting => setting.id === settingId)
    if (
      !definition
      || !isGenerationSettingValueValid(definition, request.settings[settingId])
    ) {
      throwProviderResponseInvalid()
    }
  }
  const duration = Number(enumSetting(model, request, 'durationSeconds'))
  if (!Number.isInteger(duration))
    throwProviderResponseInvalid()
  const resolution = enumSetting(model, request, 'resolution')
  return {
    aspectRatio: enumSetting(model, request, 'aspectRatio'),
    duration,
    generateAudio: profile.generateAudio
      ? request.settings.generateAudio as boolean
      : undefined,
    resolution: resolution === '4k' ? '4K' : resolution,
  }
}
