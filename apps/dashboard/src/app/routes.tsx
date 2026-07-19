/** Dashboard routing, authenticated session lifecycle, and global preferences. */

import type { LanguagePreference } from '@talelabs/i18n'
import type { ThemePreference } from '../shared/lib/theme'
import { clearUserCredentials } from '@talelabs/providers/browser'
import {
  activateOrganization,
  getMeQueryKey,
  listOrganizationsQueryKey,
  updateAccountPreferences,
} from '@talelabs/sdk'
import { Toaster } from '@talelabs/ui/components/sonner'
import { useQueryClient } from '@tanstack/react-query'
import { parseAsBoolean, useQueryState } from 'nuqs'
import { lazy, Suspense, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, Route, Routes } from 'react-router'
import { toast } from 'sonner'
import { authClient, signOut, useSession } from '../features/auth/auth-client'
import { AuthScreen } from '../features/auth/auth-screen'
import {
  defaultCookiePreferences,
  getInitialCookiePreferences,
  hasStoredCookiePreferences,
  storeCookiePreferences,
} from '../features/cookies/cookie-preferences'
import { CookiePreferencesDialog } from '../features/cookies/cookie-preferences-dialog'
import { clearUserBrowserRunJournal } from '../features/flows/runs/browser-runtime/browser-run-journal'
import { AcceptInvitationScreen } from '../features/organizations/accept-invitation-screen'
import { CreateOrganizationScreen } from '../features/organizations/create-organization-screen'
import {
  invalidateOrganizationProductQueries,
  removeOrganizationProductQueries,
} from '../features/organizations/organization-query-cache'
import { useOrganizationSession } from '../features/organizations/use-organization-session'
import {
  cancelAllUploads,
  cancelOrganizationUploads,
} from '../features/uploads/cancellation/upload-organization-cancellation'
import {
  setActiveUploadOrganization,
} from '../features/uploads/queue/upload-queue-lifecycle'
import { useLanguage } from '../i18n/language-context'
import { DashboardLayout } from '../layouts/dashboard-layout'
import { CreateOrganizationRoute } from '../routes/create-organization-route'
import { ProtectedRoute } from '../routes/protected-route'
import { PublicRoute } from '../routes/public-route'
import { ErrorBoundary } from '../shared/components/error-boundary'
import { ErrorFallback } from '../shared/components/error-fallback'
import { SplashScreen } from '../shared/components/splash-screen'
import { getApiErrorMessage } from '../shared/lib/api-error'
import {
  clearLastOrganizationId,
  storeLastOrganizationId,
} from '../shared/lib/last-organization'
import {
  getInitialThemePreference,
  storeThemePreference,
} from '../shared/lib/theme'

const AssetsScreen = lazy(async () => {
  const module = await import('../features/assets/library/assets-screen')
  return { default: module.AssetsScreen }
})

const FlowsScreen = lazy(async () => {
  const module = await import('../features/flows/browse/flows-screen')
  return { default: module.FlowsScreen }
})

const ElementsScreen = lazy(async () => {
  const module = await import('../features/elements/elements-screen')
  return { default: module.ElementsScreen }
})

const FlowEditorScreen = lazy(async () => {
  const module = await import('../features/flows/editor/flow-editor-screen')
  return { default: module.FlowEditorScreen }
})

