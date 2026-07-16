import type { ChatResult } from '@openrouter/sdk/models'

import type {
  OpenRouterChatOptions,
  OpenRouterStreamingChatOptions,
} from './contracts.js'
import { createOpenRouterClient } from './client.js'

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
    chatRequest: { ...chatRequest, stream: false },
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
    chatRequest: { ...chatRequest, stream: true },
  }, requestOptions)
}
