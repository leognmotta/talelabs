import type { ThemePreference } from '../shared/lib/theme'
import {
  activateOrganization,
  getMeQueryKey,
  listOrganizationsQueryKey,
} from '@talelabs/sdk'
import { Toaster } from '@talelabs/ui/components/sonner'
import { useQueryClient } from '@tanstack/react-query'
import { parseAsBoolean, useQueryState } from 'nuqs'
import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { toast } from 'sonner'
import { authClient, signOut, useSession } from '../features/auth/auth-client'
import { AuthScreen } from '../features/auth/auth-screen'
import { BoardsScreen } from '../features/boards/boards-screen'
import { BrandDetail } from '../features/brands/brand-detail'
import { BrandEditor } from '../features/brands/brand-editor'
import { BrandIndex } from '../features/brands/brand-index'
import { BrandsLayout } from '../features/brands/brands-layout'
import { CharacterDetail } from '../features/characters/character-detail'
import { CharacterEditor } from '../features/characters/character-editor'
import { CharacterIndex } from '../features/characters/character-index'
import { CharactersLayout } from '../features/characters/characters-layout'
import { clearContextQueries } from '../features/context/context-query-cache'
import {
  defaultCookiePreferences,
  getInitialCookiePreferences,
  hasStoredCookiePreferences,
  storeCookiePreferences,
} from '../features/cookies/cookie-preferences'
import { CookiePreferencesDialog } from '../features/cookies/cookie-preferences-dialog'
import { AcceptInvitationScreen } from '../features/organizations/accept-invitation-screen'
import { CreateOrganizationScreen } from '../features/organizations/create-organization-screen'
import { useOrganizationSession } from '../features/organizations/use-organization-session'
import { ProductDetail } from '../features/products/product-detail'
import { ProductEditor } from '../features/products/product-editor'
import { ProductIndex } from '../features/products/product-index'
import { ProductsLayout } from '../features/products/products-layout'
import { ProjectCreate } from '../features/projects/project-create'
import { ProjectDetail } from '../features/projects/project-detail'
import { ProjectEdit } from '../features/projects/project-edit'
import { ProjectsIndex } from '../features/projects/projects-index'
import { ProjectsLayout } from '../features/projects/projects-layout'
import { DashboardLayout } from '../layouts/dashboard-layout'
import { CreateOrganizationRoute } from '../routes/create-organization-route'
import { ProtectedRoute } from '../routes/protected-route'
import { PublicRoute } from '../routes/public-route'
import { BlankPage } from '../shared/components/blank-page'
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
  const [theme, setTheme] = useState<ThemePreference>(
    getInitialThemePreference,
  )
  const [cookiePreferences, setCookiePreferences] = useState(
    getInitialCookiePreferences,
  )
  const [cookiePreferencesOpen, setCookiePreferencesOpen] = useQueryState(
    'cookies',
    parseAsBoolean,
  )
  const isCookiePreferencesOpen = cookiePreferencesOpen === true
  const isSignedIn = Boolean(session.data?.user)
  const organization = useOrganizationSession({ isSignedIn })

  useEffect(() => {
    if (hasStoredCookiePreferences() || cookiePreferencesOpen === true)
      return

    void setCookiePreferencesOpen(true, { history: 'replace' })
  }, [cookiePreferencesOpen, setCookiePreferencesOpen])

  async function handleAuthenticated() {
    await session.refetch()
  }

  async function handleSignOut() {
    await signOut()
    await clearContextQueries(queryClient)
    clearLastOrganizationId()
    organization.resetOrganizationSession()
    await session.refetch()
  }

  function handleThemeChange(nextTheme: ThemePreference) {
    setTheme(nextTheme)
    storeThemePreference(nextTheme)
  }

  function handleOpenCookiePreferences() {
    setCookiePreferences(getInitialCookiePreferences())
    void setCookiePreferencesOpen(true, { history: 'push' })
  }

  function handleCookiePreferencesOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      handleOpenCookiePreferences()
      return
    }

    if (!hasStoredCookiePreferences()) {
      storeCookiePreferences(defaultCookiePreferences)
      setCookiePreferences(defaultCookiePreferences)
    }

    void setCookiePreferencesOpen(null)
  }

  function handleCookiePreferencesSave() {
    const storedPreferences = storeCookiePreferences(cookiePreferences)
    setCookiePreferences({
      analytics: storedPreferences.analytics,
      essential: true,
      marketing: storedPreferences.marketing,
    })
    void setCookiePreferencesOpen(null)
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
        const message
          = activeResult.error.message ?? 'Could not activate organization.'
        toast.error(message)
        return message
      }
    }

    if (result.data?.id)
      storeLastOrganizationId(result.data.id)

    await clearContextQueries(queryClient)
    await session.refetch()
    await organization.refreshOrganizationSession()
    await queryClient.invalidateQueries({ queryKey: getMeQueryKey() })
    await queryClient.invalidateQueries({
      queryKey: listOrganizationsQueryKey(),
    })
    toast.success('Organization created')
    return null
  }

  async function handleSwitchOrganization(organizationId: string) {
    try {
      await activateOrganization({ organizationId })
    }
    catch (error) {
      const message
        = error instanceof Error
          ? error.message
          : 'Could not switch organization.'
      toast.error(message)
      return message
    }

    storeLastOrganizationId(organizationId)
    await clearContextQueries(queryClient)
    await session.refetch()
    await organization.refreshOrganizationSession()
    await queryClient.invalidateQueries({ queryKey: getMeQueryKey() })
    await queryClient.invalidateQueries({
      queryKey: listOrganizationsQueryKey(),
    })
    toast.success('Organization switched')
    return null
  }

  async function handleInvitationAccepted(organizationId: string) {
    storeLastOrganizationId(organizationId)
    await clearContextQueries(queryClient)
    await session.refetch()
    await organization.refreshOrganizationSession()
    await queryClient.invalidateQueries({ queryKey: getMeQueryKey() })
    await queryClient.invalidateQueries({
      queryKey: listOrganizationsQueryKey(),
    })
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
              <AuthScreen
                initialMode="sign-in"
                onAuthenticated={handleAuthenticated}
              />
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
              <AuthScreen
                initialMode="sign-up"
                onAuthenticated={handleAuthenticated}
              />
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
                currentSessionId={session.data?.session.id}
                email={session.data?.user.email}
                isSystemAdmin={organization.isSystemAdmin}
                name={session.data?.user.name}
                onCreateOrganization={handleCreateOrganization}
                onOpenCookiePreferences={handleOpenCookiePreferences}
                onProfileUpdated={handleAuthenticated}
                onSignOut={handleSignOut}
                onSwitchOrganization={handleSwitchOrganization}
                onThemeChange={handleThemeChange}
                theme={theme}
              />
            </ProtectedRoute>
          )}
        >
          <Route index element={<Navigate to="/generate" replace />} />
          <Route
            path="boards"
            element={(
              <BoardsScreen
                activeOrganizationId={organization.activeWorkspaceId}
                meQueryStatus={organization.meQueryStatus}
                organizationMessage={organization.organizationMessage}
              />
            )}
          />
          <Route path="create" element={<Navigate to="/generate" replace />} />
          <Route path="generate" element={<BlankPage title="Generate" />} />
          <Route path="apps" element={<BlankPage title="Apps" />} />
          <Route path="studio" element={<BlankPage title="Studio" />} />
          <Route path="agent" element={<Navigate to="/assistant" replace />} />
          <Route path="assistant" element={<BlankPage title="Assistant" />} />
          <Route path="characters" element={<CharactersLayout />}>
            <Route index element={<CharacterIndex />} />
            <Route path="new" element={<CharacterEditor />} />
            <Route path=":characterId" element={<CharacterDetail />} />
            <Route path=":characterId/edit" element={<CharacterEditor />} />
          </Route>
          <Route path="brands" element={<BrandsLayout />}>
            <Route index element={<BrandIndex />} />
            <Route path="new" element={<BrandEditor />} />
            <Route path=":brandId" element={<BrandDetail />} />
            <Route path=":brandId/edit" element={<BrandEditor />} />
          </Route>
          <Route path="products" element={<ProductsLayout />}>
            <Route index element={<ProductIndex />} />
            <Route path="new" element={<ProductEditor />} />
            <Route path=":productId" element={<ProductDetail />} />
            <Route path=":productId/edit" element={<ProductEditor />} />
          </Route>
          <Route path="projects" element={<ProjectsLayout />}>
            <Route index element={<ProjectsIndex />} />
            <Route path="new" element={<ProjectCreate />} />
            <Route path=":projectId" element={<ProjectDetail />} />
            <Route path=":projectId/edit" element={<ProjectEdit />} />
          </Route>
          <Route path="assets" element={<BlankPage title="Assets" />} />
          <Route
            path="admin"
            element={
              organization.isSystemAdmin
                ? (
                    <BlankPage title="Admin" />
                  )
                : (
                    <Navigate to="/generate" replace />
                  )
            }
          />
          <Route path="*" element={<Navigate to="/generate" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/generate" replace />} />
      </Routes>
      <Toaster theme={theme} />
      <CookiePreferencesDialog
        onOpenChange={handleCookiePreferencesOpenChange}
        onPreferencesChange={setCookiePreferences}
        onSave={handleCookiePreferencesSave}
        open={isCookiePreferencesOpen}
        preferences={cookiePreferences}
      />
    </>
  )
}
