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
  IconShieldCog,
  IconSparkles,
  IconUserSquareRounded,
  IconWand,
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
  isSystemAdmin,
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
  isSystemAdmin: boolean
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
              title: 'Admin',
              url: '/admin',
              icon: <IconShieldCog />,
              hidden: !isSystemAdmin,
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
          onDropdownOpenChange={onSidebarOverlayOpenChange}
          onSignOut={onSignOut}
          signOutIcon={IconLogout}
        />
      </SidebarFooter>
    </Sidebar>
  )
}
