import type { ThemePreference } from '../shared/lib/theme'
import { Separator } from '@talelabs/ui/components/separator'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@talelabs/ui/components/sidebar'
import { TooltipProvider } from '@talelabs/ui/components/tooltip'

import { Outlet } from 'react-router'
import { AppSidebar } from './app-sidebar'

export function DashboardLayout({
  activeOrganizationId,
  email,
  name,
  onSignOut,
  onCreateOrganization,
  onSwitchOrganization,
  onThemeChange,
  theme,
}: {
  activeOrganizationId: string | null
  email: string | undefined
  name: string | undefined
  onCreateOrganization: (name: string, slug: string) => Promise<string | null>
  onSignOut: () => Promise<void>
  onSwitchOrganization: (organizationId: string) => Promise<string | null>
  onThemeChange: (theme: ThemePreference) => void
  theme: ThemePreference
}) {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar
          activeOrganizationId={activeOrganizationId}
          email={email}
          name={name}
          onCreateOrganization={onCreateOrganization}
          onSignOut={onSignOut}
          onSwitchOrganization={onSwitchOrganization}
          onThemeChange={onThemeChange}
          theme={theme}
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
      </SidebarProvider>
    </TooltipProvider>
  )
}
