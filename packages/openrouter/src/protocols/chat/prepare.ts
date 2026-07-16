/** Chat request validation and preparation before provider submission. */

import type { NormalizedGenerationRequest } from '@talelabs/flows'
import type { createOpenRouterHttpClient } from '../../transport/client.js'
import type {
  OpenRouterAssetResolver,
  OpenRouterChatBinding,
} from '../../types.js'
import type { OpenRouterImmediatePreparation } from '../immediate-adapter.js'

import { generationProviderError, throwProviderResponseInvalid } from '../../errors.js'
import { createOpenRouterHttpClient as createClient } from '../../transport/client.js'
import { assertRequestMatchesBinding, pinnedOpenRouterProvider } from '../binding.js'
import { assertOnlySettings, inputAssets, requestText } from '../request.js'
import { createOpenRouterChatSubmission } from './execute.js'

const MAX_TOKENS = { long: 8_192, medium: 2_048, short: 512 } as const

function openRouterChatSettings(
  request: NormalizedGenerationRequest,
  binding: OpenRouterChatBinding,
) {
  assertOnlySettings(request, binding.requestProfile.settingIds)
  const responseLength = request.settings.responseLength
  if (typeof responseLength !== 'string')
    throwProviderResponseInvalid()
  const maxTokens = responseLength === 'auto'
    ? undefined
    : MAX_TOKENS[responseLength as keyof typeof MAX_TOKENS]
  if (responseLength !== 'auto' && !maxTokens)
    throwProviderResponseInvalid()
  const reasoningMode = request.settings.reasoningMode
  if (!binding.requestProfile.reasoning)
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

/** Prepares one chat call before the durable spend boundary is crossed. */
export function createOpenRouterChatPreparation(input: {
  binding: OpenRouterChatBinding
  client?: ReturnType<typeof createOpenRouterHttpClient>
  resolveAsset: OpenRouterAssetResolver
}): OpenRouterImmediatePreparation {
  return async (request) => {
    try {
      assertRequestMatchesBinding(request, input.binding, 'chat')
      const settings = openRouterChatSettings(request, input.binding)
      const prompt = requestText(request)
      const instructions = request.textSlots.find(
        slot => slot.slotId === 'instructions',
      )?.resolvedText.trim()
      const references = inputAssets(request, 'imageReferences')
      if (
        references.length > input.binding.requestProfile.maxImageReferences
        || (request.operationId === 'visionToText' && !references.length)
        || (request.operationId === 'textToText' && references.length)
      ) {
        throwProviderResponseInvalid()
      }
      const images = []
      for (const asset of references) {
        if (asset.mediaType !== 'image')
          throwProviderResponseInvalid()
        const resolved = await input.resolveAsset(asset)
        images.push({
          image_url: { url: resolved.signedReadUrl },
          type: 'image_url' as const,
        })
      }
      const messages = [
        ...(instructions
          ? [{ content: instructions, role: 'system' as const }]
          : []),
        {
          content: images.length
            ? [{ text: prompt, type: 'text' as const }, ...images]
            : prompt,
          role: 'user' as const,
        },
      ]
      return createOpenRouterChatSubmission({
        body: {
          ...(settings.maxTokens === undefined
            ? {}
            : { [input.binding.requestProfile.maxTokensParameter]: settings.maxTokens }),
          messages,
          model: input.binding.nativeModelId,
          provider: pinnedOpenRouterProvider(input.binding, true),
          ...(settings.reasoning ? { reasoning: settings.reasoning } : {}),
        },
        client: input.client ?? createClient(),
        endpoint: input.binding.endpoint,
      })
    }
    catch (error) {
      throw generationProviderError(error)
    }
  }
}
