import type { TablerIcon } from '@tabler/icons-react'
import type { SettingsTab } from '../features/settings/settings-state'

import {
  IconSelector,
  IconSettings,
  IconUserCircle,
  IconUserPlus,
} from '@tabler/icons-react'
import {
  Avatar,
  AvatarFallback,
} from '@talelabs/ui/components/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@talelabs/ui/components/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@talelabs/ui/components/sidebar'
import { useTranslation } from 'react-i18next'

export function NavUser({
  onOpenInviteMemberSettings,
  onOpenSettings,
  onDropdownOpenChange,
  onSignOut,
  signOutIcon: SignOutIcon,
  user,
}: {
  onOpenInviteMemberSettings: () => void
  onOpenSettings: (tab?: SettingsTab) => void
  onDropdownOpenChange: (open: boolean) => void
  onSignOut: () => Promise<void>
  signOutIcon: TablerIcon
  user: {
    name: string
    email: string
  }
}) {
  const { t } = useTranslation()
  const { isMobile } = useSidebar()
  const initials = user.name
    .split(' ')
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu onOpenChange={onDropdownOpenChange}>
          <DropdownMenuTrigger
            render={(
              <SidebarMenuButton
                size="lg"
                className="
                  data-[state=open]:bg-sidebar-accent
                  data-[state=open]:text-sidebar-accent-foreground
                "
              />
            )}
          >
            <Avatar className="size-8">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm/tight">
              <span className="truncate font-medium">{user.name}</span>
              <span className="truncate text-xs">{user.email}</span>
            </div>
            <IconSelector className="ml-auto" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--anchor-width) min-w-56 rounded-lg"
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="
                  flex items-center gap-2 px-1 py-1.5 text-left text-sm
                "
                >
                  <Avatar className="size-8">
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm/tight">
                    <span className="truncate font-medium">{user.name}</span>
                    <span className="truncate text-xs">{user.email}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => onOpenSettings('profile')}>
                <IconUserCircle />
                <span>{t('navigation.profile')}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenInviteMemberSettings}>
                <IconUserPlus />
                <span>{t('navigation.inviteMember')}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onOpenSettings('general')}>
                <IconSettings />
                <span>{t('navigation.settings')}</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => void onSignOut()}>
                <SignOutIcon />
                <span>{t('common.signOut')}</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
