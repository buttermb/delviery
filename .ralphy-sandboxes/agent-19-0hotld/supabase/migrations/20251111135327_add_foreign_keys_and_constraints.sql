-- ============================================================================
-- COMPREHENSIVE FOREIGN KEYS, UNIQUE CONSTRAINTS, AND CHECK CONSTRAINTS
-- ============================================================================
-- This migration adds all missing database constraints for data integrity
-- Handles existing data gracefully - only adds constraints if they don't exist
-- ============================================================================

-- ============================================================================
-- HELPER FUNCTION: Check if constraint exists
-- ============================================================================
CREATE OR REPLACE FUNCTION check_constraint_exists(
  p_constraint_name TEXT,
  p_table_name TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = p_constraint_name
    AND table_schema = 'public'
    AND (p_table_name IS NULL OR table_name = p_table_name)
  );
END;
$$;

-- ============================================================================
-- CORE TENANT RELATIONSHIPS
-- ============================================================================

-- accounts → tenants
DO $$
BEGIN
  IF NOT check_check_constraint_exists('fk_accounts_tenant', 'accounts') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'tenant_id') THEN
      ALTER TABLE accounts 
        ADD CONSTRAINT fk_accounts_tenant 
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- tenant_users → tenants (should already exist, but ensure it does)
DO $$
BEGIN
  IF NOT check_constraint_exists('fk_tenant_users_tenant', 'tenant_users') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_users' AND column_name = 'tenant_id') THEN
      ALTER TABLE tenant_users 
        ADD CONSTRAINT fk_tenant_users_tenant 
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- tenant_users → auth.users
DO $$
BEGIN
  IF NOT check_constraint_exists('fk_tenant_users_user', 'tenant_users') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_users' AND column_name = 'user_id') THEN
      ALTER TABLE tenant_users 
        ADD CONSTRAINT fk_tenant_users_user 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- customer_users → tenants
DO $$
BEGIN
  IF NOT check_constraint_exists('fk_customer_users_tenant', 'customer_users') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_users' AND column_name = 'tenant_id') THEN
      ALTER TABLE customer_users 
        ADD CONSTRAINT fk_customer_users_tenant 
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- ============================================================================
-- ORDER RELATIONSHIPS
-- ============================================================================

-- orders → tenants
DO $$
BEGIN
  IF NOT check_constraint_exists('fk_orders_tenant', 'orders') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'tenant_id') THEN
      ALTER TABLE orders 
        ADD CONSTRAINT fk_orders_tenant 
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
    END IF;
  END IF;
END $$;

-- orders → users (customer)
DO $$
BEGIN
  IF NOT check_constraint_exists('fk_orders_user', 'orders') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'user_id') THEN
      ALTER TABLE orders 
        ADD CONSTRAINT fk_orders_user 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- orders → customers (if customer_id exists)
DO $$
BEGIN
  IF NOT check_constraint_exists('fk_orders_customer', 'orders') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'customer_id') THEN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customers') THEN
        ALTER TABLE orders 
          ADD CONSTRAINT fk_orders_customer 
          FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;
      END IF;
    END IF;
  END IF;
END $$;

-- orders → couriers
DO $$
BEGIN
  IF NOT check_constraint_exists('fk_orders_courier', 'orders') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'courier_id') THEN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'couriers') THEN
        ALTER TABLE orders 
          ADD CONSTRAINT fk_orders_courier 
          FOREIGN KEY (courier_id) REFERENCES couriers(id) ON DELETE SET NULL;
      END IF;
    END IF;
  END IF;
END $$;

-- orders → accounts (if account_id exists)
DO $$
BEGIN
  IF NOT check_constraint_exists('fk_orders_account', 'orders') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'account_id') THEN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'accounts') THEN
        ALTER TABLE orders 
          ADD CONSTRAINT fk_orders_account 
          FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT;
      END IF;
    END IF;
  END IF;
END $$;

-- order_items → orders
DO $$
BEGIN
  IF NOT check_constraint_exists('fk_order_items_order', 'order_items') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'order_id') THEN
      ALTER TABLE order_items 
        ADD CONSTRAINT fk_order_items_order 
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- order_items → products
DO $$
BEGIN
  IF NOT check_constraint_exists('fk_order_items_product', 'order_items') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'product_id') THEN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') THEN
        ALTER TABLE order_items 
          ADD CONSTRAINT fk_order_items_product 
          FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;
      END IF;
    END IF;
  END IF;
END $$;

-- ============================================================================
-- PRODUCT/INVENTORY RELATIONSHIPS
-- ============================================================================

