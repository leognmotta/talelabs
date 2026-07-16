/** Bounded parsing of untrusted OpenRouter error response bodies. */

import { z } from 'zod'

import { readBoundedOpenRouterBytes } from './body.js'

const errorResponseSchema = z.object({
  error: z.object({
    code: z.union([z.number(), z.string()]).optional(),
    message: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  }).loose(),
}).loose()

/** Extracts only bounded diagnostic fields from an untrusted error body. */
export async function readOpenRouterProviderError(response: Response) {
  const boundedText = (value: unknown) => {
    if (typeof value !== 'string' && typeof value !== 'number')
      return null
    const normalized = String(value).trim()
    return normalized ? normalized.slice(0, 1_000) : null
  }
  try {
    const bytes = await readBoundedOpenRouterBytes(response, 64 * 1024)
    const parsed = errorResponseSchema.safeParse(
      JSON.parse(new TextDecoder().decode(bytes)),
    )
    if (!parsed.success)
      return undefined
    return {
      code: boundedText(parsed.data.error.code),
      message: boundedText(parsed.data.error.message),
    }
  }
  catch {
    return undefined
  }
}
