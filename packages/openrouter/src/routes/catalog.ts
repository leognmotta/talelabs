import type { GenerationModelContractVersion } from '@talelabs/flows'

import { GENERATION_MODEL_CONTRACT_VERSION } from '@talelabs/flows'
import { currentRoutes } from './current/routes.js'
import { currentVideoRoutes } from './current/video.js'
import { historicalMediaRoutes } from './history/media.js'
import { historicalGenerationProviderRoutes } from './history/status.js'
import { majorChatRoutes } from './major/chat.js'
import { majorImageRoutes } from './major/image.js'
import { majorVideoRoutes } from './major/video.js'

export { generationProviderRouteKey } from './validation/identity.js'

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) deepFreeze(child)
  }
  return value
}

export const GENERATION_PROVIDER_ROUTES = deepFreeze([
  ...historicalGenerationProviderRoutes(historicalMediaRoutes()),
  ...historicalGenerationProviderRoutes(currentRoutes({
    modelContractVersion: '2026-07-15.15',
    providerTags: {
      grok: 'x-ai',
      seedance: 'bytedance',
      veo: 'google',
    },
    recraftMaxReferences: 0,
    routeVersion: '2026-07-15.15',
  })),
  ...historicalGenerationProviderRoutes(currentRoutes({
    modelContractVersion: '2026-07-15.16',
    providerTags: {
      grok: 'xai',
      seedance: 'seed',
      veo: 'google-vertex',
    },
    recraftMaxReferences: 0,
    routeVersion: '2026-07-15.16',
  })),
  ...historicalGenerationProviderRoutes(currentRoutes({
    modelContractVersion: '2026-07-15.17',
    providerTags: {
      grok: 'xai',
      seedance: 'seed',
      veo: 'google-vertex',
    },
    recraftMaxReferences: 1,
    routeVersion: '2026-07-15.17',
  })),
  ...historicalGenerationProviderRoutes(currentRoutes({
    modelContractVersion: '2026-07-15.18',
    providerTags: {
      grok: 'xai',
      seedance: 'seed',
      veo: 'google-vertex',
    },
    recraftMaxReferences: 1,
    routeVersion: '2026-07-15.18',
  })),
  ...historicalGenerationProviderRoutes(majorImageRoutes({
    modelContractVersion: '2026-07-15.18',
    routeVersion: '2026-07-15.18',
  })),
  ...historicalGenerationProviderRoutes(majorChatRoutes({
    modelContractVersion: '2026-07-15.18',
    routeVersion: '2026-07-15.18',
  })),
  ...historicalGenerationProviderRoutes(majorVideoRoutes({
    modelContractVersion: '2026-07-15.18',
    routeVersion: '2026-07-15.18',
  })),
  ...historicalGenerationProviderRoutes(currentVideoRoutes({
    modelContractVersion: GENERATION_MODEL_CONTRACT_VERSION,
    providerTags: {
      grok: 'xai',
      seedance: 'seed',
      veo: 'google-vertex',
    },
    routeVersion: '2026-07-15.19',
  })),
  ...historicalGenerationProviderRoutes(majorVideoRoutes({
    modelContractVersion: GENERATION_MODEL_CONTRACT_VERSION,
    routeVersion: '2026-07-15.19',
  })),
  ...currentRoutes({
    modelContractVersion: GENERATION_MODEL_CONTRACT_VERSION,
    providerTags: {
      grok: 'xai',
      seedance: 'seed',
      veo: 'google-vertex',
    },
    recraftMaxReferences: 1,
    routeVersion: '2026-07-15.19',
    streamVideoDelivery: true,
    videoRouteVersion: '2026-07-16.1',
  }),
  ...majorImageRoutes({
    modelContractVersion: GENERATION_MODEL_CONTRACT_VERSION,
    routeVersion: '2026-07-15.19',
  }),
  ...majorChatRoutes({
    modelContractVersion: GENERATION_MODEL_CONTRACT_VERSION,
    routeVersion: '2026-07-15.19',
  }),
  ...majorVideoRoutes({
    modelContractVersion: GENERATION_MODEL_CONTRACT_VERSION,
    routeVersion: '2026-07-16.1',
    streamDelivery: true,
  }),
] as const)

export function getGenerationProviderRoute(input: {
  modelContractVersion: string
  operationId: string
  productModelId: string
}) {
  return GENERATION_PROVIDER_ROUTES.find(route =>
    route.routingStatus === 'current'
    && route.modelContractVersion === input.modelContractVersion
    && route.operationId === input.operationId
    && route.productModelId === input.productModelId,
  )
}

export function getGenerationProviderRouteForSnapshot(input: {
  modelContractVersion: string
  operationId: string
  productModelId: string
  routeVersion: string
}) {
  return GENERATION_PROVIDER_ROUTES.find(route =>
    route.modelContractVersion === input.modelContractVersion
    && route.operationId === input.operationId
    && route.productModelId === input.productModelId
    && route.routeVersion === input.routeVersion,
  )
}

export type AvailableGenerationProviderRouteVersion
  = GenerationModelContractVersion
