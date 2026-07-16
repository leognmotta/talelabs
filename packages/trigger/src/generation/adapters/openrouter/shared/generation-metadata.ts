import type { createOpenRouterHttpClient } from '@talelabs/openrouter'

import { setTimeout as wait } from 'node:timers/promises'
import { z } from 'zod'

import { safeProviderCost } from './provider-facts.js'

const GENERATION_METADATA_DELAYS_MS = [0, 250, 1_000] as const
const GENERATION_METADATA_MAX_BYTES = 64 * 1_024
const GENERATION_METADATA_TIMEOUT_MS = 5_000
const generationMetadataSchema = z.object({
  data: z.object({
    total_cost: z.union([z.number(), z.string()]).nullish(),
    usage: z.union([z.number(), z.string()]).nullish(),
  }).passthrough(),
}).passthrough()

/** Queries eventual OpenRouter accounting without making output success depend on it. */
export async function lookupOpenRouterGenerationCost(input: {
  client: ReturnType<typeof createOpenRouterHttpClient>
  delaysMs?: readonly number[]
  generationId: string
  timeoutMs?: number
}) {
  for (const delayMs of input.delaysMs ?? GENERATION_METADATA_DELAYS_MS) {
    if (delayMs > 0)
      await wait(delayMs)
    try {
      const response = await input.client.requestJson({
        maxResponseBytes: GENERATION_METADATA_MAX_BYTES,
        method: 'GET',
        path: `/api/v1/generation?id=${encodeURIComponent(input.generationId)}`,
        schema: generationMetadataSchema,
        timeoutMs: input.timeoutMs ?? GENERATION_METADATA_TIMEOUT_MS,
      })
      const cost = safeProviderCost(
        response.value.data.total_cost ?? response.value.data.usage,
      )
      if (cost !== undefined)
        return cost
    }
    catch {
      // Metadata is eventually consistent and non-authoritative for output success.
    }
  }
  return undefined
}
