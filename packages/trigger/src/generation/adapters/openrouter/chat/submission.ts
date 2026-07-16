import type {
  NormalizedGenerationMediaAsset,
  NormalizedGenerationRequest,
} from '@talelabs/flows'

import type { OpenRouterChatRequestProfile } from '@talelabs/openrouter'
import type { ResolvedGenerationAsset } from '../../../inputs/asset-resolver.js'
import type { PinnedGenerationProviderRoute } from '../../contracts.js'
import { createOpenRouterHttpClient } from '@talelabs/openrouter'
import { z } from 'zod'
import {
  generationProviderError,
  throwProviderResponseInvalid,
} from '../../errors.js'
import { providerFacts } from '../shared/provider-facts.js'
import { pinnedOpenRouterProvider } from '../shared/provider-routing.js'
import { inputAssets, requestText } from '../shared/request.js'
import { openRouterChatSettings } from './settings.js'

const MAX_CHAT_JSON_BYTES = 16 * 1024 * 1024
const CHAT_REQUEST_TIMEOUT_MS = 10 * 60 * 1_000
const chatResponseSchema = z.object({
  choices: z.array(z.object({
    message: z.object({
      content: z.string().min(1),
    }).passthrough(),
  }).passthrough()).min(1),
  id: z.string().optional(),
  usage: z.object({
    cost: z.union([z.number(), z.string()]).optional(),
  }).passthrough().optional(),
}).passthrough()

export function createOpenRouterChatPreparation(input: {
  client?: ReturnType<typeof createOpenRouterHttpClient>
  profile: OpenRouterChatRequestProfile
  resolveAsset: (
    asset: NormalizedGenerationMediaAsset,
  ) => Promise<ResolvedGenerationAsset>
  route: Readonly<PinnedGenerationProviderRoute>
}) {
  return async (request: NormalizedGenerationRequest) => {
    try {
      const settings = openRouterChatSettings(request, input.route, input.profile)
      const prompt = requestText(request)
      const instructions = request.textSlots.find(
        slot => slot.slotId === 'instructions',
      )?.resolvedText.trim()
      const references = inputAssets(request, 'imageReferences')
      if (
        references.length > input.profile.maxImageReferences
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
      const provider = pinnedOpenRouterProvider(input.route, true)
      const client = input.client ?? createOpenRouterHttpClient()
      const body = {
        ...(settings.maxTokens === undefined
          ? {}
          : { [input.profile.maxTokensParameter]: settings.maxTokens }),
        messages,
        model: input.route.providerModel,
        ...(provider ? { provider } : {}),
        ...(settings.reasoning ? { reasoning: settings.reasoning } : {}),
      }
      return async () => {
        try {
          const response = await client.requestJson({
            body,
            maxResponseBytes: MAX_CHAT_JSON_BYTES,
            method: 'POST',
            path: '/api/v1/chat/completions',
            schema: chatResponseSchema,
            timeoutMs: CHAT_REQUEST_TIMEOUT_MS,
          })
          const text = response.value.choices[0]?.message.content.trim()
          if (!text)
            throwProviderResponseInvalid()
          return {
            facts: providerFacts({
              generationId: response.value.id ?? response.generationId,
              providerCostUsd: response.value.usage?.cost,
            }),
            outputs: [{
              mediaType: 'text' as const,
              outputIndex: 0,
              payload: {
                delivery: 'text' as const,
                mimeType: 'text/plain' as const,
                text,
              },
            }],
            status: 'completed' as const,
          }
        }
        catch (error) {
          throw generationProviderError(error)
        }
      }
    }
    catch (error) {
      throw generationProviderError(error)
    }
  }
}
