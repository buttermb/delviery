/**
 * Optimized Sidebar Configuration v2
 * 
 * LEAST FRICTION PRINCIPLES:
 * 1. Group by USER TASK (what they're trying to DO), not by module
 * 2. Most-used items immediately visible (no clicks to access)
 * 3. Progressive disclosure for advanced features
 * 4. ⌘K search for power users
 * 5. Flatten nested navigation - avoid >1 click depth
 * 
 * SECTIONS (8 total, ordered by frequency of use):
 * 1. TODAY      - What needs attention right now
 * 2. SELL       - Make money (orders, POS, storefront)
 * 3. MANAGE     - Day-to-day operations (inventory, customers)
 * 4. DELIVER    - Get products to customers
 * 5. MONEY      - Track financials
 * 6. GROW       - Analytics, marketing, expand
 * 7. AUTOMATE   - Integrations, API, automation
 * 8. CONFIGURE  - Settings, help
 */

import {
    LayoutDashboard,
    ShoppingCart,
    Package,
    Users,
    DollarSign,
    BarChart3,
    Settings,
    HelpCircle,
    Flame,
    Store,
    Truck,
    CreditCard,
    Bell,
    Menu,
    Building2,
    Mail,
    FileSpreadsheet,
    Star,
    UserCog,
    MapPinned,
    Receipt,
    Key,
    Zap,
    FolderKanban,
    Brain,
    Activity,
    Warehouse,
    AlertCircle,
    Barcode,
    Tag,
    PieChart,
    TrendingUp,
    Wallet,
    ScrollText,
    MapPin,
    Download,
    Headphones,
    ClipboardList,
    Layers,
    ArrowRightLeft,
    Building,
    Target,
    Presentation,
    Calculator,
    UserPlus,
    Wrench,
    type LucideIcon,
} from 'lucide-react';

export type SubscriptionTier = 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';

export interface NavItem {
    id: string;
    name: string;
    path: string;
    icon: LucideIcon;
    badge?: number | string;
    hot?: boolean;
    shortcut?: string;
    tier: SubscriptionTier;
    keywords?: string[];
    isNew?: boolean; // Show "NEW" badge
}

export interface NavSection {
    id: string;
    name: string;
    items: NavItem[];
    defaultExpanded?: boolean;
    maxVisible?: number;
}

// ============================================================================
// SECTION 1: TODAY (What needs attention NOW)
// Always expanded, most critical items
// ============================================================================
const TODAY: NavItem[] = [
    {
        id: 'dashboard',
        name: 'Dashboard',
        path: '/admin/dashboard',
        icon: LayoutDashboard,
        shortcut: '⌘1',
        tier: 'STARTER',
        keywords: ['home', 'overview', 'summary', 'main'],
    },
    {
        id: 'hotbox',
        name: 'Hotbox',
        path: '/admin/hotbox',
        icon: Flame,
        hot: true,
        shortcut: '⌘2',
        tier: 'STARTER',
        keywords: ['urgent', 'attention', 'priority', 'live', 'alerts'],
    },
    {
        id: 'live-orders',
        name: 'Live Orders',
        path: '/admin/orders?tab=live',
        icon: Activity,
        tier: 'PROFESSIONAL',
        keywords: ['realtime', 'active', 'current'],
    },
    {
        id: 'notifications',
        name: 'Notifications',
        path: '/admin/notifications',
        icon: Bell,
        tier: 'PROFESSIONAL',
        keywords: ['alerts', 'messages', 'updates'],
    },
];

