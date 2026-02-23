-- Function to update tenant usage counts
CREATE OR REPLACE FUNCTION update_tenant_usage()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant_id UUID;
  v_products_count INT;
  v_customers_count INT;
  v_menus_count INT;
  v_users_count INT;
BEGIN
  -- Determine tenant_id from the operation
  v_tenant_id := COALESCE(NEW.tenant_id, OLD.tenant_id);
  
  IF v_tenant_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Count products
  SELECT COUNT(*) INTO v_products_count
  FROM products
  WHERE tenant_id = v_tenant_id;
  
  -- Count customers
  SELECT COUNT(*) INTO v_customers_count
  FROM customers
  WHERE tenant_id = v_tenant_id;
  
  -- Count disposable menus
  SELECT COUNT(*) INTO v_menus_count
  FROM disposable_menus
  WHERE tenant_id = v_tenant_id;
  
  -- Count tenant users
  SELECT COUNT(*) INTO v_users_count
  FROM tenant_users
  WHERE tenant_id = v_tenant_id
    AND status = 'active';
  
  -- Update the tenant usage
  UPDATE tenants
  SET 
    usage = jsonb_build_object(
      'products', v_products_count,
      'customers', v_customers_count,
      'menus', v_menus_count,
      'users', v_users_count,
      'locations', COALESCE((usage->>'locations')::int, 0)
    ),
    updated_at = NOW()
  WHERE id = v_tenant_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Triggers for products table
DROP TRIGGER IF EXISTS update_tenant_usage_on_product_insert ON products;
CREATE TRIGGER update_tenant_usage_on_product_insert
  AFTER INSERT ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_tenant_usage();

DROP TRIGGER IF EXISTS update_tenant_usage_on_product_delete ON products;
CREATE TRIGGER update_tenant_usage_on_product_delete
  AFTER DELETE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_tenant_usage();

-- Triggers for customers table
DROP TRIGGER IF EXISTS update_tenant_usage_on_customer_insert ON customers;
CREATE TRIGGER update_tenant_usage_on_customer_insert
  AFTER INSERT ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_tenant_usage();

DROP TRIGGER IF EXISTS update_tenant_usage_on_customer_delete ON customers;
CREATE TRIGGER update_tenant_usage_on_customer_delete
  AFTER DELETE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_tenant_usage();

-- Triggers for disposable_menus table
DROP TRIGGER IF EXISTS update_tenant_usage_on_menu_insert ON disposable_menus;
CREATE TRIGGER update_tenant_usage_on_menu_insert
  AFTER INSERT ON disposable_menus
  FOR EACH ROW
  EXECUTE FUNCTION update_tenant_usage();

DROP TRIGGER IF EXISTS update_tenant_usage_on_menu_delete ON disposable_menus;
CREATE TRIGGER update_tenant_usage_on_menu_delete
  AFTER DELETE ON disposable_menus
  FOR EACH ROW
  EXECUTE FUNCTION update_tenant_usage();

-- Triggers for tenant_users table
DROP TRIGGER IF EXISTS update_tenant_usage_on_user_insert ON tenant_users;
CREATE TRIGGER update_tenant_usage_on_user_insert
  AFTER INSERT ON tenant_users
  FOR EACH ROW
  EXECUTE FUNCTION update_tenant_usage();

DROP TRIGGER IF EXISTS update_tenant_usage_on_user_delete ON tenant_users;
CREATE TRIGGER update_tenant_usage_on_user_delete
  AFTER DELETE ON tenant_users
  FOR EACH ROW
  EXECUTE FUNCTION update_tenant_usage();

DROP TRIGGER IF EXISTS update_tenant_usage_on_user_update ON tenant_users;
CREATE TRIGGER update_tenant_usage_on_user_update
  AFTER UPDATE OF status ON tenant_users
  FOR EACH ROW
  EXECUTE FUNCTION update_tenant_usage();

-- Sync existing usage data for all tenants
DO $$
DECLARE
  tenant_record RECORD;
  v_products_count INT;
  v_customers_count INT;
  v_menus_count INT;
  v_users_count INT;
BEGIN
  FOR tenant_record IN SELECT id FROM tenants LOOP
    -- Count products
    SELECT COUNT(*) INTO v_products_count
    FROM products
    WHERE tenant_id = tenant_record.id;
    
    -- Count customers
    SELECT COUNT(*) INTO v_customers_count
    FROM customers
    WHERE tenant_id = tenant_record.id;
    
    -- Count disposable menus
    SELECT COUNT(*) INTO v_menus_count
    FROM disposable_menus
    WHERE tenant_id = tenant_record.id;
    
    -- Count tenant users
    SELECT COUNT(*) INTO v_users_count
    FROM tenant_users
    WHERE tenant_id = tenant_record.id
      AND status = 'active';
    
    -- Update the tenant usage
    UPDATE tenants
    SET 
      usage = jsonb_build_object(
        'products', v_products_count,
        'customers', v_customers_count,
        'menus', v_menus_count,
        'users', v_users_count,
        'locations', COALESCE((usage->>'locations')::int, 0)
      ),
      updated_at = NOW()
    WHERE id = tenant_record.id;
  END LOOP;
END $$;