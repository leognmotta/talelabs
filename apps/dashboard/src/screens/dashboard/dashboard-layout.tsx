import type { ThemePreference } from '../../lib/theme'
import { Separator } from '@connecto/ui/components/separator'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@connecto/ui/components/sidebar'
import { TooltipProvider } from '@connecto/ui/components/tooltip'

import { Navigate, Route, Routes } from 'react-router'
import { AppSidebar } from '../../components/app-sidebar'
import { DashboardOverview } from './dashboard-overview'
import { WorkspaceScreen } from './workspace-screen'

export function DashboardLayout({
  activeOrganizationId,
  email,
  meQueryStatus,
  name,
  organizationMessage,
  onSignOut,
  onCreateOrganization,
  onSwitchOrganization,
  onThemeChange,
  theme,
}: {
  activeOrganizationId: string | null
  email: string | undefined
  meQueryStatus: string
  name: string | undefined
  organizationMessage: string
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
              <Separator orientation="vertical" />
              <div className="flex flex-col">
                <h1 className="text-lg font-semibold tracking-tight">{name}</h1>
                <p className="text-sm text-muted-foreground">{email}</p>
              </div>
            </header>
            <Separator />
            <section className="flex flex-1 flex-col gap-6 p-6">
              <Routes>
                <Route
                  index
                  element={(
                    <DashboardOverview
                      meQueryStatus={meQueryStatus}
                      organizationMessage={organizationMessage}
                    />
                  )}
                />
                <Route
                  path="workspace"
                  element={(
                    <WorkspaceScreen activeOrganizationId={activeOrganizationId} />
                  )}
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </section>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
