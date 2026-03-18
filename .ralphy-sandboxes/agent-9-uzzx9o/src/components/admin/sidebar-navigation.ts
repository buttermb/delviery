import type { LucideIcon } from 'lucide-react';
import type { FeatureFlag } from '@/lib/featureFlags';
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
  History,
  FileCheck,
  Target,
  Rocket,
  Route,
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
  Search,
  Bell,
  PackageOpen,
  BarChart4,
  UserCheck,
  Flame,
  Brain,
  Star,
  Barcode,
  Headphones,
  HelpCircle,
  Award,
  Tv,
  Command,
  Briefcase,
  Timer
} from 'lucide-react';

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: string | number;
  tier?: 'free' | 'professional' | 'enterprise' | 'ultimate';
  featureFlag?: FeatureFlag;
}

export interface NavSection {
  title: string;
  items: NavItem[];
  tier?: 'free' | 'professional' | 'enterprise' | 'ultimate';
}

export const navigationSections: NavSection[] = [
  // 🎯 COMMAND CENTER
  {
    title: 'Command Center',
    items: [
      {
        title: 'Dashboard',
        href: '/admin/dashboard',
        icon: LayoutDashboard
      },
      {
        title: 'Dashboard Hub',
        href: '/admin/dashboard-hub',
        icon: LayoutDashboard,
        tier: 'professional'
      },
      {
        title: 'TV Dashboard',
        href: '/admin/tv-dashboard',
        icon: Tv,
        badge: 'NEW',
        tier: 'enterprise'
      },
      {
        title: 'Command Center',
        href: '/admin/command-center',
        icon: Command,
        tier: 'enterprise'
      },
      {
        title: 'Hotbox',
        href: '/admin/hotbox',
        icon: Flame,
        badge: 'HOT',
        tier: 'professional'
      },
      {
        title: 'Live Orders',
        href: '/admin/orders?tab=live',
        icon: Activity,
        badge: 'LIVE',
        tier: 'professional'
      },
      {
        title: 'Real-Time Dashboard',
        href: '/admin/realtime-dashboard',
        icon: Activity,
        tier: 'enterprise'
      },
      {
        title: 'Live Map',
        href: '/admin/live-map',
        icon: Map,
        badge: 'LIVE',
        tier: 'enterprise',
        featureFlag: 'live_map'
      },
      {
        title: 'POS',
        href: '/admin/pos-system',
        icon: Store,
        tier: 'enterprise',
        featureFlag: 'pos'
      }
    ]
  },

  // 🛒 ORDERS
  {
    title: 'Orders',
    items: [
      {
        title: 'All Orders',
        href: '/admin/orders',
        icon: ShoppingCart
      },
      {
        title: 'B2B Orders',
        href: '/admin/orders/b2b',
        icon: Building2
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
        title: 'Transfers',
        href: '/admin/inventory-transfers',
        icon: ArrowLeftRight
      },
      {
        title: 'Barcodes',
        href: '/admin/generate-barcodes',
        icon: Barcode
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
        tier: 'professional',
        featureFlag: 'delivery_tracking'
      },
      {
        title: 'Delivery Management',
        href: '/admin/delivery-management',
        icon: Truck,
        tier: 'enterprise',
        featureFlag: 'delivery_tracking'
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

  // 📦 INVENTORY
  {
    title: 'Inventory',
    items: [
      {
        title: 'Inventory Hub',
        href: '/admin/inventory-hub',
        icon: Package
      },
      {
        title: 'Stock Levels',
        href: '/admin/inventory-hub?tab=stock',
        icon: Boxes
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
        title: 'Advanced Inventory',
        href: '/admin/advanced-inventory',
        icon: Database,
        tier: 'professional'
      }
    ]
  },

  // 🚚 FULFILLMENT
  {
    title: 'Fulfillment',
    items: [
      {
        title: 'Overview',
        href: '/admin/fulfillment-hub',
        icon: Truck,
        featureFlag: 'delivery_tracking'
      },
      {
        title: 'Fleet',
        href: '/admin/fulfillment-hub?tab=fleet',
        icon: Car,
        tier: 'professional',
        featureFlag: 'fleet_management'
      },
      {
        title: 'Receiving & Packaging',
        href: '/admin/operations/receiving',
        icon: ClipboardList
      },
      {
        title: 'Team',
        href: '/admin/team-members',
        icon: UsersRound,
        tier: 'professional'
      },
      {
        title: 'Roles',
        href: '/admin/role-management',
        icon: Shield,
        tier: 'enterprise'
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

  // 👥 CUSTOMERS
  {
    title: 'Customers',
    items: [
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
        title: 'CRM',
        href: '/admin/crm/clients',
        icon: UsersRound,
        tier: 'professional',
        featureFlag: 'crm_advanced'
      },
      {
        title: 'Invoices',
        href: '/admin/crm/invoices',
        icon: Receipt,
        tier: 'professional'
      },
      {
        title: 'Customer Insights',
        href: '/admin/customer-hub?tab=insights',
        icon: Target,
        tier: 'professional',
        featureFlag: 'crm_advanced'
      },
      {
        title: 'Customer Reports',
        href: '/admin/customer-reports',
        icon: FileSpreadsheet,
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
        title: 'Menu Analytics',
        href: '/admin/menu-analytics',
        icon: BarChart3,
        tier: 'professional'
      },
      {
        title: 'Menu Migration',
        href: '/admin/menu-migration',
        icon: ArrowLeftRight,
        tier: 'professional'
      },
      {
        title: 'Pricing & Deals',
        href: '/admin/sales/pricing',
        icon: Tags
      },
      {
        title: 'Wholesale Pricing',
        href: '/admin/wholesale-pricing-tiers',
        icon: DollarSign,
        tier: 'professional'
      },
      {
        title: 'Loyalty',
        href: '/admin/loyalty-program',
        icon: Award,
        tier: 'professional',
        featureFlag: 'marketing_hub'
      }
    ]
  },

  // 📣 MARKETING
  {
    title: 'Marketing',
    items: [
      {
        title: 'Marketing Hub',
        href: '/admin/marketing-hub',
        icon: Target,
        badge: 'NEW',
        featureFlag: 'marketing_hub'
      },
      {
        title: 'Loyalty Program',
        href: '/admin/marketing-hub?tab=loyalty',
        icon: Star,
        featureFlag: 'marketing_hub'
      },
      {
        title: 'Coupons',
        href: '/admin/storefront-hub?tab=coupons',
        icon: Tags,
        featureFlag: 'marketing_hub'
      },
      {
        title: 'Campaigns',
        href: '/admin/marketing-hub?tab=campaigns',
        icon: Rocket,
        tier: 'professional',
        featureFlag: 'marketing_hub'
      },
      {
        title: 'Live Chat',
        href: '/admin/marketing-hub?tab=live-chat',
        icon: MessageSquare,
        tier: 'professional',
        featureFlag: 'live_chat'
      },
      {
        title: 'Reviews',
        href: '/admin/storefront-hub?tab=reviews',
        icon: TrendingUp
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
        title: 'Builder',
        href: '/admin/storefront?tab=builder',
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
        tier: 'professional',
        featureFlag: 'marketing_hub'
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
        icon: UserCog,
        featureFlag: 'courier_portal'
      },
      {
        title: 'Live Map',
        href: '/admin/live-map',
        icon: Map,
        badge: 'LIVE',
        tier: 'enterprise',
        featureFlag: 'live_map'
      },
      {
        title: 'Fleet Management',
        href: '/admin/fulfillment-hub?tab=fleet',
        icon: Truck,
        tier: 'enterprise',
        featureFlag: 'fleet_management'
      },
      {
        title: 'Route Optimization',
        href: '/admin/route-optimizer',
        icon: Route,
        tier: 'enterprise',
        featureFlag: 'delivery_tracking'
      },
    ]
  },

  // 🚚 FULFILLMENT
  {
    title: 'Fulfillment',
    items: [
      {
        title: 'Drivers',
        href: '/admin/fulfillment-hub?tab=fleet',
        icon: Car
      }
    ]
  },

  // 💵 FINANCE
  {
    title: 'Finance',
    items: [
      {
        title: 'Finance Hub',
        href: '/admin/finance-hub',
        icon: Landmark,
        tier: 'professional'
      },
      {
        title: 'Financial Center',
        href: '/admin/finance-hub',
        icon: Landmark,
        tier: 'professional'
      },
      {
        title: 'Revenue',
        href: '/admin/finance-hub?tab=revenue',
        icon: TrendingUp,
        tier: 'professional'
      },
      {
        title: 'Expenses',
        href: '/admin/finance-hub?tab=expenses',
        icon: TrendingDown,
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
        href: '/admin/finance-hub?tab=revenue',
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
        href: '/admin/finance-hub?tab=expenses',
        icon: Wallet,
        tier: 'professional'
      },
      {
        title: 'Cash Register',
        href: '/admin/cash-register',
        icon: DollarSign,
        tier: 'enterprise',
        featureFlag: 'pos'
      },
      {
        title: 'Point of Sale',
        href: '/admin/pos-system',
        icon: Store,
        tier: 'enterprise',
        featureFlag: 'pos'
      },
      {
        title: 'POS Shifts',
        href: '/admin/pos-shifts',
        icon: Timer,
        tier: 'enterprise',
        featureFlag: 'pos'
      },
      {
        title: 'Z-Reports',
        href: '/admin/z-reports',
        icon: FileCheck,
        tier: 'enterprise',
        featureFlag: 'pos'
      },
      {
        title: 'Collections',
        href: '/admin/collection-mode',
        icon: Wallet,
        tier: 'professional'
      },
      {
        title: 'Payouts',
        href: '/admin/finance-hub?tab=payouts',
        icon: CreditCard,
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
        title: 'Analytics Hub',
        href: '/admin/analytics-hub',
        icon: BarChart3,
        tier: 'professional',
        featureFlag: 'analytics_advanced'
      },
      {
        title: 'Analytics Dashboard',
        href: '/admin/analytics-dashboard',
        icon: BarChart3,
        tier: 'professional',
        badge: 'NEW',
        featureFlag: 'analytics_advanced'
      },
      {
        title: 'Sales Dashboard',
        href: '/admin/sales-dashboard',
        icon: BarChart3,
        tier: 'professional',
        featureFlag: 'analytics_advanced'
      },
      {
        title: 'Order Analytics',
        href: '/admin/order-analytics',
        icon: PieChart,
        tier: 'professional',
        featureFlag: 'analytics_advanced'
      },
      {
        title: 'Customer Analytics',
        href: '/admin/customer-hub?tab=analytics',
        icon: Users,
        tier: 'professional',
        featureFlag: 'crm_advanced'
      },
      {
        title: 'Delivery Analytics',
        href: '/admin/delivery-analytics',
        icon: Truck,
        tier: 'enterprise',
        featureFlag: 'delivery_tracking'
      },
      {
        title: 'Location Analytics',
        href: '/admin/location-analytics',
        icon: MapPin,
        tier: 'enterprise',
        featureFlag: 'analytics_advanced'
      },
      {
        title: 'POS Analytics',
        href: '/admin/pos-analytics',
        icon: BarChart2,
        tier: 'enterprise',
        featureFlag: 'analytics_advanced'
      },
      {
        title: 'Advanced Analytics',
        href: '/admin/advanced-analytics',
        icon: BarChart4,
        tier: 'enterprise',
        featureFlag: 'analytics_advanced'
      },
      {
        title: 'Strategic Dashboard',
        href: '/admin/strategic-dashboard',
        icon: Target,
        tier: 'enterprise',
        featureFlag: 'analytics_advanced'
      },
      {
        title: 'Board Report',
        href: '/admin/board-report',
        icon: Briefcase,
        tier: 'enterprise',
        featureFlag: 'analytics_advanced'
      },
      {
        title: 'Expansion Analysis',
        href: '/admin/expansion',
        icon: TrendingUp,
        tier: 'enterprise',
        featureFlag: 'analytics_advanced'
      },
      {
        title: 'Export',
        href: '/admin/analytics-hub?tab=export',
        icon: FileSpreadsheet,
        tier: 'professional'
      }
    ]
  },

  // 📄 REPORTS
  {
    title: 'Reports',
    items: [
      {
        title: 'Chain of Custody',
        href: '/admin/reports',
        icon: FileCheck
      },
      {
        title: 'Custom Reports',
        href: '/admin/custom-reports',
        icon: FileText,
        tier: 'enterprise'
      },
      {
        title: 'Advanced Reporting',
        href: '/admin/advanced-reporting',
        icon: FileSpreadsheet,
        tier: 'enterprise'
      },
      {
        title: 'Data Export',
        href: '/admin/data-export',
        icon: Database,
        tier: 'enterprise'
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
        tier: 'professional',
        featureFlag: 'live_chat'
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
        tier: 'enterprise',
        featureFlag: 'vendor_management'
      },
      {
        title: 'Help Center',
        href: '/admin/help-hub',
        icon: HelpCircle
      },
      {
        title: 'Priority Support',
        href: '/admin/priority-support',
        icon: Headphones,
        tier: 'professional'
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
        href: '/admin/workflow-automation',
        icon: Settings,
        tier: 'enterprise'
      }
    ]
  },

  // 🔌 INTEGRATIONS
  {
    title: 'Integrations',
    items: [
      {
        title: 'Local AI',
        href: '/admin/local-ai',
        icon: Brain,
        tier: 'professional',
        badge: 'FREE'
      },
      {
        title: 'Custom Integrations',
        href: '/admin/custom-integrations',
        icon: Puzzle,
        tier: 'ultimate'
      }
    ]
  },

  // 🚀 ENTERPRISE
  {
    title: 'Integrations',
    items: [
      {
        title: 'Integrations',
        href: '/admin/custom-integrations',
        icon: Puzzle,
        tier: 'professional'
      },
      {
        title: 'Webhooks',
        href: '/admin/webhooks',
        icon: Webhook,
        tier: 'professional'
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

