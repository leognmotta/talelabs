import type { SupportedLocale } from '@talelabs/i18n'
import type { OrganizationStatus } from '../../shared/types/auth'

import { ApiError, getMe, useGetMe } from '@talelabs/sdk'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { storeLastOrganizationId } from '../../shared/lib/last-organization'

export function useOrganizationSession({
  isSignedIn,
}: {
  isSignedIn: boolean
}) {
  const { t } = useTranslation()
  const [organizationStatus, setOrganizationStatus] = useState<OrganizationStatus>('idle')
  const [activeOrganizationId, setActiveOrganizationId] = useState<string | null>(null)
  const [sessionIsSystemAdmin, setSessionIsSystemAdmin] = useState(false)
  const [sessionLocale, setSessionLocale] = useState<SupportedLocale | null | undefined>(
    undefined,
  )

  const meQuery = useGetMe({
    query: {
      enabled: isSignedIn && organizationStatus === 'ready',
    },
  })
  const activeWorkspaceId = activeOrganizationId
    ?? meQuery.data?.activeOrganizationId
    ?? null
  const isSystemAdmin = meQuery.data?.isSystemAdmin ?? sessionIsSystemAdmin
  const accountLocale = meQuery.data ? meQuery.data.user.locale : sessionLocale
  const hasCheckedOrganization = !isSignedIn
    || organizationStatus === 'ready'
    || organizationStatus === 'missing'
    || organizationStatus === 'error'
  const organizationMessage = useMemo(() => {
    if (organizationStatus === 'ready') {
      return t('workspace.activeOrganization', {
        organizationId: activeWorkspaceId,
      })
    }

    if (organizationStatus === 'missing')
      return t('workspace.createToStart')

    if (organizationStatus === 'error')
      return t('workspace.couldNotVerifyAccess')

    return t('workspace.checkingAccess')
  }, [activeWorkspaceId, organizationStatus, t])

  const refreshOrganizationSession = useCallback(async () => {
    setOrganizationStatus('loading')

    try {
      const body = await getMe()

      setActiveOrganizationId(body.activeOrganizationId)
      setSessionIsSystemAdmin(body.isSystemAdmin)
      setSessionLocale(body.user.locale)
      storeLastOrganizationId(body.activeOrganizationId)
      setOrganizationStatus('ready')
    }
    catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setOrganizationStatus('missing')
        setActiveOrganizationId(null)
        setSessionIsSystemAdmin(false)
        setSessionLocale(undefined)
        return
      }

      setOrganizationStatus('error')
      setActiveOrganizationId(null)
      setSessionIsSystemAdmin(false)
      setSessionLocale(undefined)
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
    setSessionLocale(undefined)
    setOrganizationStatus('idle')
  }

  return {
    activeWorkspaceId,
    accountLocale,
    hasCheckedOrganization,
    isSystemAdmin,
    organizationMessage,
    organizationStatus,
    refreshOrganizationSession,
    resetOrganizationSession,
  }
}
