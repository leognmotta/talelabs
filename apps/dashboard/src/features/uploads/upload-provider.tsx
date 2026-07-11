import type { ReactNode } from 'react'

import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useActiveOrganizationId } from '../organizations/organization-scope-context'
import { createUploadCacheAdapter } from './upload-cache'
import { uploadManager } from './upload-manager'
import { uploadStore } from './upload-store'
import { isSettledUploadStatus } from './upload.types'

function UploadBatchNotifications() {
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

export function UploadProvider({ children }: { children: ReactNode }) {
  const organizationId = useActiveOrganizationId()
  const queryClient = useQueryClient()

  useEffect(() => {
    const configurationVersion = uploadManager.configure(
      createUploadCacheAdapter(queryClient),
    )
    return () => {
      void uploadManager.shutdown(configurationVersion)
    }
  }, [queryClient])

  useEffect(() => {
    uploadManager.setActiveOrganization(organizationId)
  }, [organizationId])

  return (
    <>
      {children}
      <UploadBatchNotifications />
    </>
  )
}
