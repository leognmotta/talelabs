import type { ReactNode } from 'react'

import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@talelabs/ui/components/sidebar'
import { NavLink, useLocation } from 'react-router'

interface NavMainItem {
  title: string
  url: string
  icon: ReactNode
  end?: boolean
  hidden?: boolean
}

export function NavMain({
  items,
}: {
  items: NavMainItem[]
}) {
  const location = useLocation()
  const visibleItems = items.filter(item => !item.hidden)

  return (
    <SidebarGroup>
      <SidebarMenu>
        {visibleItems.map((item) => {
          const isActive = item.end
            ? location.pathname === item.url
            : location.pathname.startsWith(item.url)

          return (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                isActive={isActive}
                tooltip={item.title}
                className="data-active:[&_svg]:text-primary"
                render={<NavLink to={item.url} end={item.end} />}
              >
                {item.icon}
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
