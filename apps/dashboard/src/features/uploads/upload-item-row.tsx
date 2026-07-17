/** One upload queue item's progress, retry, cancellation, and failure feedback. */

import type { UploadItemState, UploadStatus } from './upload.types'

import { IconRefresh, IconX } from '@tabler/icons-react'
import { Button } from '@talelabs/ui/components/button'
import { Progress } from '@talelabs/ui/components/progress'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { formatAssetSize } from '../assets/media/asset-formatters'
import { cancelUploadItem } from './cancellation/upload-item-cancellation'
import {
  dismissUploadItem,
  retryUploadItem,
} from './queue/upload-queue-recovery'
import { getUploadErrorMessage } from './upload-error-message'
import { UploadStatusIcon } from './upload-item-status'
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

/** Keeps controls available while transfers continue independently of navigation. */
export function UploadItemRow({ item }: { item: UploadItemState }) {
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
              {getUploadErrorMessage(t, item)}
            </p>
          )}
        </div>
        {active && (
          <Button
            aria-label={t('assets.cancelUpload', { name: item.filename })}
            size="icon-xs"
            type="button"
            variant="ghost"
            onClick={() => cancelUploadItem(item.id)}
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
              onClick={() => retryUploadItem(item.id)}
            >
              <IconRefresh data-icon="inline-start" />
              {t('common.retry')}
            </Button>
            <Button
              aria-label={t('uploads.dismissFile', { name: item.filename })}
              size="xs"
              type="button"
              variant="ghost"
              onClick={() => dismissUploadItem(item.id)}
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
