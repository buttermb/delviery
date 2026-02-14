/**
 * Credit Costs Configuration
 * 
 * Complete matrix of credit costs for all actions across the platform.
 * 
 * Design Philosophy:
 * - FREE: All viewing, browsing, configuration, settings, team management
 * - LOW COST (1-10): Setup actions, daily maintenance, frequent operations
 * - MEDIUM COST (15-50): Core business actions, transactions
 * - HIGH COST (75-150): Premium features, exports, reports
 * - PREMIUM (200+): AI features, large exports, advanced analytics
 * 
 * Weekly burn estimate for active user: ~4,000 credits
 * Free tier (10,000) lasts: ~2.5 weeks for active users
 */

export interface CreditCost {
  actionKey: string;
  actionName: string;
  credits: number;
  category: CreditCategory;
  description: string;
}

export type CreditCategory =
  | 'command_center'
  | 'sales'
  | 'orders'
  | 'menus'
  | 'wholesale'
  | 'loyalty'
  | 'coupons'
  | 'pos'
  | 'inventory'
  | 'customers'
  | 'crm'
  | 'invoices'
  | 'operations'
  | 'delivery'
  | 'fleet'
  | 'analytics'
  | 'reports'
  | 'exports'
  | 'ai'
  | 'api'
  | 'integrations'
  | 'compliance'
  | 'marketplace';

/**
 * Complete Credit Costs Matrix
 * Organized by panel/category for easy reference
 */
