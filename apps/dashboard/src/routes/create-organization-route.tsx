import type { ComponentType } from 'react'
import type { OrganizationStatus } from '../shared/types/auth'

import { useTranslation } from 'react-i18next'
import { Navigate } from 'react-router'

import { WorkspaceState } from '../features/organizations/workspace-state'
import { SplashScreen } from '../shared/components/splash-screen'

export function CreateOrganizationRoute({
  hasCheckedOrganization,
  isSignedIn,
  organizationStatus,
  onCreateOrganization,
  onSignOut,
  screen: Screen,
}: {
  hasCheckedOrganization: boolean
  isSignedIn: boolean
  organizationStatus: OrganizationStatus
  onCreateOrganization: (name: string, slug: string) => Promise<string | null>
  onSignOut: () => Promise<void>
  screen: ComponentType<{
    onCreateOrganization: (name: string, slug: string) => Promise<string | null>
    onSignOut: () => Promise<void>
  }>
}) {
  const { t } = useTranslation()

  if (!isSignedIn)
    return <Navigate to="/sign-in" replace />

  if (!hasCheckedOrganization)
    return <SplashScreen message={t('workspace.opening')} />

  if (organizationStatus === 'ready')
    return <Navigate to="/" replace />

  if (organizationStatus !== 'missing') {
    return (
      <WorkspaceState
        message={t('workspace.checkingAccess')}
        status={organizationStatus}
        onSignOut={onSignOut}
      />
    )
  }

  return (
    <Screen
      onCreateOrganization={onCreateOrganization}
      onSignOut={onSignOut}
    />
  )
}
