import type { SettingsTab } from '../features/settings/settings-state'
import type { ThemePreference } from '../shared/lib/theme'
import { IconCoins, IconCookie, IconDots, IconRocket } from '@tabler/icons-react'
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
import { parseAsBoolean, parseAsStringEnum, useQueryState } from 'nuqs'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Outlet } from 'react-router'
import { mockedCreditsBalance } from '../features/credits/credits-data'
import { CreditsPurchaseDialog } from '../features/credits/credits-purchase-dialog'
import { SettingsDialog } from '../features/settings/settings-dialog'
import { settingsTabs } from '../features/settings/settings-state'
import { SubscriptionUpgradeDialog } from '../features/subscription/subscription-upgrade-dialog'
import { AppSidebar } from './app-sidebar'
import { GlobalSearch } from './global-search'

const SIDEBAR_OPEN_DELAY_MS = 60
const SIDEBAR_CLOSE_DELAY_MS = 240

export function DashboardLayout({
  activeOrganizationId,
  currentSessionId,
  email,
  isSystemAdmin,
  name,
  onSignOut,
  onCreateOrganization,
  onOpenCookiePreferences,
  onProfileUpdated,
  onSwitchOrganization,
  onThemeChange,
  theme,
}: {
  activeOrganizationId: string | null
  currentSessionId: string | undefined
  email: string | undefined
  isSystemAdmin: boolean
  name: string | undefined
  onCreateOrganization: (name: string, slug: string) => Promise<string | null>
  onOpenCookiePreferences: () => void
  onProfileUpdated: () => Promise<void>
  onSignOut: () => Promise<void>
  onSwitchOrganization: (organizationId: string) => Promise<string | null>
  onThemeChange: (theme: ThemePreference) => void
  theme: ThemePreference
}) {
  const [settingsTab, setSettingsTab] = useQueryState(
    'settings',
    parseAsStringEnum<SettingsTab>([...settingsTabs]),
  )
  const [creditsDialogOpen, setCreditsDialogOpen] = useQueryState(
    'credits',
    parseAsBoolean,
  )
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useQueryState(
    'upgrade',
    parseAsBoolean,
  )
  const activeSettingsTab = settingsTab ?? 'general'
  const isSettingsOpen = settingsTab !== null
  const isCreditsDialogOpen = creditsDialogOpen === true
  const isUpgradeDialogOpen = upgradeDialogOpen === true
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

  const closeSidebarWithIntent = useCallback((options?: {
    force?: boolean
  }) => {
    clearSidebarOpenTimer()

    if (!options?.force && isSidebarOverlayOpenRef.current)
      return

    if (!isSidebarOpenRef.current || sidebarCloseTimerRef.current !== null)
      return

    sidebarCloseTimerRef.current = window.setTimeout(() => {
      setSidebarOpenState(false)
      sidebarCloseTimerRef.current = null
    }, SIDEBAR_CLOSE_DELAY_MS)
  }, [clearSidebarOpenTimer, setSidebarOpenState])

  const handleSidebarPointerEnter = useCallback(() => {
    isSidebarPointerInsideRef.current = true
    openSidebarWithIntent()
  }, [openSidebarWithIntent])

  const handleSidebarPointerLeave = useCallback(() => {
    isSidebarPointerInsideRef.current = false
    closeSidebarWithIntent()
  }, [closeSidebarWithIntent])

  const handleSidebarOverlayOpenChange = useCallback((open: boolean) => {
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
  }, [
    clearSidebarCloseTimer,
    closeSidebarNow,
    isPointerOverSidebar,
    setSidebarOpenState,
  ])

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

  function handleOpenCreditsPurchase() {
    void setCreditsDialogOpen(true, { history: 'push' })
  }

  function handleCreditsDialogOpenChange(nextOpen: boolean) {
    void setCreditsDialogOpen(nextOpen ? true : null)
  }

  function handleOpenSubscriptionUpgrade() {
    void setUpgradeDialogOpen(true, { history: 'push' })
  }

  function handleUpgradeDialogOpenChange(nextOpen: boolean) {
    void setUpgradeDialogOpen(nextOpen ? true : null)
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

  return (
    <TooltipProvider>
      <SidebarProvider
        open={isSidebarOpen}
        onOpenChange={setSidebarOpenState}
      >
        <AppSidebar
          activeOrganizationId={activeOrganizationId}
          email={email}
          isSystemAdmin={isSystemAdmin}
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
        <SidebarInset>
          <main className="
            flex min-h-svh flex-col bg-background text-foreground
          "
          >
            <header className="flex h-16 shrink-0 items-center gap-3 px-6">
              <SidebarTrigger className="md:hidden" />
              <div className="flex min-w-0 flex-1 justify-center">
                <GlobalSearch
                  isSystemAdmin={isSystemAdmin}
                  onOpenInviteMemberSettings={handleOpenInviteMemberSettings}
                  onOpenSettings={handleOpenSettings}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-4xl px-3 text-sm"
                onClick={handleOpenCreditsPurchase}
              >
                <IconCoins data-icon="inline-start" />
                <span className="
                  hidden
                  sm:inline
                "
                >
                  {mockedCreditsBalance.toLocaleString()}
                  {' '}
                  credits
                </span>
                <span className="sm:hidden">
                  {mockedCreditsBalance.toLocaleString()}
                </span>
              </Button>
              <Button
                type="button"
                className="h-9 rounded-4xl px-3 text-sm"
                onClick={handleOpenSubscriptionUpgrade}
              >
                <IconRocket data-icon="inline-start" />
                <span className="
                  hidden
                  sm:inline
                "
                >
                  Upgrade
                </span>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={(
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="More options"
                    />
                  )}
                >
                  <IconDots />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuGroup>
                    <DropdownMenuItem onClick={onOpenCookiePreferences}>
                      <IconCookie />
                      <span>Manage cookies</span>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </header>
            <Separator />
            <section className="flex flex-1 flex-col gap-6 p-6">
              <Outlet />
            </section>
          </main>
        </SidebarInset>
        <SettingsDialog
          activeOrganizationId={activeOrganizationId}
          currentSessionId={currentSessionId}
          email={email || 'Workspace member'}
          isTeamInviteFormOpen={isTeamInviteFormOpen}
          name={name || 'TaleLabs user'}
          onOpenChange={handleSettingsOpenChange}
          onOpenCookiePreferences={onOpenCookiePreferences}
          onProfileUpdated={onProfileUpdated}
          onOpenCreditsPurchase={handleOpenCreditsPurchase}
          onOpenSubscriptionUpgrade={handleOpenSubscriptionUpgrade}
          onSignOut={onSignOut}
          onTabChange={handleSettingsTabChange}
          onTeamInviteFormOpenChange={setIsTeamInviteFormOpen}
          onThemeChange={onThemeChange}
          open={isSettingsOpen}
          tab={activeSettingsTab}
          theme={theme}
        />
        <CreditsPurchaseDialog
          creditsBalance={mockedCreditsBalance}
          onOpenChange={handleCreditsDialogOpenChange}
          open={isCreditsDialogOpen}
        />
        <SubscriptionUpgradeDialog
          onOpenChange={handleUpgradeDialogOpenChange}
          open={isUpgradeDialogOpen}
        />
      </SidebarProvider>
    </TooltipProvider>
  )
}
