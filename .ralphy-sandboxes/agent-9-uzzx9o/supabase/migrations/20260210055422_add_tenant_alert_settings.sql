-- Add alert_settings column to tenants table for configuring email digests and notifications
-- This migration supports the low-stock-email-digest edge function

-- Add alert_settings JSONB column to tenants
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'tenants'
        AND column_name = 'alert_settings'
    ) THEN
        ALTER TABLE public.tenants
        ADD COLUMN alert_settings JSONB DEFAULT '{
            "email_digest_enabled": true,
            "digest_recipients": [],
            "low_stock_threshold_override": null,
            "digest_schedule": "daily",
            "digest_time": "08:00"
        }'::jsonb;

        COMMENT ON COLUMN public.tenants.alert_settings IS 'JSON configuration for alert and digest settings. Includes email_digest_enabled, digest_recipients, low_stock_threshold_override, digest_schedule, digest_time';

        RAISE NOTICE 'Added alert_settings column to tenants';
    ELSE
        RAISE NOTICE 'tenants.alert_settings already exists';
    END IF;
END $$;

-- Create index for querying tenants with email digests enabled
CREATE INDEX IF NOT EXISTS idx_tenants_alert_settings_digest
ON public.tenants USING GIN (alert_settings);

-- Add tenant_id to inventory_alerts table if missing (needed for tenant-scoped alerts)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'inventory_alerts'
        AND column_name = 'tenant_id'
    ) THEN
        ALTER TABLE public.inventory_alerts
        ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

        CREATE INDEX IF NOT EXISTS idx_inventory_alerts_tenant
        ON public.inventory_alerts(tenant_id);

        RAISE NOTICE 'Added tenant_id to inventory_alerts';
    ELSE
        RAISE NOTICE 'inventory_alerts.tenant_id already exists';
    END IF;
END $$;

-- Update RLS policy for inventory_alerts to include tenant filtering
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON inventory_alerts;
DROP POLICY IF EXISTS "Tenant users can read inventory alerts" ON inventory_alerts;

CREATE POLICY "Tenant users can read inventory alerts" ON inventory_alerts
    FOR SELECT USING (
        auth.role() = 'authenticated'
        AND (
            tenant_id IS NULL
            OR tenant_id IN (
                SELECT tenant_id FROM public.tenant_users
                WHERE user_id = auth.uid()
            )
        )
    );

-- Function to get low stock products for a tenant (used by edge function and dashboard)
CREATE OR REPLACE FUNCTION get_low_stock_products(p_tenant_id UUID, p_limit INT DEFAULT 50)
RETURNS TABLE (
    id UUID,
    product_name TEXT,
    sku TEXT,
    current_quantity NUMERIC,
    reorder_point NUMERIC,
    days_below_threshold INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        wi.id,
        wi.product_name,
        wi.sku,
        wi.quantity_lbs as current_quantity,
        wi.reorder_point,
        EXTRACT(DAY FROM (NOW() - wi.updated_at))::INT as days_below_threshold
    FROM wholesale_inventory wi
    WHERE wi.tenant_id = p_tenant_id
    AND wi.is_active = true
    AND wi.reorder_point > 0
    AND wi.quantity_lbs <= wi.reorder_point
    ORDER BY
        CASE WHEN wi.quantity_lbs <= 0 THEN 0 ELSE 1 END,
        wi.quantity_lbs / NULLIF(wi.reorder_point, 0)
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_low_stock_products(UUID, INT) TO authenticated;
