import type { ComponentProps } from 'react'
import type { SettingsTab } from '../features/settings/settings-state'

import {
  IconArchive,
  IconComponents,
  IconGitBranch,
  IconLogout,
} from '@tabler/icons-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
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
  onSidebarOverlayOpenChange,
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
  onSidebarOverlayOpenChange: (open: boolean) => void
  onSignOut: () => Promise<void>
  onSwitchOrganization: (organizationId: string) => Promise<string | null>
}) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <OrganizationSwitcher
          activeOrganizationId={activeOrganizationId}
          onCreateOrganization={onCreateOrganization}
          onDropdownOpenChange={onSidebarOverlayOpenChange}
          onSwitchOrganization={onSwitchOrganization}
        />
      </SidebarHeader>
      <SidebarContent>
        <NavMain
          items={[
            {
              title: 'Assets',
              url: '/assets',
              icon: <IconArchive />,
            },
            {
              title: 'Flows',
              url: '/flows',
              icon: <IconGitBranch />,
            },
            {
              title: 'Elements',
              url: '/elements',
              icon: <IconComponents />,
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
          onDropdownOpenChange={onSidebarOverlayOpenChange}
          onSignOut={onSignOut}
          signOutIcon={IconLogout}
        />
      </SidebarFooter>
    </Sidebar>
  )
}
