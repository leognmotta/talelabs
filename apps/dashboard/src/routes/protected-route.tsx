import type { ReactNode } from 'react'
import type { OrganizationStatus } from '../organization/types'

import { Navigate } from 'react-router'
import { SplashScreen } from '../components/splash-screen'
import { WorkspaceStateScreen } from '../organization/workspace-state-screen'

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
  if (!isSignedIn)
    return <Navigate to="/sign-in" replace />

  if (!hasCheckedOrganization)
    return <SplashScreen message="Opening your workspace" />

  if (organizationStatus === 'missing')
    return <Navigate to="/create-organization" replace />

  if (organizationStatus !== 'ready') {
    return (
      <WorkspaceStateScreen
        message={organizationMessage}
        status={organizationStatus}
        onSignOut={onSignOut}
      />
    )
  }

  return children
}
