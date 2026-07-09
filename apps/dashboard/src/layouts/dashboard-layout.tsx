import type { SettingsTab } from '../features/settings/settings-state'
import type { ThemePreference } from '../shared/lib/theme'
import { Separator } from '@talelabs/ui/components/separator'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@talelabs/ui/components/sidebar'
import { TooltipProvider } from '@talelabs/ui/components/tooltip'
import { parseAsStringEnum, useQueryState } from 'nuqs'

import { Outlet } from 'react-router'
import { SettingsDialog } from '../features/settings/settings-dialog'
import { settingsTabs } from '../features/settings/settings-state'
import { AppSidebar } from './app-sidebar'

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
  const activeSettingsTab = settingsTab ?? 'general'
  const isSettingsOpen = settingsTab !== null

  function handleOpenSettings() {
    void setSettingsTab('general')
  }

  function handleSettingsOpenChange(nextOpen: boolean) {
    void setSettingsTab(nextOpen ? activeSettingsTab : null)
  }

  function handleSettingsTabChange(nextTab: SettingsTab) {
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
          name={name || 'TaleLabs user'}
          onOpenChange={handleSettingsOpenChange}
          onProfileUpdated={onProfileUpdated}
          onSignOut={onSignOut}
          onTabChange={handleSettingsTabChange}
          onThemeChange={onThemeChange}
          open={isSettingsOpen}
          tab={activeSettingsTab}
          theme={theme}
        />
      </SidebarProvider>
    </TooltipProvider>
  )
}
