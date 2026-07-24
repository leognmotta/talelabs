/** Canonical Asset API projection and signed media URL presentation. */

import type { AssetRecord } from '../data/assets.data.js'

import {
  createDownloadUrl,
  getAssetBucket,
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

/** Converts database JSON into the SDK-safe wire representation. */
export function toWireJsonObject(value: unknown): Record<string, WireJsonValue> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return {}

  return JSON.parse(JSON.stringify(value)) as Record<string, WireJsonValue>
}

/** Derives the public Asset lifecycle from archive and purge timestamps. */
export function getAssetLifecycle(asset: AssetRecord) {
  if (asset.purgedAt)
    return 'purged' as const
  if (asset.purgeRequestedAt)
    return 'purging' as const
  if (asset.deletedAt)
    return 'archived' as const
  return 'live' as const
}

/** Public tag metadata attached to one presented Asset. */
export interface PresentedAssetTag {
  /** Tag creation instant serialized as ISO 8601. */
  createdAt: string
  /** Stable tag identity. */
  id: string
  /** User-authored tag label. */
  name: string
  /** Latest tag update instant serialized as ISO 8601. */
  updatedAt: string
}

/** Viewer-specific metadata merged into the canonical Asset projection. */
export interface AssetPresentationMetadata {
  /** Whether the requesting user favorited the Asset. */
  favorite: boolean
  /** Tenant-owned tags currently attached to the Asset. */
  tags: PresentedAssetTag[]
}

/** Optional controls for expensive signed URL generation. */
export interface AssetPresentationOptions {
  /** Whether to include the original-file URL in addition to its thumbnail. */
  includeOriginalUrl?: boolean
}

const emptyPresentationMetadata: AssetPresentationMetadata = {
  favorite: false,
  tags: [],
}

/** Creates a signed image or generated-thumbnail URL when one is available. */
export function createAssetThumbnailUrl(asset: Pick<
  AssetRecord,
  'mimeType' | 'storageKey' | 'thumbnailKey' | 'type' | 'visibility'
>) {
  if (asset.type !== 'image' && !asset.thumbnailKey)
    return Promise.resolve(null)

  return createDownloadUrl({
    bucket: getAssetBucket(asset.visibility),
    key: asset.thumbnailKey ?? asset.storageKey,
    responseContentType: asset.thumbnailKey ? 'image/jpeg' : asset.mimeType,
  })
}

/** Projects one canonical Asset into its public API representation. */
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
              bucket: getAssetBucket(asset.visibility),
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
    visibility: asset.visibility,
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
    projectId: asset.projectId,
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

/** Projects immutable generation provenance into its public API shape. */
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