/** Composes public and protected routes around the current account session. */
export function DashboardRoutes() {
  const { t } = useTranslation()
  const language = useLanguage()
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
    if (organization.accountLocale === undefined)
      return

    void language.syncAccountLocale(organization.accountLocale)
  }, [language, organization.accountLocale])

  useEffect(() => {
    if (hasStoredCookiePreferences() || cookiePreferencesOpen === true)
      return

    void setCookiePreferencesOpen(true, { history: 'replace' })
  }, [cookiePreferencesOpen, setCookiePreferencesOpen])

  async function handleAuthenticated() {
    await session.refetch()
  }

  async function handleSignOut() {
    await cancelAllUploads()

    const userId = session.data?.user.id
    if (userId) {
      try {
        await clearUserCredentials({ userId })
        await clearUserBrowserRunJournal(userId)
      }
      catch {
        toast.error(t('secureStore.signOutCleanupFailed'))
        return
      }
    }

    await signOut()
    queryClient.clear()
    clearLastOrganizationId()
    organization.resetOrganizationSession()
    await session.refetch()
  }

  function handleThemeChange(nextTheme: ThemePreference) {
    setTheme(nextTheme)
    storeThemePreference(nextTheme)
  }

  async function handleLanguageChange(nextLanguage: LanguagePreference) {
    const previousLanguage = language.preference
    await language.setPreference(nextLanguage)

    try {
      await updateAccountPreferences({
        data: {
          locale: nextLanguage === 'auto' ? null : nextLanguage,
        },
      })
      await queryClient.invalidateQueries({ queryKey: getMeQueryKey() })
    }
    catch {
      await language.setPreference(previousLanguage)
      toast.error(t('settings.couldNotUpdateLanguage'))
    }
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
    const previousOrganizationId = organization.activeWorkspaceId
    await cancelOrganizationUploads(previousOrganizationId)
    const result = await authClient.organization.create({ name, slug })

    if (result.error) {
      setActiveUploadOrganization(previousOrganizationId)
      const message = t('organizations.couldNotCreate')
      toast.error(message)
      return message
    }

    if (result.data?.id) {
      const activeResult = await authClient.organization.setActive({
        organizationId: result.data.id,
      })

      if (activeResult.error) {
        setActiveUploadOrganization(previousOrganizationId)
        const message
          = t('organizations.couldNotActivate')
        toast.error(message)
        return message
      }
    }

    if (result.data?.id)
      storeLastOrganizationId(result.data.id)

    await session.refetch()
    await organization.refreshOrganizationSession()
    await queryClient.invalidateQueries({ queryKey: getMeQueryKey() })
    await removeOrganizationProductQueries(
      queryClient,
      previousOrganizationId,
    )
    await queryClient.invalidateQueries({
      queryKey: listOrganizationsQueryKey(),
    })
    toast.success(t('organizations.created'))
    return null
  }

  async function handleSwitchOrganization(organizationId: string) {
    const previousOrganizationId = organization.activeWorkspaceId
    await cancelOrganizationUploads(previousOrganizationId)
    await removeOrganizationProductQueries(
      queryClient,
      previousOrganizationId,
    )

    try {
      await activateOrganization({ organizationId })
    }
    catch (error) {
      setActiveUploadOrganization(previousOrganizationId)
      const message = getApiErrorMessage(
        error,
        'organizations.couldNotSwitch',
      )
      toast.error(message)
      if (previousOrganizationId)
        await invalidateOrganizationProductQueries(queryClient, previousOrganizationId)
      return message
    }

    storeLastOrganizationId(organizationId)
    await session.refetch()
    await organization.refreshOrganizationSession()
    await queryClient.invalidateQueries({ queryKey: getMeQueryKey() })
    await queryClient.invalidateQueries({
      queryKey: listOrganizationsQueryKey(),
    })
    toast.success(t('organizations.switched'))
    return null
  }

  async function handleInvitationAccepted(organizationId: string) {
    await cancelAllUploads()
    storeLastOrganizationId(organizationId)
    queryClient.clear()
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
              <Suspense fallback={<SplashScreen />}>
                <DashboardLayout
                  activeOrganizationId={organization.activeWorkspaceId}
                  currentSessionId={session.data?.session.id}
                  currentUserId={session.data?.user.id}
                  email={session.data?.user.email}
                  language={language.preference}
                  name={session.data?.user.name}
                  onCreateOrganization={handleCreateOrganization}
                  onOpenCookiePreferences={handleOpenCookiePreferences}
                  onLanguageChange={handleLanguageChange}
                  onProfileUpdated={handleAuthenticated}
                  onSignOut={handleSignOut}
                  onSwitchOrganization={handleSwitchOrganization}
                  onThemeChange={handleThemeChange}
                  theme={theme}
                />
              </Suspense>
            </ProtectedRoute>
          )}
        >
          <Route index element={<Navigate to="/flows" replace />} />
          <Route
            path="assets"
            element={(
              <ErrorBoundary
                fallback={({ resetErrorBoundary }) => (
                  <ErrorFallback
                    description={t('assets.couldNotLoadDescription')}
                    onRetry={resetErrorBoundary}
                    title={t('assets.couldNotLoad')}
                  />
                )}
              >
                <AssetsScreen />
              </ErrorBoundary>
            )}
          />
          <Route
            path="flows"
            element={(
              <ErrorBoundary
                fallback={({ resetErrorBoundary }) => (
                  <ErrorFallback
                    description={t('flows.couldNotLoadDescription')}
                    onRetry={resetErrorBoundary}
                    title={t('flows.couldNotLoad')}
                  />
                )}
              >
                <FlowsScreen />
              </ErrorBoundary>
            )}
          />
          <Route
            path="elements"
            element={(
              <ErrorBoundary
                fallback={({ resetErrorBoundary }) => (
                  <ErrorFallback
                    description={t('elements.couldNotLoadDescription')}
                    onRetry={resetErrorBoundary}
                    title={t('elements.couldNotLoad')}
                  />
                )}
              >
                <ElementsScreen />
              </ErrorBoundary>
            )}
          />
          <Route
            path="flows/:flowId"
            element={(
              <ErrorBoundary
                fallback={({ resetErrorBoundary }) => (
                  <ErrorFallback
                    description={t('flows.couldNotLoadDescription')}
                    onRetry={resetErrorBoundary}
                    title={t('flows.couldNotLoad')}
                  />
                )}
              >
                <FlowEditorScreen />
              </ErrorBoundary>
            )}
          />
          <Route path="*" element={<Navigate to="/flows" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/flows" replace />} />
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
