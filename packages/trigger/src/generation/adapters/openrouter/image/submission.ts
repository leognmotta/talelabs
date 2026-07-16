import type {
  NormalizedGenerationMediaAsset,
  NormalizedGenerationOutput,
  NormalizedGenerationRequest,
} from '@talelabs/flows'

import type { OpenRouterImageRequestProfile } from '@talelabs/openrouter'
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
import {
  decodeOpenRouterImage,
  openRouterImageMimeType,
} from './response.js'
import { providerImageSettings } from './settings.js'

const MAX_IMAGE_JSON_BYTES = 128 * 1024 * 1024
const IMAGE_REQUEST_TIMEOUT_MS = 5 * 60 * 1_000
const imageResponseSchema = z.object({
  data: z.array(z.object({
    b64_json: z.string().min(4),
    media_type: z.string().optional(),
  }).passthrough()).min(1).max(10),
  usage: z.object({
    cost: z.union([z.number(), z.string()]).optional(),
  }).passthrough().optional(),
}).passthrough()

export function createOpenRouterImagePreparation(input: {
  client?: ReturnType<typeof createOpenRouterHttpClient>
  profile: OpenRouterImageRequestProfile
  resolveAsset: (
    asset: NormalizedGenerationMediaAsset,
  ) => Promise<ResolvedGenerationAsset>
  route: Readonly<PinnedGenerationProviderRoute>
}) {
  return async (request: NormalizedGenerationRequest) => {
    try {
      const settings = providerImageSettings(request, input.route, input.profile)
      const references: Array<{
        image_url: { url: string }
        type: 'image_url'
      }> = []
      for (const asset of inputAssets(request, 'imageReferences')) {
        if (asset.mediaType !== 'image')
          throwProviderResponseInvalid()
        const resolved = await input.resolveAsset(asset)
        references.push({
          image_url: { url: resolved.signedReadUrl },
          type: 'image_url',
        })
      }
      if (references.length > input.profile.maxReferences)
        throwProviderResponseInvalid()
      if (request.operationId === 'imageToImage' && references.length === 0)
        throwProviderResponseInvalid()
      if (request.operationId === 'textToImage' && references.length !== 0)
        throwProviderResponseInvalid()
      const provider = pinnedOpenRouterProvider(input.route)
      const client = input.client ?? createOpenRouterHttpClient()
      const body = {
        ...(references.length ? { input_references: references } : {}),
        model: input.route.providerModel,
        n: request.outputCount,
        prompt: requestText(request),
        ...(provider ? { provider } : {}),
        ...settings,
      }
      return async () => {
        try {
          const response = await client.requestJson({
            body,
            maxResponseBytes: MAX_IMAGE_JSON_BYTES,
            method: 'POST',
            path: '/api/v1/images',
            schema: imageResponseSchema,
            timeoutMs: IMAGE_REQUEST_TIMEOUT_MS,
          })
          if (response.value.data.length !== request.outputCount)
            throwProviderResponseInvalid()
          const outputs: NormalizedGenerationOutput[] = response.value.data.map(
            (image, outputIndex) => ({
              mediaType: 'image',
              outputIndex,
              payload: {
                bytes: decodeOpenRouterImage(image.b64_json),
                delivery: 'bytes',
                mimeType: openRouterImageMimeType(image.media_type),
              },
            }),
          )
          return {
            facts: providerFacts({
              generationId: response.generationId,
              providerCostUsd: response.value.usage?.cost,
            }),
            outputs,
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
