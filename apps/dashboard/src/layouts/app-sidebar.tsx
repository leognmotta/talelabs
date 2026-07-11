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

import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()

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
              title: t('navigation.flows'),
              url: '/flows',
              icon: <IconGitBranch />,
            },
            {
              title: t('navigation.assets'),
              url: '/assets',
              icon: <IconArchive />,
            },
            {
              title: t('navigation.elements'),
              url: '/elements',
              icon: <IconComponents />,
            },
          ]}
        />
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{
            name: name || t('common.talelabsUser'),
            email: email || t('common.workspaceMember'),
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
