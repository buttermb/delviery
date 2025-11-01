/**
 * Navigation Configuration - Workflow-Based
 * Organized by business function with role-based filtering
 */

import { 
  LayoutDashboard, Package, FileText, Truck, Warehouse,
  Menu, Users, DollarSign, BarChart3, Image, Tag,
  Settings, Shield, Bell, Printer, Plug,
  type LucideIcon
} from 'lucide-react';

export interface NavItem {
  name: string;
  href?: string;
  icon: LucideIcon;
  iconSize?: string;
  roles?: string[];
  children?: NavItem[];
}

export const navigation: NavItem[] = [
  {
    name: 'Dashboard',
    href: '/admin/big-plug-dashboard',
    icon: LayoutDashboard,
    iconSize: 'h-5 w-5',
    roles: ['all'],
  },
  {
    name: 'Operations',
    icon: Package,
    iconSize: 'h-5 w-5',
    roles: ['owner', 'manager', 'runner', 'warehouse'],
    children: [
      { 
        name: 'Orders', 
        href: '/admin/big-plug-order', 
        icon: FileText,
        iconSize: 'h-4 w-4',
        roles: ['owner', 'manager', 'runner'],
      },
      { 
        name: 'Transfers & Delivery', 
        href: '/admin/inventory/dispatch', 
        icon: Truck,
        iconSize: 'h-4 w-4',
        roles: ['owner', 'manager', 'runner', 'warehouse'],
      },
      { 
        name: 'Inventory', 
        href: '/admin/big-plug-inventory', 
        icon: Package,
        iconSize: 'h-4 w-4',
        roles: ['owner', 'manager', 'warehouse'],
      },
      { 
        name: 'Receiving & Packaging', 
        href: '/admin/operations/receiving', 
        icon: Warehouse,
        iconSize: 'h-4 w-4',
        roles: ['owner', 'manager', 'warehouse'],
      },
    ],
  },
  {
    name: 'Sales & Menu',
    icon: Menu,
    iconSize: 'h-5 w-5',
    roles: ['owner', 'manager'],
    children: [
      { 
        name: 'Disposable Menus', 
        href: '/admin/disposable-menus', 
        icon: Menu,
        iconSize: 'h-4 w-4',
        roles: ['owner', 'manager'],
      },
      { 
        name: 'Customers', 
        href: '/admin/big-plug-clients', 
        icon: Users,
        iconSize: 'h-4 w-4',
        roles: ['owner', 'manager'],
      },
      { 
        name: 'Pricing & Deals', 
        href: '/admin/sales/pricing', 
        icon: DollarSign,
        iconSize: 'h-4 w-4',
        roles: ['owner', 'manager'],
      },
      { 
        name: 'Sales Analytics', 
        href: '/admin/analytics/comprehensive', 
        icon: BarChart3,
        iconSize: 'h-4 w-4',
        roles: ['owner', 'manager'],
      },
    ],
  },
  {
    name: 'Catalog',
    icon: Tag,
    iconSize: 'h-5 w-5',
    roles: ['owner', 'manager', 'warehouse', 'viewer'],
    children: [
      { 
        name: 'Products', 
        href: '/admin/inventory/products', 
        icon: Package,
        iconSize: 'h-4 w-4',
        roles: ['owner', 'manager', 'warehouse', 'viewer'],
      },
      { 
        name: 'Images & Media', 
        href: '/admin/catalog/images', 
        icon: Image,
        iconSize: 'h-4 w-4',
        roles: ['owner', 'manager'],
      },
      { 
        name: 'Batches & Lots', 
        href: '/admin/catalog/batches', 
        icon: Tag,
        iconSize: 'h-4 w-4',
        roles: ['owner', 'manager', 'warehouse'],
      },
      { 
        name: 'Categories & Tags', 
        href: '/admin/catalog/categories', 
        icon: Tag,
        iconSize: 'h-4 w-4',
        roles: ['owner', 'manager'],
      },
    ],
  },
  {
    name: 'Locations',
    icon: Warehouse,
    iconSize: 'h-5 w-5',
    roles: ['owner', 'manager', 'runner', 'warehouse'],
    children: [
      { 
        name: 'Warehouses', 
        href: '/admin/locations/warehouses', 
        icon: Warehouse,
        iconSize: 'h-4 w-4',
        roles: ['owner', 'manager', 'warehouse'],
      },
      { 
        name: 'Runners & Vehicles', 
        href: '/admin/locations/runners', 
        icon: Truck,
        iconSize: 'h-4 w-4',
        roles: ['owner', 'manager', 'runner'],
      },
      { 
        name: 'Location Analytics', 
        href: '/admin/analytics/comprehensive', 
        icon: BarChart3,
        iconSize: 'h-4 w-4',
        roles: ['owner', 'manager'],
      },
    ],
  },
  {
    name: 'Finance',
    icon: DollarSign,
    iconSize: 'h-5 w-5',
    roles: ['owner', 'manager'],
    children: [
      { 
        name: 'Payments & Invoices', 
        href: '/admin/financial-center', 
        icon: DollarSign,
        iconSize: 'h-4 w-4',
        roles: ['owner', 'manager'],
      },
      { 
        name: 'Revenue Reports', 
        href: '/admin/big-plug-financial', 
        icon: BarChart3,
        iconSize: 'h-4 w-4',
        roles: ['owner', 'manager'],
      },
      { 
        name: 'Credit Management', 
        href: '/admin/big-plug-financial', 
        icon: DollarSign,
        iconSize: 'h-4 w-4',
        roles: ['owner', 'manager'],
      },
      { 
        name: 'Financial Analytics', 
        href: '/admin/analytics/comprehensive', 
        icon: BarChart3,
        iconSize: 'h-4 w-4',
        roles: ['owner'],
      },
    ],
  },
  {
    name: 'Team',
    icon: Users,
    iconSize: 'h-5 w-5',
    roles: ['owner', 'manager'],
    children: [
      { 
        name: 'Staff Management', 
        href: '/admin/team', 
        icon: Users,
        iconSize: 'h-4 w-4',
        roles: ['owner', 'manager'],
      },
      { 
        name: 'Roles & Permissions', 
        href: '/admin/settings', 
        icon: Shield,
        iconSize: 'h-4 w-4',
        roles: ['owner'],
      },
      { 
        name: 'Activity Log', 
        href: '/admin/audit-logs', 
        icon: FileText,
        iconSize: 'h-4 w-4',
        roles: ['owner', 'manager'],
      },
    ],
  },
  {
    name: 'Reports',
    icon: BarChart3,
    iconSize: 'h-5 w-5',
    roles: ['owner', 'manager', 'viewer'],
    children: [
      { 
        name: 'Business Intelligence', 
        href: '/admin/analytics/comprehensive', 
        icon: BarChart3,
        iconSize: 'h-4 w-4',
        roles: ['owner', 'manager'],
      },
      { 
        name: 'Chain of Custody', 
        href: '/admin/reports-new', 
        icon: FileText,
        iconSize: 'h-4 w-4',
        roles: ['owner', 'manager'],
      },
      { 
        name: 'Inventory Reports', 
        href: '/admin/reports-new', 
        icon: Package,
        iconSize: 'h-4 w-4',
        roles: ['owner', 'manager', 'viewer'],
      },
      { 
        name: 'Financial Reports', 
        href: '/admin/reports-new', 
        icon: DollarSign,
        iconSize: 'h-4 w-4',
        roles: ['owner', 'manager'],
      },
    ],
  },
  {
    name: 'Settings',
    icon: Settings,
    iconSize: 'h-5 w-5',
    roles: ['owner', 'manager'],
    children: [
      { 
        name: 'General Settings', 
        href: '/admin/settings', 
        icon: Settings,
        iconSize: 'h-4 w-4',
        roles: ['owner'],
      },
      { 
        name: 'Security', 
        href: '/admin/settings', 
        icon: Shield,
        iconSize: 'h-4 w-4',
        roles: ['owner'],
      },
      { 
        name: 'Notifications', 
        href: '/admin/notifications', 
        icon: Bell,
        iconSize: 'h-4 w-4',
        roles: ['owner', 'manager'],
      },
      { 
        name: 'Printing & Labels', 
        href: '/admin/inventory/barcodes', 
        icon: Printer,
        iconSize: 'h-4 w-4',
        roles: ['owner', 'manager'],
      },
      { 
        name: 'Integrations', 
        href: '/admin/settings', 
        icon: Plug,
        iconSize: 'h-4 w-4',
        roles: ['owner'],
      },
    ],
  },
];

/**
 * Get navigation items filtered by role
 */
export function getNavigationForRole(role: string | null | undefined): NavItem[] {
  if (!role) return [];
  
  return navigation
    .filter(item => !item.roles || item.roles.includes('all') || item.roles.includes(role))
    .map(item => {
      const filteredChildren = item.children?.filter(child =>
        !child.roles || child.roles.includes('all') || child.roles.includes(role)
      );
      
      return {
        name: item.name,
        href: item.href,
        icon: item.icon, // Preserve icon component reference
        iconSize: item.iconSize,
        roles: item.roles,
        children: filteredChildren,
      };
    });
}
