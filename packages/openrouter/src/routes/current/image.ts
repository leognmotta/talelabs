import type { GenerationModelContractVersion } from '@talelabs/flows'

import { imageRoute } from '../builders/media.js'

export function currentImageRoutes(input: {
  modelContractVersion: GenerationModelContractVersion
  recraftMaxReferences: 0 | 1
  routeVersion: string
}) {
  const definitions = [
    {
      maxReferences: 14,
      nativeModelId: 'google/gemini-3.1-flash-lite-image',
      productModelId: 'talelabs/nano-banana-2-lite',
      providerTag: 'google-ai-studio',
      settingIds: ['aspectRatio'],
    },
    {
      maxReferences: 14,
      nativeModelId: 'google/gemini-3.1-flash-image',
      productModelId: 'talelabs/nano-banana-2',
      providerTag: 'google-ai-studio',
      settingIds: ['aspectRatio', 'resolution'],
    },
    {
      maxReferences: 14,
      nativeModelId: 'google/gemini-3-pro-image',
      productModelId: 'talelabs/nano-banana-pro',
      providerTag: 'google-ai-studio/global',
      settingIds: ['aspectRatio', 'resolution'],
    },
    {
      maxReferences: 16,
      nativeModelId: 'openai/gpt-image-2',
      productModelId: 'talelabs/gpt-image-2',
      providerTag: 'openai',
      settingIds: ['quality', 'background'],
    },
    {
      maxReferences: 14,
      nativeModelId: 'bytedance-seed/seedream-4.5',
      productModelId: 'talelabs/seedream-4.5',
      providerTag: 'seed',
      settingIds: ['aspectRatio', 'resolution'],
    },
    {
      maxReferences: 8,
      nativeModelId: 'black-forest-labs/flux.2-pro',
      productModelId: 'talelabs/flux-2-pro',
      providerTag: 'black-forest-labs',
      settingIds: ['outputFormat'],
    },
  ] as const
  return [
    ...definitions.flatMap(definition => [
      imageRoute({
        ...definition,
        ...input,
        maxReferences: 0,
        operationId: 'textToImage',
      }),
      imageRoute({ ...definition, ...input, operationId: 'imageToImage' }),
    ]),
    imageRoute({
      ...input,
      maxReferences: 0,
      nativeModelId: 'recraft/recraft-v4.1',
      operationId: 'textToImage',
      productModelId: 'talelabs/recraft-4.1',
      providerTag: 'recraft',
      settingIds: [],
    }),
    ...(input.recraftMaxReferences === 1
      ? [imageRoute({
          ...input,
          maxReferences: input.recraftMaxReferences,
          nativeModelId: 'recraft/recraft-v4.1',
          operationId: 'imageToImage',
          productModelId: 'talelabs/recraft-4.1',
          providerTag: 'recraft',
          settingIds: [],
        })]
      : []),
  ]
}
