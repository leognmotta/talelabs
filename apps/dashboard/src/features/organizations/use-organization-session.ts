import type { OrganizationStatus } from '../../shared/types/auth'

import { ApiError, getMe, useGetMe } from '@talelabs/sdk'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { storeLastOrganizationId } from '../../shared/lib/last-organization'

export function useOrganizationSession({
  isSignedIn,
}: {
  isSignedIn: boolean
}) {
  const [organizationStatus, setOrganizationStatus] = useState<OrganizationStatus>('idle')
  const [activeOrganizationId, setActiveOrganizationId] = useState<string | null>(null)
  const [sessionIsSystemAdmin, setSessionIsSystemAdmin] = useState(false)

  const meQuery = useGetMe({
    query: {
      enabled: isSignedIn && organizationStatus === 'ready',
    },
  })
  const activeWorkspaceId = meQuery.data?.activeOrganizationId ?? activeOrganizationId
  const isSystemAdmin = meQuery.data?.isSystemAdmin ?? sessionIsSystemAdmin
  const hasCheckedOrganization = !isSignedIn
    || organizationStatus === 'ready'
    || organizationStatus === 'missing'
    || organizationStatus === 'error'
  const meQueryStatus = meQuery.isFetching
    ? 'Refreshing'
    : meQuery.isSuccess ? 'Loaded' : 'Idle'

  const organizationMessage = useMemo(() => {
    if (organizationStatus === 'ready')
      return `Active organization: ${activeWorkspaceId}`

    if (organizationStatus === 'missing')
      return 'Create your organization to start using the workspace.'

    if (organizationStatus === 'error')
      return 'Could not verify organization access.'

    return 'Checking organization access...'
  }, [activeWorkspaceId, organizationStatus])

  const refreshOrganizationSession = useCallback(async () => {
    setOrganizationStatus('loading')

    try {
      const body = await getMe()

      setActiveOrganizationId(body.activeOrganizationId)
      setSessionIsSystemAdmin(body.isSystemAdmin)
      storeLastOrganizationId(body.activeOrganizationId)
      setOrganizationStatus('ready')
    }
    catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setOrganizationStatus('missing')
        setActiveOrganizationId(null)
        setSessionIsSystemAdmin(false)
        return
      }

      setOrganizationStatus('error')
      setActiveOrganizationId(null)
      setSessionIsSystemAdmin(false)
    }
  }, [])

  useEffect(() => {
    if (!isSignedIn)
      return

    let isCurrent = true

    async function loadOrganizationSession() {
      if (isCurrent)
        await refreshOrganizationSession()
    }

    void loadOrganizationSession()

    return () => {
      isCurrent = false
    }
  }, [isSignedIn, refreshOrganizationSession])

  function resetOrganizationSession() {
    setActiveOrganizationId(null)
    setSessionIsSystemAdmin(false)
    setOrganizationStatus('idle')
  }

  return {
    activeWorkspaceId,
    hasCheckedOrganization,
    isSystemAdmin,
    meQueryStatus,
    organizationMessage,
    organizationStatus,
    refreshOrganizationSession,
    resetOrganizationSession,
  }
}
