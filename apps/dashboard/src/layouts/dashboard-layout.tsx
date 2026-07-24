/** Dashboard shell composition for global Asset and Flow runtime surfaces. */

import type { LanguagePreference } from '@talelabs/i18n'
import type { SettingsTab } from '../features/settings/settings-state'
import type { ThemePreference } from '../shared/lib/theme'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@talelabs/ui/components/sidebar'
import { TooltipProvider } from '@talelabs/ui/components/tooltip'
import { cn } from '@talelabs/ui/lib/utils'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet, useMatch } from 'react-router'
import { AssetViewerDialog } from '../features/assets/viewer/asset-viewer-dialog'
import { BrowserRunRoot } from '../features/flows/runs/browser-runtime/browser-run-root'
import { FlowRunRealtimeSubscriptions } from '../features/flows/runs/realtime/flow-run-realtime-subscriptions'
import { OrganizationScopeProvider } from '../features/organizations/organization-scope'
import { SettingsDialog } from '../features/settings/settings-dialog'
import { useSettingsTabState } from '../features/settings/settings-state'
import { UploadIndicator } from '../features/uploads/upload-indicator'
import { UploadProvider } from '../features/uploads/upload-provider'
import { DARK_THEME_CLASS_NAME } from '../shared/lib/theme'
import { AppSidebar } from './app-sidebar'
import { GlobalSearch } from './global-search'

/** Renders dashboard layout for the dashboard layout boundary. */
export function DashboardLayout({
  activeOrganizationId,
  currentSessionId,
  currentUserId,
  email,
  language,
  name,
  onSignOut,
  onCreateOrganization,
  onLanguageChange,
  onOpenCookiePreferences,
  onProfileUpdated,
  onSwitchOrganization,
  onThemeChange,
  theme,
}: {
  activeOrganizationId: string | null
  currentSessionId: string | undefined
  currentUserId: string | undefined
  email: string | undefined
  language: LanguagePreference
  name: string | undefined
  onCreateOrganization: (name: string, slug: string) => Promise<string | null>
  onLanguageChange: (language: LanguagePreference) => Promise<void>
  onOpenCookiePreferences: () => void
  onProfileUpdated: () => Promise<void>
  onSignOut: () => Promise<void>
  onSwitchOrganization: (organizationId: string) => Promise<string | null>
  onThemeChange: (theme: ThemePreference) => void
  theme: ThemePreference
}) {
  const { t } = useTranslation()
  const isFlowEditor = Boolean(useMatch('/flows/:flowId'))
  const isCreate = Boolean(useMatch('/create/*'))
  const [settingsTab, setSettingsTab] = useSettingsTabState()
  const activeSettingsTab = settingsTab ?? 'general'
  const isSettingsOpen = settingsTab !== null
  const [isTeamInviteFormOpen, setIsTeamInviteFormOpen] = useState(false)

  function handleOpenSettings(nextTab: SettingsTab = 'general') {
    void setSettingsTab(nextTab)
  }

  function handleOpenInviteMemberSettings() {
    setIsTeamInviteFormOpen(true)
    void setSettingsTab('team')
  }

  function handleSettingsOpenChange(nextOpen: boolean) {
    if (!nextOpen)
      setIsTeamInviteFormOpen(false)

    void setSettingsTab(nextOpen ? activeSettingsTab : null)
  }

  function handleSettingsTabChange(nextTab: SettingsTab) {
    if (nextTab !== 'team')
      setIsTeamInviteFormOpen(false)

    void setSettingsTab(nextTab)
  }

  const settingsDialog = (
    <SettingsDialog
      activeOrganizationId={activeOrganizationId}
      currentSessionId={currentSessionId}
      email={email || t('common.workspaceMember')}
      isTeamInviteFormOpen={isTeamInviteFormOpen}
      language={language}
      name={name || t('common.talelabsUser')}
      onLanguageChange={onLanguageChange}
      onOpenChange={handleSettingsOpenChange}
      onOpenCookiePreferences={onOpenCookiePreferences}
      onProfileUpdated={onProfileUpdated}
      onSignOut={onSignOut}
      onTabChange={handleSettingsTabChange}
      onTeamInviteFormOpenChange={setIsTeamInviteFormOpen}
      onThemeChange={onThemeChange}
      open={isSettingsOpen}
      tab={activeSettingsTab}
      theme={theme}
    />
  )
  const uploadIndicator = (
    <div
      className={cn(
        'fixed right-4 z-40',
        isCreate ? 'top-16' : 'bottom-4',
      )}
    >
      <UploadIndicator />
    </div>
  )

  if (isFlowEditor) {
    return (
      <OrganizationScopeProvider organizationId={activeOrganizationId}>
        <UploadProvider>
          <TooltipProvider>
            {activeOrganizationId && (
              <FlowRunRealtimeSubscriptions organizationId={activeOrganizationId} />
            )}
            {activeOrganizationId && currentUserId && (
              <BrowserRunRoot organizationId={activeOrganizationId} userId={currentUserId} />
            )}
            <main className="
              flex h-svh min-h-0 flex-col overflow-hidden text-foreground
            "
            >
              <Outlet />
            </main>
            {uploadIndicator}
            {settingsDialog}
          </TooltipProvider>
        </UploadProvider>
      </OrganizationScopeProvider>
    )
  }

  return (
    <OrganizationScopeProvider organizationId={activeOrganizationId}>
      <UploadProvider>
        <TooltipProvider>
          {activeOrganizationId && (
            <FlowRunRealtimeSubscriptions organizationId={activeOrganizationId} />
          )}
          {activeOrganizationId && currentUserId && (
            <BrowserRunRoot organizationId={activeOrganizationId} userId={currentUserId} />
          )}
          <SidebarProvider
            className={cn(
              'h-svh min-h-0 overflow-hidden',
              isCreate && DARK_THEME_CLASS_NAME,
            )}
          >
            <AppSidebar
              activeOrganizationId={activeOrganizationId}
              email={email}
              name={name}
              onCreateOrganization={onCreateOrganization}
              onOpenInviteMemberSettings={handleOpenInviteMemberSettings}
              onOpenSettings={handleOpenSettings}
              onSignOut={onSignOut}
              onSwitchOrganization={onSwitchOrganization}
              globalSearch={(
                <GlobalSearch
                  presentation="sidebar"
                  onOpenInviteMemberSettings={handleOpenInviteMemberSettings}
                  onOpenSettings={handleOpenSettings}
                />
              )}
              variant="floating"
            />
            <SidebarInset className={cn(
              `
                min-h-0 overflow-hidden bg-transparent
                md:m-2 md:ml-0 md:rounded-2xl md:ring-1 md:ring-border/80
              `,
            )}
            >
              <div className="flex min-h-0 flex-1 flex-col text-foreground">
                <header className="
                  flex h-12 shrink-0 items-center px-3
                  md:hidden
                "
                >
                  <SidebarTrigger
                    aria-label={t('navigation.toggleSidebar')}
                  />
                </header>
                <section
                  className={cn(
                    'flex min-h-0 flex-1 flex-col',
                    isCreate
                      ? 'overflow-hidden'
                      : 'gap-6 overflow-y-auto p-6',
                  )}
                >
                  <Outlet />
                </section>
              </div>
            </SidebarInset>
            {uploadIndicator}
            {settingsDialog}
            <AssetViewerDialog />
          </SidebarProvider>
        </TooltipProvider>
      </UploadProvider>
    </OrganizationScopeProvider>
  )
}
