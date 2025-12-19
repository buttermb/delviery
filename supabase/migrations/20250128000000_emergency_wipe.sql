-- Emergency Wipe Function
-- Allows tenants to quickly wipe all their data in emergency situations
-- Used by panic button feature

CREATE OR REPLACE FUNCTION emergency_wipe(tenant_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete all tenant data from core tables
  DELETE FROM wholesale_orders WHERE tenant_id = emergency_wipe.tenant_id;
  DELETE FROM wholesale_clients WHERE tenant_id = emergency_wipe.tenant_id;
  DELETE FROM wholesale_inventory WHERE tenant_id = emergency_wipe.tenant_id;
  DELETE FROM wholesale_deliveries WHERE tenant_id = emergency_wipe.tenant_id;
  DELETE FROM disposable_menus WHERE tenant_id = emergency_wipe.tenant_id;
  DELETE FROM products WHERE tenant_id = emergency_wipe.tenant_id;
  DELETE FROM orders WHERE tenant_id = emergency_wipe.tenant_id;
  DELETE FROM order_items WHERE tenant_id = emergency_wipe.tenant_id;
  DELETE FROM customers WHERE tenant_id = emergency_wipe.tenant_id;
  DELETE FROM wholesale_runners WHERE tenant_id = emergency_wipe.tenant_id;
  
  -- Delete from other tenant-scoped tables if they exist
  DELETE FROM commission_transactions WHERE tenant_id = emergency_wipe.tenant_id;
  DELETE FROM inventory_transfers WHERE tenant_id = emergency_wipe.tenant_id;
  DELETE FROM stock_alerts WHERE tenant_id = emergency_wipe.tenant_id;
  DELETE FROM activity_logs WHERE tenant_id = emergency_wipe.tenant_id;
  DELETE FROM notification_templates WHERE tenant_id = emergency_wipe.tenant_id;
  DELETE FROM automation_rules WHERE tenant_id = emergency_wipe.tenant_id;
  DELETE FROM webhooks WHERE tenant_id = emergency_wipe.tenant_id;
  DELETE FROM custom_reports WHERE tenant_id = emergency_wipe.tenant_id;
  DELETE FROM api_keys WHERE tenant_id = emergency_wipe.tenant_id;
  
  -- Log the security event (if security_events table exists)
  BEGIN
    INSERT INTO security_events (tenant_id, event_type, details, created_at)
    VALUES (
      emergency_wipe.tenant_id,
      'emergency_wipe',
      jsonb_build_object(
        'triggered_by', 'panic_button',
        'timestamp', NOW()
      ),
      NOW()
    );
  EXCEPTION
    WHEN undefined_table THEN
      -- Table doesn't exist, skip logging
      NULL;
  END;
  
  -- Disable tenant account
  UPDATE tenants 
  SET 
    status = 'suspended',
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('emergency_wipe', 'true', 'wipe_timestamp', NOW()::text)
  WHERE id = emergency_wipe.tenant_id;
  
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION emergency_wipe(UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION emergency_wipe IS 'Emergency data wipe function for panic button feature. Wipes all tenant data and suspends account.';

