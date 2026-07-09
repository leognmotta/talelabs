import type { TablerIcon } from '@tabler/icons-react'
import type { ThemePreference } from '../shared/lib/theme'

import { IconSelector } from '@tabler/icons-react'
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

export function NavUser({
  onSignOut,
  onThemeChange,
  signOutIcon: SignOutIcon,
  theme,
  themeItems,
  user,
}: {
  onSignOut: () => Promise<void>
  onThemeChange: (theme: ThemePreference) => void
  signOutIcon: TablerIcon
  theme: ThemePreference
  themeItems: {
    icon: TablerIcon
    label: string
    value: ThemePreference
  }[]
  user: {
    name: string
    email: string
  }
}) {
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
        <DropdownMenu>
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
            <Avatar className="size-8 rounded-lg">
              <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
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
                  <Avatar className="size-8 rounded-lg">
                    <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
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
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Theme
              </DropdownMenuLabel>
              {themeItems.map(item => (
                <DropdownMenuItem
                  key={item.value}
                  onClick={() => onThemeChange(item.value)}
                >
                  <item.icon />
                  <span>{item.label}</span>
                  {theme === item.value && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      Active
                    </span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => void onSignOut()}>
                <SignOutIcon />
                <span>Sign out</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
