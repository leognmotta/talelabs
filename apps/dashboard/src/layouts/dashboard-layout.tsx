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
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet, useMatch } from 'react-router'
import { AssetViewerDialog } from '../features/assets/asset-viewer-dialog'
import { useAssetViewerUrlState } from '../features/assets/use-asset-viewer-url-state'
import { OrganizationScopeProvider } from '../features/organizations/organization-scope'
import { SettingsDialog } from '../features/settings/settings-dialog'
import { useSettingsTabState } from '../features/settings/settings-state'
import { UploadIndicator } from '../features/uploads/upload-indicator'
import { UploadProvider } from '../features/uploads/upload-provider'
import { AssetIcon } from '../shared/domain-icons'
import { AppSidebar } from './app-sidebar'
import { GlobalSearch } from './global-search'

const SIDEBAR_OPEN_DELAY_MS = 60
const SIDEBAR_CLOSE_DELAY_MS = 240

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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const isSidebarOpenRef = useRef(false)
  const isSidebarPointerInsideRef = useRef(false)
  const isSidebarOverlayOpenRef = useRef(false)
  const sidebarPointerPositionRef = useRef<{
    x: number
    y: number
  } | null>(null)
  const sidebarOpenTimerRef = useRef<number | null>(null)
  const sidebarCloseTimerRef = useRef<number | null>(null)

  const setSidebarOpenState = useCallback((open: boolean) => {
    isSidebarOpenRef.current = open
    setIsSidebarOpen(open)
  }, [])

  const clearSidebarOpenTimer = useCallback(() => {
    if (sidebarOpenTimerRef.current === null)
      return

    window.clearTimeout(sidebarOpenTimerRef.current)
    sidebarOpenTimerRef.current = null
  }, [])

  const clearSidebarCloseTimer = useCallback(() => {
    if (sidebarCloseTimerRef.current === null)
      return

    window.clearTimeout(sidebarCloseTimerRef.current)
    sidebarCloseTimerRef.current = null
  }, [])

  const isPointerOverSidebar = useCallback(() => {
    const pointerPosition = sidebarPointerPositionRef.current

    if (!pointerPosition)
      return isSidebarPointerInsideRef.current

    return document
      .elementsFromPoint(pointerPosition.x, pointerPosition.y)
      .some(element => Boolean(element.closest('[data-slot="sidebar"]')))
  }, [])

  const closeSidebarNow = useCallback(() => {
    clearSidebarOpenTimer()
    clearSidebarCloseTimer()
    setSidebarOpenState(false)
  }, [clearSidebarCloseTimer, clearSidebarOpenTimer, setSidebarOpenState])

  const openSidebarWithIntent = useCallback(() => {
    clearSidebarCloseTimer()

    if (isSidebarOpenRef.current || sidebarOpenTimerRef.current !== null)
      return

    sidebarOpenTimerRef.current = window.setTimeout(() => {
      setSidebarOpenState(true)
      sidebarOpenTimerRef.current = null
    }, SIDEBAR_OPEN_DELAY_MS)
  }, [clearSidebarCloseTimer, setSidebarOpenState])

  const closeSidebarWithIntent = useCallback(
    (options?: { force?: boolean }) => {
      clearSidebarOpenTimer()

      if (!options?.force && isSidebarOverlayOpenRef.current)
        return

      if (!isSidebarOpenRef.current || sidebarCloseTimerRef.current !== null)
        return

      sidebarCloseTimerRef.current = window.setTimeout(() => {
        setSidebarOpenState(false)
        sidebarCloseTimerRef.current = null
      }, SIDEBAR_CLOSE_DELAY_MS)
    },
    [clearSidebarOpenTimer, setSidebarOpenState],
  )

  const handleSidebarPointerEnter = useCallback(() => {
    isSidebarPointerInsideRef.current = true
    openSidebarWithIntent()
  }, [openSidebarWithIntent])

  const handleSidebarPointerLeave = useCallback(() => {
    isSidebarPointerInsideRef.current = false
    closeSidebarWithIntent()
  }, [closeSidebarWithIntent])

  const handleSidebarOverlayOpenChange = useCallback(
    (open: boolean) => {
      isSidebarOverlayOpenRef.current = open

      if (open) {
        clearSidebarCloseTimer()
        setSidebarOpenState(true)
        return
      }

      window.requestAnimationFrame(() => {
        const isPointerInsideSidebar = isPointerOverSidebar()
        isSidebarPointerInsideRef.current = isPointerInsideSidebar

        if (!isPointerInsideSidebar)
          closeSidebarNow()
      })
    },
    [
      clearSidebarCloseTimer,
      closeSidebarNow,
      isPointerOverSidebar,
      setSidebarOpenState,
    ],
  )

  useEffect(() => {
    function handleDocumentPointerDown(event: PointerEvent) {
      sidebarPointerPositionRef.current = {
        x: event.clientX,
        y: event.clientY,
      }

      if (!isSidebarOverlayOpenRef.current)
        return

      const target = event.target

      if (!(target instanceof Element))
        return

      const isInsideSidebarSurface = Boolean(
        target.closest(
          '[data-slot="sidebar"], [data-slot="dropdown-menu-content"]',
        ),
      )

      if (isInsideSidebarSurface)
        return

      isSidebarOverlayOpenRef.current = false
      isSidebarPointerInsideRef.current = false

      closeSidebarNow()
    }

    function handleDocumentPointerMove(event: PointerEvent) {
      sidebarPointerPositionRef.current = {
        x: event.clientX,
        y: event.clientY,
      }
    }

    document.addEventListener('pointerdown', handleDocumentPointerDown, {
      capture: true,
    })
    document.addEventListener('pointermove', handleDocumentPointerMove, {
      capture: true,
    })

    return () => {
      document.removeEventListener('pointerdown', handleDocumentPointerDown, {
        capture: true,
      })
      document.removeEventListener('pointermove', handleDocumentPointerMove, {
        capture: true,
      })
    }
  }, [closeSidebarNow])

  useEffect(() => {
    return () => {
      clearSidebarOpenTimer()
      clearSidebarCloseTimer()
    }
  }, [clearSidebarCloseTimer, clearSidebarOpenTimer])

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
          <SidebarProvider
            className="h-svh min-h-0 overflow-hidden"
            open={isSidebarOpen}
            onOpenChange={setSidebarOpenState}
          >
            <AppSidebar
              activeOrganizationId={activeOrganizationId}
              email={email}
              name={name}
              onCreateOrganization={onCreateOrganization}
              onOpenInviteMemberSettings={handleOpenInviteMemberSettings}
              onOpenSettings={handleOpenSettings}
              onSignOut={onSignOut}
              onSidebarOverlayOpenChange={handleSidebarOverlayOpenChange}
              onSwitchOrganization={onSwitchOrganization}
              onPointerEnter={handleSidebarPointerEnter}
              onPointerLeave={handleSidebarPointerLeave}
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
                      <SidebarTrigger className="md:hidden" />
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