// ============================================================================
// SECTION 2: SELL (Revenue-generating activities)
// Orders, POS, Storefront, Marketplace, Pre-Orders
// ============================================================================
const SELL: NavItem[] = [
    // Core orders
    {
        id: 'all-orders',
        name: 'All Orders',
        path: '/admin/orders',
        icon: ShoppingCart,
        shortcut: '⌘3',
        tier: 'STARTER',
        keywords: ['orders', 'sales', 'transactions'],
    },
    {
        id: 'menu-orders',
        name: 'Menu Orders',
        path: '/admin/orders?tab=menu',
        icon: Menu,
        tier: 'STARTER',
        keywords: ['disposable', 'catalogs'],
    },
    {
        id: 'pre-orders',
        name: 'Pre-Orders',
        path: '/admin/pre-orders',
        icon: ClipboardList,
        tier: 'PROFESSIONAL',
        keywords: ['future', 'scheduled', 'advance'],
        isNew: true,
    },
    // POS
    {
        id: 'pos-system',
        name: 'POS',
        path: '/admin/pos-system',
        icon: CreditCard,
        shortcut: '⌘P',
        tier: 'PROFESSIONAL',
        keywords: ['point of sale', 'register', 'checkout', 'cash'],
    },
    {
        id: 'cash-register',
        name: 'Cash Register',
        path: '/admin/cash-register',
        icon: Calculator,
        tier: 'PROFESSIONAL',
        keywords: ['till', 'drawer', 'cash'],
    },
    // Menus
    {
        id: 'menus',
        name: 'Menus',
        path: '/admin/disposable-menus',
        icon: Menu,
        tier: 'STARTER',
        keywords: ['disposable menus', 'catalogs', 'price lists'],
    },
    // Storefront (Online Store)
    {
        id: 'storefront-hub',
        name: 'Storefront',
        path: '/admin/storefront-hub',
        icon: Store,
        tier: 'PROFESSIONAL',
        keywords: ['online store', 'ecommerce', 'shop', 'website'],
    },
    {
        id: 'storefront-orders',
        name: 'Store Orders',
        path: '/admin/storefront/orders',
        icon: ShoppingCart,
        tier: 'PROFESSIONAL',
        keywords: ['online orders', 'ecommerce'],
    },
    {
        id: 'storefront-live',
        name: 'Live Store Orders',
        path: '/admin/storefront/live-orders',
        icon: Activity,
        tier: 'PROFESSIONAL',
        keywords: ['realtime', 'live'],
    },
    {
        id: 'storefront-builder',
        name: 'Store Builder',
        path: '/admin/storefront/builder',
        icon: Layers,
        tier: 'ENTERPRISE',
        keywords: ['customize', 'design', 'theme'],
        isNew: true,
    },
    {
        id: 'storefront-products',
        name: 'Store Products',
        path: '/admin/storefront/products',
        icon: Package,
        tier: 'PROFESSIONAL',
        keywords: ['catalog', 'listings'],
    },
    // Marketplace (B2B)
    {
        id: 'marketplace-dashboard',
        name: 'Marketplace',
        path: '/admin/marketplace/dashboard',
        icon: Building,
        tier: 'PROFESSIONAL',
        keywords: ['b2b', 'wholesale', 'marketplace'],
    },
    {
        id: 'marketplace-orders',
        name: 'B2B Orders',
        path: '/admin/marketplace/orders',
        icon: ShoppingCart,
        tier: 'PROFESSIONAL',
        keywords: ['wholesale orders', 'b2b'],
    },
    {
        id: 'marketplace-sync',
        name: 'Product Sync',
        path: '/admin/marketplace/product-sync',
        icon: ArrowRightLeft,
        tier: 'PROFESSIONAL',
        keywords: ['sync', 'import', 'export'],
    },
];

