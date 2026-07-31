/** Dashboard navigation sidebar: global shell and contextual feature variants. */

import type { ComponentProps, ReactNode } from 'react'
import type { SettingsTab } from '../features/settings/settings-state'

import {
  IconFolderOpen,
  IconFolders,
  IconGitBranch,
  IconLogout,
  IconSparkles,
} from '@tabler/icons-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarSeparator,
  SidebarTrigger,
} from '@talelabs/ui/components/sidebar'
import { cn } from '@talelabs/ui/lib/utils'
import { useTranslation } from 'react-i18next'
import { useMatch } from 'react-router'

import { BillingSidebarStatus } from '../features/billing/billing-sidebar-status'
import { OrganizationSwitcher } from '../features/organizations/organization-switcher'
import { ProjectContextSidebar } from '../features/projects/sidebar/project-context-sidebar'
import { TaleLabsLogo } from '../shared/components/talelabs-logo'
import { ElementIcon } from '../shared/domain-icons'
import { NavMain } from './nav-main'
import { NavUser } from './nav-user'

/** Renders the global sidebar shell with route-selected navigation content. */
export function AppSidebar({
  activeOrganizationId,
  email,
  globalSearch,
  name,
  onCreateOrganization,
  onOpenInviteMemberSettings,
  onOpenSettings,
  onSignOut,
  onSwitchOrganization,
  ...props
}: ComponentProps<typeof Sidebar> & {
  /** Active organization identity for the global organization switcher. */
  activeOrganizationId: string | null
  /** Signed-in user's email address. */
  email: string | undefined
  /** Global search trigger rendered above primary navigation. */
  globalSearch: ReactNode
  /** Signed-in user's display name. */
  name: string | undefined
  /** Creates an organization and returns its identity when successful. */
  onCreateOrganization: (name: string, slug: string) => Promise<string | null>
  /** Opens organization invitation settings. */
  onOpenInviteMemberSettings: () => void
  /** Opens the requested account or organization settings tab. */
  onOpenSettings: (tab?: SettingsTab) => void
  /** Ends the active session. */
  onSignOut: () => Promise<void>
  /** Activates another organization and returns its identity when successful. */
  onSwitchOrganization: (organizationId: string) => Promise<string | null>
}) {
  const { t } = useTranslation()
  const projectId = useMatch('/projects/:projectId/*')?.params.projectId ?? null

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <div className="
          flex h-8 items-center justify-end px-1
          group-data-[collapsible=icon]:justify-center
          group-data-[collapsible=icon]:px-0
        "
        >
          <SidebarTrigger aria-label={t('navigation.toggleSidebar')} />
        </div>
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
        {!projectId && (
          <OrganizationSwitcher
            activeOrganizationId={activeOrganizationId}
            onCreateOrganization={onCreateOrganization}
            onSwitchOrganization={onSwitchOrganization}
          />
        )}
      </SidebarHeader>
      <SidebarContent className={cn(projectId && 'min-h-0 overflow-hidden')}>
        {projectId
          ? (
              <ProjectContextSidebar projectId={projectId} />
            )
          : (
              <>
                {globalSearch}
                <SidebarSeparator />
                <NavMain
                  items={[
                    {
                      title: t('navigation.create'),
                      url: '/create',
                      icon: <IconSparkles />,
                    },
                    {
                      title: t('navigation.projects'),
                      url: '/projects',
                      icon: <IconFolders />,
                    },
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
              </>
            )}
      </SidebarContent>
      <SidebarFooter>
        <BillingSidebarStatus
          organizationId={activeOrganizationId}
          onOpenSettings={onOpenSettings}
        />
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
