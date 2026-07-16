/** Image provider execution and response normalization. */

import type { NormalizedGenerationOutput } from '@talelabs/flows'
import type { createOpenRouterHttpClient } from '../../transport/client.js'

import { Buffer } from 'node:buffer'
import { z } from 'zod'
import { generationProviderError, throwProviderResponseInvalid } from '../../errors.js'
import { providerFacts } from '../../provider-facts.js'

const MAX_IMAGE_BYTES = 32 * 1024 * 1024
const MAX_IMAGE_JSON_BYTES = 128 * 1024 * 1024
const IMAGE_REQUEST_TIMEOUT_MS = 5 * 60 * 1_000
const imageResponseSchema = z.object({
  data: z.array(z.object({
    b64_json: z.string().min(4),
    media_type: z.string().optional(),
  }).loose()).min(1).max(10),
  usage: z.object({
    cost: z.union([z.number(), z.string()]).optional(),
  }).loose().optional(),
}).loose()

function decodeOpenRouterImage(value: string) {
  if (
    value.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 4
    || value.length % 4 !== 0
    || !/^[a-z0-9+/]*={0,2}$/i.test(value)
  ) {
    throwProviderResponseInvalid()
  }
  const bytes = Buffer.from(value, 'base64')
  if (!bytes.byteLength || bytes.byteLength > MAX_IMAGE_BYTES)
    throwProviderResponseInvalid()
  return new Uint8Array(bytes)
}

/** Creates the spend-boundary image submission closure. */
export function createOpenRouterImageSubmission(input: {
  body: unknown
  client: ReturnType<typeof createOpenRouterHttpClient>
  endpoint: string
  outputCount: number
}) {
  return async () => {
    try {
      const response = await input.client.requestJson({
        body: input.body,
        maxResponseBytes: MAX_IMAGE_JSON_BYTES,
        method: 'POST',
        path: input.endpoint,
        schema: imageResponseSchema,
        timeoutMs: IMAGE_REQUEST_TIMEOUT_MS,
      })
      if (response.value.data.length !== input.outputCount)
        throwProviderResponseInvalid()
      const outputs: NormalizedGenerationOutput[] = response.value.data.map(
        (image, outputIndex) => {
          const mimeType = image.media_type?.toLowerCase() ?? 'image/png'
          if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType))
            throwProviderResponseInvalid()
          return {
            mediaType: 'image',
            outputIndex,
            payload: {
              bytes: decodeOpenRouterImage(image.b64_json),
              delivery: 'bytes',
              mimeType,
            },
          }
        },
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
