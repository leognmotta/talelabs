import type { SDKOptions } from '@openrouter/sdk'
import type {
  ChatMessages,
  ChatRequest,
  ChatResult,
  ChatStreamChunk,
  Model,
  ModelsListResponse,
} from '@openrouter/sdk/models'
import process from 'node:process'
import { OpenRouter } from '@openrouter/sdk'

export {
  OpenRouter,
}

export type {
  ChatMessages,
  ChatRequest,
  ChatResult,
  ChatStreamChunk,
  Model,
  ModelsListResponse,
  SDKOptions,
}

export const OPENROUTER_API_KEY_ENV = 'OPENROUTER_API_KEY'
export const OPENROUTER_DEFAULT_APP_CATEGORIES = 'media-generation'
export const OPENROUTER_DEFAULT_APP_TITLE = 'TaleLabs'
export const OPENROUTER_DEFAULT_HTTP_REFERER = 'https://app.talelabs.ai'

export type OpenRouterEnv = Partial<
  Record<
    typeof OPENROUTER_API_KEY_ENV,
    string
  >
>

export type OpenRouterRequestOptions = Parameters<OpenRouter['chat']['send']>[1]

export type OpenRouterClientOptions = Omit<
  SDKOptions,
  'apiKey' | 'appCategories' | 'appTitle' | 'httpReferer'
> & {
  apiKey?: string
  appCategories?: string
  appTitle?: string
  env?: OpenRouterEnv
  httpReferer?: string
}

export type OpenRouterChatOptions = Omit<ChatRequest, 'stream'> & {
  apiKey?: string
  appCategories?: string
  appTitle?: string
  client?: OpenRouter
  env?: OpenRouterEnv
  httpReferer?: string
  requestOptions?: OpenRouterRequestOptions
}

export type OpenRouterStreamingChatOptions = Omit<ChatRequest, 'stream'> & {
  apiKey?: string
  appCategories?: string
  appTitle?: string
  client?: OpenRouter
  env?: OpenRouterEnv
  httpReferer?: string
  requestOptions?: OpenRouterRequestOptions
}

export interface OpenRouterModelListOptions {
  apiKey?: string
  appCategories?: string
  appTitle?: string
  client?: OpenRouter
  env?: OpenRouterEnv
  httpReferer?: string
  inputModalities?: string
  outputModalities?: string
  q?: string
  requestOptions?: Parameters<OpenRouter['models']['list']>[1]
  supportedParameters?: string
}

export function getOpenRouterApiKey(env: OpenRouterEnv = process.env) {
  const apiKey = env[OPENROUTER_API_KEY_ENV]

  if (!apiKey) {
    throw new Error(`${OPENROUTER_API_KEY_ENV} is required to use OpenRouter.`)
  }

  return apiKey
}

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

export async function createChatCompletion(
  options: OpenRouterChatOptions,
): Promise<ChatResult> {
  const {
    apiKey,
    appCategories,
    appTitle,
    client,
    env,
    httpReferer,
    requestOptions,
    ...chatRequest
  } = options
  const openRouter = client ?? createOpenRouterClient({
    apiKey,
    appCategories,
    appTitle,
    env,
    httpReferer,
  })

  return openRouter.chat.send({
    chatRequest: {
      ...chatRequest,
      stream: false,
    },
  }, requestOptions)
}

export async function createStreamingChatCompletion(
  options: OpenRouterStreamingChatOptions,
) {
  const {
    apiKey,
    appCategories,
    appTitle,
    client,
    env,
    httpReferer,
    requestOptions,
    ...chatRequest
  } = options
  const openRouter = client ?? createOpenRouterClient({
    apiKey,
    appCategories,
    appTitle,
    env,
    httpReferer,
  })

  return openRouter.chat.send({
    chatRequest: {
      ...chatRequest,
      stream: true,
    },
  }, requestOptions)
}

export async function listOpenRouterModels(options: OpenRouterModelListOptions = {}) {
  const {
    apiKey,
    appCategories,
    appTitle,
    client,
    env,
    httpReferer,
    requestOptions,
    ...filters
  } = options
  const openRouter = client ?? createOpenRouterClient({
    apiKey,
    appCategories,
    appTitle,
    env,
    httpReferer,
  })

  return openRouter.models.list(filters, requestOptions)
}
