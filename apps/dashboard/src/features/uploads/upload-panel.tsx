import type { TFunction } from 'i18next'
import type { UploadItemState, UploadStatus } from './upload.types'

import {
  IconAlertCircle,
  IconBan,
  IconCheck,
  IconRefresh,
  IconX,
} from '@tabler/icons-react'
import { Badge } from '@talelabs/ui/components/badge'
import { Button } from '@talelabs/ui/components/button'
import { Progress } from '@talelabs/ui/components/progress'
import {
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@talelabs/ui/components/sheet'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from 'zustand'
import { formatAssetSize } from '../assets/asset-formatters'
import { uploadManager } from './upload-manager'
import { uploadStore } from './upload-store'
import { isActiveUploadStatus } from './upload.types'

const STAGE_KEYS: Record<UploadStatus, string> = {
  canceled: 'uploads.stages.canceled',
  completed: 'uploads.stages.completed',
  failed: 'uploads.stages.failed',
  hashing: 'uploads.stages.hashing',
  linking: 'uploads.stages.linking',
  queued: 'uploads.stages.queued',
  registering: 'uploads.stages.registering',
  uploading: 'uploads.stages.uploading',
}

function getErrorMessage(t: TFunction, item: UploadItemState) {
  if (item.failedStage === 'linking')
    return t('elements.assetLinkFailedDescription')

  const { errorCode } = item
  switch (errorCode) {
    case 'element_asset_role_capacity_reached':
      return t('uploads.errors.elementLimit')
    case 'file_too_large':
      return t('uploads.errors.fileTooLarge')
    case 'folder_creation_failed':
      return t('uploads.errors.folderCreation')
    case 'storage_request_blocked':
      return t('uploads.errors.storageBlocked')
    case 'storage_upload_rejected':
      return t('uploads.errors.storageRejected')
    case 'unsupported_file_type':
      return t('uploads.errors.unsupportedType')
    default:
      return t('uploads.errors.generic')
  }
}

function UploadStatusIcon({ status }: { status: UploadStatus }) {
  if (status === 'completed')
    return <IconCheck className="text-emerald-500" />
  if (status === 'failed')
    return <IconAlertCircle className="text-destructive" />
  if (status === 'canceled')
    return <IconBan className="text-muted-foreground" />
  return (
    <span className="relative flex size-4 items-center justify-center">
      <span className="absolute size-3 animate-ping rounded-full bg-primary/30" />
      <span className="relative size-2 rounded-full bg-primary" />
    </span>
  )
}

function UploadItemRow({ item }: { item: UploadItemState }) {
  const { i18n, t } = useTranslation()
  const percentage = useMemo(
    () => new Intl.NumberFormat(i18n.resolvedLanguage ?? 'en', {
      maximumFractionDigits: 0,
      style: 'percent',
    }).format(item.progress),
    [i18n.resolvedLanguage, item.progress],
  )
  const active = isActiveUploadStatus(item.status)

  return (
    <article className="
      flex flex-col gap-2 border-b px-5 py-4
      last:border-b-0
    "
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center">
          <UploadStatusIcon status={item.status} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{item.filename}</p>
          <div className="
            mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs
            text-muted-foreground
          "
          >
            <span>{t(STAGE_KEYS[item.status] as never)}</span>
            <span aria-hidden="true">·</span>
            <span>{formatAssetSize(item.sizeBytes, i18n.resolvedLanguage ?? 'en')}</span>
            {item.destinationLabel && (
              <>
                <span aria-hidden="true">·</span>
                <span className="truncate">{item.destinationLabel}</span>
              </>
            )}
          </div>
          {item.status === 'failed' && (
            <p className="mt-1 text-xs text-destructive">
              {getErrorMessage(t, item)}
            </p>
          )}
        </div>
        {active && (
          <Button
            aria-label={t('assets.cancelUpload', { name: item.filename })}
            size="icon-xs"
            type="button"
            variant="ghost"
            onClick={() => uploadManager.cancelItem(item.id)}
          >
            <IconX />
          </Button>
        )}
        {item.status === 'failed' && (
          <div className="flex items-center gap-1">
            <Button
              aria-label={t('uploads.retryFile', { name: item.filename })}
              size="xs"
              type="button"
              variant="ghost"
              onClick={() => uploadManager.retryItem(item.id)}
            >
              <IconRefresh data-icon="inline-start" />
              {t('common.retry')}
            </Button>
            <Button
              aria-label={t('uploads.dismissFile', { name: item.filename })}
              size="xs"
              type="button"
              variant="ghost"
              onClick={() => uploadManager.dismissItem(item.id)}
            >
              <IconX data-icon="inline-start" />
              {t('uploads.dismiss')}
            </Button>
          </div>
        )}
      </div>
      {active && (
        <div className="flex items-center gap-3 pl-8">
          <Progress className="flex-1" value={item.progress * 100} />
          <span className="
            w-10 text-right text-xs text-muted-foreground tabular-nums
          "
          >
            {percentage}
          </span>
        </div>
      )}
    </article>
  )
}

export function UploadPanel({ organizationId }: { organizationId: string }) {
  const { t } = useTranslation()
  const batches = useStore(uploadStore, state => state.batchOrder
    .map(id => state.batches[id])
    .filter(batch => batch?.organizationId === organizationId))
  const items = useStore(uploadStore, state => state.items)
  const visibleItems = batches.flatMap(batch => batch.itemIds
    .map(id => items[id])
    .filter((item): item is UploadItemState => Boolean(item)))
  const hasClearable = visibleItems.some(item =>
    item.status === 'completed' || item.status === 'canceled')

  return (
    <SheetContent closeLabel={t('common.close')} className="sm:max-w-md">
      <SheetHeader className="border-b pr-14">
        <div className="flex items-center justify-between gap-3">
          <div>
            <SheetTitle>{t('uploads.title')}</SheetTitle>
            <SheetDescription>{t('uploads.description')}</SheetDescription>
          </div>
          {hasClearable && (
            <Button
              size="sm"
              type="button"
              variant="ghost"
              onClick={() => uploadManager.clearSettled(organizationId)}
            >
              {t('uploads.clearFinished')}
            </Button>
          )}
        </div>
      </SheetHeader>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {batches.length === 0
          ? (
              <div className="
                flex h-full min-h-56 items-center justify-center px-8
                text-center
              "
              >
                <p className="text-sm text-muted-foreground">{t('uploads.empty')}</p>
              </div>
            )
          : batches.map((batch) => {
              const batchItems = batch.itemIds
                .map(id => items[id])
                .filter((item): item is UploadItemState => Boolean(item))
              const active = batchItems.some(item => isActiveUploadStatus(item.status))
              const failed = batchItems.some(item => item.status === 'failed')
              return (
                <section
                  key={batch.id}
                  className="
                    border-b
                    last:border-b-0
                  "
                >
                  <header className="
                    flex items-center justify-between gap-3 bg-muted/35 px-5
                    py-2.5
                  "
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="truncate text-xs font-medium">
                        {batch.kind === 'element'
                          ? t('uploads.elementBatch')
                          : t('uploads.assetBatch')}
                      </p>
                      <Badge variant="outline">{batchItems.length}</Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      {failed && (
                        <Button
                          size="xs"
                          type="button"
                          variant="ghost"
                          onClick={() => uploadManager.retryBatch(batch.id)}
                        >
                          <IconRefresh data-icon="inline-start" />
                          {t('uploads.retryFailed')}
                        </Button>
                      )}
                      {active && (
                        <Button
                          size="xs"
                          type="button"
                          variant="ghost"
                          onClick={() => uploadManager.cancelBatch(batch.id)}
                        >
                          {t('uploads.cancelBatch')}
                        </Button>
                      )}
                    </div>
                  </header>
                  {batchItems.map(item => <UploadItemRow key={item.id} item={item} />)}
                </section>
              )
            })}
      </div>
    </SheetContent>
  )
}
