/**
 * Navigation Configuration - Workflow-Based
 * Organized by business function with role-based filtering
 */

import LayoutDashboard from "lucide-react/dist/esm/icons/layout-dashboard";
import Package from "lucide-react/dist/esm/icons/package";
import FileText from "lucide-react/dist/esm/icons/file-text";
import Truck from "lucide-react/dist/esm/icons/truck";
import Warehouse from "lucide-react/dist/esm/icons/warehouse";
import Menu from "lucide-react/dist/esm/icons/menu";
import Users from "lucide-react/dist/esm/icons/users";
import DollarSign from "lucide-react/dist/esm/icons/dollar-sign";
import BarChart3 from "lucide-react/dist/esm/icons/bar-chart-3";
import Image from "lucide-react/dist/esm/icons/image";
import Tag from "lucide-react/dist/esm/icons/tag";
import Settings from "lucide-react/dist/esm/icons/settings";
import Shield from "lucide-react/dist/esm/icons/shield";
import Bell from "lucide-react/dist/esm/icons/bell";
import Printer from "lucide-react/dist/esm/icons/printer";
import Plug from "lucide-react/dist/esm/icons/plug";
import TrendingUp from "lucide-react/dist/esm/icons/trending-up";
import Activity from "lucide-react/dist/esm/icons/activity";
import Zap from "lucide-react/dist/esm/icons/zap";
import Globe from "lucide-react/dist/esm/icons/globe";
import Code from "lucide-react/dist/esm/icons/code";
import Webhook from "lucide-react/dist/esm/icons/webhook";
import Clock from "lucide-react/dist/esm/icons/clock";
import Download from "lucide-react/dist/esm/icons/download";
import MapPin from "lucide-react/dist/esm/icons/map-pin";
import Key from "lucide-react/dist/esm/icons/key";
import LineChart from "lucide-react/dist/esm/icons/line-chart";
import PieChart from "lucide-react/dist/esm/icons/pie-chart";
import Building2 from "lucide-react/dist/esm/icons/building-2";
import CheckCircle from "lucide-react/dist/esm/icons/check-circle";
import Eye from "lucide-react/dist/esm/icons/eye";
import type LucideIcon from "lucide-react/dist/esm/icons/type lucide-icon";

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
        name: 'Stock Alerts',
        href: '/admin/stock-alerts',
        icon: Bell,
        iconSize: 'h-4 w-4',
        roles: ['owner', 'manager', 'warehouse'],
      },
      {
        name: 'Inventory Transfers',
        href: '/admin/inventory-transfers',
        icon: Truck,
        iconSize: 'h-4 w-4',
        roles: ['owner', 'manager', 'warehouse'],
      },
      {
        name: 'Bulk Operations',
        href: '/admin/bulk-operations',
        icon: Package,
        iconSize: 'h-4 w-4',
        roles: ['owner', 'manager'],
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
        name: 'Customer Insights',
        href: '/admin/customer-hub?tab=insights',
        icon: Eye,
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
        href: '/admin/inventory-hub?tab=products',
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
        href: '/admin/finance-hub',
        icon: DollarSign,
        iconSize: 'h-4 w-4',
        roles: ['owner', 'manager'],
      },
      {
        name: 'Revenue Reports',
        href: '/admin/revenue-reports',
        icon: BarChart3,
        iconSize: 'h-4 w-4',
        roles: ['owner', 'manager'],
      },
      {
        name: 'Commission Tracking',
        href: '/admin/commission-tracking',
        icon: DollarSign,
        iconSize: 'h-4 w-4',
        roles: ['owner', 'manager'],
      },
      {
        name: 'Expense Tracking',
        href: '/admin/expense-tracking',
        icon: FileText,
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
        name: 'Cash Register',
        href: '/admin/cash-register',
        icon: Building2,
        iconSize: 'h-4 w-4',
        roles: ['owner', 'manager'],
      },
      {
        name: 'POS Shifts',
        href: '/admin/pos-shifts',
        icon: Clock,
        iconSize: 'h-4 w-4',
        roles: ['owner', 'manager'],
      },
      {
        name: 'Z-Reports',
        href: '/admin/z-reports',
        icon: FileText,
        iconSize: 'h-4 w-4',
        roles: ['owner', 'manager'],
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
        name: 'User Management',
        href: '/admin/user-management',
        icon: Users,
        iconSize: 'h-4 w-4',
        roles: ['owner'],
      },
      {
        name: 'Role Management',
        href: '/admin/role-management',
        icon: Shield,
        iconSize: 'h-4 w-4',
        roles: ['owner'],
      },
      {
        name: 'Permissions',
        href: '/admin/permissions',
        icon: Shield,
        iconSize: 'h-4 w-4',
        roles: ['owner'],
      },
      {
        name: 'Activity Logs',
        href: '/admin/activity-logs',
        icon: FileText,
        iconSize: 'h-4 w-4',
        roles: ['owner', 'manager'],
      },
      {
        name: 'Audit Trail',
        href: '/admin/audit-trail',
        icon: CheckCircle,
        iconSize: 'h-4 w-4',
        roles: ['owner'],
      },
    ],
  },
  {
    name: 'Analytics',
    icon: TrendingUp,
    iconSize: 'h-5 w-5',
    roles: ['owner', 'manager'],
    children: [
      {
        name: 'Sales Dashboard',
        href: '/admin/sales-dashboard',
        icon: BarChart3,
        iconSize: 'h-4 w-4',
        roles: ['owner', 'manager'],
      },
      {
        name: 'Order Analytics',
        href: '/admin/order-analytics',
        icon: LineChart,
        iconSize: 'h-4 w-4',
        roles: ['owner', 'manager'],
      },
      {
        name: 'Customer Analytics',
        href: '/admin/customer-hub?tab=analytics',
        icon: Users,
        iconSize: 'h-4 w-4',
        roles: ['owner', 'manager'],
      },
      {
        name: 'Delivery Analytics',
        href: '/admin/delivery-hub?tab=analytics',
        icon: Truck,
        iconSize: 'h-4 w-4',
        roles: ['owner', 'manager'],
      },
      {
        name: 'Location Analytics',
        href: '/admin/location-analytics',
        icon: MapPin,
        iconSize: 'h-4 w-4',
        roles: ['owner', 'manager'],
      },
      {
        name: 'POS Analytics',
        href: '/admin/pos-analytics',
        icon: BarChart3,
        iconSize: 'h-4 w-4',
        roles: ['owner', 'manager'],
      },
      {
        name: 'Advanced Analytics',
        href: '/admin/advanced-analytics',
        icon: TrendingUp,
        iconSize: 'h-4 w-4',
        roles: ['owner'],
      },
      {
        name: 'Real-Time Dashboard',
        href: '/admin/realtime-dashboard',
        icon: Activity,
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
        name: 'Revenue Reports',
        href: '/admin/revenue-reports',
        icon: DollarSign,
        iconSize: 'h-4 w-4',
        roles: ['owner', 'manager'],
      },
      {
        name: 'Custom Reports',
        href: '/admin/custom-reports',
        icon: FileText,
        iconSize: 'h-4 w-4',
        roles: ['owner'],
      },
      {
        name: 'Data Export',
        href: '/admin/data-export',
        icon: Download,
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
        name: 'White Label',
        href: '/admin/white-label',
        icon: Eye,
        iconSize: 'h-4 w-4',
        roles: ['owner'],
      },
      {
        name: 'Custom Domain',
        href: '/admin/custom-domain',
        icon: Globe,
        iconSize: 'h-4 w-4',
        roles: ['owner'],
      },
      {
        name: 'Printing & Labels',
        href: '/admin/inventory/barcodes',
        icon: Printer,
        iconSize: 'h-4 w-4',
        roles: ['owner', 'manager'],
      },
    ],
  },
  {
    name: 'Enterprise',
    icon: Zap,
    iconSize: 'h-5 w-5',
    roles: ['owner'],
    children: [
      {
        name: 'Automation',
        href: '/admin/automation',
        icon: Zap,
        iconSize: 'h-4 w-4',
        roles: ['owner'],
      },
      {
        name: 'Route Optimization',
        href: '/admin/route-optimization',
        icon: Truck,
        iconSize: 'h-4 w-4',
        roles: ['owner'],
      },
      {
        name: 'API Access',
        href: '/admin/api-access',
        icon: Key,
        iconSize: 'h-4 w-4',
        roles: ['owner'],
      },
      {
        name: 'Webhooks',
        href: '/admin/webhooks',
        icon: Webhook,
        iconSize: 'h-4 w-4',
        roles: ['owner'],
      },
      {
        name: 'Integrations',
        href: '/admin/custom-integrations',
        icon: Plug,
        iconSize: 'h-4 w-4',
        roles: ['owner'],
      },
      {
        name: 'Compliance',
        href: '/admin/compliance',
        icon: Shield,
        iconSize: 'h-4 w-4',
        roles: ['owner'],
      },
      {
        name: 'Priority Support',
        href: '/admin/priority-support',
        icon: Bell,
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
