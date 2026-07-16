/** Official OpenRouter SDK client construction and TaleLabs attribution. */

import type { OpenRouterClientOptions } from './contracts.js'

import process from 'node:process'
import { OpenRouter } from '@openrouter/sdk'

import {
  OPENROUTER_DEFAULT_APP_CATEGORIES,
  OPENROUTER_DEFAULT_APP_TITLE,
  OPENROUTER_DEFAULT_HTTP_REFERER,
} from '../transport/identity.js'
import {
  getOpenRouterApiKey,
} from './environment.js'

export { OpenRouter }

/** Returns the stable TaleLabs attribution supplied to OpenRouter SDK calls. */
export function getOpenRouterAttribution() {
  return {
    appCategories: OPENROUTER_DEFAULT_APP_CATEGORIES,
    appTitle: OPENROUTER_DEFAULT_APP_TITLE,
    httpReferer: OPENROUTER_DEFAULT_HTTP_REFERER,
  }
}

/** Creates an attributed official SDK client with explicit or environment auth. */
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
