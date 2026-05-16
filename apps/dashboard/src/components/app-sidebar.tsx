import type { ComponentProps } from 'react'
import type { ThemePreference } from '../lib/theme'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@connecto/ui/components/sidebar'
import {
  LayoutDashboardIcon,
  LogOutIcon,
  MonitorIcon,
  MoonIcon,
  SettingsIcon,
  SunIcon,
} from 'lucide-react'

import { NavMain } from './nav-main'
import { NavUser } from './nav-user'
import { TeamSwitcher } from './team-switcher'

export function AppSidebar({
  activeOrganizationId,
  email,
  name,
  onCreateOrganization,
  onSignOut,
  onSwitchOrganization,
  onThemeChange,
  theme,
  ...props
}: ComponentProps<typeof Sidebar> & {
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
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher
          activeOrganizationId={activeOrganizationId}
          onCreateOrganization={onCreateOrganization}
          onSwitchOrganization={onSwitchOrganization}
        />
      </SidebarHeader>
      <SidebarContent>
        <NavMain
          items={[
            {
              title: 'Overview',
              url: '/',
              icon: <LayoutDashboardIcon />,
              end: true,
            },
            {
              title: 'Workspace',
              url: '/workspace',
              icon: <SettingsIcon />,
            },
          ]}
        />
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{
            name: name || 'Connecto user',
            email: email || 'Workspace member',
          }}
          onSignOut={onSignOut}
          onThemeChange={onThemeChange}
          signOutIcon={LogOutIcon}
          theme={theme}
          themeItems={[
            { icon: SunIcon, label: 'Light', value: 'light' },
            { icon: MoonIcon, label: 'Dark', value: 'dark' },
            { icon: MonitorIcon, label: 'System', value: 'system' },
          ]}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