// ============================================================================
// SECTION 3: MANAGE (Day-to-day operations)
// Inventory, Customers, Suppliers, Team
// ============================================================================
const MANAGE: NavItem[] = [
    // Inventory
    {
        id: 'inventory-hub',
        name: 'Inventory',
        path: '/admin/inventory-hub',
        icon: Package,
        shortcut: '⌘I',
        tier: 'STARTER',
        keywords: ['products', 'stock', 'items', 'catalog'],
    },
    {
        id: 'stock-levels',
        name: 'Stock Levels',
        path: '/admin/inventory-hub?tab=stock',
        icon: Warehouse,
        tier: 'PROFESSIONAL',
        keywords: ['quantity', 'available', 'low stock'],
    },
    {
        id: 'stock-alerts',
        name: 'Stock Alerts',
        path: '/admin/inventory-hub?tab=monitoring',
        icon: AlertCircle,
        tier: 'PROFESSIONAL',
        keywords: ['low stock', 'reorder', 'warnings'],
    },
    {
        id: 'barcodes',
        name: 'Barcodes',
        path: '/admin/inventory-hub?tab=barcodes',
        icon: Barcode,
        tier: 'PROFESSIONAL',
        keywords: ['scan', 'labels', 'print'],
    },
    // Customers
    {
        id: 'customer-hub',
        name: 'Customers',
        path: '/admin/customer-hub',
        icon: Users,
        shortcut: '⌘C',
        tier: 'STARTER',
        keywords: ['clients', 'contacts', 'crm', 'buyers'],
    },
    {
        id: 'crm',
        name: 'CRM',
        path: '/admin/customer-hub?tab=crm',
        icon: Target,
        tier: 'PROFESSIONAL',
        keywords: ['relationships', 'pipeline', 'leads'],
    },
    {
        id: 'invoices',
        name: 'Invoices',
        path: '/admin/customer-hub?tab=invoices',
        icon: Receipt,
        tier: 'STARTER',
        keywords: ['billing', 'payments', 'receipts'],
    },
    {
        id: 'fronted-inventory',
        name: 'Who Owes Me',
        path: '/admin/fronted-inventory',
        icon: CreditCard,
        tier: 'PROFESSIONAL',
        keywords: ['credit', 'debt', 'outstanding'],
    },
    // Wholesale/B2B Clients
    {
        id: 'wholesale-clients',
        name: 'B2B Clients',
        path: '/admin/customer-hub?tab=contacts',
        icon: Building2,
        tier: 'PROFESSIONAL',
        keywords: ['wholesale', 'business', 'accounts'],
    },
    {
        id: 'pricing-tiers',
        name: 'Pricing Tiers',
        path: '/admin/wholesale/pricing-tiers',
        icon: Layers,
        tier: 'ENTERPRISE',
        keywords: ['volume', 'discounts', 'tiers'],
    },
    // Operations
    {
        id: 'suppliers',
        name: 'Suppliers',
        path: '/admin/suppliers',
        icon: Building2,
        tier: 'STARTER',
        keywords: ['vendors', 'partners', 'procurement'],
    },
    {
        id: 'team',
        name: 'Team',
        path: '/admin/operations-hub?tab=team',
        icon: UserCog,
        tier: 'PROFESSIONAL',
        keywords: ['staff', 'employees', 'members', 'roles'],
    },
    {
        id: 'invites',
        name: 'Invites',
        path: '/admin/invites',
        icon: UserPlus,
        tier: 'PROFESSIONAL',
        keywords: ['invite', 'add team', 'onboard'],
    },
];

// ============================================================================
// SECTION 4: DELIVER (Fulfillment & logistics)
// ============================================================================
const DELIVER: NavItem[] = [
    {
        id: 'fulfillment-hub',
        name: 'Fulfillment',
        path: '/admin/fulfillment-hub',
        icon: Truck,
        tier: 'PROFESSIONAL',
        keywords: ['delivery', 'shipping', 'logistics', 'dispatch'],
    },
    {
        id: 'couriers',
        name: 'Couriers',
        path: '/admin/fulfillment-hub?tab=couriers',
        icon: Users,
        tier: 'ENTERPRISE',
        keywords: ['drivers', 'runners', 'delivery team'],
    },
    {
        id: 'live-tracking',
        name: 'Live Tracking',
        path: '/admin/fulfillment-hub?tab=map',
        icon: MapPinned,
        tier: 'ENTERPRISE',
        keywords: ['live map', 'gps', 'location', 'real-time'],
    },
    {
        id: 'live-map',
        name: 'Live Map',
        path: '/admin/live-map',
        icon: MapPin,
        tier: 'ENTERPRISE',
        keywords: ['map', 'locations', 'fleet'],
    },
];

