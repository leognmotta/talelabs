import type { ThemePreference } from './lib/theme'
import { getMeQueryKey } from '@talelabs/sdk'
import { Toaster } from '@talelabs/ui/components/sonner'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { toast } from 'sonner'
import { DashboardLayout } from './components/dashboard-layout'
import { SplashScreen } from './components/splash-screen'
import { useOrganizationSession } from './hooks/use-organization-session'
import { authClient, signOut, useSession } from './lib/auth-client'
import {
  getInitialThemePreference,
  storeThemePreference,
} from './lib/theme'
import { CreateOrganizationRoute } from './routes/create-organization-route'
import { ProtectedRoute } from './routes/protected-route'
import { PublicRoute } from './routes/public-route'
import { AuthScreen } from './screens/auth/auth-screen'
import { DashboardScreen } from './screens/dashboard/dashboard-screen'
import { WorkspaceScreen } from './screens/workspace/workspace-screen'

function App() {
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

    await session.refetch()
    await organization.refreshOrganizationSession()
    await queryClient.invalidateQueries({ queryKey: getMeQueryKey() })
    toast.success('Organization created')
    return null
  }

  async function handleSwitchOrganization(organizationId: string) {
    const result = await authClient.organization.setActive({ organizationId })

    if (result.error) {
      const message = result.error.message ?? 'Could not switch organization.'
      toast.error(message)
      return message
    }

    await session.refetch()
    await organization.refreshOrganizationSession()
    await queryClient.invalidateQueries({ queryKey: getMeQueryKey() })
    toast.success('Organization switched')
    return null
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
              <DashboardScreen
                meQueryStatus={organization.meQueryStatus}
                organizationMessage={organization.organizationMessage}
              />
            )}
          />
          <Route
            path="workspace"
            element={(
              <WorkspaceScreen
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

export default App
