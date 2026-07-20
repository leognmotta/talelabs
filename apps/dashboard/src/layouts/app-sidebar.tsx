/** Dashboard navigation sidebar: primary sections and account controls. */

import type { ComponentProps } from 'react'
import type { SettingsTab } from '../features/settings/settings-state'

import {
  IconFolderOpen,
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
import { TaleLabsLogo } from '../shared/components/talelabs-logo'
import { ElementIcon } from '../shared/domain-icons'
import { NavMain } from './nav-main'
import { NavUser } from './nav-user'

/** Dashboard navigation sidebar: primary sections, org switcher, account menu. */
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
  const { t } = useTranslation()

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <div className="
          flex h-10 items-center px-3
          group-data-[collapsible=icon]:justify-center
          group-data-[collapsible=icon]:px-0
        "
        >
          <TaleLabsLogo
            alt={t('common.appName')}
            className="
              h-6 w-32
              group-data-[collapsible=icon]:hidden
            "
            variant="full"
          />
          <TaleLabsLogo
            alt={t('common.appName')}
            className="
              hidden size-8
              group-data-[collapsible=icon]:block
            "
            variant="icon"
          />
        </div>
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
              title: t('navigation.flows'),
              url: '/flows',
              icon: <IconGitBranch />,
            },
            {
              title: t('navigation.assets'),
              url: '/assets',
              icon: <IconFolderOpen />,
            },
            {
              title: t('navigation.elements'),
              url: '/elements',
              icon: <ElementIcon />,
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
          onSignOut={onSignOut}
          signOutIcon={IconLogout}
        />
      </SidebarFooter>
    </Sidebar>
  )
}
