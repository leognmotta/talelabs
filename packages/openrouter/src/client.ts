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
export const OPENROUTER_HTTP_REFERER_ENV = 'OPENROUTER_HTTP_REFERER'
export const OPENROUTER_APP_TITLE_ENV = 'OPENROUTER_APP_TITLE'
export const OPENROUTER_APP_CATEGORIES_ENV = 'OPENROUTER_APP_CATEGORIES'

export type OpenRouterEnv = Partial<
  Record<
    | typeof OPENROUTER_API_KEY_ENV
    | typeof OPENROUTER_HTTP_REFERER_ENV
    | typeof OPENROUTER_APP_TITLE_ENV
    | typeof OPENROUTER_APP_CATEGORIES_ENV
    | 'DASHBOARD_URL',
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

export function getOpenRouterAttribution(env: OpenRouterEnv = process.env) {
  return {
    appCategories: env[OPENROUTER_APP_CATEGORIES_ENV],
    appTitle: env[OPENROUTER_APP_TITLE_ENV] ?? 'TaleLabs',
    httpReferer: env[OPENROUTER_HTTP_REFERER_ENV] ?? env.DASHBOARD_URL,
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
  const attribution = getOpenRouterAttribution(env)

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