-- products → tenants
DO $$
BEGIN
  IF NOT check_constraint_exists('fk_products_tenant', 'products') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'tenant_id') THEN
      ALTER TABLE products 
        ADD CONSTRAINT fk_products_tenant 
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- products → categories (if category_id exists)
DO $$
BEGIN
  IF NOT check_constraint_exists('fk_products_category', 'products') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'category_id') THEN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'categories') THEN
        ALTER TABLE products 
          ADD CONSTRAINT fk_products_category 
          FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;
      END IF;
    END IF;
  END IF;
END $$;

-- inventory_batches → products
DO $$
BEGIN
  IF NOT check_constraint_exists('fk_inventory_batches_product', 'inventory_batches') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_batches' AND column_name = 'product_id') THEN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_batches') THEN
        ALTER TABLE inventory_batches 
          ADD CONSTRAINT fk_inventory_batches_product 
          FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
      END IF;
    END IF;
  END IF;
END $$;

-- inventory_batches → tenants
DO $$
BEGIN
  IF NOT check_constraint_exists('fk_inventory_batches_tenant', 'inventory_batches') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_batches' AND column_name = 'tenant_id') THEN
      ALTER TABLE inventory_batches 
        ADD CONSTRAINT fk_inventory_batches_tenant 
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- categories → tenants
DO $$
BEGIN
  IF NOT check_constraint_exists('fk_categories_tenant', 'categories') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'categories' AND column_name = 'tenant_id') THEN
      ALTER TABLE categories 
        ADD CONSTRAINT fk_categories_tenant 
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- ============================================================================
-- WHOLESALE RELATIONSHIPS
-- ============================================================================

-- wholesale_orders → wholesale_clients
DO $$
BEGIN
  IF NOT check_constraint_exists('fk_wholesale_orders_client', 'wholesale_orders') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wholesale_orders' AND column_name = 'client_id') THEN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'wholesale_clients') THEN
        ALTER TABLE wholesale_orders 
          ADD CONSTRAINT fk_wholesale_orders_client 
          FOREIGN KEY (client_id) REFERENCES wholesale_clients(id) ON DELETE RESTRICT;
      END IF;
    END IF;
  END IF;
END $$;

-- wholesale_orders → tenants
DO $$
BEGIN
  IF NOT check_constraint_exists('fk_wholesale_orders_tenant', 'wholesale_orders') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wholesale_orders' AND column_name = 'tenant_id') THEN
      ALTER TABLE wholesale_orders 
        ADD CONSTRAINT fk_wholesale_orders_tenant 
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- wholesale_clients → tenants
DO $$
BEGIN
  IF NOT check_constraint_exists('fk_wholesale_clients_tenant', 'wholesale_clients') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wholesale_clients' AND column_name = 'tenant_id') THEN
      ALTER TABLE wholesale_clients 
        ADD CONSTRAINT fk_wholesale_clients_tenant 
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- wholesale_order_items → wholesale_orders
DO $$
BEGIN
  IF NOT check_constraint_exists('fk_wholesale_order_items_order', 'wholesale_order_items') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wholesale_order_items' AND column_name = 'order_id') THEN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'wholesale_order_items') THEN
        ALTER TABLE wholesale_order_items 
          ADD CONSTRAINT fk_wholesale_order_items_order 
          FOREIGN KEY (order_id) REFERENCES wholesale_orders(id) ON DELETE CASCADE;
      END IF;
    END IF;
  END IF;
END $$;

-- ============================================================================
-- DELIVERY/COURIER RELATIONSHIPS
-- ============================================================================

-- deliveries → orders
DO $$
BEGIN
  IF NOT check_constraint_exists('fk_deliveries_order', 'deliveries') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deliveries' AND column_name = 'order_id') THEN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'deliveries') THEN
        ALTER TABLE deliveries 
          ADD CONSTRAINT fk_deliveries_order 
          FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
      END IF;
    END IF;
  END IF;
END $$;

-- deliveries → couriers
DO $$
BEGIN
  IF NOT check_constraint_exists('fk_deliveries_courier', 'deliveries') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deliveries' AND column_name = 'courier_id') THEN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'deliveries') THEN
        ALTER TABLE deliveries 
          ADD CONSTRAINT fk_deliveries_courier 
          FOREIGN KEY (courier_id) REFERENCES couriers(id) ON DELETE SET NULL;
      END IF;
    END IF;
  END IF;
END $$;

-- deliveries → tenants
DO $$
BEGIN
  IF NOT check_constraint_exists('fk_deliveries_tenant', 'deliveries') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deliveries' AND column_name = 'tenant_id') THEN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'deliveries') THEN
        ALTER TABLE deliveries 
          ADD CONSTRAINT fk_deliveries_tenant 
          FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
      END IF;
    END IF;
  END IF;
END $$;

