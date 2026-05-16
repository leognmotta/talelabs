import type { ReactNode } from 'react'

import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@connecto/ui/components/sidebar'
import { NavLink, useLocation } from 'react-router'

export function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon: ReactNode
    end?: boolean
  }[]
}) {
  const location = useLocation()

  return (
    <SidebarGroup>
      <SidebarMenu>
        {items.map((item) => {
          const isActive = item.end
            ? location.pathname === item.url
            : location.pathname.startsWith(item.url)

          return (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                <NavLink to={item.url} end={item.end}>
                  {item.icon}
                  <span>{item.title}</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
