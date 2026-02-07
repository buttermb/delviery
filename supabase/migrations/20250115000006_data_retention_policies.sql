-- ============================================
-- DATA RETENTION POLICIES
-- Implements GDPR-compliant data retention
-- ============================================

-- Function to archive old location history (30 days)
CREATE OR REPLACE FUNCTION public.archive_old_location_history()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete location history older than 30 days
  DELETE FROM courier_location_history
  WHERE created_at < NOW() - INTERVAL '30 days';
  
  DELETE FROM runner_location_history
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$;

-- Function to archive old orders (keep summary, anonymize details after 7 years)
CREATE OR REPLACE FUNCTION public.archive_old_orders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Anonymize order details older than 7 years (keep for tax/legal)
  UPDATE orders
  SET
    customer_name = 'Archived Customer',
    customer_phone = NULL,
    delivery_address = '[ARCHIVED]',
    delivery_borough = NULL,
    customer_lat = NULL,
    customer_lng = NULL,
    customer_location_enabled = false
  WHERE created_at < NOW() - INTERVAL '7 years'
    AND customer_name != 'Archived Customer';
  
  -- Anonymize order items (remove product details)
  UPDATE order_items
  SET
    product_name = '[ARCHIVED PRODUCT]',
    price = 0
  WHERE order_id IN (
    SELECT id FROM orders
    WHERE created_at < NOW() - INTERVAL '7 years'
      AND customer_name = 'Archived Customer'
  )
    AND product_name != '[ARCHIVED PRODUCT]';
END;
$$;

-- Function to clean up old activity logs (1 year)
CREATE OR REPLACE FUNCTION public.cleanup_old_activity_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete activity logs older than 1 year (non-critical)
  DELETE FROM activity_logs
  WHERE created_at < NOW() - INTERVAL '1 year'
    AND action NOT IN (
      'order_created',
      'order_completed',
      'payment_received',
      'subscription_created',
      'subscription_updated'
    );
END;
$$;

-- Function to clean up old audit logs (7 years for compliance)
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete audit logs older than 7 years
  DELETE FROM audit_logs
  WHERE timestamp < NOW() - INTERVAL '7 years';
  
  DELETE FROM audit_trail
  WHERE created_at < NOW() - INTERVAL '7 years';
END;
$$;

-- Function to clean up old notifications (90 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete read notifications older than 90 days
  DELETE FROM notifications
  WHERE read_at IS NOT NULL
    AND read_at < NOW() - INTERVAL '90 days';
  
  -- Delete unread notifications older than 180 days
  DELETE FROM notifications
  WHERE read_at IS NULL
    AND created_at < NOW() - INTERVAL '180 days';
END;
$$;

-- Master cleanup function (runs all cleanup tasks)
CREATE OR REPLACE FUNCTION public.run_data_retention_cleanup()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb := '{}'::jsonb;
BEGIN
  -- Run all cleanup functions
  BEGIN
    PERFORM archive_old_location_history();
    result := result || jsonb_build_object('location_history', 'archived');
  EXCEPTION WHEN OTHERS THEN
    result := result || jsonb_build_object('location_history', 'error: ' || SQLERRM);
  END;
  
  BEGIN
    PERFORM archive_old_orders();
    result := result || jsonb_build_object('orders', 'archived');
  EXCEPTION WHEN OTHERS THEN
    result := result || jsonb_build_object('orders', 'error: ' || SQLERRM);
  END;
  
  BEGIN
    PERFORM cleanup_old_activity_logs();
    result := result || jsonb_build_object('activity_logs', 'cleaned');
  EXCEPTION WHEN OTHERS THEN
    result := result || jsonb_build_object('activity_logs', 'error: ' || SQLERRM);
  END;
  
  BEGIN
    PERFORM cleanup_old_audit_logs();
    result := result || jsonb_build_object('audit_logs', 'cleaned');
  EXCEPTION WHEN OTHERS THEN
    result := result || jsonb_build_object('audit_logs', 'error: ' || SQLERRM);
  END;
  
  BEGIN
    PERFORM cleanup_old_notifications();
    result := result || jsonb_build_object('notifications', 'cleaned');
  EXCEPTION WHEN OTHERS THEN
    result := result || jsonb_build_object('notifications', 'error: ' || SQLERRM);
  END;
  
  result := result || jsonb_build_object('cleanup_date', NOW());
  
  RETURN result;
END;
$$;

-- Add comments
COMMENT ON FUNCTION public.archive_old_location_history IS 'Archives location history older than 30 days';
COMMENT ON FUNCTION public.archive_old_orders IS 'Anonymizes order details older than 7 years (keeps for tax/legal)';
COMMENT ON FUNCTION public.cleanup_old_activity_logs IS 'Deletes non-critical activity logs older than 1 year';
COMMENT ON FUNCTION public.cleanup_old_audit_logs IS 'Deletes audit logs older than 7 years';
COMMENT ON FUNCTION public.cleanup_old_notifications IS 'Deletes old notifications (read: 90 days, unread: 180 days)';
COMMENT ON FUNCTION public.run_data_retention_cleanup IS 'Master function to run all data retention cleanup tasks';

-- Note: Schedule these functions to run via pg_cron or external cron job
-- Example pg_cron schedule:
-- SELECT cron.schedule('cleanup-location-history', '0 2 * * *', 'SELECT archive_old_location_history()');
-- SELECT cron.schedule('cleanup-orders', '0 3 * * 0', 'SELECT archive_old_orders()');
-- SELECT cron.schedule('cleanup-activity-logs', '0 4 * * *', 'SELECT cleanup_old_activity_logs()');
-- SELECT cron.schedule('cleanup-audit-logs', '0 5 * * 0', 'SELECT cleanup_old_audit_logs()');
-- SELECT cron.schedule('cleanup-notifications', '0 6 * * *', 'SELECT cleanup_old_notifications()');

