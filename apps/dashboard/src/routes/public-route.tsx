import type { ReactNode } from 'react'
import type { OrganizationStatus } from '../shared/types/auth'

import { Navigate } from 'react-router'
import { SplashScreen } from '../shared/components/splash-screen'

export function PublicRoute({
  children,
  hasCheckedOrganization,
  isSignedIn,
  organizationStatus,
}: {
  children: ReactNode
  hasCheckedOrganization: boolean
  isSignedIn: boolean
  organizationStatus: OrganizationStatus
}) {
  if (!isSignedIn)
    return children

  if (!hasCheckedOrganization)
    return <SplashScreen message="Opening your workspace" />

  if (organizationStatus !== 'ready')
    return <Navigate to="/create-organization" replace />

  return <Navigate to="/" replace />
}
