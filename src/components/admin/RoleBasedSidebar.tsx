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
import { LogOut, ChevronDown } from 'lucide-react';
import { getNavigationForRole } from '@/lib/constants/navigation';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import type { LucideIcon } from 'lucide-react';

export function RoleBasedSidebar() {
  const { state } = useSidebar();
  const { session } = useAdminAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState<string>('owner');
  const [expandedSections, setExpandedSections] = useState<string[]>([]);

  // Get user role
  useEffect(() => {
    const fetchRole = async () => {
      if (session?.user) {
        // Check if user has role in admin_users table
        const { data } = await supabase
          .from('admin_users')
          .select('role')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (data && data.role) {
          // Map admin role to our role system
          const roleMap: Record<string, string> = {
            'super_admin': 'owner',
            'admin': 'manager',
            'compliance_officer': 'viewer',
            'support': 'viewer',
          };
          setUserRole(roleMap[data.role] || 'owner');
        }
      }
    };
    fetchRole();
  }, [session]);

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
    navigate('/admin/login');
  };

  // Helper to render icon - extract component first
  const renderIcon = (Icon: LucideIcon, className: string) => {
    // Extract to avoid build issues
    const Component = Icon;
    return <Component className={className} />;
  };

  return (
    <Sidebar className={isCollapsed ? 'w-14' : 'w-64'} collapsible="icon">
      <SidebarHeader className="border-b p-4">
        {!isCollapsed && (
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">🌿 Your Company</h2>
            <p className="text-xs text-muted-foreground truncate">
              {session?.user?.email}
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
                        'hover:bg-muted',
                        hasActiveChild && 'bg-primary/10 text-primary'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span className={cn(
                          'flex-shrink-0',
                          hasActiveChild ? 'text-primary' : 'text-muted-foreground'
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
                        {item.children.map((child) => (
                          <SidebarMenuItem key={child.href}>
                            <SidebarMenuButton asChild>
                              <NavLink
                                to={child.href || '#'}
                                className={({ isActive }) =>
                                  cn(
                                    'flex items-center gap-3',
                                    isActive
                                      ? 'bg-primary/10 text-primary font-medium'
                                      : ''
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
                        ))}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </CollapsibleContent>
                </SidebarGroup>
              </Collapsible>
            );
          }

          return (
            <SidebarGroup key={item.name}>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink
                    to={item.href || '#'}
                    className={({ isActive }) =>
                      cn(
                        isActive && 'bg-primary/10 text-primary font-medium'
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

      <div className="mt-auto p-4 border-t">
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4" />
          {!isCollapsed && <span className="ml-2">Sign Out</span>}
        </Button>
      </div>
    </Sidebar>
  );
}
