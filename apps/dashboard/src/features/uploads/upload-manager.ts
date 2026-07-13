import type { Asset, Folder } from '@talelabs/sdk'
import type { UploadTarget } from './element-upload-target'
import type { UploadCacheAdapter } from './upload-cache'
import type {
  RuntimeUploadBatch,
  RuntimeUploadItem,
} from './upload-runtime'
import type {
  AssetUploadInput,
  EnqueueAssetUploadBatchInput,
  EnqueueElementUploadBatchInput,
  UploadBatchState,
  UploadFailureStage,
  UploadItemState,
} from './upload.types'

import { getApiErrorCode } from '../../shared/lib/api-error'
import {
  AssetUploadError,
  shouldRestartUploadAfterRegistrationError,
  uploadAsset,
} from '../assets/asset-upload'
import {
  assetFolderBatchTargetsFolders,
  prepareAssetFolderBatch,
} from './asset-folder-batch-preparer'
import { linkElementUploadTarget } from './element-upload-target'
import { UploadRuntime } from './upload-runtime'
import { uploadStore } from './upload-store'

const UPLOAD_STAGE_START: Record<'hashing' | 'registering' | 'uploading', number> = {
  hashing: 0,
  uploading: 0.2,
  registering: 0.9,
}

function createId() {
  return crypto.randomUUID()
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

function getUploadErrorCode(error: unknown) {
  if (error instanceof AssetUploadError)
    return error.code
  return getApiErrorCode(error) ?? 'upload_failed'
}

function getFailureStage(status: UploadItemState['status']): UploadFailureStage {
  if (status === 'linking' || status === 'registering' || status === 'uploading')
    return status
  return 'hashing'
}

class UploadManager {
  private activeOrganizationId: null | string = null
  private blockedOrganizations = new Set<string>()
  private cache: null | UploadCacheAdapter = null
  private configurationVersion = 0
  private runningBatchId: null | string = null
  private runningOrganizationId: null | string = null
  private runningPromise: null | Promise<void> = null
  private runtime = new UploadRuntime()
  private scheduled = false

  configure(cache: UploadCacheAdapter) {
    this.cache = cache
    this.configurationVersion += 1
    return this.configurationVersion
  }

  setActiveOrganization(organizationId: null | string) {
    const previousOrganizationId = this.activeOrganizationId
    this.activeOrganizationId = organizationId
    if (organizationId)
      this.blockedOrganizations.delete(organizationId)

    if (previousOrganizationId && previousOrganizationId !== organizationId)
      this.blockAndAbortOrganization(previousOrganizationId)

    this.schedule()
  }

  enqueueAssetBatch(input: EnqueueAssetUploadBatchInput) {
    if (!this.isOrganizationActive(input.organizationId))
      return null
    return this.addBatch({
      destinationLabel: input.destinationLabel,
      files: input.files,
      folders: input.folders,
      kind: 'assets',
      organizationId: input.organizationId,
      parentFolderId: input.parentFolderId,
      toRuntimeTarget: () => ({ kind: 'asset' }),
    })
  }

  enqueueElementBatch(input: EnqueueElementUploadBatchInput) {
    if (!this.isOrganizationActive(input.organizationId))
      return null
    return this.addBatch({
      destinationLabel: input.destinationLabel,
      files: input.files.map(item => ({
        clientId: item.clientId,
        file: item.file,
        relativePath: null,
        target: {
          elementId: input.elementId,
          isPrimary: item.isPrimary,
          kind: 'element' as const,
          role: item.role,
          sortOrder: item.sortOrder,
        },
      })),
      folders: [],
      kind: 'element',
      organizationId: input.organizationId,
      parentFolderId: input.folderId,
      toRuntimeTarget: item => item.target,
    })
  }

  cancelItem(itemId: string) {
    const item = uploadStore.getState().items[itemId]
    if (!item || item.status === 'completed' || item.status === 'canceled')
      return

    this.runtime.abortItem(itemId)
    uploadStore.getState().patchItem(itemId, {
      errorCode: undefined,
      failedStage: undefined,
      status: 'canceled',
    })
    this.runtime.removeItem(itemId)
    this.clearOrphanedRuntimeBatches()
    this.schedule()
  }

  cancelBatch(batchId: string) {
    const batch = uploadStore.getState().batches[batchId]
    if (!batch)
      return

    this.runtime.abortBatch(batchId)
    for (const itemId of batch.itemIds)
      this.cancelItem(itemId)
  }

  async cancelElement(organizationId: string, elementId: string) {
    const state = uploadStore.getState()
    const batchIds = new Set(state.batchOrder.filter((batchId) => {
      const batch = state.batches[batchId]
      return batch?.organizationId === organizationId
        && batch.itemIds.some((itemId) => {
          const item = state.items[itemId]
          return item?.elementId === elementId
            && item.status !== 'completed'
            && item.status !== 'canceled'
        })
    }))
    await this.cancelBatchesAndWait(batchIds)
  }

  async cancelFolders(
    organizationId: string,
    folderIds: Iterable<string>,
  ) {
    const targetFolderIds = new Set(folderIds)
    if (targetFolderIds.size === 0)
      return

    const state = uploadStore.getState()
    const batchIds = new Set(state.batchOrder.filter((batchId) => {
      const visibleBatch = state.batches[batchId]
      const runtimeBatch = this.runtime.batches.get(batchId)
      return visibleBatch?.organizationId === organizationId
        && runtimeBatch !== undefined
        && assetFolderBatchTargetsFolders(runtimeBatch, targetFolderIds)
    }))
    await this.cancelBatchesAndWait(batchIds)
  }

  async cancelOrganization(organizationId: null | string) {
    if (!organizationId)
      return

    this.blockAndAbortOrganization(organizationId)
    const running = this.runningOrganizationId === organizationId
      ? this.runningPromise
      : null
    if (running)
      await Promise.allSettled([running])

    for (const itemId of this.runtime.items.keys()) {
      const item = uploadStore.getState().items[itemId]
      if (item?.organizationId === organizationId)
        this.runtime.removeItem(itemId)
    }
    for (const [batchId, batch] of this.runtime.batches) {
      if (batch.organizationId === organizationId)
        this.runtime.removeBatch(batchId)
    }
  }

  async cancelAll() {
    const organizationIds = new Set(
      Object.values(uploadStore.getState().batches)
        .map(batch => batch.organizationId),
    )
    await Promise.all(Array.from(organizationIds, organizationId =>
      this.cancelOrganization(organizationId)))
  }

  retryItem(itemId: string) {
    const item = uploadStore.getState().items[itemId]
    if (!item || item.status !== 'failed' || !this.runtime.items.has(itemId))
      return
    if (!this.isOrganizationActive(item.organizationId))
      return

    const batch = this.runtime.batches.get(item.batchId)
    if (batch && item.errorCode === 'folder_creation_failed')
      batch.prepared = false
    uploadStore.getState().patchItem(itemId, {
      errorCode: undefined,
      failedStage: undefined,
      progress: item.assetId
        ? 1
        : this.runtime.items.get(itemId)?.registrationUploadId ? 0.9 : 0,
      status: 'queued',
    })
    this.schedule()
  }

  retryBatch(batchId: string) {
    const batch = uploadStore.getState().batches[batchId]
    if (!batch)
      return
    for (const itemId of batch.itemIds)
      this.retryItem(itemId)
  }

  dismissItem(itemId: string) {
    const item = uploadStore.getState().items[itemId]
    if (!item || item.status !== 'failed')
      return

    this.runtime.abortItem(itemId)
    this.runtime.removeItem(itemId)
    uploadStore.getState().removeItems([itemId])
    this.clearOrphanedRuntimeBatches()
  }

  clearSettled(organizationId: string) {
    const state = uploadStore.getState()
    const removedIds = state.itemOrder.filter((id) => {
      const item = state.items[id]
      return item?.organizationId === organizationId
        && (item.status === 'completed' || item.status === 'canceled')
    })
    for (const itemId of removedIds)
      this.runtime.removeItem(itemId)
    state.clearSettled(organizationId)
    this.clearOrphanedRuntimeBatches()
  }

  async shutdown(configurationVersion = this.configurationVersion) {
    if (configurationVersion !== this.configurationVersion)
      return
    this.activeOrganizationId = null
    await this.cancelAll()
    if (configurationVersion !== this.configurationVersion)
      return
    this.runtime.clear()
    uploadStore.getState().clear()
    this.cache = null
  }

  private addBatch<T extends AssetUploadInput | (AssetUploadInput & {
    clientId?: string
    target: Extract<UploadTarget, { kind: 'element' }>
  })>(input: {
    destinationLabel: null | string
    files: T[]
    folders: Folder[]
    kind: UploadBatchState['kind']
    organizationId: string
    parentFolderId: null | string
    toRuntimeTarget: (input: T) => UploadTarget
  },
  ) {
    if (input.files.length === 0)
      return null

    const batchId = createId()
    const itemIds: string[] = []
    const items: UploadItemState[] = input.files.map((entry) => {
      const itemId = 'clientId' in entry && entry.clientId
        ? entry.clientId
        : createId()
      const target = input.toRuntimeTarget(entry)
      itemIds.push(itemId)
      this.runtime.items.set(itemId, {
        file: entry.file,
        lastProgressPercentage: -1,
        target,
      })
      return {
        batchId,
        destinationFolderId: input.parentFolderId,
        destinationLabel: input.destinationLabel,
        elementId: target.kind === 'element' ? target.elementId : undefined,
        filename: entry.file.name,
        id: itemId,
        mimeType: entry.file.type,
        organizationId: input.organizationId,
        progress: 0,
        relativePath: entry.relativePath,
        role: target.kind === 'element' ? target.role : undefined,
        sizeBytes: entry.file.size,
        status: 'queued',
      }
    })
    const batch: UploadBatchState = {
      createdAt: Date.now(),
      destinationLabel: input.destinationLabel,
      id: batchId,
      itemIds,
      kind: input.kind,
      organizationId: input.organizationId,
    }
    this.runtime.batches.set(batchId, {
      controller: new AbortController(),
      folders: input.folders,
      id: batchId,
      organizationId: input.organizationId,
      parentFolderId: input.parentFolderId,
      prepared: input.kind === 'element'
        || items.every(item => item.relativePath === null),
    })
    uploadStore.getState().addBatch(batch, items)
    this.schedule()
    return batchId
  }

  private schedule() {
    if (this.scheduled)
      return
    this.scheduled = true
    queueMicrotask(() => {
      this.scheduled = false
      void this.pump()
    })
  }

  private async pump() {
    if (this.runningPromise)
      return
    const organizationId = this.activeOrganizationId
    if (!organizationId || this.blockedOrganizations.has(organizationId))
      return

    const state = uploadStore.getState()
    const item = state.itemOrder
      .map(id => state.items[id])
      .find(candidate => candidate?.organizationId === organizationId
        && candidate.status === 'queued')
    if (!item)
      return

    const batch = this.runtime.batches.get(item.batchId)
    if (!batch)
      return

    this.runningOrganizationId = organizationId
    this.runningBatchId = batch.id
    this.runningPromise = (batch.prepared
      ? this.processItem(item.id, batch)
      : this.prepareBatch(batch))
      .finally(() => {
        this.runningPromise = null
        this.runningBatchId = null
        this.runningOrganizationId = null
        this.clearOrphanedRuntimeBatches()
        this.schedule()
      })
    await this.runningPromise
  }

  private async prepareBatch(batch: RuntimeUploadBatch) {
    const cache = this.requireCache()
    try {
      await prepareAssetFolderBatch(
        batch,
        cache,
        () => this.assertActive(batch),
      )
    }
    catch (error) {
      if (isAbortError(error) || batch.controller.signal.aborted)
        return
      const itemIds = uploadStore.getState().batches[batch.id]?.itemIds ?? []
      for (const itemId of itemIds) {
        const item = uploadStore.getState().items[itemId]
        if (item?.status === 'queued') {
          uploadStore.getState().patchItem(itemId, {
            errorCode: 'folder_creation_failed',
            failedStage: 'folder',
            status: 'failed',
          })
        }
      }
      console.error('Asset upload folder preparation failed.', {
        batchId: batch.id,
        error,
      })
    }
  }

  private async processItem(itemId: string, batch: RuntimeUploadBatch) {
    const runtime = this.runtime.items.get(itemId)
    const initialItem = uploadStore.getState().items[itemId]
    if (!runtime || !initialItem)
      return

    const controller = new AbortController()
    const abortItem = () => controller.abort()
    batch.controller.signal.addEventListener('abort', abortItem, { once: true })
    this.runtime.itemControllers.set(itemId, controller)

    try {
      this.assertActive(batch, controller.signal)
      let assetId = initialItem.assetId
      const recoveringElementLink = Boolean(
        runtime.target.kind === 'element'
        && (assetId || runtime.registrationUploadId),
      )
      if (!assetId) {
        const asset = await uploadAsset({
          elementId: runtime.target.kind === 'element'
            ? runtime.target.elementId
            : undefined,
          file: runtime.file,
          folderId: initialItem.destinationFolderId,
          isPrimary: runtime.target.kind === 'element'
            ? runtime.target.isPrimary
            : undefined,
          organizationId: batch.organizationId,
          registrationUploadId: runtime.registrationUploadId,
          role: runtime.target.kind === 'element'
            ? runtime.target.role
            : undefined,
          signal: controller.signal,
          sortOrder: runtime.target.kind === 'element'
            ? runtime.target.sortOrder
            : undefined,
          onProgress: progress => this.updateProgress(itemId, runtime, progress),
          onRegistrationReady: (uploadId) => {
            runtime.registrationUploadId = uploadId
          },
          onStageChange: status => uploadStore.getState().patchItem(itemId, {
            progress: Math.max(
              uploadStore.getState().items[itemId]?.progress ?? 0,
              UPLOAD_STAGE_START[status],
            ),
            status,
          }),
        })
        this.assertActive(batch, controller.signal)
        assetId = asset.id
        uploadStore.getState().patchItem(itemId, { assetId, progress: 1 })
        await this.refreshRegisteredAsset(batch, asset)
        this.assertActive(batch, controller.signal)
        if (runtime.target.kind === 'element') {
          await this.refreshElement(
            batch,
            runtime.target.elementId,
            asset.id,
          )
          this.assertActive(batch, controller.signal)
        }
      }

      // Existing Asset IDs and retried registration grants may predate atomic
      // registration or a response may have been lost after commit. Reconcile
      // only those recovery paths; fresh uploads were linked by POST /assets.
      if (runtime.target.kind === 'element' && recoveringElementLink) {
        uploadStore.getState().patchItem(itemId, {
          progress: 1,
          status: 'linking',
        })
        await linkElementUploadTarget(
          runtime.target,
          assetId,
          batch.organizationId,
          controller.signal,
        )
        this.assertActive(batch, controller.signal)
        await this.refreshElement(batch, runtime.target.elementId, assetId)
        this.assertActive(batch, controller.signal)
      }

      uploadStore.getState().patchItem(itemId, {
        errorCode: undefined,
        failedStage: undefined,
        progress: 1,
        status: 'completed',
      })
      this.runtime.removeItem(itemId)
    }
    catch (error) {
      const current = uploadStore.getState().items[itemId]
      if (
        current?.status === 'canceled'
        || controller.signal.aborted
        || batch.controller.signal.aborted
        || isAbortError(error)
        || !this.isOrganizationActive(batch.organizationId)
      ) {
        uploadStore.getState().patchItem(itemId, {
          errorCode: undefined,
          failedStage: undefined,
          status: 'canceled',
        })
        this.runtime.removeItem(itemId)
        return
      }

      if (shouldRestartUploadAfterRegistrationError(error))
        runtime.registrationUploadId = undefined

      uploadStore.getState().patchItem(itemId, {
        errorCode: getUploadErrorCode(error),
        failedStage: getFailureStage(current?.status ?? 'queued'),
        status: 'failed',
      })
      console.error('Asset upload pipeline failed.', {
        error,
        filename: current?.filename,
        itemId,
        status: current?.status,
      })
    }
    finally {
      batch.controller.signal.removeEventListener('abort', abortItem)
      this.runtime.removeItemController(itemId)
      this.clearOrphanedRuntimeBatches()
    }
  }

  private updateProgress(itemId: string, runtime: RuntimeUploadItem, progress: number) {
    const normalized = Math.min(Math.max(progress, 0), 1)
    const percentage = Math.round(normalized * 100)
    if (percentage === runtime.lastProgressPercentage)
      return
    runtime.lastProgressPercentage = percentage
    uploadStore.getState().patchItem(itemId, { progress: normalized })
  }

  private async refreshRegisteredAsset(batch: RuntimeUploadBatch, asset: Asset) {
    if (!this.cache || !this.isOrganizationActive(batch.organizationId))
      return
    try {
      await this.cache.assetRegistered(batch.organizationId, asset)
    }
    catch (error) {
      console.error('Registered Asset cache refresh failed.', {
        assetId: asset.id,
        error,
        organizationId: batch.organizationId,
      })
    }
  }

  private async refreshElement(
    batch: RuntimeUploadBatch,
    elementId: string,
    assetId: string,
  ) {
    if (!this.cache || !this.isOrganizationActive(batch.organizationId))
      return
    try {
      await this.cache.elementLinked(batch.organizationId, elementId, assetId)
    }
    catch (error) {
      console.error('Element Asset cache refresh failed.', {
        elementId,
        error,
        organizationId: batch.organizationId,
      })
    }
  }

  private assertActive(batch: RuntimeUploadBatch, itemSignal?: AbortSignal) {
    if (
      batch.controller.signal.aborted
      || itemSignal?.aborted
      || !this.isOrganizationActive(batch.organizationId)
    ) {
      throw new DOMException('Upload canceled', 'AbortError')
    }
  }

  private isOrganizationActive(organizationId: string) {
    return this.activeOrganizationId === organizationId
      && !this.blockedOrganizations.has(organizationId)
  }

  private requireCache() {
    if (!this.cache)
      throw new Error('The upload cache adapter is not configured.')
    return this.cache
  }

  private async cancelBatchesAndWait(batchIds: ReadonlySet<string>) {
    if (batchIds.size === 0)
      return

    const running = this.runningBatchId && batchIds.has(this.runningBatchId)
      ? this.runningPromise
      : null
    for (const batchId of batchIds)
      this.cancelBatch(batchId)
    if (running)
      await Promise.allSettled([running])
  }

  private blockAndAbortOrganization(organizationId: string) {
    this.blockedOrganizations.add(organizationId)
    for (const batch of this.runtime.batches.values()) {
      if (batch.organizationId === organizationId)
        batch.controller.abort()
    }

    const state = uploadStore.getState()
    const itemIds = state.itemOrder.filter((id) => {
      const item = state.items[id]
      return item?.organizationId === organizationId
        && !['canceled', 'completed'].includes(item.status)
    })
    for (const itemId of itemIds) {
      this.runtime.itemControllers.get(itemId)?.abort()
      state.patchItem(itemId, {
        errorCode: undefined,
        failedStage: undefined,
        status: 'canceled',
      })
    }
  }

  private clearOrphanedRuntimeBatches() {
    const state = uploadStore.getState()
    for (const batchId of this.runtime.batches.keys()) {
      const visibleBatch = state.batches[batchId]
      const hasRuntimeItems = visibleBatch?.itemIds.some(id =>
        this.runtime.items.has(id)) ?? false
      if (!hasRuntimeItems && !this.runningPromise)
        this.runtime.removeBatch(batchId)
    }
  }
}

export const uploadManager = new UploadManager()
