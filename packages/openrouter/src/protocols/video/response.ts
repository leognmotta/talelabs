/**
 * Runtime response schemas and IDs for OpenRouter video jobs.
 *
 */

import { z } from 'zod'
import { throwProviderResponseInvalid } from '../../errors.js'

/** Permissive create schema; semantic IDs are validated separately. */
export const openRouterVideoCreateSchema = z.object({
  id: z.unknown().optional(),
  polling_url: z.unknown().optional(),
}).loose()

/** Permissive status schema with one required normalized status. */
export const openRouterVideoStatusSchema = z.object({
  status: z.string().min(1),
}).loose()

/** Normalizes one bounded provider generation identifier. */
export function optionalOpenRouterProviderId(value: unknown) {
  if (typeof value !== 'string')
    return undefined
  const normalized = value.trim()
  return normalized && normalized.length <= 512 ? normalized : undefined
}

/** Extracts the provider's untrusted usage cost for later normalization. */
export function optionalOpenRouterUsageCost(value: unknown) {
  if (!value || typeof value !== 'object' || !('cost' in value))
    return undefined
  return value.cost
}

/** Resolves a create response ID without accepting foreign polling origins. */
export function openRouterVideoJobId(
  value: z.infer<typeof openRouterVideoCreateSchema>,
) {
  const responseId = optionalOpenRouterProviderId(value.id)
  if (responseId)
    return responseId
  if (typeof value.polling_url !== 'string')
    throwProviderResponseInvalid()
  try {
    const pollingUrl = new URL(value.polling_url, 'https://openrouter.ai')
    if (pollingUrl.origin === 'https://openrouter.ai') {
      const match = pollingUrl.pathname.match(/^\/api\/v1\/videos\/([^/]+)\/?$/)
      const pollingId = match?.[1]
        ? optionalOpenRouterProviderId(decodeURIComponent(match[1]))
        : undefined
      if (pollingId)
        return pollingId
    }
  }
  catch {
    // Provider URLs may contain sensitive query data and are not logged.
  }
  throwProviderResponseInvalid()
}
