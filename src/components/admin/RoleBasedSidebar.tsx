/**
 * Role-Based Sidebar - Uses workflow-based navigation with role filtering
 */

import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import LogOut from "lucide-react/dist/esm/icons/log-out";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import { getNavigationForRole } from '@/lib/constants/navigation';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import type { LucideIcon } from 'lucide-react';
import { prefetchOnHover } from '@/lib/utils/prefetch';

export function RoleBasedSidebar() {
  const { state } = useSidebar();
  const { admin, tenant } = useTenantAdminAuth();
  const { tenantSlug, buildAdminUrl } = useTenantNavigation();
  const location = useLocation();
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState<string>('owner');
  const [expandedSections, setExpandedSections] = useState<string[]>([]);

  // Get user role
  useEffect(() => {
    const fetchRole = async () => {
      if (admin) {
        // Use tenant admin role
        setUserRole('owner');
      }
    };
    fetchRole();
  }, [admin]);

  const navigation = getNavigationForRole(userRole);
  const isCollapsed = state === 'collapsed';

  // Auto-expand section if current path matches
  useEffect(() => {
    const currentSection = navigation.find(
      section => section.children?.some(child => child.href === location.pathname)
    );
    if (currentSection && !expandedSections.includes(currentSection.name)) {
      setExpandedSections([...expandedSections, currentSection.name]);
    }
  }, [location.pathname, navigation]);

  const toggleSection = (name: string) => {
    setExpandedSections(prev =>
      prev.includes(name)
        ? prev.filter(n => n !== name)
        : [...prev, name]
    );
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast({ title: 'Signed out successfully' });

    // Navigate to appropriate login page based on context
    if (tenantSlug) {
      navigate(`/${tenantSlug}/admin/login`);
    } else if (tenant) {
      navigate(`/${tenant.slug}/admin/login`);
    } else {
      navigate('/login');
    }
  };

  // Helper to render icon - extract component first
  const renderIcon = (Icon: LucideIcon, className: string) => {
    // Extract to avoid build issues
    const Component = Icon;
    return <Component className={className} />;
  };

  return (
    <Sidebar className={`${isCollapsed ? 'w-14' : 'w-64'} collapsible="icon" border-r border-[hsl(var(--tenant-border))] bg-[hsl(var(--tenant-bg))]`}>
      <SidebarHeader className="border-b border-[hsl(var(--tenant-border))] p-4 bg-[hsl(var(--tenant-surface))]">
        {!isCollapsed && (
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">{tenant?.business_name || 'Your Company'}</h2>
            <p className="text-xs text-muted-foreground truncate">
              {admin?.email}
            </p>
          </div>
        )}
        {isCollapsed && (
          <div className="flex justify-center">
            <span className="text-2xl">🌿</span>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        {navigation.map((item) => {
          if (item.children) {
            const isExpanded = expandedSections.includes(item.name);
            const hasActiveChild = item.children.some(child =>
              location.pathname === child.href || location.pathname.startsWith(child.href + '/')
            );

            return (
              <Collapsible
                key={item.name}
                open={isExpanded}
                onOpenChange={() => toggleSection(item.name)}
              >
                <SidebarGroup>
                  <SidebarGroupLabel asChild>
                    <CollapsibleTrigger
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-2 rounded-lg',
                        'text-sm font-medium transition-colors',
                        'hover:bg-[hsl(var(--tenant-surface))]',
                        hasActiveChild && 'bg-[hsl(var(--tenant-primary))]/10 text-[hsl(var(--tenant-primary))]'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span className={cn(
                          'flex-shrink-0',
                          hasActiveChild ? 'text-[hsl(var(--tenant-primary))]' : 'text-[hsl(var(--tenant-text-light))]'
                        )}>
                          {renderIcon(item.icon, item.iconSize || 'h-5 w-5')}
                        </span>
                        {!isCollapsed && <span>{item.name}</span>}
                      </div>
                      {!isCollapsed && (
                        <ChevronDown
                          className={cn(
                            'h-4 w-4 transition-transform',
                            isExpanded && 'rotate-180'
                          )}
                        />
                      )}
                    </CollapsibleTrigger>
                  </SidebarGroupLabel>
                  <CollapsibleContent>
                    <SidebarGroupContent>
                      <SidebarMenu>
                        {item.children.map((child) => {
                          // Handle tenant-aware routes
                          const href = child.href ? buildAdminUrl(child.href) : '#';

                          return (
                            <SidebarMenuItem key={href}>
                              <SidebarMenuButton asChild>
                                <NavLink
                                  to={href}
                                  className={({ isActive }) =>
                                    cn(
                                      'flex items-center gap-3',
                                      isActive
                                        ? 'bg-[hsl(var(--tenant-primary))]/10 text-[hsl(var(--tenant-primary))] font-medium'
                                        : 'text-[hsl(var(--tenant-text))] hover:bg-[hsl(var(--tenant-surface))]'
                                    )
                                  }
                                >
                                  <span className="flex-shrink-0">
                                    {renderIcon(child.icon, child.iconSize || 'h-4 w-4')}
                                  </span>
                                  {!isCollapsed && <span>{child.name}</span>}
                                </NavLink>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          );
                        })}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </CollapsibleContent>
                </SidebarGroup>
              </Collapsible>
            );
          }

          // Handle tenant-aware routes for top-level items
          const href = item.href ? buildAdminUrl(item.href) : '#';

          return (
            <SidebarGroup key={item.name}>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink
                    to={href}
                    onMouseEnter={() => prefetchOnHover(href)}
                    className={({ isActive }) =>
                      cn(
                        isActive
                          ? 'bg-[hsl(var(--tenant-primary))]/10 text-[hsl(var(--tenant-primary))] font-medium'
                          : 'text-[hsl(var(--tenant-text))] hover:bg-[hsl(var(--tenant-surface))]'
                      )
                    }
                  >
                    <span className="flex-shrink-0">
                      {renderIcon(item.icon, item.iconSize || 'h-5 w-5')}
                    </span>
                    {!isCollapsed && <span>{item.name}</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <div className="mt-auto p-4 border-t border-[hsl(var(--tenant-border))]">
        <Button
          variant="ghost"
          className="w-full justify-start text-[hsl(var(--tenant-text))] hover:bg-[hsl(var(--tenant-surface))]"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4" />
          {!isCollapsed && <span className="ml-2">Sign Out</span>}
        </Button>
      </div>
    </Sidebar>
  );
}
