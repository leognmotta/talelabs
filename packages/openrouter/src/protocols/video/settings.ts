/**
 * Settings normalization for the OpenRouter video protocol.
 *
 */

import type { NormalizedGenerationRequest } from '@talelabs/flows'
import type { OpenRouterVideoBinding } from '../../types.js'

import { throwProviderResponseInvalid } from '../../errors.js'
import { assertOnlySettings } from '../request.js'

function enumSetting(request: NormalizedGenerationRequest, settingId: string) {
  const value = request.settings[settingId]
  if (typeof value !== 'string' || !value)
    throwProviderResponseInvalid()
  return value
}

/** Maps provider-neutral video settings into OpenRouter request values. */
export function openRouterVideoSettings(
  request: NormalizedGenerationRequest,
  binding: OpenRouterVideoBinding,
) {
  assertOnlySettings(request, binding.requestProfile.settingIds)
  const duration = Number(enumSetting(request, 'durationSeconds'))
  if (!Number.isInteger(duration) || duration <= 0)
    throwProviderResponseInvalid()
  const resolution = enumSetting(request, 'resolution')
  const generateAudio = binding.requestProfile.generateAudio
    ? request.settings.generateAudio
    : undefined
  if (generateAudio !== undefined && typeof generateAudio !== 'boolean')
    throwProviderResponseInvalid()
  return {
    aspectRatio: enumSetting(request, 'aspectRatio'),
    duration,
    generateAudio,
    resolution: resolution === '4k' ? '4K' : resolution,
  }
}
