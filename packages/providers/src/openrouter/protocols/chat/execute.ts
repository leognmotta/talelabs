/** Chat provider execution and response normalization. */

import type { createOpenRouterHttpClient } from '../../transport/client.js'

import { z } from 'zod'
import { generationProviderError, throwProviderResponseInvalid } from '../../errors.js'
import { providerFacts } from '../../provider-facts.js'

const MAX_CHAT_JSON_BYTES = 16 * 1024 * 1024
const CHAT_REQUEST_TIMEOUT_MS = 10 * 60 * 1_000
const chatResponseSchema = z.object({
  choices: z.array(z.object({
    message: z.object({ content: z.string().min(1) }).loose(),
  }).loose()).min(1),
  id: z.string().optional(),
  usage: z.object({
    cost: z.union([z.number(), z.string()]).optional(),
  }).loose().optional(),
}).loose()

/** Creates the spend-boundary chat submission closure. */
export function createOpenRouterChatSubmission(input: {
  body: unknown
  client: ReturnType<typeof createOpenRouterHttpClient>
  endpoint: string
}) {
  return async () => {
    try {
      const response = await input.client.requestJson({
        body: input.body,
        maxResponseBytes: MAX_CHAT_JSON_BYTES,
        method: 'POST',
        path: input.endpoint,
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
