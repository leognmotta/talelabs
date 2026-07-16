import type { GenerationModelContractVersion } from '@talelabs/flows'

import { imageRoute } from '../builders/media.js'

export function majorImageRoutes(input: {
  modelContractVersion: GenerationModelContractVersion
  routeVersion: string
}) {
  const definitions = [
    {
      maxReferences: 16,
      nativeModelId: 'openai/gpt-5.4-image-2',
      productModelId: 'talelabs/gpt-5.4-image-2',
      providerTag: 'openai',
      settingIds: ['quality', 'background'],
    },
    {
      maxReferences: 1,
      nativeModelId: 'microsoft/mai-image-2.5',
      productModelId: 'talelabs/mai-image-2.5',
      providerTag: 'azure',
      settingIds: ['aspectRatio'],
    },
    {
      maxReferences: 3,
      nativeModelId: 'x-ai/grok-imagine-image-quality',
      productModelId: 'talelabs/grok-imagine-image-quality',
      providerTag: 'xai',
      settingIds: ['aspectRatio', 'resolution'],
    },
    {
      maxReferences: 8,
      nativeModelId: 'black-forest-labs/flux.2-max',
      productModelId: 'talelabs/flux-2-max',
      providerTag: 'black-forest-labs',
      settingIds: ['outputFormat'],
    },
    {
      maxReferences: 1,
      nativeModelId: 'recraft/recraft-v4.1-pro',
      productModelId: 'talelabs/recraft-4.1-pro',
      providerTag: 'recraft',
      settingIds: [],
    },
  ] as const
  return definitions.flatMap(definition => [
    imageRoute({
      ...definition,
      ...input,
      maxReferences: 0,
      operationId: 'textToImage',
    }),
    imageRoute({ ...definition, ...input, operationId: 'imageToImage' }),
  ])
}
