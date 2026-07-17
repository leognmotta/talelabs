/** Canonical and optimistic Asset projections used by canvas-local uploads. */

import type { Asset, FlowReferenceAsset } from '@talelabs/sdk'

import { getAssetUploadPolicy } from '@talelabs/assets'

/** Reports the browser abort error used when a canvas upload is canceled. */
export function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

/** Projects a canonical Asset into the Flow reference snapshot used by nodes. */
export function toFlowReferenceAsset(asset: Asset): FlowReferenceAsset {
  return {
    createdAt: asset.createdAt,
    durationSeconds: asset.durationSeconds,
    generationModel: null,
    height: asset.height,
    id: asset.id,
    lifecycle: asset.lifecycle,
    mimeType: asset.mimeType,
    name: asset.name,
    processingError: asset.processingError,
    processingState: asset.processingState,
    sizeBytes: asset.sizeBytes,
    source: asset.source,
    visibility: asset.visibility,
    thumbnailUrl: asset.thumbnailUrl,
    type: asset.type,
    url: asset.url,
    width: asset.width,
  }
}

/** Creates the temporary processing reference displayed until upload registration succeeds. */
export function createOptimisticReferenceAsset(
  file: File,
  temporaryAssetId: string,
): FlowReferenceAsset {
  const policy = getAssetUploadPolicy(file.type)
  if (!policy)
    throw new Error(`Unsupported optimistic Asset type: ${file.type}`)

  return {
    createdAt: new Date().toISOString(),
    durationSeconds: null,
    generationModel: null,
    height: null,
    id: temporaryAssetId,
    lifecycle: 'live',
    mimeType: file.type,
    name: file.name,
    processingError: null,
    processingState: 'processing',
    sizeBytes: file.size,
    source: 'upload',
    visibility: 'private',
    thumbnailUrl: null,
    type: policy.type,
    url: null,
    width: null,
  }
}
