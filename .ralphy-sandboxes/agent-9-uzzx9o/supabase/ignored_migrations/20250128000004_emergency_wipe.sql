-- Emergency wipe function
CREATE OR REPLACE FUNCTION emergency_wipe(tenant_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Log the emergency wipe event FIRST
  INSERT INTO security_events (tenant_id, event_type, details, created_at)
  VALUES (
    emergency_wipe.tenant_id,
    'emergency_wipe',
    jsonb_build_object(
      'timestamp', NOW(),
      'action', 'panic_button_activated'
    ),
    NOW()
  );

  -- Delete all sensitive data
  DELETE FROM wholesale_orders WHERE tenant_id = emergency_wipe.tenant_id;
  DELETE FROM wholesale_order_items WHERE tenant_id = emergency_wipe.tenant_id;
  DELETE FROM wholesale_clients WHERE tenant_id = emergency_wipe.tenant_id;
  DELETE FROM wholesale_inventory WHERE tenant_id = emergency_wipe.tenant_id;
  DELETE FROM wholesale_deliveries WHERE tenant_id = emergency_wipe.tenant_id;
  DELETE FROM wholesale_payments WHERE tenant_id = emergency_wipe.tenant_id;
  DELETE FROM disposable_menus WHERE tenant_id = emergency_wipe.tenant_id;
  DELETE FROM products WHERE tenant_id = emergency_wipe.tenant_id;
  DELETE FROM inventory_batches WHERE tenant_id = emergency_wipe.tenant_id;
  
  -- Suspend tenant
  UPDATE tenants 
  SET 
    status = 'suspended',
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('emergency_wipe', true, 'wiped_at', NOW())
  WHERE id = emergency_wipe.tenant_id;
  
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION emergency_wipe TO authenticated;