-- couriers → tenants
DO $$
BEGIN
  IF NOT check_constraint_exists('fk_couriers_tenant', 'couriers') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'couriers' AND column_name = 'tenant_id') THEN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'couriers') THEN
        ALTER TABLE couriers 
          ADD CONSTRAINT fk_couriers_tenant 
          FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
      END IF;
    END IF;
  END IF;
END $$;

-- ============================================================================
-- MENU RELATIONSHIPS
-- ============================================================================

-- disposable_menus → tenants
DO $$
BEGIN
  IF NOT check_constraint_exists('fk_disposable_menus_tenant', 'disposable_menus') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'disposable_menus' AND column_name = 'tenant_id') THEN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'disposable_menus') THEN
        ALTER TABLE disposable_menus 
          ADD CONSTRAINT fk_disposable_menus_tenant 
          FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
      END IF;
    END IF;
  END IF;
END $$;

-- menu_products → disposable_menus
DO $$
BEGIN
  IF NOT check_constraint_exists('fk_menu_products_menu', 'menu_products') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'menu_products' AND column_name = 'menu_id') THEN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'menu_products') THEN
        ALTER TABLE menu_products 
          ADD CONSTRAINT fk_menu_products_menu 
          FOREIGN KEY (menu_id) REFERENCES disposable_menus(id) ON DELETE CASCADE;
      END IF;
    END IF;
  END IF;
END $$;

-- menu_products → products
DO $$
BEGIN
  IF NOT check_constraint_exists('fk_menu_products_product', 'menu_products') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'menu_products' AND column_name = 'product_id') THEN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'menu_products') THEN
        ALTER TABLE menu_products 
          ADD CONSTRAINT fk_menu_products_product 
          FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
      END IF;
    END IF;
  END IF;
END $$;

-- ============================================================================
-- CUSTOMER RELATIONSHIPS
-- ============================================================================

-- customers → accounts
DO $$
BEGIN
  IF NOT check_constraint_exists('fk_customers_account', 'customers') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'account_id') THEN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'accounts') THEN
        ALTER TABLE customers 
          ADD CONSTRAINT fk_customers_account 
          FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;
      END IF;
    END IF;
  END IF;
END $$;

-- customers → tenants
DO $$
BEGIN
  IF NOT check_constraint_exists('fk_customers_tenant', 'customers') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'tenant_id') THEN
      ALTER TABLE customers 
        ADD CONSTRAINT fk_customers_tenant 
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- ============================================================================
-- UNIQUE CONSTRAINTS
-- ============================================================================

-- tenants.slug (should already exist, but ensure it does)
DO $$
BEGIN
  IF NOT check_constraint_exists('tenants_slug_key', 'tenants') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'slug') THEN
      ALTER TABLE tenants ADD CONSTRAINT uq_tenants_slug UNIQUE (slug);
    END IF;
  END IF;
END $$;

-- tenant_users (tenant_id, email) - should already exist
DO $$
BEGIN
  IF NOT check_constraint_exists('tenant_users_tenant_id_email_key', 'tenant_users') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_users' AND column_name = 'email') THEN
      ALTER TABLE tenant_users ADD CONSTRAINT uq_tenant_users_email_tenant UNIQUE (tenant_id, email);
    END IF;
  END IF;
END $$;

-- customer_users (tenant_id, email)
DO $$
BEGIN
  IF NOT check_constraint_exists('customer_users_tenant_id_email_key', 'customer_users') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_users' AND column_name = 'email') THEN
      ALTER TABLE customer_users ADD CONSTRAINT uq_customer_users_email_tenant UNIQUE (tenant_id, email);
    END IF;
  END IF;
END $$;

-- orders.order_number (if exists)
DO $$
BEGIN
  IF NOT check_constraint_exists('uq_orders_order_number', 'orders') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'order_number') THEN
      ALTER TABLE orders ADD CONSTRAINT uq_orders_order_number UNIQUE (order_number);
    END IF;
  END IF;
END $$;

-- orders.tracking_code (if exists)
DO $$
BEGIN
  IF NOT check_constraint_exists('uq_orders_tracking_code', 'orders') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'tracking_code') THEN
      ALTER TABLE orders ADD CONSTRAINT uq_orders_tracking_code UNIQUE (tracking_code);
    END IF;
  END IF;
END $$;

-- wholesale_orders.order_number (should already exist, but ensure)
DO $$
BEGIN
  IF NOT check_constraint_exists('wholesale_orders_order_number_key', 'wholesale_orders') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wholesale_orders' AND column_name = 'order_number') THEN
      ALTER TABLE wholesale_orders ADD CONSTRAINT uq_wholesale_orders_order_number UNIQUE (order_number);
    END IF;
  END IF;
END $$;

