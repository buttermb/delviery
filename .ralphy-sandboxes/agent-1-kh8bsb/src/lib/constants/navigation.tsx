/**
 * Navigation Configuration - Workflow-Based
 * Organized by business function with role-based filtering
 */

import React from 'react';
import {
  LayoutDashboard, Package, FileText, Truck, Warehouse,
  Menu, Users, DollarSign, BarChart3, Image, Tag,
  Settings, Shield, Bell, Printer, Plug, HelpCircle
} from 'lucide-react';

export interface NavItem {
  name: string;
  href?: string;
  icon: React.ReactNode;
  roles?: string[];
  children?: NavItem[];
}

export const navigation: NavItem[] = [
  {
    name: 'Dashboard',
    href: '/admin/dashboard',
    icon: <LayoutDashboard className="h-5 w-5" />,
    roles: ['all'],
  },
  {
    name: 'Operations',
    icon: <Package className="h-5 w-5" />,
    roles: ['owner', 'manager', 'runner', 'warehouse'],
    children: [
      {
        name: 'Orders',
        href: '/admin/orders?tab=wholesale',
        icon: <FileText className="h-4 w-4" />,
        roles: ['owner', 'manager', 'runner'],
      },
      {
        name: 'Transfers & Delivery',
        href: '/admin/dispatch-inventory',
        icon: <Truck className="h-4 w-4" />,
        roles: ['owner', 'manager', 'runner', 'warehouse'],
      },
      {
        name: 'Inventory',
        href: '/admin/inventory-hub?tab=stock',
        icon: <Package className="h-4 w-4" />,
        roles: ['owner', 'manager', 'warehouse'],
      },
      {
        name: 'Receiving & Packaging',
        href: '/admin/operations/receiving',
        icon: <Warehouse className="h-4 w-4" />,
        roles: ['owner', 'manager', 'warehouse'],
      },
    ],
  },
  {
    name: 'Sales & Menu',
    icon: <Menu className="h-5 w-5" />,
    roles: ['owner', 'manager'],
    children: [
      {
        name: 'Disposable Menus',
        href: '/admin/disposable-menus',
        icon: <Menu className="h-4 w-4" />,
        roles: ['owner', 'manager'],
      },
      {
        name: 'Customers',
        href: '/admin/customer-hub',
        icon: <Users className="h-4 w-4" />,
        roles: ['owner', 'manager'],
      },
      {
        name: 'Pricing & Deals',
        href: '/admin/sales/pricing',
        icon: <DollarSign className="h-4 w-4" />,
        roles: ['owner', 'manager'],
      },
      {
        name: 'Sales Analytics',
        href: '/admin/sales-dashboard',
        icon: <BarChart3 className="h-4 w-4" />,
        roles: ['owner', 'manager'],
      },
    ],
  },
  {
    name: 'Catalog',
    icon: <Tag className="h-5 w-5" />,
    roles: ['owner', 'manager', 'warehouse', 'viewer'],
    children: [
      {
        name: 'Products',
        href: '/admin/inventory-hub?tab=products',
        icon: <Package className="h-4 w-4" />,
        roles: ['owner', 'manager', 'warehouse', 'viewer'],
      },
      {
        name: 'Images & Media',
        href: '/admin/catalog/images',
        icon: <Image className="h-4 w-4" />,
        roles: ['owner', 'manager'],
      },
      {
        name: 'Batches & Lots',
        href: '/admin/catalog/batches',
        icon: <Tag className="h-4 w-4" />,
        roles: ['owner', 'manager', 'warehouse'],
      },
      {
        name: 'Categories & Tags',
        href: '/admin/catalog/categories',
        icon: <Tag className="h-4 w-4" />,
        roles: ['owner', 'manager'],
      },
    ],
  },
  {
    name: 'Locations',
    icon: <Warehouse className="h-5 w-5" />,
    roles: ['owner', 'manager', 'runner', 'warehouse'],
    children: [
      {
        name: 'Warehouses',
        href: '/admin/locations/warehouses',
        icon: <Warehouse className="h-4 w-4" />,
        roles: ['owner', 'manager', 'warehouse'],
      },
      {
        name: 'Runners & Vehicles',
        href: '/admin/locations/runners',
        icon: <Truck className="h-4 w-4" />,
        roles: ['owner', 'manager', 'runner'],
      },
      {
        name: 'Location Analytics',
        href: '/admin/location-analytics',
        icon: <BarChart3 className="h-4 w-4" />,
        roles: ['owner', 'manager'],
      },
    ],
  },
  {
    name: 'Finance',
    icon: <DollarSign className="h-5 w-5" />,
    roles: ['owner', 'manager'],
    children: [
      {
        name: 'Financial Center',
        href: '/admin/finance-hub',
        icon: <DollarSign className="h-4 w-4" />,
        roles: ['owner', 'manager'],
      },
    ],
  },
  {
    name: 'Team',
    icon: <Users className="h-5 w-5" />,
    roles: ['owner', 'manager'],
    children: [
      {
        name: 'Staff Management',
        href: '/admin/team-members',
        icon: <Users className="h-4 w-4" />,
        roles: ['owner', 'manager'],
      },
      {
        name: 'Roles & Permissions',
        href: '/admin/settings',
        icon: <Shield className="h-4 w-4" />,
        roles: ['owner'],
      },
      {
        name: 'Activity Log',
        href: '/admin/audit-trail',
        icon: <FileText className="h-4 w-4" />,
        roles: ['owner', 'manager'],
      },
    ],
  },
  {
    name: 'Reports',
    icon: <BarChart3 className="h-5 w-5" />,
    roles: ['owner', 'manager', 'viewer'],
    children: [
      {
        name: 'Business Intelligence',
        href: '/admin/analytics-dashboard',
        icon: <BarChart3 className="h-4 w-4" />,
        roles: ['owner', 'manager'],
      },
      {
        name: 'Chain of Custody',
        href: '/admin/reports',
        icon: <FileText className="h-4 w-4" />,
        roles: ['owner', 'manager'],
      },
      {
        name: 'Inventory Reports',
        href: '/admin/reports',
        icon: <Package className="h-4 w-4" />,
        roles: ['owner', 'manager', 'viewer'],
      },
      {
        name: 'Financial Reports',
        href: '/admin/reports',
        icon: <DollarSign className="h-4 w-4" />,
        roles: ['owner', 'manager'],
      },
    ],
  },
  {
    name: 'Settings',
    icon: <Settings className="h-5 w-5" />,
    roles: ['owner', 'manager'],
    children: [
      {
        name: 'General Settings',
        href: '/admin/settings',
        icon: <Settings className="h-4 w-4" />,
        roles: ['owner'],
      },
      {
        name: 'Security',
        href: '/admin/settings',
        icon: <Shield className="h-4 w-4" />,
        roles: ['owner'],
      },
      {
        name: 'Notifications',
        href: '/admin/notifications',
        icon: <Bell className="h-4 w-4" />,
        roles: ['owner', 'manager'],
      },
      {
        name: 'Printing & Labels',
        href: '/admin/generate-barcodes',
        icon: <Printer className="h-4 w-4" />,
        roles: ['owner', 'manager'],
      },
      {
        name: 'Integrations',
        href: '/admin/settings',
        icon: <Plug className="h-4 w-4" />,
        roles: ['owner'],
      },
      {
        name: 'Help & Resources',
        href: '/admin/help',
        icon: <HelpCircle className="h-4 w-4" />,
        roles: ['owner', 'manager', 'viewer'],
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
    .map(item => ({
      ...item,
      children: item.children?.filter(child =>
        !child.roles || child.roles.includes('all') || child.roles.includes(role)
      ),
    }));
}

