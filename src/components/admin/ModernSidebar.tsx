/**
 * 🎨 Modern Sidebar - Workflow-Based Navigation
 * Organized by business function with collapsible sections
 */

import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Package,
  FileText,
  Truck,
  Warehouse,
  Menu,
  Users,
  DollarSign,
  BarChart3,
  Image,
  Tag,
  Settings,
  Shield,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface NavItem {
  name: string;
  href?: string;
  icon: React.ReactNode;
  children?: NavItem[];
}

const navigation: NavItem[] = [
  {
    name: 'Dashboard',
    href: '/admin/big-plug-dashboard',
    icon: <LayoutDashboard className="h-5 w-5" />,
  },
  {
    name: 'Operations',
    icon: <Package className="h-5 w-5" />,
    children: [
      { name: 'Orders', href: '/admin/big-plug-order', icon: <FileText className="h-4 w-4" /> },
      { name: 'Transfers & Delivery', href: '/admin/inventory/dispatch', icon: <Truck className="h-4 w-4" /> },
      { name: 'Inventory', href: '/admin/big-plug-inventory', icon: <Package className="h-4 w-4" /> },
      { name: 'Receiving & Packaging', href: '/admin/inventory/products', icon: <Warehouse className="h-4 w-4" /> },
    ],
  },
  {
    name: 'Sales & Menu',
    icon: <Menu className="h-5 w-5" />,
    children: [
      { name: 'Disposable Menus', href: '/admin/disposable-menus', icon: <Menu className="h-4 w-4" /> },
      { name: 'Customers', href: '/admin/big-plug-clients', icon: <Users className="h-4 w-4" /> },
      { name: 'Pricing & Deals', href: '/admin/wholesale-clients', icon: <DollarSign className="h-4 w-4" /> },
      { name: 'Sales Analytics', href: '/admin/analytics/comprehensive', icon: <BarChart3 className="h-4 w-4" /> },
    ],
  },
  {
    name: 'Catalog',
    icon: <Tag className="h-5 w-5" />,
    children: [
      { name: 'Products', href: '/admin/inventory/products', icon: <Package className="h-4 w-4" /> },
      { name: 'Images & Media', href: '/admin/inventory/products', icon: <Image className="h-4 w-4" /> },
      { name: 'Batches & Lots', href: '/admin/inventory/products', icon: <Tag className="h-4 w-4" /> },
      { name: 'Categories & Tags', href: '/admin/inventory/products', icon: <Tag className="h-4 w-4" /> },
    ],
  },
  {
    name: 'Locations',
    icon: <Warehouse className="h-5 w-5" />,
    children: [
      { name: 'Warehouses', href: '/admin/big-plug-inventory', icon: <Warehouse className="h-4 w-4" /> },
      { name: 'Runners & Vehicles', href: '/admin/fleet-management', icon: <Truck className="h-4 w-4" /> },
      { name: 'Location Analytics', href: '/admin/analytics/comprehensive', icon: <BarChart3 className="h-4 w-4" /> },
    ],
  },
  {
    name: 'Finance',
    icon: <DollarSign className="h-5 w-5" />,
    children: [
      { name: 'Payments & Invoices', href: '/admin/financial-center', icon: <DollarSign className="h-4 w-4" /> },
      { name: 'Revenue Reports', href: '/admin/big-plug-financial', icon: <BarChart3 className="h-4 w-4" /> },
      { name: 'Credit Management', href: '/admin/big-plug-financial', icon: <DollarSign className="h-4 w-4" /> },
      { name: 'Financial Analytics', href: '/admin/analytics/comprehensive', icon: <BarChart3 className="h-4 w-4" /> },
    ],
  },
  {
    name: 'Team',
    icon: <Users className="h-5 w-5" />,
    children: [
      { name: 'Staff Management', href: '/admin/team', icon: <Users className="h-4 w-4" /> },
      { name: 'Roles & Permissions', href: '/admin/settings', icon: <Shield className="h-4 w-4" /> },
      { name: 'Activity Log', href: '/admin/audit-logs', icon: <FileText className="h-4 w-4" /> },
    ],
  },
  {
    name: 'Settings',
    href: '/admin/settings',
    icon: <Settings className="h-5 w-5" />,
  },
];

export function ModernSidebar() {
  const location = useLocation();
  const [expandedSections, setExpandedSections] = useState<string[]>(() => {
    // Auto-expand section if current path matches
    const currentSection = navigation.find(
      section => section.children?.some(child => child.href === location.pathname)
    );
    return currentSection ? [currentSection.name] : [];
  });

  const toggleSection = (name: string) => {
    setExpandedSections(prev =>
      prev.includes(name)
        ? prev.filter(n => n !== name)
        : [...prev, name]
    );
  };

  const isActive = (href?: string) => {
    if (!href) return false;
    return location.pathname === href || location.pathname.startsWith(href + '/');
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-background border-r border-border flex flex-col z-40">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <NavLink to="/admin/big-plug-dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-lg">
            🌿
          </div>
          <span className="font-semibold text-lg">Your Company</span>
        </NavLink>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {navigation.map((item) => {
          if (item.children) {
            const isExpanded = expandedSections.includes(item.name);
            const hasActiveChild = item.children.some(child => isActive(child.href));

            return (
              <Collapsible
                key={item.name}
                open={isExpanded}
                onOpenChange={() => toggleSection(item.name)}
              >
                <CollapsibleTrigger
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-lg',
                    'text-sm font-medium transition-colors',
                    'hover:bg-muted',
                    hasActiveChild && 'bg-primary/10 text-primary'
                  )}
                >
                  <span className={cn(
                    'flex-shrink-0',
                    hasActiveChild ? 'text-primary' : 'text-muted-foreground'
                  )}>
                    {item.icon}
                  </span>
                  <span className="flex-1 text-left">{item.name}</span>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 transition-transform',
                      isExpanded && 'rotate-180'
                    )}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-1 ml-6 space-y-1">
                  {item.children.map((child) => (
                    <NavLink
                      key={child.href}
                      to={child.href || '#'}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm',
                          'transition-colors',
                          isActive
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        )
                      }
                    >
                      <span className="flex-shrink-0">{child.icon}</span>
                      <span>{child.name}</span>
                    </NavLink>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            );
          }

          return (
            <NavLink
              key={item.name}
              to={item.href || '#'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium',
                  'transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )
              }
            >
              <span className="flex-shrink-0">{item.icon}</span>
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <NavLink to="/admin/settings">
          <Button variant="ghost" className="w-full justify-start">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </NavLink>
      </div>
    </aside>
  );
}

