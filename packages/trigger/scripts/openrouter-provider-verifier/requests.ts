import type {
  NormalizedGenerationMediaAsset,
  NormalizedGenerationRequest,
} from '@talelabs/flows'
import type { GenerationProviderRoute } from '@talelabs/openrouter'

import { defaultSettings, pinnedRoute } from './routes.js'

export function providerRequest(input: {
  orderedInputs?: NormalizedGenerationRequest['orderedInputs']
  route: GenerationProviderRoute
  settings?: NormalizedGenerationRequest['settings']
}): NormalizedGenerationRequest {
  const route = pinnedRoute(input.route)
  return {
    adapterRequestVersion: 1,
    itemKey: 'item-0',
    modelContractVersion: route.modelContractVersion,
    nodeId: 'node-0',
    operationId: route.operationId,
    orderedInputs: input.orderedInputs ?? [],
    outputCount: 1,
    productModelId: route.productModelId,
    requestId: 'job-0',
    requestIndex: 0,
    requestPayloadHash: 'a'.repeat(64),
    settings: input.settings ?? defaultSettings(input.route),
    textSlots: [
      {
        parts: [],
        resolvedText: 'Follow the creative brief.',
        slotId: 'instructions',
        source: 'inline',
      },
      {
        parts: [],
        resolvedText: 'A safe verification prompt.',
        slotId: 'prompt',
        source: 'inline',
      },
    ],
  }
}

export function imageInput(targetSlotId = 'imageReferences'):
NormalizedGenerationRequest['orderedInputs'][number] {
  return {
    edgeId: `edge-${targetSlotId}`,
    items: [{
      assets: [{ assetId: 'asset-image', mediaType: 'image', order: 0 }],
      dimensions: {},
      itemKey: 'item-image',
      text: null,
    }],
    order: 0,
    sourceHandleId: 'image',
    sourceNodeId: 'image-node',
    targetSlotId,
  }
}

export function resolvedAsset(asset: NormalizedGenerationMediaAsset) {
  return Promise.resolve({
    assetId: asset.assetId,
    durationSeconds: asset.mediaType === 'image' ? null : 5,
    height: asset.mediaType === 'audio' ? null : 1_024,
    mimeType: asset.mediaType === 'image'
      ? 'image/png'
      : asset.mediaType === 'video'
        ? 'video/mp4'
        : 'audio/mpeg',
    signedReadUrl: `https://signed.invalid/${asset.assetId}`,
    sizeBytes: 1_024 * 1_024,
    width: asset.mediaType === 'audio' ? null : 1_024,
  })
}
