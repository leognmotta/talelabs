/** Terminal batch notifications derived from the global upload Zustand store. */

import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { uploadStore } from './upload-store'
import { isSettledUploadStatus } from './upload.types'

/** Emits one completion or failure toast per settled batch, never per file. */
export function UploadBatchNotifications() {
  const { t } = useTranslation()
  const notifiedRef = useRef(new Set<string>())

  // Per-file progress lives in the global panel. Terminal batch toasts keep a
  // large upload from producing one persistent toast per file.
  useEffect(() => uploadStore.subscribe((state) => {
    for (const batchId of state.batchOrder) {
      const batch = state.batches[batchId]
      if (!batch)
        continue
      const items = batch.itemIds
        .map(id => state.items[id])
        .filter(item => Boolean(item))
      const settled = items.length > 0
        && items.every(item => isSettledUploadStatus(item.status))

      if (!settled) {
        notifiedRef.current.delete(batchId)
        continue
      }
      if (notifiedRef.current.has(batchId))
        continue
      notifiedRef.current.add(batchId)

      const failedCount = items.filter(item => item.status === 'failed').length
      const completedCount = items.filter(item => item.status === 'completed').length
      if (failedCount > 0) {
        toast.error(t('uploads.batchFailed', { count: failedCount }), {
          description: t('uploads.batchFailedDescription'),
          id: `upload:${batchId}`,
        })
      }
      else if (completedCount > 0) {
        toast.success(t('uploads.batchCompleted', { count: completedCount }), {
          id: `upload:${batchId}`,
        })
      }
    }
  }), [t])

  return null
}
