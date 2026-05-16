import type { OrganizationStatus } from '../types/auth'

import { Navigate } from 'react-router'

import { SplashScreen } from '../components/splash-screen'
import { CreateOrganizationScreen } from '../screens/create-organization/create-organization-screen'
import { WorkspaceStateScreen } from '../screens/workspace-state/workspace-state-screen'

export function CreateOrganizationRoute({
  hasCheckedOrganization,
  isSignedIn,
  organizationStatus,
  onCreateOrganization,
  onSignOut,
}: {
  hasCheckedOrganization: boolean
  isSignedIn: boolean
  organizationStatus: OrganizationStatus
  onCreateOrganization: (name: string, slug: string) => Promise<string | null>
  onSignOut: () => Promise<void>
}) {
  if (!isSignedIn)
    return <Navigate to="/sign-in" replace />

  if (!hasCheckedOrganization)
    return <SplashScreen message="Opening your workspace" />

  if (organizationStatus === 'ready')
    return <Navigate to="/" replace />

  if (organizationStatus !== 'missing') {
    return (
      <WorkspaceStateScreen
        message="Checking organization access..."
        status={organizationStatus}
        onSignOut={onSignOut}
      />
    )
  }

  return (
    <CreateOrganizationScreen
      onCreateOrganization={onCreateOrganization}
      onSignOut={onSignOut}
    />
  )
}
