/** Installs the upload queue cache bridge and active organization lifecycle. */

import type { ReactNode } from 'react'

import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useActiveOrganizationId } from '../organizations/organization-scope-context'
import {
  configureUploadQueue,
  setActiveUploadOrganization,
  shutdownUploadQueue,
} from './queue/upload-queue-lifecycle'
import { UploadBatchNotifications } from './upload-batch-notifications'
import { createUploadCacheAdapter } from './upload-cache'

/** Keeps background uploads alive across route changes within the dashboard shell. */
export function UploadProvider({ children }: { children: ReactNode }) {
  const organizationId = useActiveOrganizationId()
  const queryClient = useQueryClient()

  useEffect(() => {
    const configurationVersion = configureUploadQueue(
      createUploadCacheAdapter(queryClient),
    )
    return () => {
      void shutdownUploadQueue(configurationVersion)
    }
  }, [queryClient])

  useEffect(() => {
    setActiveUploadOrganization(organizationId)
  }, [organizationId])

  return (
    <>
      {children}
      <UploadBatchNotifications />
    </>
  )
}
