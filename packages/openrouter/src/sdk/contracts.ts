import type { OpenRouter, SDKOptions } from '@openrouter/sdk'
import type {
  ChatMessages,
  ChatRequest,
  ChatResult,
  ChatStreamChunk,
  Model,
  ModelsListResponse,
} from '@openrouter/sdk/models'

import type { OpenRouterEnv } from './environment.js'

export type {
  ChatMessages,
  ChatRequest,
  ChatResult,
  ChatStreamChunk,
  Model,
  ModelsListResponse,
  SDKOptions,
}

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

export type OpenRouterStreamingChatOptions = OpenRouterChatOptions

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
