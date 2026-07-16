import process from 'node:process'

export const OPENROUTER_API_KEY_ENV = 'OPENROUTER_API_KEY'
export const OPENROUTER_DEFAULT_APP_CATEGORIES = 'media-generation'
export const OPENROUTER_DEFAULT_APP_TITLE = 'TaleLabs'
export const OPENROUTER_DEFAULT_HTTP_REFERER = 'https://app.talelabs.ai'

export type OpenRouterEnv = Partial<
  Record<typeof OPENROUTER_API_KEY_ENV, string>
>

export function getOpenRouterApiKey(env: OpenRouterEnv = process.env) {
  const apiKey = env[OPENROUTER_API_KEY_ENV]

  if (!apiKey)
    throw new Error(`${OPENROUTER_API_KEY_ENV} is required to use OpenRouter.`)

  return apiKey
}
