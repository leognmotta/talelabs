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

function optionalEnumSetting(
  request: NormalizedGenerationRequest,
  binding: OpenRouterVideoBinding,
  settingId: string,
) {
  return binding.requestProfile.settingIds.includes(settingId)
    ? enumSetting(request, settingId)
    : undefined
}

/** Maps provider-neutral video settings into OpenRouter request values. */
export function openRouterVideoSettings(
  request: NormalizedGenerationRequest,
  binding: OpenRouterVideoBinding,
) {
  assertOnlySettings(request, binding.requestProfile.settingIds)
  const durationValue = optionalEnumSetting(request, binding, 'durationSeconds')
  const duration = durationValue === undefined ? undefined : Number(durationValue)
  if (duration !== undefined && (!Number.isInteger(duration) || duration <= 0))
    throwProviderResponseInvalid()
  const resolution = optionalEnumSetting(request, binding, 'resolution')
  const generateAudio = binding.requestProfile.generateAudio
    && binding.requestProfile.settingIds.includes('generateAudio')
    ? request.settings.generateAudio
    : undefined
  if (generateAudio !== undefined && typeof generateAudio !== 'boolean')
    throwProviderResponseInvalid()
  return {
    aspectRatio: optionalEnumSetting(request, binding, 'aspectRatio'),
    duration,
    generateAudio,
    resolution: resolution === '4k' ? '4K' : resolution,
  }
}
