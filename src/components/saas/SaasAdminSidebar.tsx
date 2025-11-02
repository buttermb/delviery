/**
 * SaaS Admin Sidebar Component
 * Provides navigation for the super admin platform
 */

import { NavLink, useLocation } from 'react-router-dom';
import {
  Building2,
  BarChart3,
  Settings,
  Ticket,
  Zap,
  LayoutDashboard,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';

const menuItems = [
  {
    title: 'Dashboard',
    url: '/saas/admin',
    icon: LayoutDashboard,
  },
  {
    title: 'Analytics',
    url: '/saas/admin/analytics',
    icon: BarChart3,
  },
  {
    title: 'Support',
    url: '/saas/admin/support',
    icon: Ticket,
  },
  {
    title: 'Automation',
    url: '/saas/admin/automation',
    icon: Zap,
  },
  {
    title: 'Settings',
    url: '/saas/admin/settings',
    icon: Settings,
  },
];

export function SaasAdminSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const collapsed = state === 'collapsed';

  const isActive = (path: string) => {
    if (path === '/saas/admin') {
      return currentPath === path;
    }
    return currentPath.startsWith(path);
  };

  const getNavCls = (active: boolean) =>
    active
      ? 'bg-primary/10 text-primary font-medium border-l-2 border-primary'
      : 'hover:bg-muted/50';

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarContent>
        <SidebarGroup>
          <div className="flex items-center justify-between px-4 py-3 border-b">
            {!collapsed && (
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <span className="font-semibold">Platform Admin</span>
              </div>
            )}
            {collapsed && (
              <Building2 className="h-5 w-5 text-primary mx-auto" />
            )}
          </div>

          <SidebarGroupLabel className={collapsed ? 'sr-only' : ''}>
            Navigation
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.url === '/saas/admin'}
                        className={getNavCls(active)}
                      >
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
