import type { ComponentProps } from 'react'
import type { SettingsTab } from '../features/settings/settings-state'

import {
  IconApps,
  IconLayoutBoard,
  IconLogout,
  IconMovie,
  IconPlus,
  IconSparkles,
  IconUserSquareRounded,
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
  onOpenInviteMemberSettings,
  onOpenSettings,
  onSignOut,
  onSwitchOrganization,
  ...props
}: ComponentProps<typeof Sidebar> & {
  activeOrganizationId: string | null
  email: string | undefined
  name: string | undefined
  onCreateOrganization: (name: string, slug: string) => Promise<string | null>
  onOpenInviteMemberSettings: () => void
  onOpenSettings: (tab?: SettingsTab) => void
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
              title: 'Boards',
              url: '/boards',
              icon: <IconLayoutBoard />,
              end: true,
            },
            {
              title: 'Create',
              url: '/create',
              icon: <IconPlus />,
            },
            {
              title: 'Apps',
              url: '/apps',
              icon: <IconApps />,
            },
            {
              title: 'Studio',
              url: '/studio',
              icon: <IconMovie />,
            },
            {
              title: 'Agent',
              url: '/agent',
              icon: <IconSparkles />,
            },
            {
              title: 'Characters',
              url: '/characters',
              icon: <IconUserSquareRounded />,
              items: [
                {
                  title: 'Brands',
                  url: '/characters/brands',
                },
                {
                  title: 'Products',
                  url: '/characters/products',
                },
                {
                  title: 'Projects',
                  url: '/characters/projects',
                },
              ],
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
          onOpenInviteMemberSettings={onOpenInviteMemberSettings}
          onOpenSettings={onOpenSettings}
          onSignOut={onSignOut}
          signOutIcon={IconLogout}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
