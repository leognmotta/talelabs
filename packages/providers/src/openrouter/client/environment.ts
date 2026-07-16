/** Server-only OpenRouter environment lookup for managed SDK utilities. */

import process from 'node:process'

/** Existing platform environment key used by SDK utilities and worker composition. */
export const OPENROUTER_API_KEY_ENV = 'OPENROUTER_API_KEY'
export {
  OPENROUTER_DEFAULT_APP_CATEGORIES,
  OPENROUTER_DEFAULT_APP_TITLE,
  OPENROUTER_DEFAULT_HTTP_REFERER,
} from '../transport/identity.js'

/** Minimal environment shape accepted by explicit SDK helper lookups. */
export type OpenRouterEnv = Partial<
  Record<typeof OPENROUTER_API_KEY_ENV, string>
>

/** Reads the required OpenRouter key for optional direct SDK utilities. */
export function getOpenRouterApiKey(env: OpenRouterEnv = process.env) {
  const apiKey = env[OPENROUTER_API_KEY_ENV]

  if (!apiKey)
    throw new Error(`${OPENROUTER_API_KEY_ENV} is required to use OpenRouter.`)

  return apiKey
}
