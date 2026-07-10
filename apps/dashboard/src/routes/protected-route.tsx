import type { ReactNode } from 'react'
import type { OrganizationStatus } from '../shared/types/auth'

import { useTranslation } from 'react-i18next'
import { Navigate } from 'react-router'
import { WorkspaceState } from '../features/organizations/workspace-state'
import { SplashScreen } from '../shared/components/splash-screen'

export function ProtectedRoute({
  children,
  hasCheckedOrganization,
  isSignedIn,
  organizationMessage,
  organizationStatus,
  onSignOut,
}: {
  children: ReactNode
  hasCheckedOrganization: boolean
  isSignedIn: boolean
  organizationMessage: string
  organizationStatus: OrganizationStatus
  onSignOut: () => Promise<void>
}) {
  const { t } = useTranslation()

  if (!isSignedIn)
    return <Navigate to="/sign-in" replace />

  if (!hasCheckedOrganization)
    return <SplashScreen message={t('workspace.opening')} />

  if (organizationStatus === 'missing')
    return <Navigate to="/create-organization" replace />

  if (organizationStatus !== 'ready') {
    return (
      <WorkspaceState
        message={organizationMessage}
        status={organizationStatus}
        onSignOut={onSignOut}
      />
    )
  }

  return children
}
