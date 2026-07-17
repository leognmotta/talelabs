import type { LanguagePreference } from '@talelabs/i18n'
import type { SettingsTab } from '../features/settings/settings-state'
import type { ThemePreference } from '../shared/lib/theme'
import { IconCookie, IconDots } from '@tabler/icons-react'
import { Button } from '@talelabs/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@talelabs/ui/components/dropdown-menu'
import { Separator } from '@talelabs/ui/components/separator'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@talelabs/ui/components/sidebar'
import { TooltipProvider } from '@talelabs/ui/components/tooltip'
import { cn } from '@talelabs/ui/lib/utils'
import {
  lazy,
  Suspense,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet, useMatch } from 'react-router'
import { AssetViewerDialog } from '../features/assets/asset-viewer-dialog'
import { useAssetViewerUrlState } from '../features/assets/use-asset-viewer-url-state'
import { FlowRunRealtimeSubscriptions } from '../features/flows/flow-run-realtime-subscriptions'
import { OrganizationScopeProvider } from '../features/organizations/organization-scope'
import { SettingsDialog } from '../features/settings/settings-dialog'
import { useSettingsTabState } from '../features/settings/settings-state'
import { UploadIndicator } from '../features/uploads/upload-indicator'
import { UploadProvider } from '../features/uploads/upload-provider'
import { AssetIcon } from '../shared/domain-icons'
import { AppSidebar } from './app-sidebar'
import { GlobalSearch } from './global-search'

function loadAssetLibraryDialog() {
  return import('../features/assets/asset-library-dialog')
}
const AssetLibraryDialog = lazy(async () => ({
  default: (await loadAssetLibraryDialog()).AssetLibraryDialog,
}))

export function DashboardLayout({
  activeOrganizationId,
  currentSessionId,
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
  const [settingsTab, setSettingsTab] = useSettingsTabState()
  const activeSettingsTab = settingsTab ?? 'general'
  const isSettingsOpen = settingsTab !== null
  const assetViewer = useAssetViewerUrlState()
  const [isAssetLibraryOpen, setIsAssetLibraryOpen] = useState(false)
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

  if (isFlowEditor) {
    return (
      <OrganizationScopeProvider organizationId={activeOrganizationId}>
        <UploadProvider>
          <TooltipProvider>
            {activeOrganizationId && (
              <FlowRunRealtimeSubscriptions organizationId={activeOrganizationId} />
            )}
            <main className="
              flex h-svh min-h-0 flex-col overflow-hidden bg-background
              text-foreground
            "
            >
              <Outlet />
            </main>
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
          <SidebarProvider className="h-svh min-h-0 overflow-hidden">
            <AppSidebar
              activeOrganizationId={activeOrganizationId}
              email={email}
              name={name}
              onCreateOrganization={onCreateOrganization}
              onOpenInviteMemberSettings={handleOpenInviteMemberSettings}
              onOpenSettings={handleOpenSettings}
              onSignOut={onSignOut}
              onSwitchOrganization={onSwitchOrganization}
            />
            <SidebarInset className="min-h-0 overflow-hidden">
              <div
                className="
                  flex min-h-0 flex-1 flex-col bg-background text-foreground
                "
              >
                {!isFlowEditor && (
                  <>
                    <header className="
                      flex h-16 shrink-0 items-center gap-3 px-6
                    "
                    >
                      <SidebarTrigger
                        aria-label={t('navigation.toggleSidebar')}
                      />
                      <div className="flex min-w-0 flex-1 justify-center">
                        <GlobalSearch
                          onOpenInviteMemberSettings={
                            handleOpenInviteMemberSettings
                          }
                          onOpenSettings={handleOpenSettings}
                        />
                      </div>
                      <UploadIndicator />
                      <Button
                        aria-label={t('navigation.assets')}
                        type="button"
                        variant="outline"
                        onClick={() => setIsAssetLibraryOpen(true)}
                        onFocus={() => void loadAssetLibraryDialog()}
                        onMouseEnter={() => void loadAssetLibraryDialog()}
                      >
                        <AssetIcon data-icon="inline-start" />
                        <span
                          className="
                            hidden
                            sm:inline
                          "
                        >
                          {t('navigation.assets')}
                        </span>
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={(
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              aria-label={t('common.moreOptions')}
                            />
                          )}
                        >
                          <IconDots />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuGroup>
                            <DropdownMenuItem onClick={onOpenCookiePreferences}>
                              <IconCookie />
                              <span>{t('cookies.manage')}</span>
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </header>
                    <Separator />
                  </>
                )}
                <section
                  className={cn(
                    'flex min-h-0 flex-1 flex-col',
                    isFlowEditor
                      ? 'overflow-hidden'
                      : 'gap-6 overflow-y-auto p-6',
                  )}
                >
                  <Outlet />
                </section>
              </div>
            </SidebarInset>
            {settingsDialog}
            {isAssetLibraryOpen && (
              <Suspense fallback={null}>
                <AssetLibraryDialog
                  mode="manage"
                  open={isAssetLibraryOpen}
                  onOpenAsset={(asset) => {
                    setIsAssetLibraryOpen(false)
                    assetViewer.openAsset(asset.id)
                  }}
                  onOpenChange={setIsAssetLibraryOpen}
                />
              </Suspense>
            )}
            <AssetViewerDialog />
          </SidebarProvider>
        </TooltipProvider>
      </UploadProvider>
    </OrganizationScopeProvider>
  )
}
