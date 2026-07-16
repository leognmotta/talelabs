import type { NormalizedGenerationRequest } from '@talelabs/flows'
import type { OpenRouterImageRequestProfile } from '@talelabs/openrouter'
import type { PinnedGenerationProviderRoute } from '../../contracts.js'

import { isGenerationSettingValueValid } from '@talelabs/flows'
import { throwProviderResponseInvalid } from '../../errors.js'
import { assertOnlySettings } from '../shared/request.js'
import { assertOpenRouterRequestMatchesRoute } from '../shared/route-contract.js'

const PROVIDER_SETTING_KEYS = {
  aspectRatio: 'aspect_ratio',
  background: 'background',
  outputFormat: 'output_format',
  quality: 'quality',
  resolution: 'resolution',
} as const satisfies Readonly<Record<
  OpenRouterImageRequestProfile['settingIds'][number],
  string
>>

export function providerImageSettings(
  request: NormalizedGenerationRequest,
  route: Readonly<PinnedGenerationProviderRoute>,
  profile: OpenRouterImageRequestProfile,
) {
  const { model } = assertOpenRouterRequestMatchesRoute({
    mediaType: 'image',
    request,
    route,
  })
  assertOnlySettings(request, profile.settingIds)
  return Object.fromEntries(profile.settingIds.map((settingId) => {
    const setting = model.settings.find(candidate => candidate.id === settingId)
    const value = request.settings[settingId]
    if (!setting || !isGenerationSettingValueValid(setting, value))
      throwProviderResponseInvalid()
    return [PROVIDER_SETTING_KEYS[settingId], value]
  }))
}
