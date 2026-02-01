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
  Activity,
  TrendingUp,
  Database,
  Globe,
  FileText,
  Workflow,
  Mail,
  Flag,
  Wrench,
  Lock,
  MessageSquare,
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
import FloraIQLogo from '@/components/FloraIQLogo';

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
    title: 'Monitoring',
    url: '/super-admin/monitoring',
    icon: Activity,
  },
  {
    title: 'Analytics',
    url: '/super-admin/analytics',
    icon: BarChart3,
  },
  {
    title: 'Revenue Analytics',
    url: '/super-admin/revenue-analytics',
    icon: TrendingUp,
  },
  {
    title: 'Data Explorer',
    url: '/super-admin/data-explorer',
    icon: Database,
  },
  {
    title: 'API Usage',
    url: '/super-admin/api-usage',
    icon: Globe,
  },
  {
    title: 'Audit Logs',
    url: '/super-admin/audit-logs',
    icon: FileText,
  },
  {
    title: 'Workflows',
    url: '/super-admin/workflows',
    icon: Workflow,
  },
  {
    title: 'Communication',
    url: '/super-admin/communication',
    icon: Mail,
  },
  {
    title: 'Forum Approvals',
    url: '/super-admin/forum-approvals',
    icon: MessageSquare,
  },
  {
    title: 'Feature Flags',
    url: '/super-admin/feature-flags',
    icon: Flag,
  },
  {
    title: 'Report Builder',
    url: '/super-admin/report-builder',
    icon: BarChart3,
  },
  {
    title: 'Executive Dashboard',
    url: '/super-admin/executive-dashboard',
    icon: TrendingUp,
  },
  {
    title: 'Security',
    url: '/super-admin/security',
    icon: Lock,
  },
  {
    title: 'System Config',
    url: '/super-admin/system-config',
    icon: Settings,
  },
  {
    title: 'Tools',
    url: '/super-admin/tools',
    icon: Wrench,
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
    // Exact match for specific routes
    if (currentPath === path) return true;
    // For routes with sub-paths, check if current path starts with the route
    return currentPath.startsWith(path + '/') || currentPath === path;
  };

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-white/10 bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl hidden lg:flex"
    >
      <SidebarContent>
        <SidebarGroup>
          <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
            {!collapsed ? (
              <div className="flex items-center gap-2">
                <FloraIQLogo size="md" className="text-[hsl(var(--super-admin-text))]" />
                <span className="text-xs text-[hsl(var(--super-admin-text))]/70 border-l border-[hsl(var(--super-admin-text))]/20 pl-2">Admin</span>
              </div>
            ) : (
              <div className="mx-auto">
                <FloraIQLogo size="md" iconOnly className="text-[hsl(var(--super-admin-text))]" />
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
