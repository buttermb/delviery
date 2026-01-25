import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Package,
  Users,
  ShoppingCart,
  Warehouse,
  MapPin,
  DollarSign,
  UsersRound,
  BarChart3,
  FileText,
  Settings,
  Zap,
  Truck,
  Building2,
  Car,
  Receipt,
  TrendingUp,
  UserCog,
  Shield,
  ScrollText,
  PieChart,
  LineChart,
  Activity,
  Map,
  FileSpreadsheet,
  Database,
  Tags,
  Image,
  Boxes,
  AlertTriangle,
  ArrowLeftRight,
  Layers,
  ClipboardList,
  CreditCard,
  Calculator,
  Wallet,
  Landmark,
  UserPlus,
  Lock,
  History,
  FileCheck,
  Target,
  Rocket,
  Route,
  Navigation,
  Code,
  Webhook,
  Puzzle,
  Palette,
  Globe,
  Printer,
  MessageSquare,
  TrendingDown,
  BarChart2,
  Store,
  Clock,
  Search,
  Bell,
  PackageOpen,
  BarChart4,
  UserCheck,
  Flame,
  Brain
} from 'lucide-react';

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: string | number;
  tier?: 'free' | 'professional' | 'enterprise' | 'ultimate';
}

export interface NavSection {
  title: string;
  items: NavItem[];
  tier?: 'free' | 'professional' | 'enterprise' | 'ultimate';
}

