import type { LucideIcon } from 'lucide-react'
import type { ThemePreference } from '../lib/theme'

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
import { ChevronsUpDownIcon } from 'lucide-react'

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
  signOutIcon: LucideIcon
  theme: ThemePreference
  themeItems: {
    icon: LucideIcon
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
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="
                data-[state=open]:bg-sidebar-accent
                data-[state=open]:text-sidebar-accent-foreground
              "
            >
              <Avatar className="size-8 rounded-lg">
                <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm/tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs">{user.email}</span>
              </div>
              <ChevronsUpDownIcon className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="
              w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg
            "
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
          >
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
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Theme
            </DropdownMenuLabel>
            <DropdownMenuGroup>
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
            <DropdownMenuItem onClick={() => void onSignOut()}>
              <SignOutIcon />
              <span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
