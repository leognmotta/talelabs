import type { ComponentProps } from 'react'

import {
  IconLayoutDashboard,
  IconLogout,
  IconSettings,
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
  onOpenSettings,
  onSignOut,
  onSwitchOrganization,
  ...props
}: ComponentProps<typeof Sidebar> & {
  activeOrganizationId: string | null
  email: string | undefined
  name: string | undefined
  onCreateOrganization: (name: string, slug: string) => Promise<string | null>
  onOpenSettings: () => void
  onSignOut: () => Promise<void>
  onSwitchOrganization: (organizationId: string) => Promise<string | null>
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
          onOpenSettings={onOpenSettings}
          onSignOut={onSignOut}
          signOutIcon={IconLogout}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
