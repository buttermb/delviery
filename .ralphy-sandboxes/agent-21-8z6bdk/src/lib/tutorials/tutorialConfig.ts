import { TutorialStep } from '@/components/tutorial/TutorialOverlay';

export interface TutorialConfig {
  id: string;
  name: string;
  description: string;
  steps: TutorialStep[];
}

export const dashboardTutorial: TutorialConfig = {
  id: 'dashboard-tour',
  name: 'Dashboard Tour',
  description: 'Learn how to navigate and use the dashboard',
  steps: [
    {
      id: 'stats-overview',
      target: '[data-tutorial="dashboard-stats"]',
      title: 'Overview Statistics',
      content: 'These cards show your key business metrics at a glance: revenue, orders, inventory levels, and more. They update in real-time as your business grows.',
      position: 'bottom',
    },
    {
      id: 'quick-actions',
      target: '[data-tutorial="quick-actions"]',
      title: 'Quick Actions',
      content: 'Use these buttons to quickly access common tasks like creating orders, adding products, or managing customers. These shortcuts save you time.',
      position: 'bottom',
    },
    {
      id: 'activity-feed',
      target: '[data-tutorial="activity-feed"]',
      title: 'Recent Activity',
      content: 'Stay updated with the latest actions in your business. This feed shows recent orders, inventory changes, and customer activities.',
      position: 'left',
    },
    {
      id: 'navigation',
      target: '[data-tutorial="navigation-sidebar"]',
      title: 'Navigation Sidebar',
      content: 'Use the sidebar to navigate between different sections: Dashboard, Orders, Inventory, Customers, Reports, and Settings. Click any item to jump to that page.',
      position: 'right',
    },
    {
      id: 'settings',
      target: '[data-tutorial="settings-access"]',
      title: 'Settings & Profile',
      content: 'Access your account settings, billing, team management, and preferences from here. You can also view your subscription plan and usage limits.',
      position: 'top',
    },
  ],
};

export const menusTutorial: TutorialConfig = {
  id: 'menus-tour',
  name: 'Disposable Menus Tour',
  description: 'Learn how to create and manage disposable encrypted menus',
  steps: [
    {
      id: 'create-menu',
      target: '[data-tutorial="create-menu-button"]',
      title: 'Create Your First Menu',
      content: 'Click this button to create a new disposable menu. You can share product lists with customers via secure, encrypted links that can be set to expire or self-destruct.',
      position: 'bottom',
    },
    {
      id: 'menu-list',
      target: '[data-tutorial="menu-list"]',
      title: 'Your Menus',
      content: 'All your active and burned menus appear here. Click on any menu to view details, manage access, or see analytics.',
      position: 'bottom',
    },
    {
      id: 'menu-actions',
      target: '[data-tutorial="menu-actions"]',
      title: 'Menu Actions',
      content: 'Each menu has actions: View to see the customer-facing menu, Burn to revoke access, Share to get the link, and Analytics to see performance.',
      position: 'left',
    },
    {
      id: 'security-settings',
      target: '[data-tutorial="security-settings"]',
      title: 'Security Features',
      content: 'Configure access codes, view limits, geofencing, and screenshot protection to keep your menus secure. These settings help protect your product information.',
      position: 'top',
    },
    {
      id: 'analytics',
      target: '[data-tutorial="menu-list"]',
      title: 'Menu Analytics',
      content: 'Click on any menu card to view detailed analytics including views, orders, popular products, and security events. Use this data to optimize your menus.',
      position: 'bottom',
    },
  ],
};

export const customersTutorial: TutorialConfig = {
  id: 'customers-tour',
  name: 'Customers Tour',
  description: 'Learn how to manage your wholesale clients and customers',
  steps: [
    {
      id: 'customer-list',
      target: '[data-tutorial="customer-list"]',
      title: 'Customer Directory',
      content: 'View all your customers in one place. See their contact information, order history, credit status, and recent activity.',
      position: 'bottom',
    },
    {
      id: 'add-customer',
      target: '[data-tutorial="add-customer"]',
      title: 'Add New Customer',
      content: 'Click here to add a new customer. You can set credit limits, payment terms, and contact information. Customers can then receive menu links and place orders.',
      position: 'bottom',
    },
    {
      id: 'customer-details',
      target: '[data-tutorial="customer-details"]',
      title: 'Customer Details',
      content: 'Click on any customer to see their full profile: order history, payment status, credit balance, and communication logs. Manage their account from here.',
      position: 'right',
    },
    {
      id: 'order-history',
      target: '[data-tutorial="order-history"]',
      title: 'Order History',
      content: 'View all orders placed by this customer. Track delivery status, payment history, and order totals. This helps you manage customer relationships.',
      position: 'top',
    },
    {
      id: 'credit-management',
      target: '[data-tutorial="credit-management"]',
      title: 'Credit Management',
      content: 'Set and manage customer credit limits. Track outstanding balances, payment due dates, and credit history. This helps you manage cash flow and risk.',
      position: 'left',
    },
  ],
};

