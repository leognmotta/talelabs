/** Type contracts for the optional official OpenRouter SDK client boundary. */

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

/** Per-request options accepted by the official OpenRouter chat SDK. */
export type OpenRouterRequestOptions = Parameters<OpenRouter['chat']['send']>[1]

/** SDK construction options with explicit TaleLabs attribution defaults. */
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

/** Non-streaming chat inputs plus optional client construction overrides. */
export type OpenRouterChatOptions = Omit<ChatRequest, 'stream'> & {
  apiKey?: string
  appCategories?: string
  appTitle?: string
  client?: OpenRouter
  env?: OpenRouterEnv
  httpReferer?: string
  requestOptions?: OpenRouterRequestOptions
}

/** Streaming chat inputs plus optional client construction overrides. */
export type OpenRouterStreamingChatOptions = OpenRouterChatOptions

/** Read-only OpenRouter model-discovery filters and client overrides. */
export interface OpenRouterModelListOptions {
  /** Explicit API key used only by this SDK utility. */
  apiKey?: string
  /** OpenRouter application-category attribution. */
  appCategories?: string
  /** OpenRouter application-title attribution. */
  appTitle?: string
  /** Existing official SDK client to reuse. */
  client?: OpenRouter
  /** Environment source used only when an explicit API key is absent. */
  env?: OpenRouterEnv
  /** OpenRouter HTTP referrer attribution. */
  httpReferer?: string
  /** Optional comma-delimited input-modality filter. */
  inputModalities?: string
  /** Optional comma-delimited output-modality filter. */
  outputModalities?: string
  /** Optional text query sent to model discovery. */
  q?: string
  /** Per-request SDK options for model discovery. */
  requestOptions?: Parameters<OpenRouter['models']['list']>[1]
  /** Optional comma-delimited supported-parameter filter. */
  supportedParameters?: string
}
