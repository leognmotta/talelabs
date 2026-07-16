import type { GenerationModelContractVersion } from '@talelabs/flows'

import { chatRoutes } from '../builders/chat.js'

export function currentChatRoutes(input: {
  modelContractVersion: GenerationModelContractVersion
  routeVersion: string
}) {
  return [
    ...chatRoutes({
      ...input,
      maxImageReferences: 8,
      nativeModelId: 'google/gemini-3.1-flash-lite',
      productModelId: 'talelabs/gemini-3.1-flash-lite',
      providerTag: 'google-vertex/global',
      reasoning: true,
      vision: true,
    }),
    ...chatRoutes({
      ...input,
      maxImageReferences: 8,
      nativeModelId: 'anthropic/claude-sonnet-4.6',
      productModelId: 'talelabs/claude-sonnet-4.6',
      providerTag: 'anthropic',
      reasoning: true,
      vision: true,
    }),
    ...chatRoutes({
      ...input,
      maxImageReferences: 8,
      maxTokensParameter: 'max_completion_tokens',
      nativeModelId: 'openai/gpt-5.4',
      productModelId: 'talelabs/gpt-5.4',
      providerTag: 'azure',
      reasoning: true,
      vision: true,
    }),
    ...chatRoutes({
      ...input,
      maxImageReferences: 8,
      nativeModelId: 'google/gemini-3.1-pro-preview',
      productModelId: 'talelabs/gemini-3.1-pro',
      providerTag: 'google-ai-studio',
      reasoning: true,
      vision: true,
    }),
    ...chatRoutes({
      ...input,
      maxImageReferences: 0,
      nativeModelId: 'deepseek/deepseek-v3.2',
      productModelId: 'talelabs/deepseek-v3.2',
      providerTag: 'streamlake/fp8',
      reasoning: true,
      vision: false,
    }),
    ...chatRoutes({
      ...input,
      maxImageReferences: 8,
      nativeModelId: 'mistralai/mistral-large-2512',
      productModelId: 'talelabs/mistral-large-3',
      providerTag: 'mistral',
      reasoning: false,
      vision: true,
    }),
  ]
}