export const navigationSections: NavSection[] = [
  // 🎯 DASHBOARD
  {
    title: 'Dashboard',
    items: [
      {
        title: 'Overview',
        href: '/admin/dashboard',
        icon: LayoutDashboard
      },
      {
        title: 'Real-Time Dashboard',
        href: '/admin/realtime-dashboard',
        icon: Activity,
        badge: 'LIVE',
        tier: 'enterprise'
      }
    ]
  },

  // 📦 OPERATIONS
  {
    title: 'Operations',
    items: [
      {
        title: 'Orders',
        href: '/admin/orders',
        icon: ShoppingCart,
        badge: 'HOT'
      },
      {
        title: 'Live Orders',
        href: '/admin/orders?tab=live',
        icon: Activity,
        tier: 'professional'
      },
      {
        title: 'Inventory',
        href: '/admin/inventory-hub',
        icon: Package
      },
      {
        title: 'Advanced Inventory',
        href: '/admin/advanced-inventory',
        icon: Database,
        tier: 'professional'
      },
      {
        title: 'Transfers & Delivery',
        href: '/admin/dispatch-inventory',
        icon: Truck
      },
      {
        title: 'Dispatch Inventory',
        href: '/admin/dispatch-inventory',
        icon: PackageOpen,
        tier: 'professional'
      },
      {
        title: 'Delivery Tracking',
        href: '/admin/delivery-tracking',
        icon: Map,
        tier: 'professional'
      },
      {
        title: 'Delivery Management',
        href: '/admin/delivery-management',
        icon: Truck,
        tier: 'enterprise'
      },
      {
        title: 'Stock Alerts',
        href: '/admin/stock-alerts',
        icon: AlertTriangle,
        tier: 'professional'
      },
      {
        title: 'Inventory Transfers',
        href: '/admin/inventory-transfers',
        icon: ArrowLeftRight,
        tier: 'professional'
      },
      {
        title: 'Bulk Operations',
        href: '/admin/bulk-operations',
        icon: Layers,
        tier: 'professional'
      },
      {
        title: 'Receiving & Packaging',
        href: '/admin/operations/receiving',
        icon: ClipboardList
      }
    ]
  },

  // 💰 FRONTED INVENTORY (Critical for plugs)
  {
    title: 'Fronted Inventory',
    items: [
      {
        title: 'Fronted Dashboard',
        href: '/admin/fronted-inventory',
        icon: Flame,
        badge: 'NEW',
        tier: 'professional'
      },
      {
        title: 'Fronted Analytics',
        href: '/admin/fronted-inventory-analytics',
        icon: TrendingUp,
        tier: 'professional'
      },
      {
        title: 'Risk Management',
        href: '/admin/risk-management',
        icon: Shield,
        tier: 'professional'
      }
    ]
  },

  // 🛍️ SALES & MENU
  {
    title: 'Sales & Menu',
    items: [
      {
        title: 'Disposable Menus',
        href: '/admin/disposable-menus',
        icon: FileText,
        badge: '🔥'
      },
      {
        title: 'Customers',
        href: '/admin/customers',
        icon: Users
      },
      {
        title: 'Customer Details',
        href: '/admin/customer-details',
        icon: UserCheck
      },
      {
        title: 'Customer Insights',
        href: '/admin/customer-hub?tab=insights',
        icon: Target,
        tier: 'professional'
      },
      {
        title: 'Customer Reports',
        href: '/admin/customer-reports',
        icon: FileSpreadsheet,
        tier: 'professional'
      },
      {
        title: 'Pricing & Deals',
        href: '/admin/sales/pricing',
        icon: Tags
      }
    ]
  },

  // 🏬 STOREFRONT (White-Label Shop)
  {
    title: 'Storefront',
    items: [
      {
        title: 'Store Dashboard',
        href: '/admin/storefront',
        icon: Store,
        badge: 'NEW'
      },
      {
        title: 'Customize Store',
        href: '/admin/storefront/customize',
        icon: Palette
      },
      {
        title: 'Products',
        href: '/admin/storefront/products',
        icon: Package
      },
      {
        title: 'Orders',
        href: '/admin/storefront/orders',
        icon: ShoppingCart
      },
      {
        title: 'Live Orders',
        href: '/admin/storefront/live-orders',
        icon: Activity,
        badge: 'LIVE',
        tier: 'professional'
      },
      {
        title: 'Customers',
        href: '/admin/storefront/customers',
        icon: Users,
        tier: 'professional'
      },
      {
        title: 'Coupons',
        href: '/admin/storefront/coupons',
        icon: Tags,
        tier: 'professional'
      },
      {
        title: 'Analytics',
        href: '/admin/storefront/analytics',
        icon: BarChart3,
        tier: 'professional'
      },
      {
        title: 'Bundles',
        href: '/admin/storefront/bundles',
        icon: Boxes,
        tier: 'professional'
      },
      {
        title: 'Store Settings',
        href: '/admin/storefront/settings',
        icon: Settings
      }
    ]
  },

  // 🏪 MARKETPLACE
  {
    title: 'Marketplace',
    items: [
      {
        title: 'Sourcing (Buy)',
        href: '/admin/marketplace/browse',
        icon: ShoppingCart
      },
      {
        title: 'My Cart',
        href: '/admin/marketplace/cart',
        icon: ShoppingCart
      },
      {
        title: 'My Purchases',
        href: '/admin/marketplace/purchases',
        icon: Package
      },
      {
        title: 'My Listings',
        href: '/admin/marketplace/listings',
        icon: Store
      },
      {
        title: 'Sales Orders',
        href: '/admin/marketplace/orders',
        icon: FileText
      },
      {
        title: 'Seller Profile',
        href: '/admin/marketplace/profile',
        icon: Building2
      },
      {
        title: 'Financials',
        href: '/admin/marketplace/financials',
        icon: Wallet
      }
    ]
  },

  // 📚 CATALOG
  {
    title: 'Catalog',
    items: [
      {
        title: 'Products',
        href: '/admin/inventory/products',
        icon: Package
      },
      {
        title: 'Images & Media',
        href: '/admin/catalog/images',
        icon: Image
      },
      {
        title: 'Batches & Lots',
        href: '/admin/catalog/batches',
        icon: Boxes
      },
      {
        title: 'Categories & Tags',
        href: '/admin/catalog/categories',
        icon: Tags
      }
    ]
  },

  // 📍 LOCATIONS
  {
    title: 'Locations',
    items: [
      {
        title: 'Locations',
        href: '/admin/locations',
        icon: Building2,
        tier: 'professional'
      },
      {
        title: 'Warehouses',
        href: '/admin/locations/warehouses',
        icon: Warehouse
      },
      {
        title: 'Runners & Vehicles',
        href: '/admin/locations/runners',
        icon: Car
      },
      {
        title: 'Couriers',
        href: '/admin/couriers',
        icon: UserCog
      },
      {
        title: 'Live Map',
        href: '/admin/live-map',
        icon: Map,
        badge: 'LIVE',
        tier: 'enterprise'
      },
      {
        title: 'Fleet Management',
        href: '/admin/delivery-hub?tab=fleet',
        icon: Truck,
        tier: 'enterprise'
      },
      {
        title: 'Route Optimization',
        href: '/admin/route-optimizer',
        icon: Route,
        tier: 'enterprise'
      },
    ]
  },

  // 🚚 FULFILLMENT
  {
    title: 'Fulfillment',
    items: [
      {
        title: 'Drivers',
        href: '/admin/drivers',
        icon: Car
      }
    ]
  },

  // 💵 FINANCE
  {
    title: 'Finance',
    items: [
      {
        title: 'Financial Center',
        href: '/admin/financial-center',
        icon: Landmark,
        tier: 'professional'
      },
      {
        title: 'Payments & Invoices',
        href: '/admin/invoice-management',
        icon: Receipt,
        tier: 'professional'
      },
      {
        title: 'Advanced Invoice',
        href: '/admin/advanced-invoice',
        icon: FileText,
        tier: 'professional',
        badge: 'NEW'
      },
      {
        title: 'Revenue Reports',
        href: '/admin/revenue-reports',
        icon: TrendingUp,
        tier: 'professional'
      },
      {
        title: 'Commission Tracking',
        href: '/admin/commission-tracking',
        icon: Calculator,
        tier: 'professional'
      },
      {
        title: 'Expense Tracking',
        href: '/admin/expense-tracking',
        icon: Wallet,
        tier: 'professional'
      },
      {
        title: 'Cash Register',
        href: '/admin/cash-register',
        icon: DollarSign,
        tier: 'enterprise'
      },
      {
        title: 'Point of Sale',
        href: '/admin/pos-system',
        icon: Store,
        tier: 'enterprise'
      },
      {
        title: 'Collections',
        href: '/admin/collection-mode',
        icon: Wallet,
        tier: 'professional'
      }
    ]
  },

  // 👥 TEAM
  {
    title: 'Team',
    items: [
      {
        title: 'Team Members',
        href: '/admin/team-members',
        icon: UsersRound,
        tier: 'professional'
      },
      {
        title: 'Role Management',
        href: '/admin/role-management',
        icon: Shield,
        tier: 'enterprise'
      },
      {
        title: 'Activity Logs',
        href: '/admin/activity-logs',
        icon: History,
        tier: 'professional'
      },
      {
        title: 'Audit Trail',
        href: '/admin/audit-trail',
        icon: ScrollText,
        tier: 'enterprise'
      }
    ]
  },

  // 📊 ANALYTICS
  {
    title: 'Analytics',
    items: [
      {
        title: 'Analytics Dashboard',
        href: '/admin/analytics-dashboard',
        icon: BarChart3,
        tier: 'professional',
        badge: 'NEW'
      },
      {
        title: 'Sales Dashboard',
        href: '/admin/sales-dashboard',
        icon: BarChart3,
        tier: 'professional'
      },
      {
        title: 'Order Analytics',
        href: '/admin/order-analytics',
        icon: PieChart,
        tier: 'professional'
      },
      {
        title: 'Customer Analytics',
        href: '/admin/customer-hub?tab=analytics',
        icon: Users,
        tier: 'professional'
      },
      {
        title: 'Delivery Analytics',
        href: '/admin/delivery-analytics',
        icon: Truck,
        tier: 'enterprise'
      },
      {
        title: 'Location Analytics',
        href: '/admin/location-analytics',
        icon: MapPin,
        tier: 'enterprise'
      },
      {
        title: 'POS Analytics',
        href: '/admin/pos-analytics',
        icon: BarChart2,
        tier: 'enterprise'
      },
      {
        title: 'Advanced Analytics',
        href: '/admin/advanced-analytics',
        icon: BarChart4,
        tier: 'enterprise'
      }
    ]
  },

  // 📄 REPORTS
  {
    title: 'Reports',
    items: [
      {
        title: 'Custom Reports',
        href: '/admin/custom-reports',
        icon: FileText,
        tier: 'enterprise'
      },
      {
        title: 'Data Export',
        href: '/admin/data-export',
        icon: Database,
        tier: 'enterprise'
      },
      {
        title: 'Chain of Custody',
        href: '/admin/reports',
        icon: FileCheck
      }
    ]
  },

  // 🛠️ TOOLS
  {
    title: 'Tools',
    items: [
      {
        title: 'Global Search',
        href: '/admin/global-search',
        icon: Search,
        badge: '⌘K'
      },
      {
        title: 'Live Chat',
        href: '/admin/live-chat',
        icon: MessageSquare,
        tier: 'professional'
      },
      {
        title: 'Notifications',
        href: '/admin/notifications',
        icon: Bell
      },
      {
        title: 'System Settings',
        href: '/admin/system-settings',
        icon: Settings,
        tier: 'enterprise'
      }
    ]
  },

  // ⚙️ SETTINGS
  {
    title: 'Settings',
    items: [
      {
        title: 'General Settings',
        href: '/admin/settings',
        icon: Settings
      },
      {
        title: 'White Label',
        href: '/admin/white-label',
        icon: Palette,
        tier: 'ultimate'
      },
      {
        title: 'Custom Domain',
        href: '/admin/custom-domain',
        icon: Globe,
        tier: 'ultimate'
      },
      {
        title: 'Printing & Labels',
        href: '/admin/generate-barcodes',
        icon: Printer
      },
      {
        title: 'Vendor Management',
        href: '/admin/vendor-management',
        icon: Building2,
        tier: 'enterprise'
      }
    ]
  },

  // 🤖 AI & AUTOMATION
  {
    title: 'AI & Automation',
    items: [
      {
        title: 'Workflow Automation',
        href: '/admin/workflow-automation',
        icon: Zap,
        tier: 'professional',
        badge: 'NEW'
      },
      {
        title: 'Local AI Assistant',
        href: '/admin/local-ai',
        icon: Brain,
        tier: 'professional',
        badge: 'FREE'
      },
      {
        title: 'Automation',
        href: '/admin/automation',
        icon: Settings,
        tier: 'enterprise'
      }
    ]
  },

  // 🚀 ENTERPRISE
  {
    title: 'Enterprise',
    items: [
      {
        title: 'API Access',
        href: '/admin/api-access',
        icon: Code,
        tier: 'ultimate'
      },
      {
        title: 'Webhooks',
        href: '/admin/webhooks',
        icon: Webhook,
        tier: 'ultimate'
      },
      {
        title: 'Integrations',
        href: '/admin/custom-integrations',
        icon: Puzzle,
        tier: 'ultimate'
      },
      {
        title: 'Compliance',
        href: '/admin/compliance',
        icon: Shield,
        tier: 'ultimate'
      },
      {
        title: 'Developer Tools',
        href: '/admin/developer-tools',
        icon: Code,
        tier: 'professional'
      }
    ]
  }
];