// ============================================================================
// SECTION 5: MONEY (Financial management)
// ============================================================================
const MONEY: NavItem[] = [
    {
        id: 'finance-hub',
        name: 'Finance',
        path: '/admin/finance-hub',
        icon: DollarSign,
        tier: 'PROFESSIONAL',
        keywords: ['money', 'revenue', 'expenses', 'accounting'],
    },
    {
        id: 'revenue',
        name: 'Revenue',
        path: '/admin/finance-hub?tab=revenue',
        icon: TrendingUp,
        tier: 'PROFESSIONAL',
        keywords: ['income', 'sales', 'earnings'],
    },
    {
        id: 'expenses',
        name: 'Expenses',
        path: '/admin/finance-hub?tab=expenses',
        icon: Wallet,
        tier: 'PROFESSIONAL',
        keywords: ['costs', 'spending', 'outgoing'],
    },
    {
        id: 'billing',
        name: 'Subscription',
        path: '/admin/billing',
        icon: CreditCard,
        tier: 'STARTER',
        keywords: ['subscription', 'plan', 'payment method'],
    },
    {
        id: 'tax-management',
        name: 'Taxes',
        path: '/admin/tax-management',
        icon: FileSpreadsheet,
        tier: 'ENTERPRISE',
        keywords: ['tax', 'rates', 'compliance'],
    },
];

// ============================================================================
// SECTION 6: GROW (Marketing, analytics, strategy)
// ============================================================================
const GROW: NavItem[] = [
    // Analytics
    {
        id: 'analytics-hub',
        name: 'Analytics',
        path: '/admin/analytics-hub',
        icon: BarChart3,
        tier: 'PROFESSIONAL',
        keywords: ['reports', 'metrics', 'data', 'insights'],
    },
    {
        id: 'reports',
        name: 'Reports',
        path: '/admin/reports',
        icon: FileSpreadsheet,
        tier: 'STARTER',
        keywords: ['exports', 'summaries', 'documents'],
    },
    {
        id: 'advanced-analytics',
        name: 'Advanced',
        path: '/admin/analytics-hub?tab=advanced',
        icon: PieChart,
        tier: 'ENTERPRISE',
        keywords: ['deep dive', 'charts', 'trends'],
    },
    // Marketing
    {
        id: 'marketing-hub',
        name: 'Marketing',
        path: '/admin/marketing-hub',
        icon: Mail,
        tier: 'PROFESSIONAL',
        keywords: ['campaigns', 'promotions', 'email'],
    },
    {
        id: 'coupons',
        name: 'Coupons',
        path: '/admin/marketing-hub?tab=coupons',
        icon: Tag,
        tier: 'PROFESSIONAL',
        keywords: ['discounts', 'codes', 'promotions'],
    },
    {
        id: 'reviews',
        name: 'Reviews',
        path: '/admin/marketing-hub?tab=reviews',
        icon: Star,
        tier: 'PROFESSIONAL',
        keywords: ['ratings', 'feedback', 'testimonials'],
    },
    {
        id: 'loyalty',
        name: 'Loyalty',
        path: '/admin/customer-hub?tab=loyalty',
        icon: Star,
        tier: 'ENTERPRISE',
        keywords: ['rewards', 'points', 'retention'],
    },
    // Executive / Strategy (Enterprise)
    {
        id: 'strategic-dashboard',
        name: 'Strategy',
        path: '/admin/strategic-dashboard',
        icon: Target,
        tier: 'ENTERPRISE',
        keywords: ['strategy', 'planning', 'goals'],
        isNew: true,
    },
    {
        id: 'board-reports',
        name: 'Board Reports',
        path: '/admin/board-reports',
        icon: Presentation,
        tier: 'ENTERPRISE',
        keywords: ['executive', 'summary', 'board'],
    },
    {
        id: 'expansion',
        name: 'Expansion',
        path: '/admin/expansion-analysis',
        icon: TrendingUp,
        tier: 'ENTERPRISE',
        keywords: ['growth', 'planning', 'markets'],
    },
];

