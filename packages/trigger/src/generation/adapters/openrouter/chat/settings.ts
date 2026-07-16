import type { NormalizedGenerationRequest } from '@talelabs/flows'

import type { OpenRouterChatRequestProfile } from '@talelabs/openrouter'
import type { PinnedGenerationProviderRoute } from '../../contracts.js'
import { isGenerationSettingValueValid } from '@talelabs/flows'
import { throwProviderResponseInvalid } from '../../errors.js'
import { assertOnlySettings } from '../shared/request.js'
import { assertOpenRouterRequestMatchesRoute } from '../shared/route-contract.js'

const MAX_TOKENS = {
  long: 8_192,
  medium: 2_048,
  short: 512,
} as const

export function openRouterChatSettings(
  request: NormalizedGenerationRequest,
  route: Readonly<PinnedGenerationProviderRoute>,
  profile: OpenRouterChatRequestProfile,
) {
  const { model } = assertOpenRouterRequestMatchesRoute({
    mediaType: 'text',
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
  const responseLength = request.settings.responseLength
  if (typeof responseLength !== 'string')
    throwProviderResponseInvalid()
  const maxTokens = responseLength === 'auto'
    ? undefined
    : MAX_TOKENS[responseLength as keyof typeof MAX_TOKENS]
  if (responseLength !== 'auto' && !maxTokens)
    throwProviderResponseInvalid()

  const reasoningMode = request.settings.reasoningMode
  if (!profile.reasoning)
    return { maxTokens, reasoning: undefined }
  if (typeof reasoningMode !== 'string')
    throwProviderResponseInvalid()
  return {
    maxTokens,
    reasoning: reasoningMode === 'auto'
      ? { enabled: true }
      : { effort: reasoningMode === 'off' ? 'none' : reasoningMode },
  }
}
