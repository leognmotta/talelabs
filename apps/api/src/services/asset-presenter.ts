import type { AssetRecord } from '../data/assets.data.js'

import {
  createDownloadUrl,
  TALELABS_PRIVATE_BUCKET,
} from '@talelabs/storage'

function toIso(value: Date | null) {
  return value?.toISOString() ?? null
}

type WireJsonValue
  = | boolean
    | null
    | number
    | string
    | WireJsonValue[]
    | { [key: string]: WireJsonValue }

export function toWireJsonObject(value: unknown): Record<string, WireJsonValue> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return {}

  return JSON.parse(JSON.stringify(value)) as Record<string, WireJsonValue>
}

export function getAssetLifecycle(asset: AssetRecord) {
  if (asset.purgedAt)
    return 'purged' as const
  if (asset.purgeRequestedAt)
    return 'purging' as const
  if (asset.deletedAt)
    return 'archived' as const
  return 'live' as const
}

export interface PresentedAssetTag {
  createdAt: string
  id: string
  name: string
  updatedAt: string
}

export interface AssetPresentationMetadata {
  favorite: boolean
  tags: PresentedAssetTag[]
}

export interface AssetPresentationOptions {
  includeOriginalUrl?: boolean
}

const emptyPresentationMetadata: AssetPresentationMetadata = {
  favorite: false,
  tags: [],
}

export function createAssetThumbnailUrl(asset: Pick<
  AssetRecord,
  'mimeType' | 'storageKey' | 'thumbnailKey' | 'type'
>) {
  if (asset.type !== 'image' && !asset.thumbnailKey)
    return Promise.resolve(null)

  return createDownloadUrl({
    bucket: TALELABS_PRIVATE_BUCKET,
    key: asset.thumbnailKey ?? asset.storageKey,
    responseContentType: asset.thumbnailKey ? 'image/jpeg' : asset.mimeType,
  })
}

export async function presentAsset(
  asset: AssetRecord,
  presentation: AssetPresentationMetadata = emptyPresentationMetadata,
  options: AssetPresentationOptions = {},
) {
  const lifecycle = getAssetLifecycle(asset)
  const canRead = lifecycle === 'live' || lifecycle === 'archived'
  const [url, thumbnailUrl] = canRead
    ? await Promise.all([
        options.includeOriginalUrl === false
          ? Promise.resolve(null)
          : createDownloadUrl({
              bucket: TALELABS_PRIVATE_BUCKET,
              key: asset.storageKey,
              responseContentType: asset.mimeType,
            }),
        createAssetThumbnailUrl(asset),
      ])
    : [null, null]

  return {
    id: asset.id,
    name: asset.name,
    type: asset.type,
    source: asset.source,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes === null ? null : Number(asset.sizeBytes),
    width: asset.width,
    height: asset.height,
    durationSeconds: asset.durationSeconds === null
      ? null
      : Number(asset.durationSeconds),
    folderId: asset.folderId,
    generationJobId: asset.generationJobId,
    outputIndex: asset.outputIndex,
    lifecycle,
    processingState: asset.processingState,
    processingError: asset.processingError,
    favorite: presentation.favorite,
    tags: presentation.tags,
    url,
    thumbnailUrl,
    createdBy: asset.createdBy,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
  }
}

export function presentGenerationProvenance(provenance: NonNullable<
  Awaited<ReturnType<typeof import('../data/assets.data.js')['getAssetDetailRelations']>>['generation']
>) {
  return {
    jobId: provenance.job.id,
    runId: provenance.job.flowRunId,
    mediaType: provenance.job.mediaType,
    provider: provenance.job.provider,
    model: provenance.job.model,
    settings: toWireJsonObject(provenance.job.settings),
    resolvedPrompt: provenance.job.resolvedPrompt,
    creditCost: provenance.job.creditCost,
    sources: provenance.sources.map(source => ({
      ...source,
      snapshot: toWireJsonObject(source.snapshot),
    })),
    inputs: provenance.inputs,
    createdAt: provenance.job.createdAt.toISOString(),
    completedAt: toIso(provenance.job.completedAt),
  }
}
