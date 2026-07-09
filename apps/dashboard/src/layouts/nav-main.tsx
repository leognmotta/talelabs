import type { ReactNode } from 'react'

import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@talelabs/ui/components/sidebar'
import { NavLink, useLocation } from 'react-router'

interface NavMainSubItem {
  title: string
  url: string
  end?: boolean
}

interface NavMainItem {
  title: string
  url: string
  icon: ReactNode
  end?: boolean
  items?: NavMainSubItem[]
}

export function NavMain({
  items,
}: {
  items: NavMainItem[]
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
              <SidebarMenuButton
                isActive={isActive}
                tooltip={item.title}
                render={<NavLink to={item.url} end={item.end} />}
              >
                {item.icon}
                <span>{item.title}</span>
              </SidebarMenuButton>
              {item.items?.length && (
                <SidebarMenuSub>
                  {item.items.map((subItem) => {
                    const isSubItemActive = subItem.end
                      ? location.pathname === subItem.url
                      : location.pathname.startsWith(subItem.url)

                    return (
                      <SidebarMenuSubItem key={subItem.title}>
                        <SidebarMenuSubButton
                          isActive={isSubItemActive}
                          render={<NavLink to={subItem.url} end={subItem.end} />}
                        >
                          <span>{subItem.title}</span>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    )
                  })}
                </SidebarMenuSub>
              )}
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
