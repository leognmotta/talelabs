import type { OpenRouterClientOptions } from './contracts.js'

import process from 'node:process'
import { OpenRouter } from '@openrouter/sdk'

import {
  getOpenRouterApiKey,
  OPENROUTER_DEFAULT_APP_CATEGORIES,
  OPENROUTER_DEFAULT_APP_TITLE,
  OPENROUTER_DEFAULT_HTTP_REFERER,
} from './environment.js'

export { OpenRouter }

export function getOpenRouterAttribution() {
  return {
    appCategories: OPENROUTER_DEFAULT_APP_CATEGORIES,
    appTitle: OPENROUTER_DEFAULT_APP_TITLE,
    httpReferer: OPENROUTER_DEFAULT_HTTP_REFERER,
  }
}

export function createOpenRouterClient(options: OpenRouterClientOptions = {}) {
  const {
    apiKey,
    appCategories,
    appTitle,
    env = process.env,
    httpReferer,
    ...sdkOptions
  } = options
  const attribution = getOpenRouterAttribution()

  return new OpenRouter({
    ...sdkOptions,
    apiKey: apiKey ?? getOpenRouterApiKey(env),
    appCategories: appCategories ?? attribution.appCategories,
    appTitle: appTitle ?? attribution.appTitle,
    httpReferer: httpReferer ?? attribution.httpReferer,
  })
}
