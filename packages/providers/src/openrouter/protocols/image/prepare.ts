/** Image request validation and preparation before provider submission. */

import type { OpenRouterHttpClient } from '../../transport/contracts.js'
import type {
  OpenRouterAssetResolver,
  OpenRouterImageBinding,
} from '../../types.js'
import type { OpenRouterImmediatePreparation } from '../immediate-adapter.js'

import { generationProviderError, throwProviderResponseInvalid } from '../../errors.js'
import { assertRequestMatchesBinding, pinnedOpenRouterProvider } from '../binding.js'
import { assertOnlySettings, inputAssets, requestText } from '../request.js'
import { createOpenRouterImageSubmission } from './execute.js'

const PROVIDER_SETTING_KEYS = {
  aspectRatio: 'aspect_ratio',
  background: 'background',
  outputFormat: 'output_format',
  quality: 'quality',
  resolution: 'resolution',
} as const satisfies Readonly<Record<string, string>>

/** Prepares one image call before the durable spend boundary is crossed. */
export function createOpenRouterImagePreparation(input: {
  binding: OpenRouterImageBinding
  client: OpenRouterHttpClient
  resolveAsset: OpenRouterAssetResolver
}): OpenRouterImmediatePreparation {
  return async (request) => {
    try {
      assertRequestMatchesBinding(request, input.binding, 'image')
      assertOnlySettings(request, input.binding.requestProfile.settingIds)
      const settings = Object.fromEntries(
        input.binding.requestProfile.settingIds.map((settingId) => {
          const providerKey = PROVIDER_SETTING_KEYS[
            settingId as keyof typeof PROVIDER_SETTING_KEYS
          ]
          const value = request.settings[settingId]
          if (!providerKey || value === undefined)
            throwProviderResponseInvalid()
          return [providerKey, value]
        }),
      )
      const references: Array<{
        image_url: { url: string }
        type: 'image_url'
      }> = []
      for (const asset of inputAssets(request, 'imageReferences')) {
        if (asset.mediaType !== 'image')
          throwProviderResponseInvalid()
        const resolved = await input.resolveAsset(asset)
        references.push({
          image_url: { url: resolved.providerUrl },
          type: 'image_url',
        })
      }
      if (
        references.length > input.binding.requestProfile.maxReferences
        || (request.operationId === 'imageToImage' && references.length === 0)
        || (request.operationId === 'textToImage' && references.length !== 0)
      ) {
        throwProviderResponseInvalid()
      }
      return createOpenRouterImageSubmission({
        body: {
          ...(references.length ? { input_references: references } : {}),
          model: input.binding.nativeModelId,
          n: request.outputCount,
          prompt: requestText(request),
          provider: pinnedOpenRouterProvider(input.binding),
          ...settings,
        },
        client: input.client,
        endpoint: input.binding.endpoint,
        outputCount: request.outputCount,
      })
    }
    catch (error) {
      throw generationProviderError(error)
    }
  }
}
