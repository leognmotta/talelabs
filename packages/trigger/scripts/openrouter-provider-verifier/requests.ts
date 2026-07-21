/** Provider-neutral request and Asset fixtures for OpenRouter protocol scenarios. */

import type {
  NormalizedGenerationMediaAsset,
  NormalizedGenerationRequest,
} from '@talelabs/flows'
import type {
  CatalogModelRecord,
  CatalogOperation,
} from '@talelabs/models-catalog'

import {
  GENERATION_MODEL_CONTRACT_VERSION,
} from '@talelabs/flows'
import { MODEL_CATALOG } from '@talelabs/models-catalog'
import { defaultSettings } from './settings.js'

/** Minimum catalog route facts needed to build a normalized request fixture. */
export interface ProviderRequestRoute {
  /** Current owning model record. */
  model: CatalogModelRecord
  /** Current operation served by the captured binding. */
  operation: CatalogOperation
}

/** Builds one immutable normalized request matching a catalog route fixture. */
export function providerRequest(input: {
  orderedInputs?: NormalizedGenerationRequest['orderedInputs']
  outputCount?: number
  route: ProviderRequestRoute
  settings?: NormalizedGenerationRequest['settings']
}): NormalizedGenerationRequest {
  return {
    adapterRequestVersion: 3,
    catalogRevision: MODEL_CATALOG.catalogRevision,
    catalogVersion: MODEL_CATALOG.catalogVersion,
    itemKey: 'item-0',
    modelContractVersion: GENERATION_MODEL_CONTRACT_VERSION,
    modelRevision: input.route.model.revision,
    nodeId: 'node-0',
    operationId: input.route.operation.id,
    orderedInputs: input.orderedInputs ?? [],
    outputCount: input.outputCount ?? 1,
    productModelId: input.route.model.id,
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

/** Builds one ordered image Asset input for a target slot. */
export function imageInput(targetSlotId = 'imageReferences'):
NormalizedGenerationRequest['orderedInputs'][number] {
  return mediaInput(targetSlotId, 'image')
}

/** Builds one ordered media Asset input for an exact semantic target slot. */
export function mediaInput(
  targetSlotId: string,
  mediaType: 'audio' | 'image' | 'video',
): NormalizedGenerationRequest['orderedInputs'][number] {
  return {
    edgeId: `edge-${targetSlotId}`,
    items: [{
      assets: [{ assetId: `asset-${mediaType}-${targetSlotId}`, mediaType, order: 0 }],
      dimensions: {},
      itemKey: `item-${mediaType}`,
      text: null,
    }],
    order: 0,
    sourceHandleId: mediaType,
    sourceNodeId: `${mediaType}-node`,
    targetSlotId,
  }
}

/** Resolves a fixture Asset to bounded metadata and a deterministic signed URL. */
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
    providerUrl: `https://signed.invalid/${asset.assetId}`,
    sizeBytes: 1_024 * 1_024,
    width: asset.mediaType === 'audio' ? null : 1_024,
  })
}
