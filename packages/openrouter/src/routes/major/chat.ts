import type { GenerationModelContractVersion } from '@talelabs/flows'

import { chatRoutes } from '../builders/chat.js'

export function majorChatRoutes(input: {
  modelContractVersion: GenerationModelContractVersion
  routeVersion: string
}) {
  const definitions = [
    {
      maxImageReferences: 8,
      maxTokensParameter: 'max_completion_tokens',
      nativeModelId: 'openai/gpt-5.5',
      productModelId: 'talelabs/gpt-5.5',
      providerTag: 'azure',
      reasoning: true,
      vision: true,
    },
    {
      maxImageReferences: 8,
      maxTokensParameter: 'max_completion_tokens',
      nativeModelId: 'openai/gpt-5.6-sol',
      productModelId: 'talelabs/gpt-5.6-sol',
      providerTag: 'azure',
      reasoning: true,
      vision: true,
    },
    {
      maxImageReferences: 8,
      nativeModelId: 'anthropic/claude-opus-4.8',
      productModelId: 'talelabs/claude-opus-4.8',
      providerTag: 'anthropic',
      reasoning: true,
      vision: true,
    },
    {
      maxImageReferences: 8,
      nativeModelId: 'anthropic/claude-sonnet-5',
      productModelId: 'talelabs/claude-sonnet-5',
      providerTag: 'anthropic',
      reasoning: true,
      vision: true,
    },
    {
      maxImageReferences: 8,
      nativeModelId: 'google/gemini-3.5-flash',
      productModelId: 'talelabs/gemini-3.5-flash',
      providerTag: 'google-vertex/global',
      reasoning: true,
      vision: true,
    },
    {
      maxImageReferences: 8,
      nativeModelId: 'x-ai/grok-4.5',
      productModelId: 'talelabs/grok-4.5',
      providerTag: 'xai',
      reasoning: true,
      vision: true,
    },
    {
      maxImageReferences: 0,
      nativeModelId: 'deepseek/deepseek-v4-pro',
      productModelId: 'talelabs/deepseek-v4-pro',
      providerTag: 'deepseek',
      reasoning: true,
      vision: false,
    },
    {
      maxImageReferences: 0,
      nativeModelId: 'z-ai/glm-5.2',
      productModelId: 'talelabs/glm-5.2',
      providerTag: 'alibaba',
      reasoning: true,
      vision: false,
    },
    {
      maxImageReferences: 8,
      nativeModelId: 'qwen/qwen3.7-plus',
      productModelId: 'talelabs/qwen3.7-plus',
      providerTag: 'alibaba',
      reasoning: true,
      vision: true,
    },
    {
      maxImageReferences: 8,
      nativeModelId: 'moonshotai/kimi-k2.5',
      productModelId: 'talelabs/kimi-k2.5',
      providerTag: 'moonshotai/int4',
      reasoning: true,
      vision: true,
    },
  ] as const
  return definitions.flatMap(definition => chatRoutes({
    ...definition,
    ...input,
  }))
}
