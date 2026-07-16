import type {
  NormalizedGenerationMediaAsset,
  NormalizedGenerationRequest,
  NormalizedGenerationSubmissionContext,
} from '@talelabs/flows'

import type { OpenRouterVideoRequestProfile } from '@talelabs/openrouter'
import type { ResolvedGenerationAsset } from '../../../inputs/asset-resolver.js'
import type { PinnedGenerationProviderRoute } from '../../contracts.js'
import { createOpenRouterHttpClient } from '@talelabs/openrouter'
import { generationProviderError } from '../../errors.js'
import { providerFacts } from '../shared/provider-facts.js'
import { pinnedOpenRouterProvider } from '../shared/provider-routing.js'
import { requestText } from '../shared/request.js'
import { assertOpenRouterRequestMatchesRoute } from '../shared/route-contract.js'
import { resolveOpenRouterVideoInputs } from './inputs.js'
import {
  openRouterVideoCreateSchema,
  openRouterVideoJobId,
  optionalOpenRouterProviderId,
  optionalOpenRouterUsageCost,
} from './response.js'
import { openRouterVideoSettings } from './settings.js'
import {
  logOpenRouterVideoHttpError,
  logOpenRouterVideoSubmission,
} from './telemetry.js'

const VIDEO_SUBMISSION_TIMEOUT_MS = 60_000

export function createOpenRouterVideoPreparation(input: {
  client?: ReturnType<typeof createOpenRouterHttpClient>
  profile: OpenRouterVideoRequestProfile
  resolveAsset: (
    asset: NormalizedGenerationMediaAsset,
  ) => Promise<ResolvedGenerationAsset>
  route: Readonly<PinnedGenerationProviderRoute>
}) {
  return async (
    request: NormalizedGenerationRequest,
    context?: NormalizedGenerationSubmissionContext,
  ) => {
    try {
      const contract = assertOpenRouterRequestMatchesRoute({
        mediaType: 'video',
        request,
        route: input.route,
      })
      const settings = openRouterVideoSettings(
        contract.model,
        request,
        input.profile,
      )
      const videoInputs = await resolveOpenRouterVideoInputs({
        model: contract.model,
        operation: contract.operation,
        profile: input.profile,
        request,
        resolveAsset: input.resolveAsset,
      })
      const provider = pinnedOpenRouterProvider(input.route)
      const client = input.client ?? createOpenRouterHttpClient()
      const body = {
        aspect_ratio: settings.aspectRatio,
        ...(context?.callbackUrl ? { callback_url: context.callbackUrl } : {}),
        duration: settings.duration,
        ...(videoInputs.frameImages.length
          ? { frame_images: videoInputs.frameImages }
          : {}),
        ...(settings.generateAudio === undefined
          ? {}
          : { generate_audio: settings.generateAudio }),
        ...(videoInputs.inputReferences.length
          ? { input_references: videoInputs.inputReferences }
          : {}),
        model: input.route.providerModel,
        prompt: requestText(request),
        ...(provider ? { provider } : {}),
        resolution: settings.resolution,
      }
      return async () => {
        logOpenRouterVideoSubmission({
          duration: settings.duration,
          inputs: videoInputs,
          request,
          resolution: settings.resolution,
          route: input.route,
        })
        try {
          const response = await client.requestJson({
            body,
            method: 'POST',
            path: '/api/v1/videos',
            schema: openRouterVideoCreateSchema,
            timeoutMs: VIDEO_SUBMISSION_TIMEOUT_MS,
          })
          return {
            externalJobId: openRouterVideoJobId(response.value),
            facts: providerFacts({
              generationId:
                optionalOpenRouterProviderId(response.value.generation_id)
                ?? response.generationId,
              providerCostUsd: optionalOpenRouterUsageCost(response.value.usage),
            }),
            pollAfterMs: response.retryAfterMs ?? (context?.callbackUrl ? 30_000 : 5_000),
            status: 'submitted' as const,
          }
        }
        catch (error) {
          logOpenRouterVideoHttpError(error, 'submit')
          throw generationProviderError(error)
        }
      }
    }
    catch (error) {
      throw generationProviderError(error)
    }
  }
}
