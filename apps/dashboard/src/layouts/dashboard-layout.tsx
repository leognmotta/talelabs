import type { SettingsTab } from '../features/settings/settings-state'
import type { ThemePreference } from '../shared/lib/theme'
import { IconCoins } from '@tabler/icons-react'
import { Button } from '@talelabs/ui/components/button'
import { Separator } from '@talelabs/ui/components/separator'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@talelabs/ui/components/sidebar'
import { TooltipProvider } from '@talelabs/ui/components/tooltip'
import { parseAsBoolean, parseAsStringEnum, useQueryState } from 'nuqs'

import { useState } from 'react'
import { Outlet } from 'react-router'
import { mockedCreditsBalance } from '../features/credits/credits-data'
import { CreditsPurchaseDialog } from '../features/credits/credits-purchase-dialog'
import { SettingsDialog } from '../features/settings/settings-dialog'
import { settingsTabs } from '../features/settings/settings-state'
import { AppSidebar } from './app-sidebar'
import { GlobalSearch } from './global-search'

export function DashboardLayout({
  activeOrganizationId,
  currentSessionId,
  email,
  name,
  onSignOut,
  onCreateOrganization,
  onProfileUpdated,
  onSwitchOrganization,
  onThemeChange,
  theme,
}: {
  activeOrganizationId: string | null
  currentSessionId: string | undefined
  email: string | undefined
  name: string | undefined
  onCreateOrganization: (name: string, slug: string) => Promise<string | null>
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
  const activeSettingsTab = settingsTab ?? 'general'
  const isSettingsOpen = settingsTab !== null
  const isCreditsDialogOpen = creditsDialogOpen === true
  const [isTeamInviteFormOpen, setIsTeamInviteFormOpen] = useState(false)

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
      <SidebarProvider>
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
        <SidebarInset>
          <main className="
            flex min-h-svh flex-col bg-background text-foreground
          "
          >
            <header className="flex h-16 shrink-0 items-center gap-3 px-6">
              <SidebarTrigger />
              <div className="flex min-w-0 flex-1 justify-center">
                <GlobalSearch
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
          onProfileUpdated={onProfileUpdated}
          onOpenCreditsPurchase={handleOpenCreditsPurchase}
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
      </SidebarProvider>
    </TooltipProvider>
  )
}
