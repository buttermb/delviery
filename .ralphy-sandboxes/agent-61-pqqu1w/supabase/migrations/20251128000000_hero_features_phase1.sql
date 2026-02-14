-- Phase 1: Hero Features Integration Migration

-- 1. Enhance orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'pos' CHECK (source IN ('pos', 'disposable_menu', 'wholesale', 'online')),
ADD COLUMN IF NOT EXISTS fulfillment_status TEXT DEFAULT 'pending_pickup' CHECK (fulfillment_status IN ('pending_pickup', 'in_progress', 'completed', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_orders_source ON orders(source);
CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_status ON orders(fulfillment_status);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_fulfillment ON orders(tenant_id, fulfillment_status, created_at);

-- 2. Create disposable_menu_orders table
CREATE TABLE IF NOT EXISTS disposable_menu_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_id UUID REFERENCES disposable_menus(id),
    customer_id UUID REFERENCES customers(id),
    tenant_id UUID REFERENCES tenants(id),
    items JSONB NOT NULL, -- Array of {product_id, quantity, price, name}
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
    tax DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready_for_pickup', 'in_pos', 'completed', 'cancelled')),
    pos_transaction_id UUID REFERENCES orders(id),
    customer_notes TEXT,
    pickup_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Add RLS policies for disposable_menu_orders
ALTER TABLE disposable_menu_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can view their own menu orders"
    ON disposable_menu_orders FOR ALL
    USING (tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "Customers can view their own orders"
    ON disposable_menu_orders FOR SELECT
    USING (customer_id IN (SELECT id FROM customers WHERE email = auth.email()));

-- 3. Inventory Sync Infrastructure
ALTER TABLE products
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS sync_source TEXT CHECK (sync_source IN ('pos', 'manual', 'import', 'system'));

CREATE TABLE IF NOT EXISTS inventory_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id),
    tenant_id UUID REFERENCES tenants(id),
    previous_quantity INTEGER,
    new_quantity INTEGER,
    change_amount INTEGER,
    change_source TEXT CHECK (change_source IN ('pos_sale', 'disposable_order', 'manual_adjustment', 'system_sync')),
    changed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE inventory_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can view their own sync logs"
    ON inventory_sync_log FOR SELECT
    USING (tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

-- 4. Triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_disposable_menu_orders_updated_at
    BEFORE UPDATE ON disposable_menu_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
