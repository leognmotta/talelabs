import type { ComponentProps } from 'react'
import type { SettingsTab } from '../features/settings/settings-state'

import {
  IconApps,
  IconArchive,
  IconBriefcase,
  IconBuildingStore,
  IconLayoutBoard,
  IconLogout,
  IconMovie,
  IconPackage,
  IconSparkles,
  IconUserSquareRounded,
  IconWand,
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
              hidden: true,
            },
            {
              title: 'Generate',
              url: '/generate',
              icon: <IconWand />,
            },
            {
              title: 'Assets',
              url: '/assets',
              icon: <IconArchive />,
            },
            {
              title: 'Projects',
              url: '/projects',
              icon: <IconBriefcase />,
            },
            {
              title: 'Brands',
              url: '/brands',
              icon: <IconBuildingStore />,
            },
            {
              title: 'Products',
              url: '/products',
              icon: <IconPackage />,
            },
            {
              title: 'Characters',
              url: '/characters',
              icon: <IconUserSquareRounded />,
            },
            {
              title: 'Apps',
              url: '/apps',
              icon: <IconApps />,
              hidden: true,
            },
            {
              title: 'Studio',
              url: '/studio',
              icon: <IconMovie />,
              hidden: true,
            },
            {
              title: 'Assistant',
              url: '/assistant',
              icon: <IconSparkles />,
              hidden: true,
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
