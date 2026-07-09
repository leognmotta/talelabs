import type { ComponentProps } from 'react'
import type { ThemePreference } from '../shared/lib/theme'

import {
  IconDeviceDesktop,
  IconLayoutDashboard,
  IconLogout,
  IconMoon,
  IconSettings,
  IconSun,
} from '@tabler/icons-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@talelabs/ui/components/sidebar'

import { OrganizationSwitcher } from '../features/organizations/organization-switcher'
import { NavMain } from './nav-main'
import { NavUser } from './nav-user'

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
        <OrganizationSwitcher
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
              icon: <IconLayoutDashboard />,
              end: true,
            },
            {
              title: 'Workspace',
              url: '/workspace',
              icon: <IconSettings />,
            },
          ]}
        />
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{
            name: name || 'TaleLabs user',
            email: email || 'Workspace member',
          }}
          onSignOut={onSignOut}
          onThemeChange={onThemeChange}
          signOutIcon={IconLogout}
          theme={theme}
          themeItems={[
            { icon: IconSun, label: 'Light', value: 'light' },
            { icon: IconMoon, label: 'Dark', value: 'dark' },
            { icon: IconDeviceDesktop, label: 'System', value: 'system' },
          ]}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
