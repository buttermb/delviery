/**
 * SaaS Admin Sidebar Component - Dark Theme
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
  Users,
  Shield,
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

const menuItems = [
  {
    title: 'Dashboard',
    url: '/super-admin/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'Tenants',
    url: '/super-admin/tenants',
    icon: Building2,
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
    url: '/super-admin/settings',
    icon: Settings,
  },
];

export function SaasAdminSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const collapsed = state === 'collapsed';

  const isActive = (path: string) => {
    if (path === '/super-admin/dashboard') {
      return currentPath === path || currentPath.startsWith('/super-admin/tenants');
    }
    return currentPath.startsWith(path);
  };

  return (
    <Sidebar 
      collapsible="icon" 
      className="border-r border-white/10 bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl"
    >
      <SidebarContent>
        <SidebarGroup>
          <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
            {!collapsed ? (
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[hsl(var(--super-admin-primary))] to-[hsl(var(--super-admin-secondary))] flex items-center justify-center">
                  <Shield className="h-4 w-4 text-white" />
                </div>
                <span className="font-semibold text-[hsl(var(--super-admin-text))]">Platform Admin</span>
              </div>
            ) : (
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[hsl(var(--super-admin-primary))] to-[hsl(var(--super-admin-secondary))] flex items-center justify-center mx-auto">
                <Shield className="h-4 w-4 text-white" />
              </div>
            )}
          </div>

          <SidebarGroupLabel className={`${collapsed ? 'sr-only' : ''} text-[hsl(var(--super-admin-text))]/70 px-4`}>
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
                        end={item.url === '/super-admin/dashboard'}
                        className={`
                          ${active 
                            ? 'bg-[hsl(var(--super-admin-primary))]/20 text-[hsl(var(--super-admin-primary))] border-l-2 border-[hsl(var(--super-admin-primary))]' 
                            : 'hover:bg-white/5 text-[hsl(var(--super-admin-text))]/80'
                          }
                          transition-colors
                        `}
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
