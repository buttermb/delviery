-- Quick Win Features Migration
-- 1. Cart Rounding
-- 2. Product Effects
-- 3. Potency Limit Alerts
-- 4. Customer Visit Tracking (first/returning)

-- 1. Add cart rounding setting to stores
ALTER TABLE marketplace_stores
ADD COLUMN IF NOT EXISTS enable_cart_rounding BOOLEAN DEFAULT false;

-- 2. Add product effects array to marketplace_listings
ALTER TABLE marketplace_listings
ADD COLUMN IF NOT EXISTS effects TEXT[] DEFAULT '{}';

-- 3. Add potency limit to stores for import alerts
ALTER TABLE marketplace_stores
ADD COLUMN IF NOT EXISTS potency_limit_thc NUMERIC(5,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS potency_limit_cbd NUMERIC(5,2) DEFAULT NULL;

-- 4. Add customer tracking columns
ALTER TABLE marketplace_customers
ADD COLUMN IF NOT EXISTS first_order_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS order_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_returning BOOLEAN GENERATED ALWAYS AS (order_count > 1) STORED;

-- 5. Add first-time discount fields to deals
ALTER TABLE marketplace_deals
ADD COLUMN IF NOT EXISTS first_time_only BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS max_uses_per_customer INTEGER DEFAULT NULL;

-- 6. Track deal usage per customer
CREATE TABLE IF NOT EXISTS marketplace_deal_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID NOT NULL REFERENCES marketplace_deals(id) ON DELETE CASCADE,
    customer_email TEXT NOT NULL,
    store_id UUID NOT NULL REFERENCES marketplace_stores(id) ON DELETE CASCADE,
    used_at TIMESTAMPTZ DEFAULT NOW(),
    order_id UUID,
    UNIQUE(deal_id, customer_email, order_id)
);

CREATE INDEX IF NOT EXISTS idx_deal_usage_customer ON marketplace_deal_usage(customer_email, deal_id);

-- 7. Function to update customer stats after order
CREATE OR REPLACE FUNCTION update_marketplace_customer_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Update or insert customer record
    INSERT INTO marketplace_customers (store_id, email, first_order_at, order_count)
    VALUES (NEW.store_id, NEW.customer_email, NOW(), 1)
    ON CONFLICT (store_id, email) DO UPDATE SET
        order_count = marketplace_customers.order_count + 1,
        last_order_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on order creation
DROP TRIGGER IF EXISTS trg_update_customer_stats ON marketplace_orders;
CREATE TRIGGER trg_update_customer_stats
    AFTER INSERT ON marketplace_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_marketplace_customer_stats();