export const CREDIT_COSTS: Record<string, CreditCost> = {
  // ============================================================================
  // COMMAND CENTER - All viewing is FREE
  // ============================================================================
  dashboard_view: {
    actionKey: 'dashboard_view',
    actionName: 'View Dashboard',
    credits: 0,
    category: 'command_center',
    description: 'View dashboard (always free)',
  },
  hotbox_view: {
    actionKey: 'hotbox_view',
    actionName: 'View Hotbox',
    credits: 0,
    category: 'command_center',
    description: 'View hotbox (always free)',
  },
  live_orders_view: {
    actionKey: 'live_orders_view',
    actionName: 'View Live Orders',
    credits: 0,
    category: 'command_center',
    description: 'Monitor live orders (always free)',
  },
  live_orders_process: {
    actionKey: 'live_orders_process',
    actionName: 'Process Live Order',
    credits: 0,
    category: 'command_center',
    description: 'Accept/process order (already paid via menu order)',
  },
  realtime_monitor_view: {
    actionKey: 'realtime_monitor_view',
    actionName: 'Real-Time Monitor',
    credits: 0,
    category: 'command_center',
    description: 'View real-time monitor (always free)',
  },
  live_map_view: {
    actionKey: 'live_map_view',
    actionName: 'View Live Map',
    credits: 0,
    category: 'command_center',
    description: 'View live map (always free)',
  },

  // ============================================================================
  // SALES & ORDERS
  // ============================================================================
  orders_view: {
    actionKey: 'orders_view',
    actionName: 'View Orders',
    credits: 0,
    category: 'orders',
    description: 'View orders list (always free)',
  },
  order_create_manual: {
    actionKey: 'order_create_manual',
    actionName: 'Create Manual Order',
    credits: 50,
    category: 'orders',
    description: 'Create order manually',
  },
  order_export: {
    actionKey: 'order_export',
    actionName: 'Export Orders',
    credits: 0,
    category: 'exports',
    description: 'Export orders data (always free)',
  },
  order_update_status: {
    actionKey: 'order_update_status',
    actionName: 'Update Order Status',
    credits: 0,
    category: 'orders',
    description: 'Change order status (free - already paid)',
  },
  order_cancel: {
    actionKey: 'order_cancel',
    actionName: 'Cancel Order',
    credits: 0,
    category: 'orders',
    description: 'Cancel an order (free)',
  },

  // ============================================================================
  // MENUS (Disposable Menus)
  // ============================================================================
  menu_view: {
    actionKey: 'menu_view',
    actionName: 'Menu View',
    credits: 2,
    category: 'menus',
    description: 'Customer viewed menu (passive drain)',
  },
  menu_create: {
    actionKey: 'menu_create',
    actionName: 'Create Menu',
    credits: 100,
    category: 'menus',
    description: 'Create disposable menu (core feature)',
  },
  menu_edit: {
    actionKey: 'menu_edit',
    actionName: 'Edit Menu',
    credits: 0,
    category: 'menus',
    description: 'Edit existing menu (maintenance)',
  },
  menu_order_received: {
    actionKey: 'menu_order_received',
    actionName: 'Order Received',
    credits: 75,
    category: 'orders',
    description: 'Customer order from menu (core revenue)',
  },
  menu_share_link: {
    actionKey: 'menu_share_link',
    actionName: 'Share Menu Link',
    credits: 0,
    category: 'menus',
    description: 'Share menu link (encourages usage)',
  },
  menu_import_catalog: {
    actionKey: 'menu_import_catalog',
    actionName: 'Import Catalog',
    credits: 50,
    category: 'menus',
    description: 'Import catalog to menu (one-time setup)',
  },

  // ============================================================================
  // WHOLESALE
  // ============================================================================
  wholesale_view: {
    actionKey: 'wholesale_view',
    actionName: 'View Wholesale',
    credits: 0,
    category: 'wholesale',
    description: 'Browse wholesale catalog (always free)',
  },
  wholesale_order_place: {
    actionKey: 'wholesale_order_place',
    actionName: 'Place Wholesale Order',
    credits: 100,
    category: 'wholesale',
    description: 'Place B2B wholesale order',
  },
  wholesale_order_receive: {
    actionKey: 'wholesale_order_receive',
    actionName: 'Receive Wholesale Order',
    credits: 75,
    category: 'wholesale',
    description: 'Receive wholesale order (revenue)',
  },

  // ============================================================================
  // LOYALTY PROGRAM
  // ============================================================================
  loyalty_view: {
    actionKey: 'loyalty_view',
    actionName: 'View Loyalty Program',
    credits: 0,
    category: 'loyalty',
    description: 'View loyalty program (always free)',
  },
  loyalty_reward_create: {
    actionKey: 'loyalty_reward_create',
    actionName: 'Create Reward',
    credits: 25,
    category: 'loyalty',
    description: 'Create loyalty reward (setup)',
  },
  loyalty_reward_issue: {
    actionKey: 'loyalty_reward_issue',
    actionName: 'Issue Reward',
    credits: 15,
    category: 'loyalty',
    description: 'Issue reward to customer',
  },

  // ============================================================================
  // COUPONS
  // ============================================================================
  coupon_view: {
    actionKey: 'coupon_view',
    actionName: 'View Coupons',
    credits: 0,
    category: 'coupons',
    description: 'View coupons (always free)',
  },
  coupon_create: {
    actionKey: 'coupon_create',
    actionName: 'Create Coupon',
    credits: 20,
    category: 'coupons',
    description: 'Create coupon code (setup)',
  },
  coupon_redeemed: {
    actionKey: 'coupon_redeemed',
    actionName: 'Coupon Redeemed',
    credits: 5,
    category: 'coupons',
    description: 'Coupon redeemed (passive)',
  },

  // ============================================================================
  // MARKETPLACE (White-label Storefront)
  // ============================================================================
  marketplace_browse: {
    actionKey: 'marketplace_browse',
    actionName: 'Browse Marketplace',
    credits: 0,
    category: 'marketplace',
    description: 'Browse marketplace (always free)',
  },
  marketplace_list_product: {
    actionKey: 'marketplace_list_product',
    actionName: 'List Product',
    credits: 25,
    category: 'marketplace',
    description: 'List product on marketplace',
  },
  marketplace_order_created: {
    actionKey: 'marketplace_order_created',
    actionName: 'Marketplace Order Received',
    credits: 100,
    category: 'marketplace',
    description: 'Credits consumed when a marketplace order is placed',
  },
  marketplace_notification_sent: {
    actionKey: 'marketplace_notification_sent',
    actionName: 'Marketplace Notification',
    credits: 50,
    category: 'marketplace',
    description: 'SMS/email notification to marketplace customer',
  },
  marketplace_coupon_created: {
    actionKey: 'marketplace_coupon_created',
    actionName: 'Create Marketplace Coupon',
    credits: 25,
    category: 'marketplace',
    description: 'Create a new marketplace coupon code',
  },
  marketplace_bulk_update: {
    actionKey: 'marketplace_bulk_update',
    actionName: 'Bulk Product Update',
    credits: 100,
    category: 'marketplace',
    description: 'Bulk update product visibility/pricing for marketplace',
  },
  marketplace_export_orders: {
    actionKey: 'marketplace_export_orders',
    actionName: 'Export Marketplace Orders',
    credits: 0,
    category: 'marketplace',
    description: 'Export marketplace orders data (free)',
  },
  marketplace_store_view: {
    actionKey: 'marketplace_store_view',
    actionName: 'View Store Settings',
    credits: 0,
    category: 'marketplace',
    description: 'View/edit store settings (always free)',
  },
  storefront_create: {
    actionKey: 'storefront_create',
    actionName: 'Create Storefront',
    credits: 500,
    category: 'marketplace',
    description: 'Create a new white-label storefront (one-time setup)',
  },

  // ============================================================================
  // POINT OF SALE (POS)
  // ============================================================================
  pos_view: {
    actionKey: 'pos_view',
    actionName: 'View POS',
    credits: 0,
    category: 'pos',
    description: 'View cash register (always free)',
  },
  pos_process_sale: {
    actionKey: 'pos_process_sale',
    actionName: 'Process Sale',
    credits: 25,
    category: 'pos',
    description: 'Process POS sale (revenue action)',
  },
  pos_open_close_drawer: {
    actionKey: 'pos_open_close_drawer',
    actionName: 'Open/Close Drawer',
    credits: 0,
    category: 'pos',
    description: 'Open/close cash drawer (operations)',
  },
  pos_apply_discount: {
    actionKey: 'pos_apply_discount',
    actionName: 'Apply Discount',
    credits: 0,
    category: 'pos',
    description: 'Apply discount (part of sale)',
  },
  pos_print_receipt: {
    actionKey: 'pos_print_receipt',
    actionName: 'Print Receipt',
    credits: 5,
    category: 'pos',
    description: 'Print receipt',
  },

  // ============================================================================
  // INVENTORY - PRODUCTS
  // ============================================================================
  product_view: {
    actionKey: 'product_view',
    actionName: 'View Products',
    credits: 0,
    category: 'inventory',
    description: 'View products (always free)',
  },
  product_add: {
    actionKey: 'product_add',
    actionName: 'Add Product',
    credits: 10,
    category: 'inventory',
    description: 'Add product (setup feels free)',
  },
  product_edit: {
    actionKey: 'product_edit',
    actionName: 'Edit Product',
    credits: 0,
    category: 'inventory',
    description: 'Edit product (maintenance)',
  },
  product_delete: {
    actionKey: 'product_delete',
    actionName: 'Delete Product',
    credits: 0,
    category: 'inventory',
    description: 'Delete product (cleanup)',
  },
  product_bulk_import: {
    actionKey: 'product_bulk_import',
    actionName: 'Bulk Import Products',
    credits: 50,
    category: 'inventory',
    description: 'Bulk import products (one-time)',
  },

  // ============================================================================
  // INVENTORY - STOCK
  // ============================================================================
  stock_view: {
    actionKey: 'stock_view',
    actionName: 'View Stock',
    credits: 0,
    category: 'inventory',
    description: 'View stock levels (always free)',
  },
  stock_update: {
    actionKey: 'stock_update',
    actionName: 'Update Stock',
    credits: 3,
    category: 'inventory',
    description: 'Update stock level (frequent, low cost)',
  },
  stock_bulk_update: {
    actionKey: 'stock_bulk_update',
    actionName: 'Bulk Update Stock',
    credits: 25,
    category: 'inventory',
    description: 'Bulk update stock levels',
  },

  // ============================================================================
  // INVENTORY - ALERTS & BARCODES
  // ============================================================================
  alert_view: {
    actionKey: 'alert_view',
    actionName: 'View Alerts',
    credits: 0,
    category: 'inventory',
    description: 'View alerts (always free)',
  },
  alert_configure: {
    actionKey: 'alert_configure',
    actionName: 'Configure Alert',
    credits: 0,
    category: 'inventory',
    description: 'Configure alert (setup)',
  },
  alert_triggered: {
    actionKey: 'alert_triggered',
    actionName: 'Alert Triggered',
    credits: 10,
    category: 'inventory',
    description: 'Alert notification sent',
  },
  barcode_view: {
    actionKey: 'barcode_view',
    actionName: 'View Barcodes',
    credits: 0,
    category: 'inventory',
    description: 'View barcodes (always free)',
  },
  barcode_generate: {
    actionKey: 'barcode_generate',
    actionName: 'Generate Barcode',
    credits: 5,
    category: 'inventory',
    description: 'Generate single barcode',
  },
  barcode_print_batch: {
    actionKey: 'barcode_print_batch',
    actionName: 'Print Barcode Batch',
    credits: 25,
    category: 'inventory',
    description: 'Print batch of barcodes',
  },

  // ============================================================================
  // INVENTORY - TRANSFERS & RECEIVING
  // ============================================================================
  transfer_view: {
    actionKey: 'transfer_view',
    actionName: 'View Transfers',
    credits: 0,
    category: 'inventory',
    description: 'View transfers (always free)',
  },
  transfer_create: {
    actionKey: 'transfer_create',
    actionName: 'Create Transfer',
    credits: 20,
    category: 'inventory',
    description: 'Create inventory transfer',
  },
  receiving_view: {
    actionKey: 'receiving_view',
    actionName: 'View Receiving',
    credits: 0,
    category: 'inventory',
    description: 'View receiving (always free)',
  },
  receiving_log: {
    actionKey: 'receiving_log',
    actionName: 'Log Received Inventory',
    credits: 10,
    category: 'inventory',
    description: 'Log received inventory',
  },
  dispatch_view: {
    actionKey: 'dispatch_view',
    actionName: 'View Dispatch',
    credits: 0,
    category: 'inventory',
    description: 'View dispatch (always free)',
  },
  dispatch_create: {
    actionKey: 'dispatch_create',
    actionName: 'Create Dispatch',
    credits: 20,
    category: 'inventory',
    description: 'Create dispatch order',
  },

  // ============================================================================
  // INVENTORY - VENDORS
  // ============================================================================
  vendor_view: {
    actionKey: 'vendor_view',
    actionName: 'View Vendors',
    credits: 0,
    category: 'inventory',
    description: 'View vendors (always free)',
  },
  vendor_add: {
    actionKey: 'vendor_add',
    actionName: 'Add Vendor',
    credits: 5,
    category: 'inventory',
    description: 'Add vendor (setup)',
  },

  // ============================================================================
  // CUSTOMERS
  // ============================================================================
  customer_view: {
    actionKey: 'customer_view',
    actionName: 'View Customers',
    credits: 0,
    category: 'customers',
    description: 'View customers (always free)',
  },
  customer_add: {
    actionKey: 'customer_add',
    actionName: 'Add Customer',
    credits: 5,
    category: 'customers',
    description: 'Add customer (setup)',
  },
  customer_edit: {
    actionKey: 'customer_edit',
    actionName: 'Edit Customer',
    credits: 0,
    category: 'customers',
    description: 'Edit customer (maintenance)',
  },
  customer_import: {
    actionKey: 'customer_import',
    actionName: 'Import Customers',
    credits: 50,
    category: 'customers',
    description: 'Bulk import customers',
  },
  customer_export: {
    actionKey: 'customer_export',
    actionName: 'Export Customers',
    credits: 0,
    category: 'exports',
    description: 'Export customers (always free)',
  },

  // ============================================================================
  // CRM & COMMUNICATION
  // ============================================================================
  crm_view: {
    actionKey: 'crm_view',
    actionName: 'View CRM',
    credits: 0,
    category: 'crm',
    description: 'View CRM (always free)',
  },
  crm_log_interaction: {
    actionKey: 'crm_log_interaction',
    actionName: 'Log Interaction',
    credits: 5,
    category: 'crm',
    description: 'Log customer interaction',
  },
  send_sms: {
    actionKey: 'send_sms',
    actionName: 'Send SMS',
    credits: 25,
    category: 'crm',
    description: 'Send SMS notification',
  },
  send_bulk_sms: {
    actionKey: 'send_bulk_sms',
    actionName: 'Send Bulk SMS',
    credits: 20,
    category: 'crm',
    description: 'Send bulk SMS (volume discount)',
  },
  send_email: {
    actionKey: 'send_email',
    actionName: 'Send Email',
    credits: 10,
    category: 'crm',
    description: 'Send email notification',
  },
  send_bulk_email: {
    actionKey: 'send_bulk_email',
    actionName: 'Send Bulk Email',
    credits: 8,
    category: 'crm',
    description: 'Send bulk email (volume discount)',
  },
  live_chat_view: {
    actionKey: 'live_chat_view',
    actionName: 'View Live Chat',
    credits: 0,
    category: 'crm',
    description: 'View live chat (always free)',
  },
  live_chat_message: {
    actionKey: 'live_chat_message',
    actionName: 'Send Chat Message',
    credits: 5,
    category: 'crm',
    description: 'Send chat message',
  },
  who_owes_me_view: {
    actionKey: 'who_owes_me_view',
    actionName: 'View Who Owes Me',
    credits: 0,
    category: 'crm',
    description: 'View outstanding balances (critical data)',
  },
  who_owes_me_reminder: {
    actionKey: 'who_owes_me_reminder',
    actionName: 'Send Payment Reminder',
    credits: 25,
    category: 'crm',
    description: 'Send payment reminder (SMS)',
  },

  // ============================================================================
  // INVOICES
  // ============================================================================
  invoice_view: {
    actionKey: 'invoice_view',
    actionName: 'View Invoices',
    credits: 0,
    category: 'invoices',
    description: 'View invoices (always free)',
  },
  invoice_create: {
    actionKey: 'invoice_create',
    actionName: 'Create Invoice',
    credits: 50,
    category: 'invoices',
    description: 'Create invoice (document generation)',
  },
  invoice_send: {
    actionKey: 'invoice_send',
    actionName: 'Send Invoice',
    credits: 25,
    category: 'invoices',
    description: 'Send invoice (communication)',
  },
  invoice_export: {
    actionKey: 'invoice_export',
    actionName: 'Export Invoices',
    credits: 0,
    category: 'exports',
    description: 'Export invoices (always free)',
  },

  // ============================================================================
  // OPERATIONS
  // ============================================================================
  supplier_view: {
    actionKey: 'supplier_view',
    actionName: 'View Suppliers',
    credits: 0,
    category: 'operations',
    description: 'View suppliers (always free)',
  },
  supplier_add: {
    actionKey: 'supplier_add',
    actionName: 'Add Supplier',
    credits: 5,
    category: 'operations',
    description: 'Add supplier (setup)',
  },
  purchase_order_view: {
    actionKey: 'purchase_order_view',
    actionName: 'View Purchase Orders',
    credits: 0,
    category: 'operations',
    description: 'View purchase orders (always free)',
  },
  purchase_order_create: {
    actionKey: 'purchase_order_create',
    actionName: 'Create Purchase Order',
    credits: 30,
    category: 'operations',
    description: 'Create purchase order (document)',
  },
  purchase_order_send: {
    actionKey: 'purchase_order_send',
    actionName: 'Send Purchase Order',
    credits: 25,
    category: 'operations',
    description: 'Send purchase order (communication)',
  },
  return_view: {
    actionKey: 'return_view',
    actionName: 'View Returns',
    credits: 0,
    category: 'operations',
    description: 'View returns (always free)',
  },
  return_process: {
    actionKey: 'return_process',
    actionName: 'Process Return',
    credits: 15,
    category: 'operations',
    description: 'Process return',
  },
  qc_view: {
    actionKey: 'qc_view',
    actionName: 'View Quality Control',
    credits: 0,
    category: 'operations',
    description: 'View QC (always free)',
  },
  qc_log_check: {
    actionKey: 'qc_log_check',
    actionName: 'Log QC Check',
    credits: 10,
    category: 'operations',
    description: 'Log quality control check',
  },
  appointment_view: {
    actionKey: 'appointment_view',
    actionName: 'View Appointments',
    credits: 0,
    category: 'operations',
    description: 'View appointments (always free)',
  },
  appointment_create: {
    actionKey: 'appointment_create',
    actionName: 'Create Appointment',
    credits: 10,
    category: 'operations',
    description: 'Create appointment',
  },
  appointment_reminder: {
    actionKey: 'appointment_reminder',
    actionName: 'Send Appointment Reminder',
    credits: 25,
    category: 'operations',
    description: 'Send appointment reminder (communication)',
  },
  support_ticket_create: {
    actionKey: 'support_ticket_create',
    actionName: 'Create Support Ticket',
    credits: 0,
    category: 'operations',
    description: 'Create support ticket (always free)',
  },

  // ============================================================================
  // DELIVERY & FLEET
  // ============================================================================
  delivery_view: {
    actionKey: 'delivery_view',
    actionName: 'View Deliveries',
    credits: 0,
    category: 'delivery',
    description: 'View deliveries (always free)',
  },
  delivery_create: {
    actionKey: 'delivery_create',
    actionName: 'Create Delivery',
    credits: 30,
    category: 'delivery',
    description: 'Create delivery',
  },
  delivery_mark_complete: {
    actionKey: 'delivery_mark_complete',
    actionName: 'Mark Delivered',
    credits: 0,
    category: 'delivery',
    description: 'Mark delivery complete (free)',
  },
  fleet_view: {
    actionKey: 'fleet_view',
    actionName: 'View Fleet',
    credits: 0,
    category: 'delivery',
    description: 'View fleet (always free)',
  },
  route_optimization: {
    actionKey: 'route_optimization',
    actionName: 'Optimize Route',
    credits: 1,
    category: 'delivery',
    description: 'Optimize a delivery route',
  },
  fleet_add_vehicle: {
    actionKey: 'fleet_add_vehicle',
    actionName: 'Add Vehicle',
    credits: 0,
    category: 'fleet',
    description: 'Add vehicle (setup)',
  },
  courier_view: {
    actionKey: 'courier_view',
    actionName: 'View Couriers',
    credits: 0,
    category: 'fleet',
    description: 'View couriers (always free)',
  },
  courier_add: {
    actionKey: 'courier_add',
    actionName: 'Add Courier',
    credits: 0,
    category: 'fleet',
    description: 'Add courier (setup)',
  },
  courier_assign_delivery: {
    actionKey: 'courier_assign_delivery',
    actionName: 'Assign Delivery',
    credits: 10,
    category: 'fleet',
    description: 'Assign delivery to courier',
  },
  route_view: {
    actionKey: 'route_view',
    actionName: 'View Routes',
    credits: 0,
    category: 'fleet',
    description: 'View routes (always free)',
  },
  route_optimize: {
    actionKey: 'route_optimize',
    actionName: 'Optimize Route',
    credits: 50,
    category: 'fleet',
    description: 'Optimize delivery route (premium)',
  },
  tracking_view: {
    actionKey: 'tracking_view',
    actionName: 'View Tracking',
    credits: 0,
    category: 'fleet',
    description: 'View tracking (always free)',
  },
  tracking_ping: {
    actionKey: 'tracking_ping',
    actionName: 'Location Ping',
    credits: 1,
    category: 'fleet',
    description: 'Location ping (high frequency)',
  },
  tracking_send_link: {
    actionKey: 'tracking_send_link',
    actionName: 'Send Tracking Link',
    credits: 15,
    category: 'fleet',
    description: 'Send tracking link (communication)',
  },

  // ============================================================================
  // ANALYTICS & REPORTS
  // ============================================================================
  analytics_view: {
    actionKey: 'analytics_view',
    actionName: 'View Analytics',
    credits: 0,
    category: 'analytics',
    description: 'View analytics (always free)',
  },
  report_standard_view: {
    actionKey: 'report_standard_view',
    actionName: 'View Standard Reports',
    credits: 0,
    category: 'reports',
    description: 'View standard reports (always free)',
  },
  report_custom_generate: {
    actionKey: 'report_custom_generate',
    actionName: 'Generate Custom Report',
    credits: 75,
    category: 'reports',
    description: 'Generate custom report (premium)',
  },
  report_export: {
    actionKey: 'report_export',
    actionName: 'Export Report',
    credits: 0,
    category: 'exports',
    description: 'Export report (always free)',
  },
  report_schedule: {
    actionKey: 'report_schedule',
    actionName: 'Schedule Report',
    credits: 50,
    category: 'reports',
    description: 'Schedule automated report',
  },
  report_advanced_generate: {
    actionKey: 'report_advanced_generate',
    actionName: 'Generate Advanced Report',
    credits: 100,
    category: 'reports',
    description: 'Generate advanced report (premium)',
  },
  commission_view: {
    actionKey: 'commission_view',
    actionName: 'View Commissions',
    credits: 0,
    category: 'analytics',
    description: 'View commissions (always free)',
  },
  commission_calculate: {
    actionKey: 'commission_calculate',
    actionName: 'Calculate Commissions',
    credits: 30,
    category: 'analytics',
    description: 'Run commission calculation',
  },
  expense_view: {
    actionKey: 'expense_view',
    actionName: 'View Expenses',
    credits: 0,
    category: 'analytics',
    description: 'View expenses (always free)',
  },
  expense_add: {
    actionKey: 'expense_add',
    actionName: 'Add Expense',
    credits: 5,
    category: 'analytics',
    description: 'Add expense entry',
  },
  forecast_view: {
    actionKey: 'forecast_view',
    actionName: 'View Forecast',
    credits: 0,
    category: 'analytics',
    description: 'View forecast (always free)',
  },
  forecast_run: {
    actionKey: 'forecast_run',
    actionName: 'Run Forecast',
    credits: 75,
    category: 'analytics',
    description: 'Run forecast calculation (AI/compute)',
  },
  custom_report_view: {
    actionKey: 'custom_report_view',
    actionName: 'View Custom Reports',
    credits: 0,
    category: 'reports',
    description: 'View custom reports (always free)',
  },
  custom_report_run: {
    actionKey: 'custom_report_run',
    actionName: 'Run Custom Report',
    credits: 100,
    category: 'reports',
    description: 'Run custom report (premium)',
  },
  data_warehouse_view: {
    actionKey: 'data_warehouse_view',
    actionName: 'View Data Warehouse',
    credits: 0,
    category: 'analytics',
    description: 'View data warehouse (always free)',
  },
  data_warehouse_query: {
    actionKey: 'data_warehouse_query',
    actionName: 'Query Data Warehouse',
    credits: 25,
    category: 'analytics',
    description: 'Query data warehouse (compute)',
  },
  data_warehouse_export: {
    actionKey: 'data_warehouse_export',
    actionName: 'Export from Data Warehouse',
    credits: 200,
    category: 'exports',
    description: 'Export from data warehouse (large export)',
  },

  // ============================================================================
  // AI FEATURES
  // ============================================================================
  ai_view: {
    actionKey: 'ai_view',
    actionName: 'View AI Analytics',
    credits: 0,
    category: 'ai',
    description: 'View AI analytics (always free)',
  },
  ai_insight_generate: {
    actionKey: 'ai_insight_generate',
    actionName: 'Generate AI Insight',
    credits: 50,
    category: 'ai',
    description: 'Generate AI insight',
  },
  ai_task_run: {
    actionKey: 'ai_task_run',
    actionName: 'Run AI Task',
    credits: 50,
    category: 'ai',
    description: 'Run AI task (compute)',
  },
  menu_ocr: {
    actionKey: 'menu_ocr',
    actionName: 'Menu OCR Scan',
    credits: 250,
    category: 'ai',
    description: 'AI-powered menu scanning',
  },
  ai_suggestions: {
    actionKey: 'ai_suggestions',
    actionName: 'AI Suggestions',
    credits: 100,
    category: 'ai',
    description: 'AI product suggestions',
  },

  // ============================================================================
  // INTEGRATIONS & API
  // ============================================================================
  webhook_view: {
    actionKey: 'webhook_view',
    actionName: 'View Webhooks',
    credits: 0,
    category: 'integrations',
    description: 'View/configure webhooks (always free)',
  },
  webhook_fired: {
    actionKey: 'webhook_fired',
    actionName: 'Webhook Fired',
    credits: 5,
    category: 'integrations',
    description: 'Webhook execution (API cost)',
  },
  api_call: {
    actionKey: 'api_call',
    actionName: 'API Call',
    credits: 5,
    category: 'api',
    description: 'External API request',
  },
  bulk_operation_execute: {
    actionKey: 'bulk_operation_execute',
    actionName: 'Bulk Operation',
    credits: 0,
    category: 'integrations',
    description: 'Bulk operation (sum of individual actions)',
  },

  // ============================================================================
  // COMPLIANCE & SECURITY
  // ============================================================================
  batch_recall_view: {
    actionKey: 'batch_recall_view',
    actionName: 'View Batch Recall',
    credits: 0,
    category: 'compliance',
    description: 'View batch recall (always free)',
  },
  batch_recall_initiate: {
    actionKey: 'batch_recall_initiate',
    actionName: 'Initiate Batch Recall',
    credits: 0,
    category: 'compliance',
    description: 'Initiate recall (safety - never block)',
  },
  compliance_vault_view: {
    actionKey: 'compliance_vault_view',
    actionName: 'View Compliance Vault',
    credits: 0,
    category: 'compliance',
    description: 'View compliance vault (always free)',
  },
  compliance_vault_upload: {
    actionKey: 'compliance_vault_upload',
    actionName: 'Upload to Vault',
    credits: 0,
    category: 'compliance',
    description: 'Upload document (storage)',
  },
  compliance_report_generate: {
    actionKey: 'compliance_report_generate',
    actionName: 'Generate Compliance Report',
    credits: 100,
    category: 'compliance',
    description: 'Generate compliance report (premium)',
  },
  audit_logs_view: {
    actionKey: 'audit_logs_view',
    actionName: 'View Audit Logs',
    credits: 0,
    category: 'compliance',
    description: 'View audit logs (always free)',
  },

  // ============================================================================
  // SETTINGS & CONFIGURATION - ALL FREE
  // ============================================================================
  settings_view: {
    actionKey: 'settings_view',
    actionName: 'View Settings',
    credits: 0,
    category: 'command_center',
    description: 'View/change settings (always free)',
  },
  team_manage: {
    actionKey: 'team_manage',
    actionName: 'Manage Team',
    credits: 0,
    category: 'command_center',
    description: 'Manage team (always free)',
  },
  roles_manage: {
    actionKey: 'roles_manage',
    actionName: 'Manage Roles',
    credits: 0,
    category: 'command_center',
    description: 'Manage roles (always free)',
  },
  permissions_manage: {
    actionKey: 'permissions_manage',
    actionName: 'Manage Permissions',
    credits: 0,
    category: 'command_center',
    description: 'Manage permissions (always free)',
  },
  locations_manage: {
    actionKey: 'locations_manage',
    actionName: 'Manage Locations',
    credits: 0,
    category: 'command_center',
    description: 'Manage locations (always free)',
  },

  // ============================================================================
  // LEGACY ALIASES (for backwards compatibility)
  // ============================================================================
  create_order: {
    actionKey: 'create_order',
    actionName: 'Create Order',
    credits: 50,
    category: 'orders',
    description: 'Create order (legacy alias)',
  },
  add_product: {
    actionKey: 'add_product',
    actionName: 'Add Product',
    credits: 10,
    category: 'inventory',
    description: 'Add product (legacy alias)',
  },
  add_customer: {
    actionKey: 'add_customer',
    actionName: 'Add Customer',
    credits: 5,
    category: 'customers',
    description: 'Add customer (legacy alias)',
  },
  generate_invoice: {
    actionKey: 'generate_invoice',
    actionName: 'Generate Invoice',
    credits: 50,
    category: 'invoices',
    description: 'Generate invoice (legacy alias)',
  },
  send_menu_link: {
    actionKey: 'send_menu_link',
    actionName: 'Send Menu Link',
    credits: 0,
    category: 'menus',
    description: 'Send menu link (legacy alias)',
  },
  export_csv: {
    actionKey: 'export_csv',
    actionName: 'Export to CSV',
    credits: 0,
    category: 'exports',
    description: 'Export to CSV (always free)',
  },
  export_pdf: {
    actionKey: 'export_pdf',
    actionName: 'Export to PDF',
    credits: 0,
    category: 'exports',
    description: 'Export to PDF (always free)',
  },
  generate_report: {
    actionKey: 'generate_report',
    actionName: 'Generate Report',
    credits: 75,
    category: 'reports',
    description: 'Generate report (legacy alias)',
  },
  update_inventory: {
    actionKey: 'update_inventory',
    actionName: 'Update Inventory',
    credits: 3,
    category: 'inventory',
    description: 'Update inventory (legacy alias)',
  },
  create_delivery_route: {
    actionKey: 'create_delivery_route',
    actionName: 'Create Delivery Route',
    credits: 50,
    category: 'fleet',
    description: 'Create delivery route (legacy alias)',
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the credit cost for an action
 */
export function getCreditCost(actionKey: string): number {
  return CREDIT_COSTS[actionKey]?.credits ?? 0;
}

/**
 * Get the full credit cost info for an action
 */
export function getCreditCostInfo(actionKey: string): CreditCost | null {
  return CREDIT_COSTS[actionKey] ?? null;
}

/**
 * Get all credit costs by category
 */
export function getCreditCostsByCategory(category: CreditCategory): CreditCost[] {
  return Object.values(CREDIT_COSTS).filter((cost) => cost.category === category);
}

/**
 * Get category display name
 */
export function getCategoryDisplayName(category: CreditCategory): string {
  const names: Record<CreditCategory, string> = {
    command_center: 'Command Center',
    sales: 'Sales',
    orders: 'Orders',
    menus: 'Menus',
    wholesale: 'Wholesale',
    loyalty: 'Loyalty',
    coupons: 'Coupons',
    pos: 'Point of Sale',
    inventory: 'Inventory',
    customers: 'Customers',
    crm: 'CRM',
    invoices: 'Invoices',
    operations: 'Operations',
    delivery: 'Delivery',
    fleet: 'Fleet',
    analytics: 'Analytics',
    reports: 'Reports',
    exports: 'Exports',
    ai: 'AI Features',
    api: 'API Access',
    integrations: 'Integrations',
    compliance: 'Compliance',
    marketplace: 'Marketplace',
  };
  return names[category] || category;
}

/**
 * Free actions list - actions that should never cost credits
 */
export const FREE_ACTIONS = [
  // All viewing/browsing
  'dashboard_view',
  'hotbox_view',
  'live_orders_view',
  'live_orders_process',
  'realtime_monitor_view',
  'live_map_view',
  'orders_view',
  'menu_edit',
  'menu_share_link',
  'wholesale_view',
  'loyalty_view',
  'coupon_view',
  'marketplace_browse',
  'marketplace_store_view',
  'marketplace_export_orders',
  'pos_view',
  'pos_open_close_drawer',
  'pos_apply_discount',
  'product_view',
  'product_edit',
  'product_delete',
  'stock_view',
  'alert_view',
  'alert_configure',
  'barcode_view',
  'transfer_view',
  'receiving_view',
  'dispatch_view',
  'vendor_view',
  'customer_view',
  'customer_edit',
  'crm_view',
  'live_chat_view',
  'who_owes_me_view',
  'invoice_view',
  'supplier_view',
  'purchase_order_view',
  'return_view',
  'qc_view',
  'appointment_view',
  'support_ticket_create',
  'delivery_view',
  'delivery_mark_complete',
  'fleet_view',
  'fleet_add_vehicle',
  'courier_view',
  'courier_add',
  'route_view',
  'tracking_view',
  'analytics_view',
  'report_standard_view',
  'commission_view',
  'expense_view',
  'forecast_view',
  'custom_report_view',
  'data_warehouse_view',
  'ai_view',
  'webhook_view',
  'batch_recall_view',
  'batch_recall_initiate',
  'compliance_vault_view',
  'compliance_vault_upload',
  'audit_logs_view',
  'settings_view',
  'team_manage',
  'roles_manage',
  'permissions_manage',
  'locations_manage',
  'order_update_status',
  'order_cancel',
] as const;

/**
 * Check if an action is free
 */
export type FreeAction = typeof FREE_ACTIONS[number];

export function isActionFree(actionKey: string): boolean {
  return FREE_ACTIONS.includes(actionKey as FreeAction) || getCreditCost(actionKey) === 0;
}

/**
 * Credit packages available for purchase
 */
export interface CreditPackage {
  id: string;
  name: string;
  slug: string;
  credits: number;
  priceCents: number;
  badge?: string;
  description: string;
}

/**
 * Credit packages designed to make subscription more attractive
 * Prices are intentionally higher per-credit than subscription value
 * With $79/mo subscription = unlimited, buying credits should feel expensive
 */
export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    id: 'quick-boost',
    name: 'Quick Boost',
    slug: 'quick-boost',
    credits: 500,
    priceCents: 1999, // $19.99 for 500 credits (~$0.04/credit)
    description: 'Quick top-up for immediate needs',
  },
  {
    id: 'starter-pack',
    name: 'Starter Pack',
    slug: 'starter-pack',
    credits: 1500,
    priceCents: 4999, // $49.99 for 1,500 credits (~$0.033/credit)
    badge: 'POPULAR',
    description: 'Most popular for growing businesses',
  },
  {
    id: 'growth-pack',
    name: 'Growth Pack',
    slug: 'growth-pack',
    credits: 5000,
    priceCents: 12999, // $129.99 for 5,000 credits (~$0.026/credit)
    badge: 'BEST VALUE',
    description: 'Best value for heavy users',
  },
  {
    id: 'power-pack',
    name: 'Power Pack',
    slug: 'power-pack',
    credits: 15000,
    priceCents: 29999, // $299.99 for 15,000 credits (~$0.02/credit)
    description: 'For high-volume operations',
  },
];

