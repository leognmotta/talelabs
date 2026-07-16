import type { GenerationModelContractVersion } from '@talelabs/flows'

import type {
  GenerationProviderRoute,
  OpenRouterChatRequestProfile,
} from '../contracts.js'
import {
  IMMEDIATE_TEXT_LIFECYCLE,
  OPENROUTER_CHAT_ADAPTER_VERSION,
  OPENROUTER_CHAT_GUIDE_URL,
  OPENROUTER_PROVIDER,
  OPENROUTER_REASONING_URL,
} from '../contracts.js'
import { providerRoute } from './media.js'

export function chatRoutes(input: {
  maxImageReferences: number
  maxTokensParameter?: OpenRouterChatRequestProfile['maxTokensParameter']
  modelContractVersion: GenerationModelContractVersion
  nativeModelId: string
  productModelId: string
  providerTag: string
  reasoning: boolean
  routeVersion: string
  vision: boolean
}): GenerationProviderRoute[] {
  const maxTokensParameter = input.maxTokensParameter ?? 'max_tokens'
  const settingIds = input.reasoning
    ? ['responseLength', 'reasoningMode']
    : ['responseLength']
  const operations = input.vision
    ? (['textToText', 'visionToText'] as const)
    : (['textToText'] as const)
  return operations.map(operationId => providerRoute({
    adapterVersion: OPENROUTER_CHAT_ADAPTER_VERSION,
    lifecycle: IMMEDIATE_TEXT_LIFECYCLE,
    modelContractVersion: input.modelContractVersion,
    operationId,
    outputType: 'text',
    productModelId: input.productModelId,
    providerRoute: {
      endpoint: '/api/v1/chat/completions',
      nativeModelId: input.nativeModelId,
      policy: 'pinned',
      provider: OPENROUTER_PROVIDER,
      providerTag: input.providerTag,
      supportedParameters: [
        maxTokensParameter,
        'messages',
        'model',
        'provider',
        ...(input.reasoning ? ['reasoning'] : []),
      ],
    },
    requestProfile: {
      kind: 'chat',
      maxImageReferences: operationId === 'visionToText'
        ? input.maxImageReferences
        : 0,
      maxTokensParameter,
      reasoning: input.reasoning,
      settingIds,
    },
    routeVersion: input.routeVersion,
    sources: [
      OPENROUTER_CHAT_GUIDE_URL,
      ...(input.reasoning ? [OPENROUTER_REASONING_URL] : []),
      `https://openrouter.ai/${input.nativeModelId}`,
      `https://openrouter.ai/api/v1/models/${input.nativeModelId}/endpoints`,
    ] as [string, ...string[]],
  }))
}
