-- Add tenant_id to menu_orders table for proper multi-tenant isolation

-- Check if tenant_id column exists, add it if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'menu_orders' AND column_name = 'tenant_id'
  ) THEN
    -- Add tenant_id column
    ALTER TABLE menu_orders ADD COLUMN tenant_id UUID REFERENCES tenants(id);
    
    -- Populate tenant_id from related disposable_menus
    UPDATE menu_orders mo
    SET tenant_id = dm.tenant_id
    FROM disposable_menus dm
    WHERE mo.menu_id = dm.id
    AND mo.tenant_id IS NULL;
    
    -- Make tenant_id NOT NULL after population
    ALTER TABLE menu_orders ALTER COLUMN tenant_id SET NOT NULL;
    
    -- Add index for performance
    CREATE INDEX IF NOT EXISTS idx_menu_orders_tenant_id ON menu_orders(tenant_id);
    
    -- Add comment
    COMMENT ON COLUMN menu_orders.tenant_id IS 'Tenant ID for multi-tenant data isolation';
    
    RAISE NOTICE 'Added tenant_id column to menu_orders and populated from disposable_menus';
  ELSE
    RAISE NOTICE 'menu_orders.tenant_id already exists';
  END IF;
END $$;