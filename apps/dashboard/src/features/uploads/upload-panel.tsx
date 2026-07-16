import type { UploadItemState } from './upload.types'

import { IconRefresh } from '@tabler/icons-react'
import { Badge } from '@talelabs/ui/components/badge'
import { Button } from '@talelabs/ui/components/button'
import {
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@talelabs/ui/components/sheet'
import { useTranslation } from 'react-i18next'
import { useStore } from 'zustand'
import { UploadItemRow } from './upload-item-row'
import { uploadManager } from './upload-manager'
import { uploadStore } from './upload-store'
import { isActiveUploadStatus } from './upload.types'

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
