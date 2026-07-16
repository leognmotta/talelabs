import { z } from 'zod'

import { throwProviderResponseInvalid } from '../../errors.js'

export const openRouterVideoCreateSchema = z
  .object({
    id: z.unknown().optional(),
    polling_url: z.unknown().optional(),
  })
  .passthrough()

export const openRouterVideoStatusSchema = z
  .object({
    status: z.string().min(1),
  })
  .passthrough()

export function optionalOpenRouterProviderId(value: unknown) {
  if (typeof value !== 'string')
    return undefined
  const normalized = value.trim()
  return normalized && normalized.length <= 512 ? normalized : undefined
}

export function optionalOpenRouterUsageCost(value: unknown) {
  if (!value || typeof value !== 'object' || !('cost' in value))
    return undefined
  return value.cost
}

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
    // Invalid provider URLs are intentionally not logged because they may
    // contain customer or credential-bearing query data.
  }
  throwProviderResponseInvalid()
}
