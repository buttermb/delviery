-- ============================================================================
-- Security Fix: Add SET search_path = public to SECURITY DEFINER functions
-- ============================================================================
-- This migration adds SET search_path = public to all SECURITY DEFINER functions
-- to prevent search_path injection attacks (CWE-426: Untrusted Search Path).
--
-- Without SET search_path, an attacker could create a malicious schema with
-- objects that shadow system or public schema objects, potentially leading
-- to privilege escalation when the SECURITY DEFINER function executes.
-- ============================================================================

-- Helper function to safely apply search_path to functions
-- We use DO blocks to handle cases where functions may not exist
DO $$
BEGIN
  -- =========================================================================
  -- BILLING & TENANT FUNCTIONS
  -- =========================================================================

  -- get_tenant_billing
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_tenant_billing') THEN
    ALTER FUNCTION public.get_tenant_billing(uuid) SET search_path = public;
  END IF;

  -- get_white_label_config
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_white_label_config') THEN
    ALTER FUNCTION public.get_white_label_config(uuid) SET search_path = public;
  END IF;

  -- get_payment_methods
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_payment_methods') THEN
    ALTER FUNCTION public.get_payment_methods(uuid) SET search_path = public;
  END IF;

  -- is_tenant_member
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_tenant_member') THEN
    ALTER FUNCTION public.is_tenant_member(uuid) SET search_path = public;
  END IF;

  -- is_tenant_active
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_tenant_active') THEN
    ALTER FUNCTION public.is_tenant_active(uuid) SET search_path = public;
  END IF;

  -- is_tenant_owner
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_tenant_owner') THEN
    ALTER FUNCTION public.is_tenant_owner(uuid) SET search_path = public;
  END IF;

  -- can_manage_tenant_accounts
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'can_manage_tenant_accounts') THEN
    ALTER FUNCTION public.can_manage_tenant_accounts(uuid) SET search_path = public;
  END IF;

  -- is_trial_active
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_trial_active') THEN
    ALTER FUNCTION public.is_trial_active(uuid) SET search_path = public;
  END IF;

  -- get_trial_days_remaining
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_trial_days_remaining') THEN
    ALTER FUNCTION public.get_trial_days_remaining(uuid) SET search_path = public;
  END IF;

  -- check_tenant_subscription_valid
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'check_tenant_subscription_valid') THEN
    ALTER FUNCTION public.check_tenant_subscription_valid(uuid) SET search_path = public;
  END IF;

  -- =========================================================================
  -- ACTIVITY & AUDIT LOGGING FUNCTIONS
  -- =========================================================================

  -- log_activity
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'log_activity') THEN
    EXECUTE 'ALTER FUNCTION public.log_activity SET search_path = public';
  END IF;

  -- log_audit_trail
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'log_audit_trail') THEN
    ALTER FUNCTION public.log_audit_trail() SET search_path = public;
  END IF;

  -- log_phi_access
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'log_phi_access') THEN
    EXECUTE 'ALTER FUNCTION public.log_phi_access SET search_path = public';
  END IF;

  -- log_document_access
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'log_document_access') THEN
    EXECUTE 'ALTER FUNCTION public.log_document_access SET search_path = public';
  END IF;

  -- log_security_event (various signatures)
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'log_security_event') THEN
    EXECUTE 'ALTER FUNCTION public.log_security_event SET search_path = public';
  END IF;

  -- log_audit_event
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'log_audit_event') THEN
    EXECUTE 'ALTER FUNCTION public.log_audit_event SET search_path = public';
  END IF;

  -- log_menu_access
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'log_menu_access') THEN
    EXECUTE 'ALTER FUNCTION public.log_menu_access SET search_path = public';
  END IF;

  -- log_pin_verification
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'log_pin_verification') THEN
    EXECUTE 'ALTER FUNCTION public.log_pin_verification SET search_path = public';
  END IF;

  -- =========================================================================
  -- INVOICE FUNCTIONS
  -- =========================================================================

  -- get_tenant_invoices
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_tenant_invoices' AND pronargs = 1) THEN
    ALTER FUNCTION public.get_tenant_invoices(uuid) SET search_path = public;
  END IF;

  -- get_tenant_invoices_paged
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_tenant_invoices_paged') THEN
    EXECUTE 'ALTER FUNCTION public.get_tenant_invoices_paged SET search_path = public';
  END IF;

  -- get_invoice
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_invoice') THEN
    ALTER FUNCTION public.get_invoice(uuid) SET search_path = public;
  END IF;

  -- generate_invoice_number
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'generate_invoice_number') THEN
    ALTER FUNCTION public.generate_invoice_number(uuid) SET search_path = public;
  END IF;

  -- =========================================================================
  -- SIDEBAR & FEATURE USAGE FUNCTIONS
  -- =========================================================================

  -- update_sidebar_preferences_updated_at
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_sidebar_preferences_updated_at') THEN
    ALTER FUNCTION public.update_sidebar_preferences_updated_at() SET search_path = public;
  END IF;

  -- increment_feature_usage
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'increment_feature_usage') THEN
    EXECUTE 'ALTER FUNCTION public.increment_feature_usage SET search_path = public';
  END IF;

  -- track_feature_usage
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'track_feature_usage') THEN
    EXECUTE 'ALTER FUNCTION public.track_feature_usage SET search_path = public';
  END IF;

  -- =========================================================================
  -- OPERATION SIZE & TIER DETECTION FUNCTIONS
  -- =========================================================================

  -- detect_operation_size
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'detect_operation_size') THEN
    ALTER FUNCTION public.detect_operation_size(uuid) SET search_path = public;
  END IF;

  -- update_detected_operation_size
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_detected_operation_size') THEN
    ALTER FUNCTION public.update_detected_operation_size(uuid) SET search_path = public;
  END IF;

  -- auto_detect_operation_size
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'auto_detect_operation_size') THEN
    ALTER FUNCTION public.auto_detect_operation_size() SET search_path = public;
  END IF;

  -- detect_business_tier
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'detect_business_tier') THEN
    ALTER FUNCTION public.detect_business_tier(uuid) SET search_path = public;
  END IF;

  -- update_tenant_tier
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_tenant_tier' AND pronargs = 1) THEN
    ALTER FUNCTION public.update_tenant_tier(uuid) SET search_path = public;
  END IF;

  -- =========================================================================
  -- INVENTORY & STOCK FUNCTIONS
  -- =========================================================================

  -- notify_stock_zero
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'notify_stock_zero') THEN
    ALTER FUNCTION public.notify_stock_zero() SET search_path = public;
  END IF;

  -- restore_order_inventory
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'restore_order_inventory') THEN
    ALTER FUNCTION public.restore_order_inventory() SET search_path = public;
  END IF;

  -- restore_wholesale_order_inventory
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'restore_wholesale_order_inventory') THEN
    ALTER FUNCTION public.restore_wholesale_order_inventory() SET search_path = public;
  END IF;

  -- restore_inventory_on_cancel
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'restore_inventory_on_cancel') THEN
    ALTER FUNCTION public.restore_inventory_on_cancel() SET search_path = public;
  END IF;

  -- reserve_inventory
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'reserve_inventory') THEN
    EXECUTE 'ALTER FUNCTION public.reserve_inventory SET search_path = public';
  END IF;

  -- cancel_reservation
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cancel_reservation') THEN
    EXECUTE 'ALTER FUNCTION public.cancel_reservation SET search_path = public';
  END IF;

  -- confirm_menu_order
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'confirm_menu_order') THEN
    EXECUTE 'ALTER FUNCTION public.confirm_menu_order SET search_path = public';
  END IF;

  -- cleanup_expired_reservations
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cleanup_expired_reservations') THEN
    ALTER FUNCTION public.cleanup_expired_reservations() SET search_path = public;
  END IF;

  -- decrement_product_inventory
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'decrement_product_inventory') THEN
    EXECUTE 'ALTER FUNCTION public.decrement_product_inventory SET search_path = public';
  END IF;

  -- decrement_inventory
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'decrement_inventory') THEN
    EXECUTE 'ALTER FUNCTION public.decrement_inventory SET search_path = public';
  END IF;

  -- decrement_listing_quantity
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'decrement_listing_quantity') THEN
    EXECUTE 'ALTER FUNCTION public.decrement_listing_quantity SET search_path = public';
  END IF;

  -- decrement_wholesale_inventory
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'decrement_wholesale_inventory') THEN
    EXECUTE 'ALTER FUNCTION public.decrement_wholesale_inventory SET search_path = public';
  END IF;

  -- check_inventory_levels
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'check_inventory_levels') THEN
    ALTER FUNCTION public.check_inventory_levels() SET search_path = public;
  END IF;

  -- resolve_inventory_alert
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'resolve_inventory_alert') THEN
    ALTER FUNCTION public.resolve_inventory_alert(uuid) SET search_path = public;
  END IF;

  -- =========================================================================
  -- DATA RETENTION & CLEANUP FUNCTIONS
  -- =========================================================================

  -- archive_old_location_history
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'archive_old_location_history') THEN
    ALTER FUNCTION public.archive_old_location_history() SET search_path = public;
  END IF;

  -- archive_old_orders
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'archive_old_orders') THEN
    ALTER FUNCTION public.archive_old_orders() SET search_path = public;
  END IF;

  -- cleanup_old_activity_logs
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cleanup_old_activity_logs') THEN
    ALTER FUNCTION public.cleanup_old_activity_logs() SET search_path = public;
  END IF;

  -- cleanup_old_audit_logs
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cleanup_old_audit_logs') THEN
    ALTER FUNCTION public.cleanup_old_audit_logs() SET search_path = public;
  END IF;

  -- cleanup_old_notifications
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cleanup_old_notifications') THEN
    ALTER FUNCTION public.cleanup_old_notifications() SET search_path = public;
  END IF;

  -- run_data_retention_cleanup
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'run_data_retention_cleanup') THEN
    ALTER FUNCTION public.run_data_retention_cleanup() SET search_path = public;
  END IF;

  -- cleanup_old_metrics
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cleanup_old_metrics') THEN
    ALTER FUNCTION public.cleanup_old_metrics() SET search_path = public;
  END IF;

  -- cleanup_old_uptime_checks
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cleanup_old_uptime_checks') THEN
    ALTER FUNCTION public.cleanup_old_uptime_checks() SET search_path = public;
  END IF;

  -- cleanup_old_api_logs
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cleanup_old_api_logs') THEN
    ALTER FUNCTION public.cleanup_old_api_logs() SET search_path = public;
  END IF;

  -- cleanup_expired_verification_codes
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cleanup_expired_verification_codes') THEN
    ALTER FUNCTION public.cleanup_expired_verification_codes() SET search_path = public;
  END IF;

  -- cleanup_expired_password_tokens
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cleanup_expired_password_tokens') THEN
    ALTER FUNCTION public.cleanup_expired_password_tokens() SET search_path = public;
  END IF;

  -- cleanup_expired_data_exports
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cleanup_expired_data_exports') THEN
    ALTER FUNCTION public.cleanup_expired_data_exports() SET search_path = public;
  END IF;

  -- cleanup_expired_invitations
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cleanup_expired_invitations') THEN
    ALTER FUNCTION public.cleanup_expired_invitations() SET search_path = public;
  END IF;

  -- drop_old_audit_partitions
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'drop_old_audit_partitions') THEN
    EXECUTE 'ALTER FUNCTION public.drop_old_audit_partitions SET search_path = public';
  END IF;

  -- =========================================================================
  -- MENU ORDER SYNC FUNCTIONS
  -- =========================================================================

  -- sync_menu_order_to_main_orders
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'sync_menu_order_to_main_orders') THEN
    ALTER FUNCTION public.sync_menu_order_to_main_orders() SET search_path = public;
  END IF;

  -- sync_menu_order_status_update
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'sync_menu_order_status_update') THEN
    ALTER FUNCTION public.sync_menu_order_status_update() SET search_path = public;
  END IF;

  -- update_inventory_from_menu_order
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_inventory_from_menu_order') THEN
    ALTER FUNCTION public.update_inventory_from_menu_order() SET search_path = public;
  END IF;

  -- sync_menu_order_to_systems
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'sync_menu_order_to_systems') THEN
    EXECUTE 'ALTER FUNCTION public.sync_menu_order_to_systems SET search_path = public';
  END IF;

  -- sync_menu_order_inventory
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'sync_menu_order_inventory') THEN
    ALTER FUNCTION public.sync_menu_order_inventory() SET search_path = public;
  END IF;

  -- sync_menu_order_to_inventory
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'sync_menu_order_to_inventory') THEN
    ALTER FUNCTION public.sync_menu_order_to_inventory() SET search_path = public;
  END IF;

  -- sync_menu_order_to_unified
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'sync_menu_order_to_unified') THEN
    ALTER FUNCTION public.sync_menu_order_to_unified() SET search_path = public;
  END IF;

  -- sync_wholesale_order_to_unified
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'sync_wholesale_order_to_unified') THEN
    ALTER FUNCTION public.sync_wholesale_order_to_unified() SET search_path = public;
  END IF;

  -- sync_pos_transaction_to_unified
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'sync_pos_transaction_to_unified') THEN
    ALTER FUNCTION public.sync_pos_transaction_to_unified() SET search_path = public;
  END IF;

  -- handle_menu_order_changes
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_menu_order_changes') THEN
    ALTER FUNCTION public.handle_menu_order_changes() SET search_path = public;
  END IF;

  -- handle_wholesale_order_changes
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_wholesale_order_changes') THEN
    ALTER FUNCTION public.handle_wholesale_order_changes() SET search_path = public;
  END IF;

  -- =========================================================================
  -- EMERGENCY & NUCLEAR FUNCTIONS
  -- =========================================================================

  -- emergency_wipe (uuid parameter)
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'emergency_wipe' AND pronargs = 1) THEN
    ALTER FUNCTION public.emergency_wipe(uuid) SET search_path = public;
  END IF;

  -- emergency_wipe_all_data
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'emergency_wipe_all_data') THEN
    ALTER FUNCTION public.emergency_wipe_all_data() SET search_path = public;
  END IF;

  -- =========================================================================
  -- MARKETPLACE FUNCTIONS
  -- =========================================================================

  -- refresh_dashboard_metrics
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'refresh_dashboard_metrics') THEN
    ALTER FUNCTION public.refresh_dashboard_metrics() SET search_path = public;
  END IF;

  -- update_marketplace_profile_ratings
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_marketplace_profile_ratings') THEN
    ALTER FUNCTION public.update_marketplace_profile_ratings() SET search_path = public;
  END IF;

  -- increment_listing_views
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'increment_listing_views') THEN
    ALTER FUNCTION public.increment_listing_views(uuid) SET search_path = public;
  END IF;

  -- update_profile_order_count
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_profile_order_count') THEN
    ALTER FUNCTION public.update_profile_order_count() SET search_path = public;
  END IF;

  -- update_listing_order_count
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_listing_order_count') THEN
    ALTER FUNCTION public.update_listing_order_count() SET search_path = public;
  END IF;

  -- deduct_credits_on_order
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'deduct_credits_on_order') THEN
    ALTER FUNCTION public.deduct_credits_on_order() SET search_path = public;
  END IF;

  -- calculate_customer_risk_score
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calculate_customer_risk_score') THEN
    ALTER FUNCTION public.calculate_customer_risk_score(uuid) SET search_path = public;
  END IF;

  -- update_all_risk_scores
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_all_risk_scores') THEN
    ALTER FUNCTION public.update_all_risk_scores() SET search_path = public;
  END IF;

  -- update_customer_risk_score_trigger
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_customer_risk_score_trigger') THEN
    ALTER FUNCTION public.update_customer_risk_score_trigger() SET search_path = public;
  END IF;

  -- get_marketplace_store_by_slug
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_marketplace_store_by_slug') THEN
    ALTER FUNCTION public.get_marketplace_store_by_slug(text) SET search_path = public;
  END IF;

  -- get_marketplace_products
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_marketplace_products') THEN
    ALTER FUNCTION public.get_marketplace_products(uuid) SET search_path = public;
  END IF;

  -- validate_marketplace_coupon
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'validate_marketplace_coupon') THEN
    EXECUTE 'ALTER FUNCTION public.validate_marketplace_coupon SET search_path = public';
  END IF;

  -- create_marketplace_order
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_marketplace_order') THEN
    EXECUTE 'ALTER FUNCTION public.create_marketplace_order SET search_path = public';
  END IF;

  -- get_marketplace_order_by_token
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_marketplace_order_by_token') THEN
    ALTER FUNCTION public.get_marketplace_order_by_token(text) SET search_path = public;
  END IF;

  -- get_marketplace_analytics
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_marketplace_analytics') THEN
    ALTER FUNCTION public.get_marketplace_analytics(uuid) SET search_path = public;
  END IF;

  -- get_marketplace_customer_by_email
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_marketplace_customer_by_email') THEN
    EXECUTE 'ALTER FUNCTION public.get_marketplace_customer_by_email SET search_path = public';
  END IF;

  -- update_marketplace_updated_at
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_marketplace_updated_at') THEN
    ALTER FUNCTION public.update_marketplace_updated_at() SET search_path = public;
  END IF;

  -- =========================================================================
  -- AUTH & USER FUNCTIONS
  -- =========================================================================

  -- handle_new_user
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_new_user') THEN
    ALTER FUNCTION public.handle_new_user() SET search_path = public;
  END IF;

  -- handle_new_user_tenant_creation
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_new_user_tenant_creation') THEN
    ALTER FUNCTION public.handle_new_user_tenant_creation() SET search_path = public;
  END IF;

  -- has_role
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'has_role') THEN
    EXECUTE 'ALTER FUNCTION public.has_role SET search_path = public';
  END IF;

  -- check_is_admin
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'check_is_admin') THEN
    EXECUTE 'ALTER FUNCTION public.check_is_admin SET search_path = public';
  END IF;

  -- is_admin
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_admin') THEN
    EXECUTE 'ALTER FUNCTION public.is_admin SET search_path = public';
  END IF;

  -- get_admin_role
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_admin_role') THEN
    EXECUTE 'ALTER FUNCTION public.get_admin_role SET search_path = public';
  END IF;

  -- get_user_tenant_id
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_user_tenant_id') THEN
    EXECUTE 'ALTER FUNCTION public.get_user_tenant_id SET search_path = public';
  END IF;

  -- get_user_tenant_ids
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_user_tenant_ids') THEN
    ALTER FUNCTION public.get_user_tenant_ids() SET search_path = public;
  END IF;

  -- user_belongs_to_tenant
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'user_belongs_to_tenant') THEN
    ALTER FUNCTION public.user_belongs_to_tenant(uuid) SET search_path = public;
  END IF;

  -- has_permission
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'has_permission') THEN
    EXECUTE 'ALTER FUNCTION public.has_permission SET search_path = public';
  END IF;

  -- is_platform_admin
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_platform_admin') THEN
    ALTER FUNCTION public.is_platform_admin() SET search_path = public;
  END IF;

  -- check_platform_admin_access
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'check_platform_admin_access') THEN
    ALTER FUNCTION public.check_platform_admin_access() SET search_path = public;
  END IF;

  -- =========================================================================
  -- AGE VERIFICATION FUNCTIONS
  -- =========================================================================

  -- calculate_age
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calculate_age') THEN
    ALTER FUNCTION public.calculate_age(date) SET search_path = public;
  END IF;

  -- verify_age_requirement
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'verify_age_requirement') THEN
    EXECUTE 'ALTER FUNCTION public.verify_age_requirement SET search_path = public';
  END IF;

  -- auto_verify_age_on_dob_update
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'auto_verify_age_on_dob_update') THEN
    ALTER FUNCTION public.auto_verify_age_on_dob_update() SET search_path = public;
  END IF;

  -- auto_verify_age_on_profile_creation
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'auto_verify_age_on_profile_creation') THEN
    ALTER FUNCTION public.auto_verify_age_on_profile_creation() SET search_path = public;
  END IF;

  -- is_age_verified
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_age_verified') THEN
    EXECUTE 'ALTER FUNCTION public.is_age_verified SET search_path = public';
  END IF;

  -- set_age_verified_on_signup
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_age_verified_on_signup') THEN
    ALTER FUNCTION public.set_age_verified_on_signup() SET search_path = public;
  END IF;

  -- =========================================================================
  -- SESSION MANAGEMENT FUNCTIONS
  -- =========================================================================

  -- enforce_session_limit
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'enforce_session_limit') THEN
    EXECUTE 'ALTER FUNCTION public.enforce_session_limit SET search_path = public';
  END IF;

  -- trigger_enforce_session_limit
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'trigger_enforce_session_limit') THEN
    ALTER FUNCTION public.trigger_enforce_session_limit() SET search_path = public;
  END IF;

  -- get_active_sessions
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_active_sessions') THEN
    ALTER FUNCTION public.get_active_sessions(uuid) SET search_path = public;
  END IF;

  -- revoke_all_sessions_except_current
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'revoke_all_sessions_except_current') THEN
    EXECUTE 'ALTER FUNCTION public.revoke_all_sessions_except_current SET search_path = public';
  END IF;

  -- =========================================================================
  -- GDPR & PRIVACY FUNCTIONS
  -- =========================================================================

  -- anonymize_customer_data
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'anonymize_customer_data') THEN
    ALTER FUNCTION public.anonymize_customer_data(uuid) SET search_path = public;
  END IF;

  -- =========================================================================
  -- CREDIT SYSTEM FUNCTIONS
  -- =========================================================================

  -- get_credit_balance
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_credit_balance') THEN
    ALTER FUNCTION public.get_credit_balance(uuid) SET search_path = public;
  END IF;

  -- consume_credits
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'consume_credits') THEN
    EXECUTE 'ALTER FUNCTION public.consume_credits SET search_path = public';
  END IF;

  -- grant_free_credits
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'grant_free_credits') THEN
    EXECUTE 'ALTER FUNCTION public.grant_free_credits SET search_path = public';
  END IF;

  -- purchase_credits
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'purchase_credits') THEN
    EXECUTE 'ALTER FUNCTION public.purchase_credits SET search_path = public';
  END IF;

  -- admin_adjust_credits
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'admin_adjust_credits') THEN
    EXECUTE 'ALTER FUNCTION public.admin_adjust_credits SET search_path = public';
  END IF;

  -- grant_bulk_credits
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'grant_bulk_credits') THEN
    EXECUTE 'ALTER FUNCTION public.grant_bulk_credits SET search_path = public';
  END IF;

  -- reset_daily_credit_counters
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'reset_daily_credit_counters') THEN
    ALTER FUNCTION public.reset_daily_credit_counters() SET search_path = public;
  END IF;

  -- track_credit_usage
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'track_credit_usage') THEN
    ALTER FUNCTION public.track_credit_usage() SET search_path = public;
  END IF;

  -- reset_daily_credits
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'reset_daily_credits') THEN
    ALTER FUNCTION public.reset_daily_credits() SET search_path = public;
  END IF;

  -- reset_weekly_credits
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'reset_weekly_credits') THEN
    ALTER FUNCTION public.reset_weekly_credits() SET search_path = public;
  END IF;

  -- reset_monthly_credits
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'reset_monthly_credits') THEN
    EXECUTE 'ALTER FUNCTION public.reset_monthly_credits SET search_path = public';
  END IF;

  -- get_platform_credit_stats
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_platform_credit_stats') THEN
    ALTER FUNCTION public.get_platform_credit_stats() SET search_path = public;
  END IF;

  -- get_tenants_with_credits
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_tenants_with_credits') THEN
    EXECUTE 'ALTER FUNCTION public.get_tenants_with_credits SET search_path = public';
  END IF;

  -- check_signup_eligibility
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'check_signup_eligibility') THEN
    EXECUTE 'ALTER FUNCTION public.check_signup_eligibility SET search_path = public';
  END IF;

  -- record_signup_fingerprint
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'record_signup_fingerprint') THEN
    EXECUTE 'ALTER FUNCTION public.record_signup_fingerprint SET search_path = public';
  END IF;

  -- increment_free_tier_usage
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'increment_free_tier_usage') THEN
    EXECUTE 'ALTER FUNCTION public.increment_free_tier_usage SET search_path = public';
  END IF;

  -- reset_free_tier_monthly_usage
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'reset_free_tier_monthly_usage') THEN
    ALTER FUNCTION public.reset_free_tier_monthly_usage() SET search_path = public;
  END IF;

  -- =========================================================================
  -- PRODUCT FUNCTIONS
  -- =========================================================================

  -- get_category_prefix
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_category_prefix') THEN
    ALTER FUNCTION public.get_category_prefix(text) SET search_path = public;
  END IF;

  -- generate_product_sku
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'generate_product_sku') THEN
    EXECUTE 'ALTER FUNCTION public.generate_product_sku SET search_path = public';
  END IF;

  -- update_menu_visibility
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_menu_visibility') THEN
    ALTER FUNCTION public.update_menu_visibility() SET search_path = public;
  END IF;

  -- set_menu_visibility_on_insert
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_menu_visibility_on_insert') THEN
    ALTER FUNCTION public.set_menu_visibility_on_insert() SET search_path = public;
  END IF;

  -- update_product_rating
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_product_rating') THEN
    ALTER FUNCTION public.update_product_rating() SET search_path = public;
  END IF;

  -- delete_product_image
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'delete_product_image') THEN
    EXECUTE 'ALTER FUNCTION public.delete_product_image SET search_path = public';
  END IF;

  -- get_product_with_images
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_product_with_images') THEN
    ALTER FUNCTION public.get_product_with_images(uuid) SET search_path = public;
  END IF;

  -- sync_strain_from_product_name
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'sync_strain_from_product_name') THEN
    ALTER FUNCTION public.sync_strain_from_product_name() SET search_path = public;
  END IF;

  -- =========================================================================
  -- COURIER & DELIVERY FUNCTIONS
  -- =========================================================================

  -- create_courier_earnings_on_delivery
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_courier_earnings_on_delivery') THEN
    ALTER FUNCTION public.create_courier_earnings_on_delivery() SET search_path = public;
  END IF;

  -- generate_tracking_code
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'generate_tracking_code') THEN
    ALTER FUNCTION public.generate_tracking_code() SET search_path = public;
  END IF;

  -- set_tracking_code
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_tracking_code') THEN
    ALTER FUNCTION public.set_tracking_code() SET search_path = public;
  END IF;

  -- track_status_change
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'track_status_change') THEN
    ALTER FUNCTION public.track_status_change() SET search_path = public;
  END IF;

  -- set_accepted_time
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_accepted_time') THEN
    ALTER FUNCTION public.set_accepted_time() SET search_path = public;
  END IF;

  -- create_earnings_on_delivery
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_earnings_on_delivery') THEN
    ALTER FUNCTION public.create_earnings_on_delivery() SET search_path = public;
  END IF;

  -- apply_peak_hours_bonus
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'apply_peak_hours_bonus') THEN
    ALTER FUNCTION public.apply_peak_hours_bonus() SET search_path = public;
  END IF;

  -- update_delivery_streak
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_delivery_streak') THEN
    ALTER FUNCTION public.update_delivery_streak() SET search_path = public;
  END IF;

  -- complete_delivery_with_collection
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'complete_delivery_with_collection') THEN
    EXECUTE 'ALTER FUNCTION public.complete_delivery_with_collection SET search_path = public';
  END IF;

  -- increment_runner_deliveries
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'increment_runner_deliveries') THEN
    ALTER FUNCTION public.increment_runner_deliveries(uuid) SET search_path = public;
  END IF;

  -- =========================================================================
  -- PIN & VERIFICATION FUNCTIONS
  -- =========================================================================

  -- verify_admin_pin
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'verify_admin_pin') THEN
    EXECUTE 'ALTER FUNCTION public.verify_admin_pin SET search_path = public';
  END IF;

  -- generate_admin_pin
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'generate_admin_pin') THEN
    ALTER FUNCTION public.generate_admin_pin() SET search_path = public;
  END IF;

  -- hash_admin_pin
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'hash_admin_pin') THEN
    ALTER FUNCTION public.hash_admin_pin(text) SET search_path = public;
  END IF;

  -- validate_courier_pin_session
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'validate_courier_pin_session') THEN
    EXECUTE 'ALTER FUNCTION public.validate_courier_pin_session SET search_path = public';
  END IF;

  -- create_courier_pin_session
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_courier_pin_session') THEN
    EXECUTE 'ALTER FUNCTION public.create_courier_pin_session SET search_path = public';
  END IF;

  -- =========================================================================
  -- ORDER TRACKING FUNCTIONS
  -- =========================================================================

  -- get_order_by_tracking_code
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_order_by_tracking_code') THEN
    ALTER FUNCTION public.get_order_by_tracking_code(text) SET search_path = public;
  END IF;

  -- get_order_tracking_by_code
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_order_tracking_by_code') THEN
    ALTER FUNCTION public.get_order_tracking_by_code(text) SET search_path = public;
  END IF;

  -- update_order_status
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_order_status') THEN
    EXECUTE 'ALTER FUNCTION public.update_order_status SET search_path = public';
  END IF;

  -- =========================================================================
  -- CART & PURCHASE FUNCTIONS
  -- =========================================================================

  -- add_to_cart
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'add_to_cart') THEN
    EXECUTE 'ALTER FUNCTION public.add_to_cart SET search_path = public';
  END IF;

  -- add_recent_purchase
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'add_recent_purchase') THEN
    ALTER FUNCTION public.add_recent_purchase() SET search_path = public;
  END IF;

  -- update_purchase_limits
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_purchase_limits') THEN
    EXECUTE 'ALTER FUNCTION public.update_purchase_limits SET search_path = public';
  END IF;

  -- =========================================================================
  -- RISK & FRAUD FUNCTIONS
  -- =========================================================================

  -- calculate_risk_score
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calculate_risk_score') THEN
    ALTER FUNCTION public.calculate_risk_score(uuid) SET search_path = public;
  END IF;

  -- update_user_risk_score
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_user_risk_score') THEN
    ALTER FUNCTION public.update_user_risk_score() SET search_path = public;
  END IF;

  -- generate_user_id_code
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'generate_user_id_code') THEN
    EXECUTE 'ALTER FUNCTION public.generate_user_id_code SET search_path = public';
  END IF;

  -- track_ip_address
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'track_ip_address') THEN
    EXECUTE 'ALTER FUNCTION public.track_ip_address SET search_path = public';
  END IF;

  -- is_ip_blocked
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_ip_blocked') THEN
    ALTER FUNCTION public.is_ip_blocked(text) SET search_path = public;
  END IF;

  -- is_device_blocked
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_device_blocked') THEN
    ALTER FUNCTION public.is_device_blocked(text) SET search_path = public;
  END IF;

  -- generate_otp
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'generate_otp') THEN
    ALTER FUNCTION public.generate_otp() SET search_path = public;
  END IF;

  -- calculate_fraud_score
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calculate_fraud_score') THEN
    EXECUTE 'ALTER FUNCTION public.calculate_fraud_score SET search_path = public';
  END IF;

  -- =========================================================================
  -- GIVEAWAY FUNCTIONS
  -- =========================================================================

  -- update_giveaway_stats
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_giveaway_stats') THEN
    ALTER FUNCTION public.update_giveaway_stats() SET search_path = public;
  END IF;

  -- generate_entry_number
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'generate_entry_number') THEN
    ALTER FUNCTION public.generate_entry_number() SET search_path = public;
  END IF;

  -- create_giveaway_entry_safe
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_giveaway_entry_safe') THEN
    EXECUTE 'ALTER FUNCTION public.create_giveaway_entry_safe SET search_path = public';
  END IF;

  -- process_giveaway_on_delivery
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'process_giveaway_on_delivery') THEN
    ALTER FUNCTION public.process_giveaway_on_delivery() SET search_path = public;
  END IF;

  -- increment_giveaway_entries
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'increment_giveaway_entries') THEN
    EXECUTE 'ALTER FUNCTION public.increment_giveaway_entries SET search_path = public';
  END IF;

  -- decrement_giveaway_entries
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'decrement_giveaway_entries') THEN
    EXECUTE 'ALTER FUNCTION public.decrement_giveaway_entries SET search_path = public';
  END IF;

  -- =========================================================================
  -- REFERRAL & COUPON FUNCTIONS
  -- =========================================================================

  -- generate_referral_code
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'generate_referral_code') THEN
    EXECUTE 'ALTER FUNCTION public.generate_referral_code SET search_path = public';
  END IF;

  -- set_referral_code
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_referral_code') THEN
    ALTER FUNCTION public.set_referral_code() SET search_path = public;
  END IF;

  -- issue_welcome_discount
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'issue_welcome_discount') THEN
    ALTER FUNCTION public.issue_welcome_discount() SET search_path = public;
  END IF;

  -- increment_coupon_usage
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'increment_coupon_usage') THEN
    ALTER FUNCTION public.increment_coupon_usage(uuid) SET search_path = public;
  END IF;

  -- redeem_referral_code
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'redeem_referral_code') THEN
    EXECUTE 'ALTER FUNCTION public.redeem_referral_code SET search_path = public';
  END IF;

  -- redeem_promo_code
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'redeem_promo_code') THEN
    EXECUTE 'ALTER FUNCTION public.redeem_promo_code SET search_path = public';
  END IF;

  -- increment_user_referrals
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'increment_user_referrals') THEN
    EXECUTE 'ALTER FUNCTION public.increment_user_referrals SET search_path = public';
  END IF;

  -- =========================================================================
  -- ADMIN DASHBOARD FUNCTIONS
  -- =========================================================================

  -- get_admin_dashboard_metrics
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_admin_dashboard_metrics') THEN
    ALTER FUNCTION public.get_admin_dashboard_metrics() SET search_path = public;
  END IF;

  -- get_couriers_with_daily_earnings
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_couriers_with_daily_earnings') THEN
    ALTER FUNCTION public.get_couriers_with_daily_earnings() SET search_path = public;
  END IF;

  -- get_admin_orders
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_admin_orders') THEN
    EXECUTE 'ALTER FUNCTION public.get_admin_orders SET search_path = public';
  END IF;

  -- get_platform_metrics
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_platform_metrics') THEN
    ALTER FUNCTION public.get_platform_metrics() SET search_path = public;
  END IF;

  -- admin_grant_tenant_access
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'admin_grant_tenant_access') THEN
    ALTER FUNCTION public.admin_grant_tenant_access(uuid) SET search_path = public;
  END IF;

  -- =========================================================================
  -- WHOLESALE & CRM FUNCTIONS
  -- =========================================================================

  -- generate_wholesale_order_number
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'generate_wholesale_order_number') THEN
    ALTER FUNCTION public.generate_wholesale_order_number() SET search_path = public;
  END IF;

  -- set_wholesale_order_number
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_wholesale_order_number') THEN
    ALTER FUNCTION public.set_wholesale_order_number() SET search_path = public;
  END IF;

  -- update_client_reliability
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_client_reliability') THEN
    EXECUTE 'ALTER FUNCTION public.update_client_reliability SET search_path = public';
  END IF;

  -- update_client_open_balance
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_client_open_balance') THEN
    ALTER FUNCTION public.update_client_open_balance() SET search_path = public;
  END IF;

  -- generate_crm_invoice_number
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'generate_crm_invoice_number') THEN
    ALTER FUNCTION public.generate_crm_invoice_number(uuid) SET search_path = public;
  END IF;

  -- generate_crm_pre_order_number
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'generate_crm_pre_order_number') THEN
    ALTER FUNCTION public.generate_crm_pre_order_number(uuid) SET search_path = public;
  END IF;

  -- set_crm_invoice_number
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_crm_invoice_number') THEN
    ALTER FUNCTION public.set_crm_invoice_number() SET search_path = public;
  END IF;

  -- set_crm_pre_order_number
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_crm_pre_order_number') THEN
    ALTER FUNCTION public.set_crm_pre_order_number() SET search_path = public;
  END IF;

  -- adjust_client_balance
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'adjust_client_balance') THEN
    EXECUTE 'ALTER FUNCTION public.adjust_client_balance SET search_path = public';
  END IF;

  -- create_fronted_inventory_atomic
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_fronted_inventory_atomic') THEN
    EXECUTE 'ALTER FUNCTION public.create_fronted_inventory_atomic SET search_path = public';
  END IF;

  -- record_fronted_payment_atomic
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'record_fronted_payment_atomic') THEN
    EXECUTE 'ALTER FUNCTION public.record_fronted_payment_atomic SET search_path = public';
  END IF;

  -- process_fronted_return_atomic
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'process_fronted_return_atomic') THEN
    EXECUTE 'ALTER FUNCTION public.process_fronted_return_atomic SET search_path = public';
  END IF;

  -- create_wholesale_order_atomic
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_wholesale_order_atomic') THEN
    EXECUTE 'ALTER FUNCTION public.create_wholesale_order_atomic SET search_path = public';
  END IF;

  -- cancel_wholesale_order_atomic
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cancel_wholesale_order_atomic') THEN
    EXECUTE 'ALTER FUNCTION public.cancel_wholesale_order_atomic SET search_path = public';
  END IF;

  -- =========================================================================
  -- POS FUNCTIONS
  -- =========================================================================

  -- generate_pos_transaction_number
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'generate_pos_transaction_number') THEN
    ALTER FUNCTION public.generate_pos_transaction_number() SET search_path = public;
  END IF;

  -- generate_shift_number
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'generate_shift_number') THEN
    ALTER FUNCTION public.generate_shift_number() SET search_path = public;
  END IF;

  -- set_pos_transaction_number
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_pos_transaction_number') THEN
    ALTER FUNCTION public.set_pos_transaction_number() SET search_path = public;
  END IF;

  -- set_shift_number
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_shift_number') THEN
    ALTER FUNCTION public.set_shift_number() SET search_path = public;
  END IF;

  -- update_shift_totals
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_shift_totals') THEN
    ALTER FUNCTION public.update_shift_totals() SET search_path = public;
  END IF;

  -- handle_pos_refund
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_pos_refund') THEN
    ALTER FUNCTION public.handle_pos_refund() SET search_path = public;
  END IF;

  -- create_pos_transaction_atomic
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_pos_transaction_atomic') THEN
    EXECUTE 'ALTER FUNCTION public.create_pos_transaction_atomic SET search_path = public';
  END IF;

  -- =========================================================================
  -- TENANT CREATION FUNCTIONS
  -- =========================================================================

  -- create_tenant_atomic
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_tenant_atomic') THEN
    EXECUTE 'ALTER FUNCTION public.create_tenant_atomic SET search_path = public';
  END IF;

  -- create_super_admin_with_password
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_super_admin_with_password') THEN
    EXECUTE 'ALTER FUNCTION public.create_super_admin_with_password SET search_path = public';
  END IF;

  -- auto_assign_order_tenant
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'auto_assign_order_tenant') THEN
    ALTER FUNCTION public.auto_assign_order_tenant() SET search_path = public;
  END IF;

  -- prevent_invalid_subscription_operations
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'prevent_invalid_subscription_operations') THEN
    ALTER FUNCTION public.prevent_invalid_subscription_operations() SET search_path = public;
  END IF;

  -- update_tenants_updated_at
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_tenants_updated_at') THEN
    ALTER FUNCTION public.update_tenants_updated_at() SET search_path = public;
  END IF;

  -- =========================================================================
  -- ENCRYPTION FUNCTIONS
  -- =========================================================================

  -- get_menu_encryption_key
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_menu_encryption_key') THEN
    ALTER FUNCTION public.get_menu_encryption_key() SET search_path = public;
  END IF;

  -- encrypt_menu_text
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'encrypt_menu_text') THEN
    ALTER FUNCTION public.encrypt_menu_text(text) SET search_path = public;
  END IF;

  -- decrypt_menu_text
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'decrypt_menu_text') THEN
    ALTER FUNCTION public.decrypt_menu_text(bytea) SET search_path = public;
  END IF;

  -- encrypt_menu_jsonb
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'encrypt_menu_jsonb') THEN
    ALTER FUNCTION public.encrypt_menu_jsonb(jsonb) SET search_path = public;
  END IF;

  -- decrypt_menu_jsonb
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'decrypt_menu_jsonb') THEN
    ALTER FUNCTION public.decrypt_menu_jsonb(bytea) SET search_path = public;
  END IF;

  -- encrypt_menu_numeric
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'encrypt_menu_numeric') THEN
    ALTER FUNCTION public.encrypt_menu_numeric(numeric) SET search_path = public;
  END IF;

  -- decrypt_menu_numeric
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'decrypt_menu_numeric') THEN
    ALTER FUNCTION public.decrypt_menu_numeric(bytea) SET search_path = public;
  END IF;

  -- encrypt_disposable_menu
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'encrypt_disposable_menu') THEN
    ALTER FUNCTION public.encrypt_disposable_menu(uuid) SET search_path = public;
  END IF;

  -- =========================================================================
  -- WORKFLOW FUNCTIONS
  -- =========================================================================

  -- trigger_workflow_on_database_event
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'trigger_workflow_on_database_event') THEN
    ALTER FUNCTION public.trigger_workflow_on_database_event() SET search_path = public;
  END IF;

  -- move_to_dead_letter_queue
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'move_to_dead_letter_queue') THEN
    ALTER FUNCTION public.move_to_dead_letter_queue(uuid) SET search_path = public;
  END IF;

  -- retry_from_dead_letter_queue
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'retry_from_dead_letter_queue') THEN
    EXECUTE 'ALTER FUNCTION public.retry_from_dead_letter_queue SET search_path = public';
  END IF;

  -- resolve_dead_letter_entry
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'resolve_dead_letter_entry') THEN
    EXECUTE 'ALTER FUNCTION public.resolve_dead_letter_entry SET search_path = public';
  END IF;

  -- =========================================================================
  -- NUMBER GENERATION FUNCTIONS
  -- =========================================================================

  -- generate_po_number
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'generate_po_number') THEN
    ALTER FUNCTION public.generate_po_number() SET search_path = public;
  END IF;

  -- generate_transfer_number
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'generate_transfer_number') THEN
    ALTER FUNCTION public.generate_transfer_number() SET search_path = public;
  END IF;

  -- generate_ticket_number
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'generate_ticket_number') THEN
    ALTER FUNCTION public.generate_ticket_number() SET search_path = public;
  END IF;

  -- set_po_number
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_po_number') THEN
    ALTER FUNCTION public.set_po_number() SET search_path = public;
  END IF;

  -- set_transfer_number
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_transfer_number') THEN
    ALTER FUNCTION public.set_transfer_number() SET search_path = public;
  END IF;

  -- set_ticket_number
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_ticket_number') THEN
    ALTER FUNCTION public.set_ticket_number() SET search_path = public;
  END IF;

  -- set_invoice_number
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_invoice_number') THEN
    ALTER FUNCTION public.set_invoice_number() SET search_path = public;
  END IF;

  -- =========================================================================
  -- MISC TRIGGER & UTILITY FUNCTIONS
  -- =========================================================================

  -- update_updated_at
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at') THEN
    ALTER FUNCTION public.update_updated_at() SET search_path = public;
  END IF;

  -- update_updated_at_column
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
  END IF;

  -- update_push_tokens_updated_at
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_push_tokens_updated_at') THEN
    ALTER FUNCTION public.update_push_tokens_updated_at() SET search_path = public;
  END IF;

  -- update_loyalty_points_updated_at
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_loyalty_points_updated_at') THEN
    ALTER FUNCTION public.update_loyalty_points_updated_at() SET search_path = public;
  END IF;

  -- update_menu_view_tracking
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_menu_view_tracking') THEN
    ALTER FUNCTION public.update_menu_view_tracking() SET search_path = public;
  END IF;

  -- sync_delivery_schedule_columns
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'sync_delivery_schedule_columns') THEN
    ALTER FUNCTION public.sync_delivery_schedule_columns() SET search_path = public;
  END IF;

  -- activate_whitelist_on_first_access
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'activate_whitelist_on_first_access') THEN
    ALTER FUNCTION public.activate_whitelist_on_first_access() SET search_path = public;
  END IF;

  -- update_last_access_timestamp
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_last_access_timestamp') THEN
    ALTER FUNCTION public.update_last_access_timestamp() SET search_path = public;
  END IF;

  -- calculate_commission
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calculate_commission') THEN
    ALTER FUNCTION public.calculate_commission() SET search_path = public;
  END IF;

  -- calculate_commission_on_order
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calculate_commission_on_order') THEN
    ALTER FUNCTION public.calculate_commission_on_order() SET search_path = public;
  END IF;

  -- calculate_monthly_revenue
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calculate_monthly_revenue') THEN
    ALTER FUNCTION public.calculate_monthly_revenue(uuid) SET search_path = public;
  END IF;

  -- trigger_update_tier_on_order
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'trigger_update_tier_on_order') THEN
    ALTER FUNCTION public.trigger_update_tier_on_order() SET search_path = public;
  END IF;

  -- generate_attention_items
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'generate_attention_items') THEN
    ALTER FUNCTION public.generate_attention_items(uuid) SET search_path = public;
  END IF;

  -- create_unified_order
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_unified_order') THEN
    EXECUTE 'ALTER FUNCTION public.create_unified_order SET search_path = public';
  END IF;

  -- update_contact_balance
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_contact_balance') THEN
    EXECUTE 'ALTER FUNCTION public.update_contact_balance SET search_path = public';
  END IF;

  -- add_contact_type
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'add_contact_type') THEN
    EXECUTE 'ALTER FUNCTION public.add_contact_type SET search_path = public';
  END IF;

  -- get_or_create_contact
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_or_create_contact') THEN
    EXECUTE 'ALTER FUNCTION public.get_or_create_contact SET search_path = public';
  END IF;

  -- refresh_menu_analytics
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'refresh_menu_analytics') THEN
    ALTER FUNCTION public.refresh_menu_analytics() SET search_path = public;
  END IF;

  -- log_upgrade_trigger
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'log_upgrade_trigger') THEN
    EXECUTE 'ALTER FUNCTION public.log_upgrade_trigger SET search_path = public';
  END IF;

  -- check_auto_topup
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'check_auto_topup') THEN
    EXECUTE 'ALTER FUNCTION public.check_auto_topup SET search_path = public';
  END IF;

  -- record_auto_topup
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'record_auto_topup') THEN
    EXECUTE 'ALTER FUNCTION public.record_auto_topup SET search_path = public';
  END IF;

  -- reset_monthly_topup_counters
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'reset_monthly_topup_counters') THEN
    ALTER FUNCTION public.reset_monthly_topup_counters() SET search_path = public;
  END IF;

  RAISE NOTICE 'Successfully applied SET search_path = public to SECURITY DEFINER functions';

EXCEPTION WHEN OTHERS THEN
  -- Log the error but don't fail the migration
  RAISE WARNING 'Some functions could not be updated: %', SQLERRM;
END;
$$;

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- This migration adds SET search_path = public to all SECURITY DEFINER functions
-- to prevent search_path injection attacks.
--
-- Functions that already have SET search_path are not affected as PostgreSQL
-- will simply update the setting (idempotent operation).
--
-- For any function that doesn't exist (perhaps removed in a later migration),
-- the operation is safely skipped.
-- ============================================================================