// ============================================================================
// SECTION 7: AUTOMATE (Integrations, API, automation)
// ============================================================================
const AUTOMATE: NavItem[] = [
    {
        id: 'integrations-hub',
        name: 'Integrations',
        path: '/admin/integrations-hub',
        icon: FolderKanban,
        tier: 'PROFESSIONAL',
        keywords: ['bulk operations', 'imports', 'exports'],
    },
    {
        id: 'automation',
        name: 'Automation',
        path: '/admin/workflow-automation',
        icon: Zap,
        tier: 'ENTERPRISE',
        keywords: ['workflows', 'triggers', 'rules'],
    },
    {
        id: 'api-access',
        name: 'API Access',
        path: '/admin/api-access',
        icon: Key,
        tier: 'ENTERPRISE',
        keywords: ['developer', 'api keys', 'tokens'],
    },
    {
        id: 'webhooks',
        name: 'Webhooks',
        path: '/admin/webhooks',
        icon: Zap,
        tier: 'ENTERPRISE',
        keywords: ['automation', 'events', 'triggers'],
    },
    {
        id: 'local-ai',
        name: 'Local AI',
        path: '/admin/local-ai',
        icon: Brain,
        tier: 'ENTERPRISE',
        keywords: ['ai', 'assistant', 'machine learning'],
    },
    {
        id: 'data-export',
        name: 'Data Export',
        path: '/admin/analytics-hub?tab=export',
        icon: Download,
        tier: 'PROFESSIONAL',
        keywords: ['download', 'csv', 'backup'],
    },
    // Developer tools (Enterprise only)
    {
        id: 'developer-tools',
        name: 'Dev Tools',
        path: '/admin/developer-tools',
        icon: Wrench,
        tier: 'ENTERPRISE',
        keywords: ['debug', 'console', 'testing'],
    },
];

// ============================================================================
// SECTION 8: CONFIGURE (Settings, help, support)
// ============================================================================
const CONFIGURE: NavItem[] = [
    {
        id: 'settings',
        name: 'Settings',
        path: '/admin/settings-hub',
        icon: Settings,
        tier: 'STARTER',
        keywords: ['preferences', 'configuration', 'options'],
    },
    {
        id: 'activity-logs',
        name: 'Activity Logs',
        path: '/admin/operations-hub?tab=activity',
        icon: ScrollText,
        tier: 'ENTERPRISE',
        keywords: ['audit', 'history', 'changes'],
    },
    {
        id: 'help',
        name: 'Help Center',
        path: '/admin/help-hub',
        icon: HelpCircle,
        tier: 'STARTER',
        keywords: ['support', 'docs', 'faq', 'tutorials'],
    },
    {
        id: 'priority-support',
        name: 'Priority Support',
        path: '/admin/help-hub?tab=support',
        icon: Headphones,
        tier: 'ENTERPRISE',
        keywords: ['chat', 'phone', 'ticket'],
    },
];

