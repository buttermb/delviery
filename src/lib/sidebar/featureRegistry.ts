import {
    LayoutDashboard,
    Package,
    Users,
    ShoppingCart,
    DollarSign,
    TrendingUp,
    Warehouse,
    AlertCircle,
    CreditCard,
    Wallet,
    Box,
    Share2,
    Settings,
    FileText,
    Building2,
    Truck,
    Mail,
    MapPin,
    Bell,
    BarChart3,
    Star,
    Tag,
    Shield,
    FileSpreadsheet,
    Receipt,
    Menu,
    Store,
    Globe,
    Zap,
    Brain,
    Download,
    FolderKanban,
    Layers,
    ScrollText,
    Headphones,
    HelpCircle,
    Flame,
    Activity,
    Briefcase
} from 'lucide-react';
import { FeatureId } from '@/lib/featureConfig';
import { BusinessTier } from '@/lib/presets/businessTiers';

export type OperationSize = 'street' | 'small' | 'medium' | 'enterprise';

export interface FeatureDef {
    id: FeatureId;
    name: string;
    icon: React.ComponentType<{ className?: string }>;
    path: string;
    category: string;
    minOperationSize: OperationSize;
    minBusinessTier: BusinessTier;
    description?: string;
}

export const FEATURE_REGISTRY: Record<string, FeatureDef> = {
    // Command Center
    'hotbox': {
        id: 'hotbox',
        name: 'Hotbox',
        icon: Flame,
        path: '/admin/hotbox',
        category: 'Command Center',
        minOperationSize: 'small',
        minBusinessTier: 'street'
    },
    'dashboard': {
        id: 'dashboard',
        name: 'Overview',
        icon: LayoutDashboard,
        path: '/admin/dashboard',
        category: 'Command Center',
        minOperationSize: 'small',
        minBusinessTier: 'street'
    },
    'live-orders': {
        id: 'live-orders',
        name: 'Live Orders',
        icon: Activity,
        path: '/admin/live-orders',
        category: 'Command Center',
        minOperationSize: 'small',
        minBusinessTier: 'trap'
    },
    'live-map': {
        id: 'live-map',
        name: 'Live Map',
        icon: MapPin,
        path: '/admin/live-map',
        category: 'Command Center',
        minOperationSize: 'medium',
        minBusinessTier: 'block'
    },
    'notifications': {
        id: 'notifications',
        name: 'Notifications',
        icon: Bell,
        path: '/admin/notifications',
        category: 'Command Center',
        minOperationSize: 'medium',
        minBusinessTier: 'block'
    },
    'realtime-dashboard': {
        id: 'realtime-dashboard',
        name: 'Real-Time Monitor',
        icon: Activity,
        path: '/admin/realtime-dashboard',
        category: 'Command Center',
        minOperationSize: 'enterprise',
        minBusinessTier: 'empire'
    },

    // Sales & Orders
    'basic-orders': {
        id: 'basic-orders',
        name: 'Orders',
        icon: ShoppingCart,
        path: '/admin/disposable-menu-orders',
        category: 'Sales & Orders',
        minOperationSize: 'street',
        minBusinessTier: 'street'
    },
    'pos-system': {
        id: 'pos-system',
        name: 'POS Register',
        icon: CreditCard,
        path: '/admin/pos-system',
        category: 'Sales & Orders',
        minOperationSize: 'small',
        minBusinessTier: 'street'
    },
    'disposable-menus': {
        id: 'disposable-menus',
        name: 'Menus',
        icon: Menu,
        path: '/admin/disposable-menus',
        category: 'Sales & Orders',
        minOperationSize: 'street',
        minBusinessTier: 'street'
    },
    'wholesale-orders': {
        id: 'wholesale-orders',
        name: 'Wholesale',
        icon: FileText,
        path: '/admin/wholesale-orders',
        category: 'Sales & Orders',
        minOperationSize: 'small',
        minBusinessTier: 'trap'
    },
    'marketplace': {
        id: 'marketplace',
        name: 'Marketplace',
        icon: Globe,
        path: '/admin/marketplace/listings',
        category: 'Sales & Orders',
        minOperationSize: 'medium',
        minBusinessTier: 'block'
    },
    'sales-dashboard': {
        id: 'sales-dashboard',
        name: 'Deals & Pricing',
        icon: Tag,
        path: '/admin/sales-dashboard',
        category: 'Sales & Orders',
        minOperationSize: 'medium',
        minBusinessTier: 'block'
    },
    'bulk-operations': {
        id: 'bulk-operations',
        name: 'Bulk Operations',
        icon: FolderKanban,
        path: '/admin/bulk-operations',
        category: 'Sales & Orders',
        minOperationSize: 'enterprise',
        minBusinessTier: 'empire'
    },

    // Inventory
    'products': {
        id: 'products',
        name: 'Products',
        icon: Box,
        path: '/admin/inventory/products',
        category: 'Inventory',
        minOperationSize: 'street',
        minBusinessTier: 'street'
    },
    'inventory-dashboard': {
        id: 'inventory-dashboard',
        name: 'Stock Levels',
        icon: Package,
        path: '/admin/inventory-dashboard',
        category: 'Inventory',
        minOperationSize: 'small',
        minBusinessTier: 'trap'
    },
    'stock-alerts': {
        id: 'stock-alerts',
        name: 'Stock Alerts',
        icon: AlertCircle,
        path: '/admin/stock-alerts',
        category: 'Inventory',
        minOperationSize: 'street',
        minBusinessTier: 'street'
    },
    'stock-check': {
        id: 'stock-check',
        name: 'Check Stock',
        icon: Package,
        path: '/admin/inventory/products',
        category: 'Inventory',
        minOperationSize: 'street',
        minBusinessTier: 'street'
    },

    // Customers
    'customer-crm': {
        id: 'customer-crm',
        name: 'CRM',
        icon: Users,
        path: '/admin/crm/clients',
        category: 'Customers',
        minOperationSize: 'street',
        minBusinessTier: 'street'
    },
    'customer-list': {
        id: 'customer-list',
        name: 'Customer List',
        icon: Users,
        path: '/admin/big-plug-clients',
        category: 'Customers',
        minOperationSize: 'small',
        minBusinessTier: 'street'
    },
    'crm-invoices': {
        id: 'crm-invoices',
        name: 'Invoices',
        icon: FileText,
        path: '/admin/crm/invoices',
        category: 'Customers',
        minOperationSize: 'small',
        minBusinessTier: 'trap'
    },
    'customer-insights': {
        id: 'customer-insights',
        name: 'Insights',
        icon: TrendingUp,
        path: '/admin/customer-insights',
        category: 'Customers',
        minOperationSize: 'medium',
        minBusinessTier: 'block'
    },
    'marketing-automation': {
        id: 'marketing-automation',
        name: 'Marketing',
        icon: Mail,
        path: '/admin/marketing-automation',
        category: 'Customers',
        minOperationSize: 'medium',
        minBusinessTier: 'block'
    },
    'loyalty-program': {
        id: 'loyalty-program',
        name: 'Loyalty',
        icon: Star,
        path: '/admin/loyalty-program',
        category: 'Customers',
        minOperationSize: 'medium',
        minBusinessTier: 'block'
    },
    'support-tickets': {
        id: 'support-tickets',
        name: 'Support Desk',
        icon: Headphones,
        path: '/admin/support-tickets',
        category: 'Customers',
        minOperationSize: 'enterprise',
        minBusinessTier: 'empire'
    },

    // Operations
    'delivery-management': {
        id: 'delivery-management',
        name: 'Delivery',
        icon: Truck,
        path: '/admin/delivery-management',
        category: 'Operations',
        minOperationSize: 'medium',
        minBusinessTier: 'block'
    },
    'team-members': {
        id: 'team-members',
        name: 'Team',
        icon: Users,
        path: '/admin/staff-management',
        category: 'Operations',
        minOperationSize: 'small',
        minBusinessTier: 'trap'
    },
    'locations': {
        id: 'locations',
        name: 'Locations',
        icon: Building2,
        path: '/admin/locations',
        category: 'Operations',
        minOperationSize: 'medium',
        minBusinessTier: 'block'
    },
    'quality-control': {
        id: 'quality-control',
        name: 'Quality Control',
        icon: Shield,
        path: '/admin/quality-control',
        category: 'Operations',
        minOperationSize: 'medium',
        minBusinessTier: 'block'
    },
    'automation': {
        id: 'automation',
        name: 'Workflows',
        icon: Zap,
        path: '/admin/workflow-automation',
        category: 'Operations',
        minOperationSize: 'enterprise',
        minBusinessTier: 'empire'
    },
    'compliance': {
        id: 'compliance',
        name: 'Compliance',
        icon: Shield,
        path: '/admin/compliance',
        category: 'Operations',
        minOperationSize: 'enterprise',
        minBusinessTier: 'empire'
    },

    // Analytics & Finance
    'reports': {
        id: 'reports',
        name: 'Reports',
        icon: TrendingUp,
        path: '/admin/reports',
        category: 'Analytics & Finance',
        minOperationSize: 'street',
        minBusinessTier: 'street'
    },
    'revenue-reports': {
        id: 'revenue-reports',
        name: 'Revenue',
        icon: Receipt,
        path: '/admin/revenue-reports',
        category: 'Analytics & Finance',
        minOperationSize: 'small',
        minBusinessTier: 'trap'
    },
    'analytics': {
        id: 'analytics',
        name: 'Analytics',
        icon: BarChart3,
        path: '/admin/analytics/comprehensive',
        category: 'Analytics & Finance',
        minOperationSize: 'medium',
        minBusinessTier: 'block'
    },
    'invoice-management': {
        id: 'invoice-management',
        name: 'Financial Center',
        icon: Briefcase,
        path: '/admin/financial-center',
        category: 'Analytics & Finance',
        minOperationSize: 'medium',
        minBusinessTier: 'block'
    },
    'predictive-analytics': {
        id: 'predictive-analytics',
        name: 'Predictive AI',
        icon: Brain,
        path: '/admin/predictive-analytics',
        category: 'Analytics & Finance',
        minOperationSize: 'enterprise',
        minBusinessTier: 'empire'
    },
    'advanced-reporting': {
        id: 'advanced-reporting',
        name: 'Custom Reports',
        icon: FileSpreadsheet,
        path: '/admin/advanced-reporting',
        category: 'Analytics & Finance',
        minOperationSize: 'enterprise',
        minBusinessTier: 'empire'
    },
    'data-export': {
        id: 'data-export',
        name: 'Data Warehouse',
        icon: Download,
        path: '/admin/data-export',
        category: 'Analytics & Finance',
        minOperationSize: 'enterprise',
        minBusinessTier: 'empire'
    },
    'fronted-inventory': {
        id: 'fronted-inventory',
        name: 'Who Owes Me',
        icon: CreditCard,
        path: '/admin/fronted-inventory',
        category: 'Analytics & Finance',
        minOperationSize: 'street',
        minBusinessTier: 'street'
    },
    'cash-register': {
        id: 'cash-register',
        name: 'Cash Count',
        icon: Wallet,
        path: '/admin/cash-register',
        category: 'Analytics & Finance',
        minOperationSize: 'street',
        minBusinessTier: 'street'
    },

    // Settings & Admin
    'settings': {
        id: 'settings',
        name: 'Settings',
        icon: Settings,
        path: '/admin/settings',
        category: 'Settings',
        minOperationSize: 'street',
        minBusinessTier: 'street'
    },
    'billing': {
        id: 'billing',
        name: 'Billing',
        icon: DollarSign,
        path: '/admin/billing',
        category: 'Settings',
        minOperationSize: 'street',
        minBusinessTier: 'street'
    },
    'custom-integrations': {
        id: 'custom-integrations',
        name: 'Integrations',
        icon: Zap,
        path: '/admin/custom-integrations',
        category: 'Settings',
        minOperationSize: 'medium',
        minBusinessTier: 'block'
    },
    'help': {
        id: 'help',
        name: 'Support',
        icon: HelpCircle,
        path: '/admin/help',
        category: 'Settings',
        minOperationSize: 'medium',
        minBusinessTier: 'street'
    },
    'api-access': {
        id: 'api-access',
        name: 'API & Webhooks',
        icon: Zap,
        path: '/admin/api-access',
        category: 'Settings',
        minOperationSize: 'enterprise',
        minBusinessTier: 'empire'
    },
    'white-label': {
        id: 'white-label',
        name: 'White Label',
        icon: Layers,
        path: '/admin/white-label',
        category: 'Settings',
        minOperationSize: 'enterprise',
        minBusinessTier: 'empire'
    },
    'audit-trail': {
        id: 'audit-trail',
        name: 'Audit Logs',
        icon: ScrollText,
        path: '/admin/audit-trail',
        category: 'Settings',
        minOperationSize: 'enterprise',
        minBusinessTier: 'empire'
    },
    'priority-support': {
        id: 'priority-support',
        name: 'Enterprise Support',
        icon: Headphones,
        path: '/admin/priority-support',
        category: 'Settings',
        minOperationSize: 'enterprise',
        minBusinessTier: 'empire'
    }
};

export function getFeature(id: string): FeatureDef | undefined {
    return FEATURE_REGISTRY[id];
}

export function getAllFeatures(): FeatureDef[] {
    return Object.values(FEATURE_REGISTRY);
}

export function getFeaturesByCategory(category: string): FeatureDef[] {
    return getAllFeatures().filter(f => f.category === category);
}
