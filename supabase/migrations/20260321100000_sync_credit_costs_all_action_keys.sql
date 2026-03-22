-- ============================================================================
-- SYNC CREDIT_COSTS TABLE WITH ALL ACTION KEYS FROM creditCosts.ts
-- ============================================================================
-- Upserts all 170+ action keys across 23 categories into the credit_costs
-- table so the consume_credits RPC can look up costs server-side.
-- Uses ON CONFLICT (action_key) DO UPDATE to sync costs idempotently.
-- ============================================================================

INSERT INTO public.credit_costs (action_key, credit_cost, category, description, is_active)
VALUES
  -- ========================================================================
  -- COMMAND CENTER - All viewing is FREE
  -- ========================================================================
  ('dashboard_view', 0, 'command_center', 'View dashboard (always free)', true),
  ('hotbox_view', 0, 'command_center', 'View hotbox (always free)', true),
  ('live_orders_view', 0, 'command_center', 'Monitor live orders (always free)', true),
  ('live_orders_process', 0, 'command_center', 'Accept/process order (already paid via menu order)', true),
  ('realtime_monitor_view', 0, 'command_center', 'View real-time monitor (always free)', true),
  ('live_map_view', 0, 'command_center', 'View live map (always free)', true),

  -- ========================================================================
  -- SALES & ORDERS
  -- ========================================================================
  ('orders_view', 0, 'orders', 'View orders list (always free)', true),
  ('order_create_manual', 50, 'orders', 'Create order manually', true),
  ('order_export', 0, 'exports', 'Export orders data (always free)', true),
  ('order_update_status', 0, 'orders', 'Change order status (free - already paid)', true),
  ('order_cancel', 0, 'orders', 'Cancel an order (free)', true),

  -- ========================================================================
  -- MENUS (Disposable Menus)
  -- ========================================================================
  ('menu_view', 2, 'menus', 'Customer viewed menu (passive drain)', true),
  ('menu_create', 100, 'menus', 'Create disposable menu (core feature)', true),
  ('menu_edit', 0, 'menus', 'Edit existing menu (maintenance)', true),
  ('menu_order_received', 75, 'orders', 'Customer order from menu (core revenue)', true),
  ('menu_share_link', 0, 'menus', 'Share menu link (encourages usage)', true),
  ('menu_import_catalog', 50, 'menus', 'Import catalog to menu (one-time setup)', true),

  -- ========================================================================
  -- WHOLESALE
  -- ========================================================================
  ('wholesale_view', 0, 'wholesale', 'Browse wholesale catalog (always free)', true),
  ('wholesale_order_place', 100, 'wholesale', 'Place B2B wholesale order', true),
  ('wholesale_order_receive', 75, 'wholesale', 'Receive wholesale order (revenue)', true),

  -- ========================================================================
  -- LOYALTY PROGRAM
  -- ========================================================================
  ('loyalty_view', 0, 'loyalty', 'View loyalty program (always free)', true),
  ('loyalty_reward_create', 25, 'loyalty', 'Create loyalty reward (setup)', true),
  ('loyalty_reward_issue', 15, 'loyalty', 'Issue reward to customer', true),

  -- ========================================================================
  -- COUPONS
  -- ========================================================================
  ('coupon_view', 0, 'coupons', 'View coupons (always free)', true),
  ('coupon_create', 20, 'coupons', 'Create coupon code (setup)', true),
  ('coupon_redeemed', 5, 'coupons', 'Coupon redeemed (passive)', true),

  -- ========================================================================
  -- MARKETPLACE (White-label Storefront)
  -- ========================================================================
  ('marketplace_browse', 0, 'marketplace', 'Browse marketplace (always free)', true),
  ('marketplace_list_product', 25, 'marketplace', 'List product on marketplace', true),
  ('marketplace_order_created', 100, 'marketplace', 'Credits consumed when a marketplace order is placed', true),
  ('marketplace_notification_sent', 50, 'marketplace', 'SMS/email notification to marketplace customer', true),
  ('marketplace_coupon_created', 25, 'marketplace', 'Create a new marketplace coupon code', true),
  ('marketplace_bulk_update', 100, 'marketplace', 'Bulk update product visibility/pricing for marketplace', true),
  ('marketplace_export_orders', 0, 'marketplace', 'Export marketplace orders data (free)', true),
  ('marketplace_store_view', 0, 'marketplace', 'View/edit store settings (always free)', true),
  ('storefront_create', 500, 'marketplace', 'Create a new white-label storefront (one-time setup)', true),

  -- ========================================================================
  -- POINT OF SALE (POS)
  -- ========================================================================
  ('pos_view', 0, 'pos', 'View cash register (always free)', true),
  ('pos_process_sale', 25, 'pos', 'Process POS sale (revenue action)', true),
  ('pos_open_close_drawer', 0, 'pos', 'Open/close cash drawer (operations)', true),
  ('pos_apply_discount', 0, 'pos', 'Apply discount (part of sale)', true),
  ('pos_print_receipt', 5, 'pos', 'Print receipt', true),

  -- ========================================================================
  -- INVENTORY - PRODUCTS
  -- ========================================================================
  ('product_view', 0, 'inventory', 'View products (always free)', true),
  ('product_add', 10, 'inventory', 'Add product (setup feels free)', true),
  ('product_edit', 0, 'inventory', 'Edit product (maintenance)', true),
  ('product_delete', 0, 'inventory', 'Delete product (cleanup)', true),
  ('product_bulk_import', 50, 'inventory', 'Bulk import products (one-time)', true),

  -- ========================================================================
  -- INVENTORY - STOCK
  -- ========================================================================
  ('stock_view', 0, 'inventory', 'View stock levels (always free)', true),
  ('stock_update', 3, 'inventory', 'Update stock level (frequent, low cost)', true),
  ('stock_bulk_update', 25, 'inventory', 'Bulk update stock levels', true),

  -- ========================================================================
  -- INVENTORY - ALERTS & BARCODES
  -- ========================================================================
  ('alert_view', 0, 'inventory', 'View alerts (always free)', true),
  ('alert_configure', 0, 'inventory', 'Configure alert (setup)', true),
  ('alert_triggered', 10, 'inventory', 'Alert notification sent', true),
  ('barcode_view', 0, 'inventory', 'View barcodes (always free)', true),
  ('barcode_generate', 5, 'inventory', 'Generate single barcode', true),
  ('barcode_print_batch', 25, 'inventory', 'Print batch of barcodes', true),

  -- ========================================================================
  -- INVENTORY - TRANSFERS & RECEIVING
  -- ========================================================================
  ('transfer_view', 0, 'inventory', 'View transfers (always free)', true),
  ('transfer_create', 20, 'inventory', 'Create inventory transfer', true),
  ('receiving_view', 0, 'inventory', 'View receiving (always free)', true),
  ('receiving_log', 10, 'inventory', 'Log received inventory', true),
  ('dispatch_view', 0, 'inventory', 'View dispatch (always free)', true),
  ('dispatch_create', 20, 'inventory', 'Create dispatch order', true),

  -- ========================================================================
  -- INVENTORY - VENDORS
  -- ========================================================================
  ('vendor_view', 0, 'inventory', 'View vendors (always free)', true),
  ('vendor_add', 5, 'inventory', 'Add vendor (setup)', true),

  -- ========================================================================
  -- CUSTOMERS
  -- ========================================================================
  ('customer_view', 0, 'customers', 'View customers (always free)', true),
  ('customer_add', 5, 'customers', 'Add customer (setup)', true),
  ('customer_edit', 0, 'customers', 'Edit customer (maintenance)', true),
  ('customer_import', 50, 'customers', 'Bulk import customers', true),
  ('customer_export', 0, 'exports', 'Export customers (always free)', true),

  -- ========================================================================
  -- CRM & COMMUNICATION
  -- ========================================================================
  ('crm_view', 0, 'crm', 'View CRM (always free)', true),
  ('crm_log_interaction', 5, 'crm', 'Log customer interaction', true),
  ('send_sms', 25, 'crm', 'Send SMS notification', true),
  ('send_bulk_sms', 20, 'crm', 'Send bulk SMS (volume discount)', true),
  ('send_email', 10, 'crm', 'Send email notification', true),
  ('send_bulk_email', 8, 'crm', 'Send bulk email (volume discount)', true),
  ('live_chat_view', 0, 'crm', 'View live chat (always free)', true),
  ('live_chat_message', 5, 'crm', 'Send chat message', true),
  ('who_owes_me_view', 0, 'crm', 'View outstanding balances (critical data)', true),
  ('who_owes_me_reminder', 25, 'crm', 'Send payment reminder (SMS)', true),

  -- ========================================================================
  -- INVOICES
  -- ========================================================================
  ('invoice_view', 0, 'invoices', 'View invoices (always free)', true),
  ('invoice_create', 50, 'invoices', 'Create invoice (document generation)', true),
  ('invoice_send', 25, 'invoices', 'Send invoice (communication)', true),
  ('invoice_export', 0, 'exports', 'Export invoices (always free)', true),

  -- ========================================================================
  -- OPERATIONS
  -- ========================================================================
  ('supplier_view', 0, 'operations', 'View suppliers (always free)', true),
  ('supplier_add', 5, 'operations', 'Add supplier (setup)', true),
  ('purchase_order_view', 0, 'operations', 'View purchase orders (always free)', true),
  ('purchase_order_create', 30, 'operations', 'Create purchase order (document)', true),
  ('purchase_order_send', 25, 'operations', 'Send purchase order (communication)', true),
  ('return_view', 0, 'operations', 'View returns (always free)', true),
  ('return_process', 15, 'operations', 'Process return', true),
  ('qc_view', 0, 'operations', 'View QC (always free)', true),
  ('qc_log_check', 10, 'operations', 'Log quality control check', true),
  ('appointment_view', 0, 'operations', 'View appointments (always free)', true),
  ('appointment_create', 10, 'operations', 'Create appointment', true),
  ('appointment_reminder', 25, 'operations', 'Send appointment reminder (communication)', true),
  ('support_ticket_create', 0, 'operations', 'Create support ticket (always free)', true),

  -- ========================================================================
  -- DELIVERY & FLEET
  -- ========================================================================
  ('delivery_view', 0, 'delivery', 'View deliveries (always free)', true),
  ('delivery_create', 30, 'delivery', 'Create delivery', true),
  ('delivery_mark_complete', 0, 'delivery', 'Mark delivery complete (free)', true),
  ('fleet_view', 0, 'delivery', 'View fleet (always free)', true),
  ('route_optimization', 1, 'delivery', 'Optimize a delivery route', true),
  ('fleet_add_vehicle', 0, 'fleet', 'Add vehicle (setup)', true),
  ('courier_view', 0, 'fleet', 'View couriers (always free)', true),
  ('courier_add', 0, 'fleet', 'Add courier (setup)', true),
  ('courier_assign_delivery', 10, 'fleet', 'Assign delivery to courier', true),
  ('route_view', 0, 'fleet', 'View routes (always free)', true),
  ('route_optimize', 50, 'fleet', 'Optimize delivery route (premium)', true),
  ('tracking_view', 0, 'fleet', 'View tracking (always free)', true),
  ('tracking_ping', 1, 'fleet', 'Location ping (high frequency)', true),
  ('tracking_send_link', 15, 'fleet', 'Send tracking link (communication)', true),

  -- ========================================================================
  -- ANALYTICS & REPORTS
  -- ========================================================================
  ('analytics_view', 0, 'analytics', 'View analytics (always free)', true),
  ('report_standard_view', 0, 'reports', 'View standard reports (always free)', true),
  ('report_custom_generate', 75, 'reports', 'Generate custom report (premium)', true),
  ('report_export', 0, 'exports', 'Export report (always free)', true),
  ('report_schedule', 50, 'reports', 'Schedule automated report', true),
  ('report_advanced_generate', 100, 'reports', 'Generate advanced report (premium)', true),
  ('commission_view', 0, 'analytics', 'View commissions (always free)', true),
  ('commission_calculate', 30, 'analytics', 'Run commission calculation', true),
  ('expense_view', 0, 'analytics', 'View expenses (always free)', true),
  ('expense_add', 5, 'analytics', 'Add expense entry', true),
  ('forecast_view', 0, 'analytics', 'View forecast (always free)', true),
  ('forecast_run', 75, 'analytics', 'Run forecast calculation (AI/compute)', true),
  ('custom_report_view', 0, 'reports', 'View custom reports (always free)', true),
  ('custom_report_run', 100, 'reports', 'Run custom report (premium)', true),
  ('data_warehouse_view', 0, 'analytics', 'View data warehouse (always free)', true),
  ('data_warehouse_query', 25, 'analytics', 'Query data warehouse (compute)', true),
  ('data_warehouse_export', 200, 'exports', 'Export from data warehouse (large export)', true),

  -- ========================================================================
  -- AI FEATURES
  -- ========================================================================
  ('ai_view', 0, 'ai', 'View AI analytics (always free)', true),
  ('ai_insight_generate', 50, 'ai', 'Generate AI insight', true),
  ('ai_task_run', 50, 'ai', 'Run AI task (compute)', true),
  ('menu_ocr', 250, 'ai', 'AI-powered menu scanning', true),
  ('ai_suggestions', 100, 'ai', 'AI product suggestions', true),

  -- ========================================================================
  -- INTEGRATIONS & API
  -- ========================================================================
  ('webhook_view', 0, 'integrations', 'View/configure webhooks (always free)', true),
  ('webhook_fired', 5, 'integrations', 'Webhook execution (API cost)', true),
  ('api_call', 5, 'api', 'External API request', true),
  ('bulk_operation_execute', 0, 'integrations', 'Bulk operation (sum of individual actions)', true),

  -- ========================================================================
  -- COMPLIANCE & SECURITY
  -- ========================================================================
  ('batch_recall_view', 0, 'compliance', 'View batch recall (always free)', true),
  ('batch_recall_initiate', 0, 'compliance', 'Initiate recall (safety - never block)', true),
  ('compliance_vault_view', 0, 'compliance', 'View compliance vault (always free)', true),
  ('compliance_vault_upload', 0, 'compliance', 'Upload document (storage)', true),
  ('compliance_report_generate', 100, 'compliance', 'Generate compliance report (premium)', true),
  ('audit_logs_view', 0, 'compliance', 'View audit logs (always free)', true),

  -- ========================================================================
  -- SETTINGS & CONFIGURATION - ALL FREE
  -- ========================================================================
  ('settings_view', 0, 'command_center', 'View/change settings (always free)', true),
  ('team_manage', 0, 'command_center', 'Manage team (always free)', true),
  ('roles_manage', 0, 'command_center', 'Manage roles (always free)', true),
  ('permissions_manage', 0, 'command_center', 'Manage permissions (always free)', true),
  ('locations_manage', 0, 'command_center', 'Manage locations (always free)', true),

  -- ========================================================================
  -- LEGACY ALIASES (for backwards compatibility)
  -- ========================================================================
  ('create_order', 50, 'orders', 'Create order (legacy alias)', true),
  ('add_product', 10, 'inventory', 'Add product (legacy alias)', true),
  ('add_customer', 5, 'customers', 'Add customer (legacy alias)', true),
  ('generate_invoice', 50, 'invoices', 'Generate invoice (legacy alias)', true),
  ('send_menu_link', 0, 'menus', 'Send menu link (legacy alias)', true),
  ('export_csv', 0, 'exports', 'Export to CSV (always free)', true),
  ('export_pdf', 0, 'exports', 'Export to PDF (always free)', true),
  ('generate_report', 75, 'reports', 'Generate report (legacy alias)', true),
  ('update_inventory', 3, 'inventory', 'Update inventory (legacy alias)', true),
  ('create_delivery_route', 50, 'fleet', 'Create delivery route (legacy alias)', true),

  -- ========================================================================
  -- NOTIFICATION-SPECIFIC KEYS (used by edge functions)
  -- ========================================================================
  ('send_push_notification', 15, 'crm', 'Send push notification', true),
  ('barcode_lookup', 1, 'inventory', 'Barcode lookup query', true)

ON CONFLICT (action_key) DO UPDATE SET
  credit_cost = EXCLUDED.credit_cost,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- Deactivate old dot-notation action keys that are no longer used
UPDATE public.credit_costs
SET is_active = false, updated_at = now()
WHERE action_key LIKE '%.%'
  AND action_key NOT IN (
    SELECT unnest(ARRAY[
      'dashboard_view', 'hotbox_view', 'live_orders_view', 'live_orders_process',
      'realtime_monitor_view', 'live_map_view', 'orders_view', 'order_create_manual'
    ])
  );