export const inventoryTutorial: TutorialConfig = {
  id: 'inventory-tour',
  name: 'Inventory Tour',
  description: 'Learn how to manage your product inventory',
  steps: [
    {
      id: 'inventory-overview',
      target: '[data-tutorial="inventory-overview"]',
      title: 'Inventory Dashboard',
      content: 'Get a complete view of your inventory across all warehouses. See total value, low stock alerts, and recent movements at a glance.',
      position: 'bottom',
    },
    {
      id: 'product-list',
      target: '[data-tutorial="product-list"]',
      title: 'Product Catalog',
      content: 'Browse and manage all your products. See stock levels, prices, categories, and locations. Use filters and search to find products quickly.',
      position: 'bottom',
    },
    {
      id: 'add-product',
      target: '[data-tutorial="add-product"]',
      title: 'Add Products',
      content: 'Add new products to your inventory. Set prices, quantities, categories, and warehouse locations. You can also upload product images and descriptions.',
      position: 'bottom',
    },
    {
      id: 'stock-adjustments',
      target: '[data-tutorial="stock-adjustments"]',
      title: 'Stock Adjustments',
      content: 'Make inventory adjustments for receiving, transfers, or corrections. Track all movements with detailed logs and audit trails.',
      position: 'left',
    },
    {
      id: 'low-stock-alerts',
      target: '[data-tutorial="low-stock-alerts"]',
      title: 'Stock Alerts',
      content: 'Get notified when products are running low. Set reorder points and receive alerts so you never run out of popular items.',
      position: 'top',
    },
  ],
};

export const ordersTutorial: TutorialConfig = {
  id: 'orders-tour',
  name: 'Orders Tour',
  description: 'Learn how to create and manage orders',
  steps: [
    {
      id: 'orders-list',
      target: '[data-tutorial="orders-list"]',
      title: 'Orders Dashboard',
      content: 'View all your orders in one place. See order status, customer information, totals, and delivery details. Filter by status, date, or customer.',
      position: 'bottom',
    },
    {
      id: 'create-order',
      target: '[data-tutorial="create-order"]',
      title: 'Create New Order',
      content: 'Start a new order for a customer. Select products, set quantities, and configure delivery options. Orders can be created manually or from menu links.',
      position: 'bottom',
    },
    {
      id: 'order-status',
      target: '[data-tutorial="order-status"]',
      title: 'Order Status Workflow',
      content: 'Track orders through their lifecycle: Pending → Confirmed → Assigned → In Transit → Delivered. Update status as orders progress.',
      position: 'right',
    },
    {
      id: 'delivery-assignment',
      target: '[data-tutorial="delivery-assignment"]',
      title: 'Assign Delivery',
      content: 'Assign orders to couriers or delivery drivers. Track real-time location and delivery progress. Customers receive updates automatically.',
      position: 'left',
    },
    {
      id: 'order-analytics',
      target: '[data-tutorial="order-analytics"]',
      title: 'Order Analytics',
      content: 'Analyze order trends, popular products, customer behavior, and revenue. Use insights to optimize your business operations and inventory.',
      position: 'top',
    },
  ],
};

export const reportsTutorial: TutorialConfig = {
  id: 'reports-tour',
  name: 'Reports Tour',
  description: 'Learn how to generate and export reports',
  steps: [
    {
      id: 'report-types',
      target: '[data-tutorial="report-types"]',
      title: 'Report Types',
      content: 'Choose from various report types: Sales, Inventory, Customers, Orders, and Financial. Each report provides different insights into your business.',
      position: 'bottom',
    },
    {
      id: 'date-range',
      target: '[data-tutorial="date-range"]',
      title: 'Date Range Selection',
      content: 'Select a time period for your report: Today, This Week, This Month, or Custom Range. Reports update automatically based on your selection.',
      position: 'bottom',
    },
    {
      id: 'export-options',
      target: '[data-tutorial="export-options"]',
      title: 'Export Reports',
      content: 'Export reports as CSV or PDF for sharing or record-keeping. Use exports for accounting, tax preparation, or business analysis.',
      position: 'left',
    },
    {
      id: 'custom-reports',
      target: '[data-tutorial="custom-reports"]',
      title: 'Custom Reports',
      content: 'Create custom reports with specific metrics and filters. Save report templates for quick access to frequently used reports.',
      position: 'right',
    },
    {
      id: 'analytics-dashboard',
      target: '[data-tutorial="analytics-dashboard"]',
      title: 'Analytics Dashboard',
      content: 'View visual charts and graphs showing trends, comparisons, and insights. Use analytics to make data-driven business decisions.',
      position: 'top',
    },
  ],
};

export const allTutorials: Record<string, TutorialConfig> = {
  'dashboard-tour': dashboardTutorial,
  'menus-tour': menusTutorial,
  'customers-tour': customersTutorial,
  'inventory-tour': inventoryTutorial,
  'orders-tour': ordersTutorial,
  'reports-tour': reportsTutorial,
};

export function getTutorial(id: string): TutorialConfig | undefined {
  return allTutorials[id];
}

