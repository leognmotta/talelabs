import type { NormalizedGenerationRequest } from '@talelabs/flows'

import type { OpenRouterSpeechRequestProfile } from '@talelabs/openrouter'
import type { PinnedGenerationProviderRoute } from '../../contracts.js'
import { isGenerationSettingValueValid } from '@talelabs/flows'
import { throwProviderResponseInvalid } from '../../errors.js'
import { assertOnlySettings } from '../shared/request.js'
import { assertOpenRouterRequestMatchesRoute } from '../shared/route-contract.js'

export function openRouterSpeechSettings(
  request: NormalizedGenerationRequest,
  route: Readonly<PinnedGenerationProviderRoute>,
  profile: OpenRouterSpeechRequestProfile,
) {
  const { model } = assertOpenRouterRequestMatchesRoute({
    mediaType: 'audio',
    request,
    route,
  })
  assertOnlySettings(request, profile.settingIds)
  for (const settingId of profile.settingIds) {
    const setting = model.settings.find(candidate => candidate.id === settingId)
    if (
      !setting
      || !isGenerationSettingValueValid(setting, request.settings[settingId])
    ) {
      throwProviderResponseInvalid()
    }
  }
  const voiceValue = request.settings.voice
  const outputFormat = request.settings.outputFormat
  const voice = typeof voiceValue === 'string'
    ? profile.voiceValues[voiceValue]
    : undefined
  if (
    !voice
    || typeof outputFormat !== 'string'
    || !profile.outputFormats.includes(outputFormat as 'mp3')
  ) {
    throwProviderResponseInvalid()
  }
  return { outputFormat: outputFormat as 'mp3', voice }
}