-- ============================================================================
-- CHECK CONSTRAINTS FOR ENUMS
-- ============================================================================

-- tenant_users.role
DO $$
BEGIN
  IF NOT check_constraint_exists('tenant_users_role_check', 'tenant_users') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_users' AND column_name = 'role') THEN
      ALTER TABLE tenant_users 
        ADD CONSTRAINT chk_tenant_users_role 
        CHECK (role IN ('owner', 'admin', 'member', 'viewer', 'team_member'));
    END IF;
  END IF;
END $$;

-- tenant_users.status
DO $$
BEGIN
  IF NOT check_constraint_exists('tenant_users_status_check', 'tenant_users') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_users' AND column_name = 'status') THEN
      ALTER TABLE tenant_users 
        ADD CONSTRAINT chk_tenant_users_status 
        CHECK (status IN ('pending', 'active', 'suspended', 'deleted'));
    END IF;
  END IF;
END $$;

-- tenants.subscription_plan
DO $$
BEGIN
  IF NOT check_constraint_exists('tenants_subscription_plan_check', 'tenants') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'subscription_plan') THEN
      ALTER TABLE tenants 
        ADD CONSTRAINT chk_tenants_subscription_plan 
        CHECK (subscription_plan IN ('starter', 'professional', 'enterprise'));
    END IF;
  END IF;
END $$;

-- tenants.subscription_status
DO $$
BEGIN
  IF NOT check_constraint_exists('tenants_subscription_status_check', 'tenants') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'subscription_status') THEN
      ALTER TABLE tenants 
        ADD CONSTRAINT chk_tenants_subscription_status 
        CHECK (subscription_status IN ('trial', 'trialing', 'active', 'past_due', 'cancelled', 'suspended'));
    END IF;
  END IF;
END $$;

-- orders.status (if exists)
DO $$
BEGIN
  IF NOT check_constraint_exists('orders_status_check', 'orders') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'status') THEN
      ALTER TABLE orders 
        ADD CONSTRAINT chk_orders_status 
        CHECK (status IN ('pending', 'accepted', 'preparing', 'out_for_delivery', 'delivered', 'cancelled', 'refunded'));
    END IF;
  END IF;
END $$;

-- ============================================================================
-- TENANT INVITATIONS RELATIONSHIPS
-- ============================================================================

-- tenant_invitations → tenants
DO $$
BEGIN
  IF NOT check_constraint_exists('fk_tenant_invitations_tenant', 'tenant_invitations') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_invitations' AND column_name = 'tenant_id') THEN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenant_invitations') THEN
        ALTER TABLE tenant_invitations 
          ADD CONSTRAINT fk_tenant_invitations_tenant 
          FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
      END IF;
    END IF;
  END IF;
END $$;

-- tenant_invitations → tenant_users (invited_by)
DO $$
BEGIN
  IF NOT check_constraint_exists('fk_tenant_invitations_invited_by', 'tenant_invitations') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_invitations' AND column_name = 'invited_by') THEN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenant_invitations') THEN
        ALTER TABLE tenant_invitations 
          ADD CONSTRAINT fk_tenant_invitations_invited_by 
          FOREIGN KEY (invited_by) REFERENCES tenant_users(id) ON DELETE SET NULL;
      END IF;
    END IF;
  END IF;
END $$;

-- tenant_invitations unique constraint (tenant_id, email, token)
DO $$
BEGIN
  IF NOT check_constraint_exists('uq_tenant_invitations_token', 'tenant_invitations') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_invitations' AND column_name = 'token') THEN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenant_invitations') THEN
        ALTER TABLE tenant_invitations ADD CONSTRAINT uq_tenant_invitations_token UNIQUE (token);
      END IF;
    END IF;
  END IF;
END $$;

-- ============================================================================
-- CLEANUP: Drop helper function
-- ============================================================================
DROP FUNCTION IF EXISTS check_constraint_exists(TEXT, TEXT);

-- ============================================================================
-- VERIFICATION: Log summary
-- ============================================================================
DO $$
DECLARE
  fk_count INTEGER;
  uq_count INTEGER;
  chk_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO fk_count
  FROM information_schema.table_constraints
  WHERE constraint_type = 'FOREIGN KEY'
  AND table_schema = 'public';
  
  SELECT COUNT(*) INTO uq_count
  FROM information_schema.table_constraints
  WHERE constraint_type = 'UNIQUE'
  AND table_schema = 'public';
  
  SELECT COUNT(*) INTO chk_count
  FROM information_schema.table_constraints
  WHERE constraint_type = 'CHECK'
  AND table_schema = 'public';
  
  RAISE NOTICE 'Migration complete. Foreign Keys: %, Unique Constraints: %, Check Constraints: %', fk_count, uq_count, chk_count;
END $$;

