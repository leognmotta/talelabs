/**
 * Safe provider metadata normalization and reconciliation.
 *
 */

import type { NormalizedGenerationProviderFacts } from '@talelabs/flows'
import type { createOpenRouterHttpClient } from './transport/client.js'

import { setTimeout as wait } from 'node:timers/promises'
import { z } from 'zod'

const GENERATION_METADATA_DELAYS_MS = [0, 250, 1_000] as const
const GENERATION_METADATA_MAX_BYTES = 64 * 1_024
const GENERATION_METADATA_TIMEOUT_MS = 5_000
const generationMetadataSchema = z.object({
  data: z.object({
    total_cost: z.union([z.number(), z.string()]).nullish(),
    usage: z.union([z.number(), z.string()]).nullish(),
  }).loose(),
}).loose()

/** Normalizes one bounded non-negative provider cost. */
export function safeProviderCost(value: unknown) {
  const numeric = typeof value === 'string' ? Number(value) : value
  return typeof numeric === 'number'
    && Number.isFinite(numeric)
    && numeric >= 0
    && numeric <= 999_999.999_999
    ? numeric
    : undefined
}

/** Builds persistable normalized provider facts. */
export function providerFacts(input: {
  generationId?: null | string
  providerCostUsd?: unknown
}): NormalizedGenerationProviderFacts | undefined {
  const providerCostUsd = safeProviderCost(input.providerCostUsd)
  const candidateGenerationId = input.generationId?.trim() || undefined
  const providerGenerationId
    = candidateGenerationId && candidateGenerationId.length <= 512
      ? candidateGenerationId
      : undefined
  if (providerCostUsd === undefined && providerGenerationId === undefined)
    return undefined
  return {
    ...(providerCostUsd === undefined ? {} : { providerCostUsd }),
    ...(providerGenerationId === undefined ? {} : { providerGenerationId }),
  }
}

/** Queries eventual OpenRouter accounting without affecting output success. */
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
      // Accounting metadata is eventually consistent and non-authoritative.
    }
  }
  return undefined
}
