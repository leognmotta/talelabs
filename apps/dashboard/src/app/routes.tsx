import type { ThemePreference } from '../shared/lib/theme'
import {
  activateOrganization,
  getMeQueryKey,
  listOrganizationsQueryKey,
} from '@talelabs/sdk'
import { Toaster } from '@talelabs/ui/components/sonner'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { toast } from 'sonner'
import { authClient, signOut, useSession } from '../features/auth/auth-client'
import { AuthScreen } from '../features/auth/auth-screen'
import { GenerationScreen } from '../features/generation/generation-screen'
import { AcceptInvitationScreen } from '../features/organizations/accept-invitation-screen'
import { CreateOrganizationScreen } from '../features/organizations/create-organization-screen'
import { useOrganizationSession } from '../features/organizations/use-organization-session'
import { ProjectsScreen } from '../features/projects/projects-screen'
import { DashboardLayout } from '../layouts/dashboard-layout'
import { CreateOrganizationRoute } from '../routes/create-organization-route'
import { ProtectedRoute } from '../routes/protected-route'
import { PublicRoute } from '../routes/public-route'
import { SplashScreen } from '../shared/components/splash-screen'
import {
  clearLastOrganizationId,
  storeLastOrganizationId,
} from '../shared/lib/last-organization'
import {
  getInitialThemePreference,
  storeThemePreference,
} from '../shared/lib/theme'

export function DashboardRoutes() {
  const session = useSession()
  const queryClient = useQueryClient()
  const [theme, setTheme] = useState<ThemePreference>(getInitialThemePreference)
  const isSignedIn = Boolean(session.data?.user)
  const organization = useOrganizationSession({ isSignedIn })

  async function handleAuthenticated() {
    await session.refetch()
  }

  async function handleSignOut() {
    await signOut()
    clearLastOrganizationId()
    organization.resetOrganizationSession()
    await session.refetch()
  }

  function handleThemeChange(nextTheme: ThemePreference) {
    setTheme(nextTheme)
    storeThemePreference(nextTheme)
  }

  async function handleCreateOrganization(name: string, slug: string) {
    const result = await authClient.organization.create({ name, slug })

    if (result.error) {
      const message = result.error.message ?? 'Could not create organization.'
      toast.error(message)
      return message
    }

    if (result.data?.id) {
      const activeResult = await authClient.organization.setActive({
        organizationId: result.data.id,
      })

      if (activeResult.error) {
        const message = activeResult.error.message
          ?? 'Could not activate organization.'
        toast.error(message)
        return message
      }
    }

    if (result.data?.id)
      storeLastOrganizationId(result.data.id)

    await session.refetch()
    await organization.refreshOrganizationSession()
    await queryClient.invalidateQueries({ queryKey: getMeQueryKey() })
    await queryClient.invalidateQueries({ queryKey: listOrganizationsQueryKey() })
    toast.success('Organization created')
    return null
  }

  async function handleSwitchOrganization(organizationId: string) {
    try {
      await activateOrganization({ organizationId })
    }
    catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'Could not switch organization.'
      toast.error(message)
      return message
    }

    storeLastOrganizationId(organizationId)
    await session.refetch()
    await organization.refreshOrganizationSession()
    await queryClient.invalidateQueries({ queryKey: getMeQueryKey() })
    await queryClient.invalidateQueries({ queryKey: listOrganizationsQueryKey() })
    toast.success('Organization switched')
    return null
  }

  async function handleInvitationAccepted(organizationId: string) {
    storeLastOrganizationId(organizationId)
    await session.refetch()
    await organization.refreshOrganizationSession()
    await queryClient.invalidateQueries({ queryKey: getMeQueryKey() })
    await queryClient.invalidateQueries({ queryKey: listOrganizationsQueryKey() })
  }

  if (session.isPending)
    return <SplashScreen />

  return (
    <>
      <Routes>
        <Route
          path="/sign-in"
          element={(
            <PublicRoute
              hasCheckedOrganization={organization.hasCheckedOrganization}
              isSignedIn={isSignedIn}
              organizationStatus={organization.organizationStatus}
            >
              <AuthScreen initialMode="sign-in" onAuthenticated={handleAuthenticated} />
            </PublicRoute>
          )}
        />
        <Route
          path="/sign-up"
          element={(
            <PublicRoute
              hasCheckedOrganization={organization.hasCheckedOrganization}
              isSignedIn={isSignedIn}
              organizationStatus={organization.organizationStatus}
            >
              <AuthScreen initialMode="sign-up" onAuthenticated={handleAuthenticated} />
            </PublicRoute>
          )}
        />
        <Route
          path="/create-organization"
          element={(
            <CreateOrganizationRoute
              hasCheckedOrganization={organization.hasCheckedOrganization}
              isSignedIn={isSignedIn}
              organizationStatus={organization.organizationStatus}
              onCreateOrganization={handleCreateOrganization}
              onSignOut={handleSignOut}
              screen={CreateOrganizationScreen}
            />
          )}
        />
        <Route
          path="/accept-invitation"
          element={(
            <AcceptInvitationScreen
              isSignedIn={isSignedIn}
              onAccepted={handleInvitationAccepted}
            />
          )}
        />
        <Route
          path="/"
          element={(
            <ProtectedRoute
              hasCheckedOrganization={organization.hasCheckedOrganization}
              isSignedIn={isSignedIn}
              organizationMessage={organization.organizationMessage}
              organizationStatus={organization.organizationStatus}
              onSignOut={handleSignOut}
            >
              <DashboardLayout
                activeOrganizationId={organization.activeWorkspaceId}
                email={session.data?.user.email}
                name={session.data?.user.name}
                onCreateOrganization={handleCreateOrganization}
                onSignOut={handleSignOut}
                onSwitchOrganization={handleSwitchOrganization}
                onThemeChange={handleThemeChange}
                theme={theme}
              />
            </ProtectedRoute>
          )}
        >
          <Route
            index
            element={(
              <ProjectsScreen
                activeOrganizationId={organization.activeWorkspaceId}
                meQueryStatus={organization.meQueryStatus}
                organizationMessage={organization.organizationMessage}
              />
            )}
          />
          <Route
            path="workspace"
            element={(
              <GenerationScreen
                activeOrganizationId={organization.activeWorkspaceId}
              />
            )}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster theme={theme} />
    </>
  )
}