// ============================================================================
// COMPLETE SIDEBAR SECTIONS
// ============================================================================
export const OPTIMIZED_SIDEBAR_SECTIONS: NavSection[] = [
    {
        id: 'today',
        name: 'Today',
        items: TODAY,
        defaultExpanded: true,
        maxVisible: 4, // All visible
    },
    {
        id: 'sell',
        name: 'Sell',
        items: SELL,
        defaultExpanded: true,
        maxVisible: 5, // Show top 5, hide rest
    },
    {
        id: 'manage',
        name: 'Manage',
        items: MANAGE,
        defaultExpanded: true,
        maxVisible: 5,
    },
    {
        id: 'deliver',
        name: 'Deliver',
        items: DELIVER,
        defaultExpanded: false,
        maxVisible: 4,
    },
    {
        id: 'money',
        name: 'Money',
        items: MONEY,
        defaultExpanded: false,
        maxVisible: 4,
    },
    {
        id: 'grow',
        name: 'Grow',
        items: GROW,
        defaultExpanded: false,
        maxVisible: 5,
    },
    {
        id: 'automate',
        name: 'Automate',
        items: AUTOMATE,
        defaultExpanded: false,
        maxVisible: 4,
    },
    {
        id: 'configure',
        name: 'Configure',
        items: CONFIGURE,
        defaultExpanded: false,
        maxVisible: 3,
    },
];

// ============================================================================
// HELPER: Filter items by tier
// ============================================================================
export function filterItemsByTier(items: NavItem[], userTier: SubscriptionTier): NavItem[] {
    const tierHierarchy: Record<SubscriptionTier, number> = {
        STARTER: 1,
        PROFESSIONAL: 2,
        ENTERPRISE: 3,
    };

    const userTierLevel = tierHierarchy[userTier];

    return items.filter(item => tierHierarchy[item.tier] <= userTierLevel);
}

// ============================================================================
// HELPER: Get sections filtered by tier
// ============================================================================
export function getSidebarForTier(userTier: SubscriptionTier): NavSection[] {
    return OPTIMIZED_SIDEBAR_SECTIONS.map(section => ({
        ...section,
        items: filterItemsByTier(section.items, userTier),
    })).filter(section => section.items.length > 0);
}

// ============================================================================
// HELPER: Search all items
// ============================================================================
export function searchSidebarItems(query: string, userTier: SubscriptionTier): NavItem[] {
    const normalizedQuery = query.toLowerCase().trim();
    if (!normalizedQuery) return [];

    const allItems = OPTIMIZED_SIDEBAR_SECTIONS.flatMap(s => s.items);
    const filteredByTier = filterItemsByTier(allItems, userTier);

    return filteredByTier.filter(item => {
        const nameMatch = item.name.toLowerCase().includes(normalizedQuery);
        const keywordMatch = item.keywords?.some(k => k.includes(normalizedQuery));
        return nameMatch || keywordMatch;
    });
}

// ============================================================================
// QUICK ACTIONS - Top features for dashboard widget
// ============================================================================
export const QUICK_ACTION_ITEMS: Record<SubscriptionTier, NavItem[]> = {
    STARTER: [
        TODAY[0],   // Dashboard
        SELL[0],    // All Orders
        SELL[5],    // Menus
        MANAGE[0],  // Inventory
        MANAGE[4],  // Customers
        MANAGE[6],  // Invoices
        GROW[1],    // Reports
    ],
    PROFESSIONAL: [
        TODAY[0],   // Dashboard
        TODAY[1],   // Hotbox
        SELL[0],    // All Orders
        SELL[3],    // POS
        SELL[6],    // Storefront
        MANAGE[0],  // Inventory
        GROW[0],    // Analytics
        MONEY[0],   // Finance
    ],
    ENTERPRISE: [
        TODAY[0],   // Dashboard
        TODAY[1],   // Hotbox
        TODAY[2],   // Live Orders
        SELL[3],    // POS
        SELL[6],    // Storefront
        MANAGE[0],  // Inventory
        DELIVER[0], // Fulfillment
        GROW[0],    // Analytics
    ],
};

// ============================================================================
// STATS: Total counts per tier
// ============================================================================
export function getSidebarStats(tier: SubscriptionTier) {
    const sections = getSidebarForTier(tier);
    const totalItems = sections.reduce((sum, s) => sum + s.items.length, 0);
    return {
        sections: sections.length,
        items: totalItems,
    };
}