/**
 * Get price per credit for a package
 */
export function getPricePerCredit(priceCents: number, credits: number): number {
  return priceCents / credits / 100;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Free tier monthly credit allocation
 * Reduced from 1,000 to 500 for aggressive monetization
 * This gives ~1 day of active business use
 * Maintains "free" illusion while driving upgrades
 */
export const FREE_TIER_MONTHLY_CREDITS = 500;
export const LOW_CREDIT_WARNING_THRESHOLD = 2000;
export const CRITICAL_CREDIT_THRESHOLD = 100;

/**
 * Progressive warning thresholds (for upgrade triggers)
 * Triggers at 2000, 1000, 500, 100 credits
 */
export const CREDIT_WARNING_THRESHOLDS = {
  FIRST_WARNING: 2000, // First warning - "Credits running low"
  SECOND_WARNING: 1000, // Second warning - "Consider buying credits"
  YELLOW_BADGE: 500, // Show yellow indicator
  WARNING_MODAL: 100, // Show warning modal - critical level
  BANNER_WARNING: 50, // Show banner at top of dashboard
  BLOCKED: 0, // Block credit-consuming actions
} as const;

/**
 * Low balance warning levels for toast notifications
 * Triggers at specific thresholds: 2000, 1000, 500, 100
 */
export const LOW_BALANCE_WARNING_LEVELS = [2000, 1000, 500, 100] as const;

/**
 * Behavioral trigger thresholds
 * Very aggressive - trigger upgrades quickly
 */
export const BEHAVIORAL_TRIGGERS = {
  MENUS_CREATED: 1, // After 1st menu created - show value immediately
  ORDERS_RECEIVED: 2, // After 2nd order received
  DAYS_ON_FREE_TIER: 3, // 3 days on free tier
} as const;

/**
 * High cost threshold (requires confirmation dialog)
 * Lowered so users see confirmations more often
 */
export const HIGH_COST_THRESHOLD = 75;

/**
 * Grace period configuration
 * When credits hit zero, users get 24 hours before hard blocking
 * This prevents lost business while encouraging immediate action
 */
export const GRACE_PERIOD = {
  /** Grace period duration in hours */
  DURATION_HOURS: 24,
  /** Number of "free" actions allowed during grace period */
  FREE_ACTIONS: 5,
  /** Maximum credit cost of actions allowed during grace */
  MAX_ACTION_COST: 100,
  /** Actions completely blocked even during grace */
  BLOCKED_ACTIONS: ['export_csv', 'export_pdf', 'bulk_sms', 'ai_feature'] as const,
} as const;

/**
 * Minimum balance requirements for high-cost actions
 * Prevents users from starting operations they can't complete
 */
export const MIN_BALANCE_REQUIREMENTS = {
  /** Actions requiring minimum balance equal to total cost */
  require_full_balance: [
    'bulk_sms',
    'bulk_email',
    'export_csv',
    'export_pdf',
    'custom_report',
    'ai_feature',
  ] as const,
  /** Additional buffer required (% of action cost) */
  buffer_percentage: 10,
  /** Minimum buffer in credits */
  min_buffer: 25,
} as const;

/**
 * Weekly burn estimate for active user
 * Orders/Menus: ~2,000 (20 orders × 75 + 5 menus × 100)
 * Communication: ~1,000 (40 SMS × 25)
 * POS: ~500 (20 sales × 25)
 * Reports: ~300 (2 exports × 150)
 * Inventory: ~150 (50 updates × 3)
 * Total: ~4,000 credits/week (~570/day)
 * Free tier (500) lasts: ~1 day for active users
 */
export const WEEKLY_BURN_ESTIMATE = {
  orders_menus: 2000,
  communication: 1000,
  pos: 500,
  reports: 300,
  inventory: 150,
  total: 4000,
  daily_average: 570,
} as const;

/**
 * Free Tier Daily/Monthly Limits
 * These hard limits prevent abuse and encourage upgrades
 * Even with credits, free users can only do this much per day
 */
export const FREE_TIER_LIMITS = {
  // Daily limits - reset at midnight
  max_menus_per_day: 1, // Only 1 menu per day
  max_orders_per_day: 3, // Only 3 manual orders (received orders don't count)
  max_sms_per_day: 2, // Only 2 SMS messages
  max_emails_per_day: 5, // Only 5 emails
  max_pos_sales_per_day: 5, // Only 5 POS transactions
  max_bulk_operations_per_day: 1, // Only 1 bulk operation

  // Monthly limits - reset on billing cycle
  max_exports_per_month: 999999, // Unlimited exports
  max_invoices_per_month: 3, // Only 3 invoices
  max_custom_reports_per_month: 0, // No custom reports on free tier
  max_ai_features_per_month: 0, // No AI features on free tier

  // Feature restrictions
  max_products: 25, // Limited product catalog
  max_customers: 50, // Limited customer database
  max_team_members: 1, // Solo only
  max_locations: 1, // Single location

  // No access to premium features
  blocked_features: [
    'route_optimization',
    'ai_analytics',
    'custom_reports',
    'white_label',
    'api_access',
    'bulk_sms',
    'scheduled_reports',
    // 'data_export_unlimited', // REMOVED: Data export is always free
    'priority_support',
  ] as const,
} as const;

export type BlockedFeature = typeof FREE_TIER_LIMITS.blocked_features[number];





